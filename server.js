require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const emailMasivoRoutes = require('./routes/emailMasivo');

// ========================================
// MIDDLEWARE CORS - ACEPTA VERCEL + DOMINIO PERSONALIZADO
// ========================================
app.use(cors({
  origin: function(origin, callback) {
    // Permitir sin origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173',
      'https://www.detodoencursos.com',
      'https://detodoencursos.com'
    ];
    
    // Permitir todas las URLs de Vercel (*.vercel.app)
    if (origin.includes('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ========================================
// MIDDLEWARE GENERAL
// ========================================

// Para webhook de Stripe (debe ir antes de express.json())
app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (comprobantes)
app.use('/uploads', express.static('uploads'));

// ========================================
// CONEXIÓN A MONGODB
// ========================================
mongoose.connect('mongodb+srv://gabrielalejandrovolcan_db_user:ZLZuTTB6nGwBEU6B@cluster0.kbw4fz6.mongodb.net/cursos-camaras?retryWrites=true&w=majority')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// ========================================
// RUTAS - SISTEMA ACTUAL (mantener)
// ========================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cursos', require('./routes/cursos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/pagos-manual', require('./routes/pagosManual'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/email-masivo', emailMasivoRoutes);

// ========================================
// 🆕 RUTAS - PRODUCTOS DIGITALES (ACTIVO)
// ========================================
app.use('/api/productos', require('./routes/productos'));

// ========================================
// RUTAS DE PRUEBA Y SALUD
// ========================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    mensaje: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    sistema: {
      cursos: 'activo',
      productos: 'activo'
    }
  });
});

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API de Detodo en Cursos',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      cursos: '/api/cursos',
      productos: '/api/productos',
      pagos: '/api/pagos',
      admin: '/api/admin'
    }
  });
});

// ========================================
// MANEJO DE ERRORES
// ========================================

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    ruta: req.originalUrl,
    metodo: req.method
  });
});

// Manejo de errores general
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    mensaje: process.env.NODE_ENV === 'development' ? err.message : 'Ocurrió un error',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// INICIAR SERVIDOR
// ========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀========================================');
  console.log(`   Servidor corriendo en puerto ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   MongoDB: Conectado`);
  console.log(`   CORS: Configurado para Vercel + detodoencursos.com`);
  console.log('========================================🚀');
  console.log('');
});
