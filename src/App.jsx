import React, { useState, useRef } from 'react';
import { Container, Typography, TextField, Button, LinearProgress, Collapse, Paper, IconButton, List, ListItem, ListItemText } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Visibility, VisibilityOff } from '@mui/icons-material';

function App() {
  const [urls, setUrls] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const [reports, setReports] = useState([]);
  const [devices, setDevices] = useState({ desktop: true, mobile: false });
  const [categories, setCategories] = useState({
    performance: true,
    accessibility: false,
    'best-practices': false,
    seo: false,
    pwa: false
  });
  const logRef = useRef(null);

  const handleStartScan = async () => {
    setScanning(true);
    setProgress(0);
    setLogs([]);
    setReports([]);
    const urlList = urls.split(/\r?\n|,/).map(u => u.trim()).filter(u => u);
    const selectedDevices = Object.keys(devices).filter(d => devices[d]);
    const selectedCategories = Object.keys(categories).filter(c => categories[c]);
    window.electronAPI.startScan({ urls: urlList, devices: selectedDevices, categories: selectedCategories });
  };

  const handleCancelScan = () => {
    window.electronAPI.cancelScan();
    setScanning(false);
  };

  React.useEffect(() => {
    window.electronAPI.onLog((_, msg) => {
      const timestamp = new Date().toLocaleTimeString();
      setLogs(l => [...l, `[${timestamp}] ${msg}`]);
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      // If scan finished, update scanning state
      if (msg === 'All scans finished.') {
        setScanning(false);
      }
    });
    window.electronAPI.onProgress((_, value) => setProgress(value));
    window.electronAPI.onReport((_, report) => setReports(r => [...r, report]));
  }, []);

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Lighthouse Local</Typography>
      <TextField
        label="URLs to Scan (one per line or comma separated)"
        multiline
        minRows={4}
        fullWidth
        value={urls}
        onChange={e => setUrls(e.target.value)}
        disabled={scanning}
        sx={{ mb: 2 }}
      />
      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle1">Device Type</Typography>
        <label style={{ marginRight: 16 }}>
          <input type="checkbox" checked={devices.desktop} disabled={scanning}
            onChange={e => setDevices(d => ({ ...d, desktop: e.target.checked }))} /> Desktop
        </label>
        <label>
          <input type="checkbox" checked={devices.mobile} disabled={scanning}
            onChange={e => setDevices(d => ({ ...d, mobile: e.target.checked }))} /> Mobile
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle1">Categories</Typography>
        {Object.keys(categories).map(cat => (
          <label key={cat} style={{ marginRight: 16 }}>
            <input type="checkbox" checked={categories[cat]} disabled={scanning}
              onChange={e => setCategories(c => ({ ...c, [cat]: e.target.checked }))} /> {cat.charAt(0).toUpperCase() + cat.replace(/-/g, ' ').slice(1)}
          </label>
        ))}
      </div>
  <Button variant="contained" color="primary" onClick={handleStartScan} disabled={scanning || !urls.trim()} sx={{ mr: 2 }}>Start Scan</Button>
  <Button variant="outlined" color="secondary" onClick={handleCancelScan} disabled={!scanning}>Cancel</Button>
      {scanning && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
          <CircularProgress size={32} sx={{ mr: 2 }} />
          <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1 }} />
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <IconButton onClick={() => setShowLogs(l => !l)}>
          {showLogs ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      </div>
      <Collapse in={showLogs}>
        <Paper sx={{ mt: 2, p: 2, maxHeight: 200, overflow: 'auto' }} ref={logRef}>
          {logs.map((log, i) => <div key={i}>{log}</div>)}
        </Paper>
      </Collapse>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 32 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Completed Reports</Typography>
        <Button
          variant="outlined"
          onClick={async () => {
            // Get appData path from main process
            const appData = await window.electronAPI.getAppData();
            if (appData) {
              window.electronAPI.showInFolder(`${appData}/reports`);
            }
          }}
          sx={{ ml: 2 }}
        >Show Reports Folder</Button>
        <Button
          variant="contained"
          color="success"
          sx={{ ml: 2 }}
          onClick={async () => {
            const res = await window.electronAPI.exportExcel();
            if (res.success) {
              alert(`Excel file created: ${res.path}`);
              window.electronAPI.showInFolder(res.path);
            } else {
              alert(`Excel export failed: ${res.error}`);
            }
          }}
        >Export to Excel</Button>
      </div>
      <List>
        {reports.map((r, i) => (
          <ListItem key={i}>
            <ListItemText
              primary={r.url}
              secondary={`Device: ${r.device} | Status: ${r.status}`}
            />
            <Button onClick={() => window.electronAPI.openInBrowser(r.htmlPath)} sx={{ mr: 1 }}>View HTML</Button>
            <Button href={r.jsonPath} download sx={{ mr: 1 }}>Download JSON</Button>
            <Button onClick={() => window.electronAPI.showInFolder(r.htmlPath)} sx={{ mr: 1 }}>Show in Folder</Button>
          </ListItem>
        ))}
      </List>
    </Container>
  );
}

export default App;
