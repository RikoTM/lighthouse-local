const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function exportLighthouseResultsToExcel(jsonFiles, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lighthouse Results');
  if (!jsonFiles || jsonFiles.length === 0) throw new Error('No JSON report files found.');

  // Parse all reports and collect scores
  const categories = ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'];
  const results = {};
  const urls = [];

  jsonFiles.forEach(file => {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const url = data.finalUrl || data.requestedUrl || path.basename(file);
    if (!urls.includes(url)) urls.push(url);
    categories.forEach(cat => {
      if (!results[cat]) results[cat] = {};
      let device = 'desktop';
      if (file.includes('_mobile_')) device = 'mobile';
      const key = `${cat} - ${device}`;
      if (!results[key]) results[key] = {};
      const score = data.categories && data.categories[cat] ? Math.round(data.categories[cat].score * 100) : '';
      results[key][url] = score;
    });
  });

  // Build header row
  const header = ['Category', ...urls];
  sheet.addRow(header);

  // Add rows for each category/device
  const devices = ['desktop', 'mobile'];
  categories.forEach(cat => {
    devices.forEach(device => {
      const catKey = `${cat} - ${device}`;
      if (results[catKey]) {
        const row = [catKey];
        let hasScore = false;
        urls.forEach(url => {
          const val = results[catKey][url];
          if (val !== '' && val !== undefined) hasScore = true;
          row.push(val !== undefined ? val : '');
        });
        if (hasScore) {
          sheet.addRow(row);
        }
      }
    });
  });

  await workbook.xlsx.writeFile(outputPath);
}

module.exports = exportLighthouseResultsToExcel;
