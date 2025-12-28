const mongoose = require('mongoose');

const compraSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  cursos: [{
    curso: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso',
      required: true
    },
    precio: {
      type: Number,
      required: true
    },
    moneda: {
      type: String,
      default: 'USD'
    }
  }],
  total: {
    type: Number,
    required: true
  },
  moneda: {
    type: String,
    enum: ['USD', 'PEN', 'CLP', 'ARS', 'UYU'],
    default: 'USD'
  },
  pais: {
    type: String,
    enum: ['peru', 'chile', 'argentina', 'uruguay', 'venezuela', 'internacional'],
    default: 'internacional'
  },
  metodoPago: {
    tipo: {
      type: String,
      enum: ['stripe', 'transferencia', 'yape', 'plin', 'mercadopago', 'pagomovil', 'binance', 'paypal'],
      default: 'transferencia'
    },
    nombre: String,
    pais: String
  },
  estadoPago: {
    type: String,
    enum: ['pendiente', 'en_revision', 'aprobado', 'rechazado', 'completado'],
    default: 'pendiente'
  },
  comprobante: {
    url: String,
    nombreArchivo: String,
    fechaSubida: Date
  },
  stripePaymentId: {
    type: String,
    default: null
  },
  stripeSessionId: {
    type: String,
    default: null
  },
  datosFacturacion: {
    nombre: String,
    email: String,
    telefono: String,
    pais: String
  },
  notasAdmin: {
    type: String,
    default: ''
  },
  fechaAprobacion: Date,
  aprobadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Compra', compraSchema);
