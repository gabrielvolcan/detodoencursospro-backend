require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Para webhook de Stripe (debe ir antes de express.json())
app.use('/api/pagos/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (comprobantes)
app.use('/uploads', express.static('uploads'));

// Conectar a MongoDB
mongoose.connect('mongodb+srv://gabrielalejandrovolcan_db_user:ZLZuTTB6nGwBEU6B@cluster0.kbw4fz6.mongodb.net/cursos-camaras?retryWrites=true&w=majority')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cursos', require('./routes/cursos'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/pagos-manual', require('./routes/pagosManual'));
app.use('/api/admin', require('./routes/admin'));

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    mensaje: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores general
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    mensaje: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📡 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
