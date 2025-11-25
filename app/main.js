const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

// App lifecycle
app.whenReady().then(() => {
  // Hide dock icon
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createWindow();
  createTray();
  registerShortcuts();
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
