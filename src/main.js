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
let lastScanJsonFiles = [];

function sendLog(win, msg) {
  win.webContents.send('log', msg);
}
function sendProgress(win, value) {
  win.webContents.send('progress', value);
}
function sendReport(win, report) {
  win.webContents.send('report', report);
}

ipcMain.handle('start-scan', async (event, opts) => {
  const win = BrowserWindow.getFocusedWindow();
  cancelRequested = false;
  const { urls, devices, categories } = opts;
  const dateFolder = path.join(app.getPath('userData'), 'reports', new Date().toISOString().slice(0,10));
  if (!fs.existsSync(dateFolder)) fs.mkdirSync(dateFolder, { recursive: true });
  let totalScans = urls.length * devices.length;
  let completed = 0;
  lastScanJsonFiles = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    for (let j = 0; j < devices.length; j++) {
      if (cancelRequested) {
        sendLog(win, 'Scan cancelled by user.');
        break;
      }
      let device = devices[j];
      // Ensure device is 'desktop' or 'mobile'
      device = device.toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
      sendLog(win, `Scanning: ${url} [${device}]`);
      let chrome = null;
      try {
        const cl = await getChromeLauncher();
        chrome = await cl.launch({ chromeFlags: ['--headless'] });
        const lh = await getLighthouse();
        // Check for cancellation after Chrome launch
        if (cancelRequested) {
          await chrome.kill();
          sendLog(win, 'Scan cancelled by user.');
          break;
        }
        // Lighthouse options and config per ticket #12058
        const lhOpts = {
          port: chrome.port,
          output: 'html'
        };
        // Use custom screenEmulation for desktop scans
        let lhConfig;
        if (device === 'desktop') {
          lhConfig = {
            extends: 'lighthouse:default',
            settings: {
              formFactor: 'desktop',
              onlyCategories: categories,
              screenEmulation: {
                mobile: false,
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                disabled: false,
                screenOrientation: 'portrait'
              },
              throttling: {
                rttMs: 40,
                throughputKbps: 10240,
                cpuSlowdownMultiplier: 1,
                requestLatencyMs: 0,
                downloadThroughputKbps: 0,
                uploadThroughputKbps: 0
              }
            }
          };
        } else {
          lhConfig = {
            extends: 'lighthouse:default',
            settings: {
              formFactor: 'mobile',
              onlyCategories: categories,
              screenEmulation: {
                mobile: true,
                width: 412,
                height: 823,
                deviceScaleFactor: 1.75              }
            },
            throttling: {
                rttMs: 150,
                throughputKbps: 1638.4,
                cpuSlowdownMultiplier: 4,
                requestLatencyMs: 0,
                downloadThroughputKbps: 0,
                uploadThroughputKbps: 0
              }
          };
        }
        const htmlResult = await lh(url, lhOpts, lhConfig);
        if (cancelRequested) {
          await chrome.kill();
          sendLog(win, 'Scan cancelled by user.');
          break;
        }
        lhOpts.output = 'json';
        const jsonResult = await lh(url, lhOpts, lhConfig);
        await chrome.kill();
        // Create a safe domain-based filename
        const domain = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_');
        const datetime = new Date().toISOString().replace(/[:.]/g, '-');
        const htmlPath = path.join(dateFolder, `${domain}_${device}_${datetime}.html`);
        const jsonPath = path.join(dateFolder, `${domain}_${device}_${datetime}.json`);
  fs.writeFileSync(htmlPath, typeof htmlResult === 'string' ? htmlResult : htmlResult.report);
  fs.writeFileSync(jsonPath, typeof jsonResult === 'string' ? jsonResult : JSON.stringify(jsonResult.lhr, null, 2));
  lastScanJsonFiles.push(jsonPath);
  sendReport(win, { url, device, status: 'Success', htmlPath, jsonPath });
  sendLog(win, `Completed: ${url} [${device}]`);
      } catch (err) {
        if (chrome) {
          try { await chrome.kill(); } catch (e) {}
        }
        sendReport(win, { url, device, status: 'Error', htmlPath: '', jsonPath: '' });
        sendLog(win, `Error scanning ${url} [${device}]: ${err.message}`);
      }
      completed++;
      sendProgress(win, Math.round(((completed) / totalScans) * 100));
    }
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

const exportLighthouseResultsToExcel = require('./exportExcel');
ipcMain.handle('export-excel', async (event) => {
  const outputPath = path.join(app.getPath('userData'), 'LighthouseResults.xlsx');
  try {
    if (!lastScanJsonFiles || lastScanJsonFiles.length === 0) throw new Error('No recent scan results found. Run a scan first.');
    await exportLighthouseResultsToExcel(lastScanJsonFiles, outputPath);
    return { success: true, path: outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});