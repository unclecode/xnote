const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');

// Data directory
const dataDir = path.join(os.homedir(), '.xnote');
const dataFile = path.join(dataDir, 'data.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let genAI = null;

// Default system prompt for AI
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant helping to draft and refine notes. Return ONLY the requested content wrapped in <result></result> XML tags. No explanations, greetings, or commentary. Just the content.`;

// Load data from file
function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
  return {};
}

// Save data to file
function saveData(data) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

function createWindow() {
  const data = loadData();
  const bounds = data.windowBounds || { width: 800, height: 600 };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    show: false,
    transparent: false,
    resizable: true,
    skipTaskbar: true,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Make window appear on all workspaces/desktops
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Save window position on move/resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMinimized()) {
      const data = loadData();
      data.windowBounds = mainWindow.getBounds();
      saveData(data);
    }
  });

  mainWindow.on('move', () => {
    const data = loadData();
    data.windowBounds = mainWindow.getBounds();
    saveData(data);
  });

  // Hide instead of close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    // Don't show on startup, wait for shortcut
  });
}

function createTray() {
  // Create a simple tray icon (will be replaced with proper icon)
  const iconPath = path.join(__dirname, 'assets', 'trayIconTemplate.png');
  
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a simple fallback icon
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('xnote');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => toggleWindow()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  
  // Left click to toggle
  tray.on('click', () => {
    toggleWindow();
  });
}

function toggleWindow() {
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
    app.focus({ steal: true });
  }
}

function registerShortcuts() {
  // Check accessibility permissions on macOS
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!trusted) {
      // Prompt for permissions
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  }

  // Register global shortcut: Cmd+Ctrl+Shift+N
  const registered = globalShortcut.register('CommandOrControl+Shift+Control+N', () => {
    toggleWindow();
  });

  if (!registered) {
    console.error('Global shortcut registration failed');
  }
}

// IPC handlers for data persistence
ipcMain.handle('get-data', (event, key) => {
  const data = loadData();
  return key ? data[key] : data;
});

ipcMain.handle('set-data', (event, key, value) => {
  const data = loadData();
  data[key] = value;
  saveData(data);
  return true;
});

ipcMain.handle('get-all-data', () => {
  return loadData();
});

ipcMain.handle('set-all-data', (event, newData) => {
  saveData(newData);
  return true;
});

// Window controls
ipcMain.on('window-hide', () => {
  mainWindow.hide();
});

ipcMain.on('window-close', () => {
  mainWindow.hide();
});

ipcMain.on('app-quit', () => {
  isQuitting = true;
  app.quit();
});

// AI-related functions
function initializeGeminiClient(apiKey) {
  if (!apiKey) {
    genAI = null;
    return;
  }
  try {
    genAI = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('Error initializing Gemini client:', error);
    genAI = null;
  }
}

// AI IPC handlers
ipcMain.handle('ai-generate-content', async (event, content, model, images = []) => {
  if (!genAI) {
    return { success: false, error: 'AI not configured. Please set API key in settings.' };
  }

  try {
    const data = loadData();
    const systemPrompt = data.aiSettings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const enableSearch = data.aiSettings?.enableSearch !== false;
    const isImageModel = model === 'models/gemini-3-pro-image-preview';

    // Prepare parts for the request
    const parts = [{ text: `${systemPrompt}\n\nCurrent note:\n${content}` }];

    // Add images if provided
    if (images && images.length > 0) {
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data
          }
        });
      }
    }

    // Build request config
    const requestConfig = {
      model: model,
      contents: [{
        role: 'user',
        parts: parts
      }]
    };

    // Add special config for image model
    if (isImageModel) {
      requestConfig.config = {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: { imageSize: '1K' }
      };
      if (enableSearch) {
        requestConfig.config.tools = [{ googleSearch: {} }];
      }
    } else if (enableSearch) {
      requestConfig.config = {
        tools: [{ googleSearch: {} }]
      };
    }

    // Generate content with streaming
    const response = await genAI.models.generateContentStream(requestConfig);

    // Stream response back to renderer
    let fullText = '';
    let imageData = null;

    for await (const chunk of response) {
      // Handle text chunks
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        event.sender.send('ai-content-chunk', chunkText);
      }

      // Handle image chunks
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        imageData = {
          mimeType: inlineData.mimeType,
          data: inlineData.data
        };
        event.sender.send('ai-image-chunk', imageData);
      }
    }

    // Extract content from <result> tags for text
    const match = fullText.match(/<result>([\s\S]*?)<\/result>/);
    const extracted = match ? match[1].trim() : fullText;

    return {
      success: true,
      content: extracted,
      image: imageData
    };

  } catch (error) {
    console.error('AI generation error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-save-settings', async (event, settings) => {
  try {
    const data = loadData();
    data.aiSettings = settings;
    saveData(data);

    // Re-initialize client with new API key
    initializeGeminiClient(settings.apiKey);

    return { success: true };
  } catch (error) {
    console.error('Error saving AI settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-get-settings', async () => {
  try {
    const data = loadData();
    return data.aiSettings || null;
  } catch (error) {
    console.error('Error getting AI settings:', error);
    return null;
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Hide dock icon
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createWindow();
  createTray();
  registerShortcuts();

  // Initialize AI client if API key exists
  const data = loadData();
  if (data.aiSettings?.apiKey) {
    initializeGeminiClient(data.aiSettings.apiKey);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  isQuitting = true;
});
