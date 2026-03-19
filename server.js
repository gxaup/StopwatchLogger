import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const REPORTS_DIR = path.join(__dirname, 'reports');

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Ensure reports directory exists
fs.ensureDirSync(REPORTS_DIR);

// API: Save a report
app.post('/api/reports', async (req, res) => {
  try {
    const report = req.body;
    if (!report.id) report.id = Date.now();
    
    const filename = `Report_${report.id}.json`;
    const filePath = path.join(REPORTS_DIR, filename);
    
    await fs.writeJson(filePath, report, { spaces: 2 });
    console.log(`Report saved: ${filename}`);
    res.status(200).json({ success: true, message: 'Report saved to local backend' });
  } catch (err) {
    console.error('Error saving report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const reports = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readJson(path.join(REPORTS_DIR, file));
        reports.push(data);
      }
    }
    // Sort descending
    reports.sort((a, b) => (b.id || 0) - (a.id || 0));
    res.status(200).json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Delete a report
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const filename = `Report_${req.params.id}.json`;
    const filePath = path.join(REPORTS_DIR, filename);
    await fs.remove(filePath);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Local Backend running at http://0.0.0.0:${PORT}`);
  console.log(`Network-accessible for syncing from mobile devices.`);
});
