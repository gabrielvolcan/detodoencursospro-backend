const mongoose = require('mongoose');

const temaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: ''
  },
  duracion: {
    type: String,
    default: ''
  }
});

const moduloSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  temas: [temaSchema]
});

const cursoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descripcionCorta: {
    type: String,
    required: true,
    maxlength: 200
  },
  descripcionCompleta: {
    type: String,
    default: ''
  },
  categoria: {
    type: String,
    required: true
  },
  nivel: {
    type: String,
    enum: ['Principiante', 'Intermedio', 'Avanzado'],
    default: 'Principiante'
  },
  // Precio base en USD
  precioUSD: {
    type: Number,
    required: true,
    min: 0
  },
  // Precios calculados por país (se generan automáticamente)
  precios: {
    peru: { monto: Number, moneda: { type: String, default: 'PEN' } },
    chile: { monto: Number, moneda: { type: String, default: 'CLP' } },
    argentina: { monto: Number, moneda: { type: String, default: 'ARS' } },
    uruguay: { monto: Number, moneda: { type: String, default: 'UYU' } },
    venezuela: { monto: Number, moneda: { type: String, default: 'USD' } },
    internacional: { monto: Number, moneda: { type: String, default: 'USD' } }
  },
  imagen: {
    type: String,
    default: 'https://ejemplo.com/imagen.jpg'
  },
  duracion: {
    type: String,
    default: ''
  },
  temario: [moduloSchema],
  destacado: {
    type: Boolean,
    default: false
  },
  activo: {
    type: Boolean,
    default: true
  },
  estudiantes: {
    type: Number,
    default: 0
  },
  calificacion: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  }
}, {
  timestamps: true
});

// Middleware para calcular precios por país antes de guardar
cursoSchema.pre('save', function(next) {
  if (this.isModified('precioUSD')) {
    // Tasas de cambio aproximadas (actualizar según necesites)
    const tasas = {
      peru: 3.75,      // USD a PEN
      chile: 950,      // USD a CLP
      argentina: 1000, // USD a ARS
      uruguay: 39,     // USD a UYU
      venezuela: 1,    // USD (ya que usan dólares)
      internacional: 1 // USD
    };

    this.precios = {
      peru: { 
        monto: Math.round(this.precioUSD * tasas.peru), 
        moneda: 'PEN' 
      },
      chile: { 
        monto: Math.round(this.precioUSD * tasas.chile), 
        moneda: 'CLP' 
      },
      argentina: { 
        monto: Math.round(this.precioUSD * tasas.argentina), 
        moneda: 'ARS' 
      },
      uruguay: { 
        monto: Math.round(this.precioUSD * tasas.uruguay), 
        moneda: 'UYU' 
      },
      venezuela: { 
        monto: this.precioUSD, 
        moneda: 'USD' 
      },
      internacional: { 
        monto: this.precioUSD, 
        moneda: 'USD' 
      }
    };
  }
  next();
});

module.exports = mongoose.model('Curso', cursoSchema);
