const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, systemPreferences, dialog } = require('electron');
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
ipcMain.handle('ai-generate-content', async (event, content, model, images = [], chatHistory = [], isInlineMode = false) => {
  if (!genAI) {
    return { success: false, error: 'AI not configured. Please set API key in settings.' };
  }

  try {
    const data = loadData();
    const systemPrompt = data.aiSettings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const enableSearch = data.aiSettings?.enableSearch !== false;
    const isImageModel = model === 'models/gemini-3-pro-image-preview';

    // Build contents array from chat history
    let contents = [];

    // Convert chat history to Gemini format (for chat mode)
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        const role = msg.role === 'ai' ? 'model' : 'user';
        const parts = [];

        // Add text content
        if (msg.content) {
          parts.push({ text: msg.content });
        }

        // Add images if present in message
        if (msg.images && msg.images.length > 0) {
          for (const img of msg.images) {
            parts.push({
              inlineData: {
                mimeType: img.mimeType,
                data: img.data
              }
            });
          }
        }

        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    // If no chat history, create single message
    if (contents.length === 0) {
      const parts = [{ text: content }];

      // Add current images if provided
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

      contents.push({ role: 'user', parts });
    }

    // Build request config
    const requestConfig = {
      model: model,
      contents: contents
    };

    // Initialize config
    requestConfig.config = {};

    // For inline mode: use JSON response schema (no system prompt needed)
    // For chat mode: use system instruction for context
    if (isInlineMode && !isImageModel) {
      // Inline mode: force JSON response
      requestConfig.config.responseMimeType = 'application/json';
      requestConfig.config.responseSchema = {
        type: 'object',
        properties: {
          result: { type: 'string' }
        },
        required: ['result']
      };
    } else if (!isImageModel && systemPrompt && !isInlineMode) {
      // Chat mode: use system instruction
      requestConfig.config.systemInstruction = systemPrompt;
    }

    // Add thinking config based on model
    if (model.includes('gemini-3')) {
      requestConfig.config.thinkingConfig = { thinkingLevel: 'LOW' };
    } else if (model.includes('gemini-2.5-flash-lite')) {
      requestConfig.config.thinkingConfig = { thinkingBudget: 0 };
    } else if (model.includes('gemini-2.5-flash')) {
      requestConfig.config.thinkingConfig = { thinkingBudget: -1 };
    } else if (model.includes('gemini-2.5-pro')) {
      requestConfig.config.thinkingConfig = { thinkingBudget: 2334 };
    }

    // Add special config for image model
    if (isImageModel) {
      requestConfig.config.responseModalities = ['IMAGE'];
      requestConfig.config.imageConfig = {};
    }

    // Add search tool if enabled (not for inline mode with JSON)
    if (enableSearch && !isInlineMode) {
      requestConfig.config.tools = [{ googleSearch: {} }];
    }

    console.log('Request config:', JSON.stringify(requestConfig, null, 2));

    // For inline mode: use non-streaming for cleaner JSON parsing
    if (isInlineMode && !isImageModel) {
      const response = await genAI.models.generateContent(requestConfig);
      const fullText = response.text || '';

      console.log('Inline mode response:', fullText.substring(0, 500));

      // Parse JSON response
      try {
        const jsonResponse = JSON.parse(fullText);
        return {
          success: true,
          content: jsonResponse.result || '',
          image: null
        };
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // Fallback: return raw text
        return {
          success: true,
          content: fullText,
          image: null
        };
      }
    }

    // Chat mode: Generate content with streaming
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

    return {
      success: true,
      content: fullText,
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

// Download/export note as markdown
ipcMain.handle('download-markdown', async (event, content, suggestedName) => {
  const downloadsPath = app.getPath('downloads');
  const defaultFilename = suggestedName || 'note.md';

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Note as Markdown',
    defaultPath: path.join(downloadsPath, defaultFilename),
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (err) {
    console.error('Error saving file:', err);
    return { success: false, error: err.message };
  }
});

// Share note as GitHub Gist (create or update)
ipcMain.handle('share-gist', async (event, content, filename, isPublic, existingGistId) => {
  const { execSync } = require('child_process');
  const tmpFile = path.join(os.tmpdir(), filename || 'note.md');

  try {
    // Write content to temp file
    fs.writeFileSync(tmpFile, content, 'utf8');

    let cmd, output;

    if (existingGistId) {
      // UPDATE existing gist
      cmd = `gh gist edit ${existingGistId} "${tmpFile}" 2>&1`;
      execSync(cmd, { encoding: 'utf8', timeout: 30000 });
      return {
        success: true,
        gistId: existingGistId,
        url: `https://gist.github.com/${existingGistId}`
      };
    } else {
      // CREATE new gist
      const visibility = isPublic ? '--public' : '';
      cmd = `gh gist create ${visibility} "${tmpFile}" 2>&1`;
      output = execSync(cmd, { encoding: 'utf8', timeout: 30000 });

      // Extract URL from output
      const urlMatch = output.match(/https:\/\/gist\.github\.com\/[^\s]+/);
      if (urlMatch) {
        const url = urlMatch[0];
        const gistId = url.split('/').pop();
        return { success: true, url, gistId };
      }

      return { success: false, error: 'Could not get gist URL' };
    }
  } catch (err) {
    console.error('Error with gist:', err);
    // Handle gist-not-found (deleted externally)
    const errMsg = err.message || err.stderr?.toString() || '';
    if (errMsg.includes('not found') || errMsg.includes('404') || errMsg.includes('could not find')) {
      return { success: false, error: 'Gist not found', notFound: true };
    }
    return { success: false, error: err.message };
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

// Delete a GitHub Gist
ipcMain.handle('delete-gist', async (event, gistId) => {
  const { execSync } = require('child_process');

  try {
    const cmd = `gh gist delete ${gistId} --yes 2>&1`;
    execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    return { success: true };
  } catch (err) {
    const errMsg = err.message || err.stderr?.toString() || '';
    // If already deleted, treat as success
    if (errMsg.includes('not found') || errMsg.includes('404')) {
      return { success: true };
    }
    console.error('Error deleting gist:', err);
    return { success: false, error: err.message };
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
