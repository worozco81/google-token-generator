require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Función para escapar HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ========== RUTAS PÚBLICAS ==========

app.get('/', (req, res) => {
  res.json({ 
    message: 'Google Token Generator API', 
    status: 'active',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      dashboard: '/dashboard?api_key=TU_CLAVE',
      connect: '/connect/:clientId'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Página de conexión para clientes
app.get('/connect/:clientId', (req, res) => {
  const { clientId } = req.params;
  const clientName = req.query.name || 'Cliente';
  const clientEmail = req.query.email || '';
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Conectar Google Calendar</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {
                font-family: system-ui, -apple-system, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
            }
            .card {
                background: white;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            h1 { color: #1a73e8; margin-top: 0; }
            button {
                background: #1a73e8;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                cursor: pointer;
                width: 100%;
            }
            button:hover { background: #1557b0; }
            .info { 
                background: #e8f0fe; 
                padding: 16px;
                border-radius: 8px;
                margin: 20px 0;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🔗 Conectar Google Calendar</h1>
            <p>Hola <strong>${escapeHtml(clientName)}</strong>,</p>
            <p>Para que tu consultor pueda automatizar tu calendario, necesitas autorizar el acceso.</p>
            <div class="info">
                📋 <strong>Permisos que otorgas:</strong><br>
                • Crear eventos en tu calendario<br>
                • Ver eventos existentes
            </div>
            <button onclick="startAuth()">✅ Autorizar con Google Calendar</button>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                Puedes revocar este acceso en cualquier momento desde 
                <a href="https://myaccount.google.com/permissions">Google Account Permissions</a>
            </p>
        </div>
        <script>
            function startAuth() {
                window.location.href = '/auth?clientId=${clientId}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}';
            }
        </script>
    </body>
    </html>
  `);
});

// Iniciar OAuth
app.get('/auth', (req, res) => {
  const { clientId, name, email } = req.query;
  
  if (!clientId) {
    return res.status(400).send('Falta clientId');
  }
  
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    `${BASE_URL}/callback`
  );
  
  const state = Buffer.from(JSON.stringify({ clientId, name, email })).toString('base64');
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    state: state
  });
  
  res.redirect(url);
});

// Callback de OAuth
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.send(`<h1>Error</h1><p>${error}</p>`);
  }
  
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { clientId, name, email } = stateData;
    
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      `${BASE_URL}/callback`
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Guardar en base de datos
    await db.saveClient(clientId, name, email);
    await db.saveToken(clientId, tokens.refresh_token);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>✅ Conexión exitosa</title>
          <style>
              body { font-family: system-ui; text-align: center; padding: 50px; }
              .success { color: #0d652d; font-size: 48px; }
          </style>
      </head>
      <body>
          <div class="success">✅</div>
          <h1>¡Conexión exitosa!</h1>
          <p>Tu calendario ha sido conectado correctamente.</p>
          <p>Ya puedes cerrar esta ventana.</p>
      </body>
      </html>
    `);
    
  } catch (err) {
    console.error(err);
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

// ========== RUTAS PROTEGIDAS (Dashboard) ==========

app.get('/dashboard', (req, res) => {
  const apiKey = req.query.api_key;
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).send('No autorizado');
  }
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API: Listar clientes
app.get('/api/clients', async (req, res) => {
  const apiKey = req.query.api_key;
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const clients = await db.getClients();
  res.json(clients);
});

// API: Obtener token de un cliente
app.get('/api/token/:clientId', async (req, res) => {
  const apiKey = req.query.api_key;
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = await db.getToken(req.params.clientId);
  res.json({ refresh_token: token });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard: ${BASE_URL}/dashboard?api_key=${process.env.ADMIN_API_KEY}`);
});