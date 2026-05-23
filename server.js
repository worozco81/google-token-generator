require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Google Token Generator API', 
    status: 'ok',
    endpoints: {
      dashboard: '/dashboard',
      connect: '/connect/:clientId',
      health: '/health'
    }
  });
});

// Ruta de salud
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});