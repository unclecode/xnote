#!/usr/bin/env node

const { program } = require('commander');
const { getNotes, getNoteByName, createNote, DATA_DIR } = require('./lib/data');
const { generateNoteName } = require('./lib/ai');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const TurndownService = require('turndown');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Helper: Read stdin
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

// Helper: Check if app is running
function isAppRunning() {
  const pidFile = path.join(DATA_DIR, 'xnote.pid');
  if (!fs.existsSync(pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

program
  .name('xnote')
  .description('xnote CLI - Manage notes from command line')
  .version('1.0.0');

// xnote create [-n name]
program
  .command('create')
  .description('Create note from stdin')
  .option('-n, --name <name>', 'Note name')
  .option('--force', 'Overwrite existing note')
  .action(async (options) => {
    const content = await readStdin();
    if (!content.trim()) {
      console.error('Error: No input. Pipe content to this command.');
      console.error('Example: echo "content" | xnote create -n "My Note"');
      process.exit(1);
    }

    let name = options.name;
    if (!name) {
      process.stderr.write('Generating title... ');
      name = await generateNoteName(content);
      process.stderr.write('done\n');
    }

    // Check for existing note
    const existing = getNoteByName(name);
    if (existing && !options.force) {
      console.error(`Error: Note "${name}" already exists. Use --force to overwrite.`);
      process.exit(3);
    }

    createNote(name, content, true);
    console.log(`Created "${name}"`);
  });

// xnote get <name>
program
  .command('get <name>')
  .description('Output note content to stdout (always markdown)')
  .option('--html', 'Output raw HTML instead')
  .option('--json', 'Output full note as JSON')
  .action((name, options) => {
    const note = getNoteByName(name);
    if (!note) {
      console.error(`Error: Note "${name}" not found.`);
      const notes = getNotes();
      const similar = notes.filter(n =>
        n.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(n.name.toLowerCase().split(' ')[0])
      ).slice(0, 3);
      if (similar.length) {
        console.error('Similar: ' + similar.map(n => n.name).join(', '));
      }
      process.exit(2);
    }

    if (options.json) {
      console.log(JSON.stringify(note, null, 2));
    } else if (options.html) {
      console.log(note.richContent);
    } else {
      // Always output markdown - convert HTML if needed (same as Gist share)
      const content = note.mdContent?.trim()
        ? note.mdContent
        : turndown.turndown(note.richContent || '');
      console.log(content);
    }
  });

// xnote list
program
  .command('list')
  .description('List all notes')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const notes = getNotes();
    if (notes.length === 0) {
      console.log('No notes yet.');
      console.log('Create one: echo "Hello" | xnote create -n "My Note"');
      return;
    }

    if (options.json) {
      console.log(JSON.stringify(notes.map(n => ({
        name: n.name,
        updatedAt: n.updatedAt,
        size: (n.mdContent || n.richContent || '').length
      })), null, 2));
    } else {
      // Sort by date descending
      const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
      sorted.forEach(n => {
        const date = new Date(n.updatedAt).toLocaleDateString();
        const size = (n.mdContent || n.richContent || '').length;
        console.log(`${n.name}  (${date}, ${size} chars)`);
      });
    }
  });

// xnote open <name>
program
  .command('open <name>')
  .description('Open note in xnote app')
  .action((name) => {
    const note = getNoteByName(name);
    if (!note) {
      console.error(`Error: Note "${name}" not found.`);
      process.exit(2);
    }

    const appDir = path.resolve(__dirname, '..');
    const running = isAppRunning();

    console.log(running ? `Opening "${name}"` : `Starting xnote with "${name}"`);

    spawn('npx', ['electron', '.', '--cli-open', name], {
      cwd: appDir,
      detached: true,
      stdio: 'ignore'
    }).unref();
  });

program.parse();
