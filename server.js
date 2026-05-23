require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Google Token Generator API', 
    status: 'active',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      info: '/info'
    }
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ruta de información
app.get('/info', (req, res) => {
  res.json({
    service: 'Google Token Generator',
    environment: process.env.NODE_ENV || 'production',
    node_version: process.version
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});