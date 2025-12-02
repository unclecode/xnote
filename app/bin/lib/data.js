const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.xnote');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading data:', err.message);
  }
  return { notes: [] };
}

function saveData(data) {
  ensureDataDir();
  // Atomic write: temp file + rename
  const tempFile = path.join(DATA_DIR, `.data.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    // Clean up temp file on error
    try { fs.unlinkSync(tempFile); } catch {}
    throw err;
  }
}

function getNotes() {
  return loadData().notes || [];
}

function getNoteByName(name) {
  const notes = getNotes();
  return notes.find(n => n.name.toLowerCase() === name.toLowerCase());
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function createNote(name, content, isMarkdown = true) {
  const data = loadData();
  if (!data.notes) data.notes = [];

  const existingIndex = data.notes.findIndex(n =>
    n.name.toLowerCase() === name.toLowerCase()
  );

  // Convert content to HTML for richContent (preserve line breaks)
  const htmlContent = isMarkdown
    ? content.split('\n').map(line => `<div>${escapeHtml(line) || '<br>'}</div>`).join('')
    : content;

  const note = {
    name,
    richContent: htmlContent,
    mdContent: isMarkdown ? content : '',
    updatedAt: Date.now()
  };

  if (existingIndex >= 0) {
    data.notes[existingIndex] = note;
  } else {
    data.notes.push(note);
  }

  saveData(data);
  return note;
}

module.exports = {
  loadData,
  saveData,
  getNotes,
  getNoteByName,
  createNote,
  escapeHtml,
  DATA_DIR,
  DATA_FILE
};
