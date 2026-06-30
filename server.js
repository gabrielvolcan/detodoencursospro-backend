require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { limitadorGeneral } = require('./middleware/security');

// ========================================
// 🚨 VALIDACIÓN DE VARIABLES DE ENTORNO OBLIGATORIAS
// ========================================
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error('FALTAN variables de entorno obligatorias: JWT_SECRET y/o MONGODB_URI');
  process.exit(1);
}

const app = express();
const emailMasivoRoutes = require('./routes/emailMasivo');

// Confiar en el primer proxy (necesario para rate limiting detrás de proxy/Vercel)
app.set('trust proxy', 1);

// ========================================
// MIDDLEWARE CORS - LISTA BLANCA EXACTA
// ========================================
app.use(cors({
  origin: function(origin, callback) {
    // Rechazar requests sin origin en rutas con credenciales
    if (!origin) return callback(null, false);

    // Lista blanca exacta de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:5173',
      'https://www.detodoencursos.com',
      'https://detodoencursos.com'
    ];
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    // Previews de Vercel SOLO del propio proyecto (regex anclada)
    const vercelPreview = /^https:\/\/detodoencursospro[a-z0-9-]*\.vercel\.app$/;

    if (allowedOrigins.includes(origin) || vercelPreview.test(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// ========================================
// 🛡️ SEGURIDAD
// ========================================

// Headers de seguridad HTTP (CSP, HSTS, XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

// Rate limiting general — 200 req / IP / 15min
app.use('/api/', limitadorGeneral);

// ========================================
// MIDDLEWARE GENERAL
// ========================================

// Límite de 10kb por request (previene ataques de body oversized)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitizar inputs contra inyección NoSQL (ej: { "$gt": "" } en email)
app.use(mongoSanitize());

// NOTA: Los comprobantes (PII) ya NO se sirven públicamente.
// Se exponen únicamente vía GET /api/pagos-manual/comprobante/:compraId (autenticado).

// ========================================
// CONEXIÓN A MONGODB
// ========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// ========================================
// RUTAS - SISTEMA ACTUAL (mantener)
// ========================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cursos', require('./routes/cursos'));
app.use('/api/pagos-manual', require('./routes/pagosManual'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));
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

if (!process.env.VERCEL) {
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
}

module.exports = app;
