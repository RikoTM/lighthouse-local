const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let lighthouse;
async function getLighthouse() {
  if (!lighthouse) {
    lighthouse = (await import('lighthouse')).default;
  }
  return lighthouse;
}
let chromeLauncher;
async function getChromeLauncher() {
  if (!chromeLauncher) {
    const mod = await import('chrome-launcher');
    chromeLauncher = mod.launch ? mod : mod.default;
  }
  return chromeLauncher;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, '../build/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let cancelRequested = false;

function sendLog(win, msg) {
  win.webContents.send('log', msg);
}
function sendProgress(win, value) {
  win.webContents.send('progress', value);
}
function sendReport(win, report) {
  win.webContents.send('report', report);
}

ipcMain.handle('start-scan', async (event, urls) => {
  const win = BrowserWindow.getFocusedWindow();
  cancelRequested = false;
  const dateFolder = path.join(app.getPath('userData'), 'reports', new Date().toISOString().slice(0,10));
  if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder, { recursive: true });
  let completed = 0;
  for (let i = 0; i < urls.length; i++) {
    if (cancelRequested) {
      sendLog(win, 'Scan cancelled by user.');
      break;
    }
    const url = urls[i];
    sendLog(win, `Scanning: ${url}`);
    try {
      const cl = await getChromeLauncher();
      const chrome = await cl.launch({ chromeFlags: ['--headless'] });
      const lh = await getLighthouse();
      // Get HTML report
      const htmlResult = await lh(url, { port: chrome.port, output: 'html' });
      // Get JSON report
      const jsonResult = await lh(url, { port: chrome.port, output: 'json' });
      await chrome.kill();
  // Create a safe domain-based filename
  const domain = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_');
  const datetime = new Date().toISOString().replace(/[:.]/g, '-');
  const htmlPath = path.join(dateFolder, `${domain}_${datetime}.html`);
  const jsonPath = path.join(dateFolder, `${domain}_${datetime}.json`);
  fs.writeFileSync(htmlPath, typeof htmlResult === 'string' ? htmlResult : htmlResult.report);
  fs.writeFileSync(jsonPath, typeof jsonResult === 'string' ? jsonResult : JSON.stringify(jsonResult.lhr, null, 2));
  sendReport(win, { url, status: 'Success', htmlPath, jsonPath });
  sendLog(win, `Completed: ${url}`);
    } catch (err) {
      sendReport(win, { url, status: 'Error', htmlPath: '', jsonPath: '' });
      sendLog(win, `Error scanning ${url}: ${err.message}`);
    }
    completed++;
    sendProgress(win, Math.round(((completed) / urls.length) * 100));
  }
  sendLog(win, 'All scans finished.');
});

ipcMain.handle('cancel-scan', () => {
  cancelRequested = true;
});


ipcMain.handle('show-in-folder', (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-in-browser', (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('get-app-data', () => {
  return app.getPath('userData');
});