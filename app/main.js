const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');

// Data directory
const dataDir = path.join(os.homedir(), '.xnote');
const dataFile = path.join(dataDir, 'data.json');
const imagesDir = path.join(dataDir, 'images');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure images directory exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
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
  // mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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
    // Temporarily enable visibleOnAllWorkspaces to show on current desktop
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.show();
    mainWindow.focus();
    app.focus({ steal: true });
    // Disable after showing so window doesn't follow between desktops
    setTimeout(() => {
      mainWindow.setVisibleOnAllWorkspaces(false);
    }, 100);
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
    // For image models, don't use system prompt - just send the content
    const parts = isImageModel
      ? [{ text: content }]
      : [{ text: `${systemPrompt}\n\nCurrent note:\n${content}` }];

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
        responseModalities: ['IMAGE'],
        imageConfig: {}
      };
      if (enableSearch) {
        requestConfig.config.tools = [{ googleSearch: {} }];
      }
    } else if (enableSearch) {
      requestConfig.config = {
        tools: [{ googleSearch: {} }]
      };
    }

    console.log('Request config:', JSON.stringify(requestConfig, null, 2));

    // Generate content with streaming
    const response = await genAI.models.generateContentStream(requestConfig);

    // Stream response back to renderer
    let fullText = '';
    let imageData = null;

    for await (const chunk of response) {
      // Log chunk structure for debugging
      console.log('Chunk received:', JSON.stringify(chunk, null, 2).substring(0, 500));

      // Handle text chunks
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        event.sender.send('ai-content-chunk', chunkText);
      }

      // Handle image chunks
      if (chunk.candidates?.[0]?.content?.parts) {
        console.log('Parts found:', chunk.candidates[0].content.parts.length);
        for (const part of chunk.candidates[0].content.parts) {
          console.log('Part type:', part.inlineData ? 'inlineData' : 'other', Object.keys(part));
          if (part.inlineData) {
            const inlineData = part.inlineData;
            const mimeType = inlineData.mimeType || 'image/png';
            const imageBuffer = Buffer.from(inlineData.data, 'base64');

            // Generate unique filename
            const extension = mimeType.split('/')[1] || 'png';
            const filename = `generated-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
            const filePath = path.join(imagesDir, filename);

            // Save image to disk
            fs.writeFileSync(filePath, imageBuffer);
            console.log('Image saved to:', filePath);

            // Send file path to renderer
            imageData = {
              mimeType: mimeType,
              filePath: filePath,
              filename: filename
            };
            event.sender.send('ai-image-chunk', imageData);
          }
        }
      }
    }

    console.log('Final imageData:', imageData ? 'Present' : 'NULL');

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

// UI State persistence
ipcMain.handle('save-ui-state', async (event, uiState) => {
  try {
    const data = loadData();
    data.uiState = uiState;
    saveData(data);
    return { success: true };
  } catch (error) {
    console.error('Error saving UI state:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-ui-state', async () => {
  try {
    const data = loadData();
    return data.uiState || null;
  } catch (error) {
    console.error('Error getting UI state:', error);
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
