import React, { useState, useRef } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
// Add Montserrat font from Google Fonts
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap';
document.head.appendChild(fontLink);

const theme = createTheme({
  palette: {
    primary: {
      main: '#212b36', // Sidebar dark blue
      contrastText: '#fff',
    },
    secondary: {
      main: '#e3f2fd', // Light grey/blue
      contrastText: '#212b36',
    },
    background: {
      default: '#f4f6f8',
      paper: '#fff',
    },
  },
  typography: {
    fontFamily: 'Montserrat, Arial, sans-serif',
    h4: {
      fontWeight: 700,
      color: '#212b36',
    },
    h6: {
      color: '#388e3c',
    },
  },
});

import { Box, Container, Typography, TextField, Button, LinearProgress, Collapse, Paper, IconButton, List, ListItem, ListItemText, Checkbox, FormControlLabel, FormGroup, Divider, Avatar } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { Visibility, VisibilityOff } from '@mui/icons-material';

function App() {
  const [urls, setUrls] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const [reports, setReports] = useState([]);
  const [devices, setDevices] = useState({ desktop: true, mobile: true });
  const [categories, setCategories] = useState({
    performance: true,
    accessibility: true,
    'best-practices': true,
    seo: true,
    pwa: true
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
        {/* Sidebar */}
        <Box sx={{ width: 80, background: '#212b36', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, boxShadow: 2 }}>
          <img src={process.env.PUBLIC_URL + '/lighthouse.png'} alt="Lighthouse" style={{ width: 48, height: 48, marginBottom: 16 }} />
        </Box>
        {/* Main Content */}
        <Container maxWidth="md" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 4, background: '#fff' }}>
            <Typography variant="h4" gutterBottom align="center">Lighthouse Local</Typography>
            <Divider sx={{ mb: 3 }} />
            <style>{`.MuiTypography-h4 { color: #212b36 !important; }`}</style>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
              <TextField
                label="URLs to Scan (one per line or comma separated)"
                multiline
                minRows={4}
                fullWidth
                value={urls}
                onChange={e => setUrls(e.target.value)}
                disabled={scanning}
                sx={{ flex: 2 }}
              />
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Device Type</Typography>
                <FormGroup row>
                  <FormControlLabel
                    control={<Checkbox checked={devices.desktop} disabled={scanning} onChange={e => setDevices(d => ({ ...d, desktop: e.target.checked }))} />}
                    label="Desktop"
                  />
                  <FormControlLabel
                    control={<Checkbox checked={devices.mobile} disabled={scanning} onChange={e => setDevices(d => ({ ...d, mobile: e.target.checked }))} />}
                    label="Mobile"
                  />
                </FormGroup>
                <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Categories</Typography>
                <FormGroup row>
                  {Object.keys(categories).map(cat => (
                    <FormControlLabel
                      key={cat}
                      control={<Checkbox checked={categories[cat]} disabled={scanning} onChange={e => setCategories(c => ({ ...c, [cat]: e.target.checked }))} />}
                      label={cat.charAt(0).toUpperCase() + cat.replace(/-/g, ' ').slice(1)}
                      sx={{ mr: 2 }}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Button variant="contained" color="primary" onClick={handleStartScan} disabled={scanning || !urls.trim()} sx={{ minWidth: 120 }}>Start Scan</Button>
              <Button variant="contained" color="secondary" onClick={handleCancelScan} disabled={!scanning} sx={{ minWidth: 120 }}>Cancel</Button>
              <Button variant="contained" color="primary" onClick={async () => {
                const res = await window.electronAPI.exportExcel();
                if (res.success) {
                  alert(`Excel file created: ${res.path}`);
                  window.electronAPI.showInFolder(res.path);
                } else {
                  alert(`Excel export failed: ${res.error}`);
                }
              }} sx={{ minWidth: 120 }}>Export to Excel</Button>
              <Button variant="contained" color="secondary" onClick={async () => {
                const appData = await window.electronAPI.getAppData();
                if (appData) {
                  window.electronAPI.showInFolder(`${appData}/reports`);
                }
              }} sx={{ minWidth: 120 }}>Show Reports Folder</Button>
            </Box>
            {scanning && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CircularProgress size={32} sx={{ mr: 2 }} />
                <LinearProgress variant="determinate" value={progress} sx={{ flexGrow: 1 }} />
              </Box>
            )}
            <Box sx={{ mt: 2 }}>
              <IconButton onClick={() => setShowLogs(l => !l)}>
                {showLogs ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </Box>
            <Collapse in={showLogs}>
              <Paper sx={{ mt: 2, p: 2, maxHeight: 200, overflow: 'auto', background: '#f5f7fa' }} ref={logRef}>
                {logs.map((log, i) => <div key={i}>{log}</div>)}
              </Paper>
            </Collapse>
            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Completed Reports</Typography>
            <List>
              {reports.map((r, i) => (
                <ListItem key={i} sx={{ borderBottom: '1px solid #eee' }}>
                  <ListItemText
                    primary={r.url}
                    secondary={`Device: ${r.device} | Status: ${r.status}`}
                  />
                  <Button variant="contained" color="primary" onClick={() => window.electronAPI.openInBrowser(r.htmlPath)} sx={{ mr: 1 }}>View HTML</Button>
                  <Button variant="contained" color="secondary" href={r.jsonPath} download sx={{ mr: 1 }}>Download JSON</Button>
                  <Button variant="contained" color="secondary" onClick={() => window.electronAPI.showInFolder(r.htmlPath)} sx={{ mr: 1 }}>Show in Folder</Button>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
