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
  // ========================================
  // 🆕 NUEVO CAMPO: Curso Gratuito
  // ========================================
  esGratuito: {
    type: Boolean,
    default: false
  },
  precioUSD: {
    type: Number,
    required: true,
    min: 0
  },
  precios: {
    peru: { monto: Number, moneda: { type: String, default: 'PEN' } },
    chile: { monto: Number, moneda: { type: String, default: 'CLP' } },
    argentina: { monto: Number, moneda: { type: String, default: 'ARS' } },
    uruguay: { monto: Number, moneda: { type: String, default: 'UYU' } },
    venezuela: { monto: Number, moneda: { type: String, default: 'VES' } },
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

// ========================================
// 🔧 MIDDLEWARE ACTUALIZADO: Cursos gratuitos = $0
// ========================================
cursoSchema.pre('save', function(next) {
  // Si el curso es gratuito, forzar precio a 0
  if (this.esGratuito) {
    this.precioUSD = 0;
  }

  // Calcular precios por país (TASAS ACTUALIZADAS 10 ENERO 2026)
  if (this.isModified('precioUSD') || this.isModified('esGratuito')) {
    const tasas = {
      peru: 3.36,
      chile: 894,
      argentina: 1505,
      uruguay: 38.9,
      venezuela: 50,
      internacional: 1
    };

    this.precios = {
      peru: { 
        monto: (this.precioUSD * tasas.peru).toFixed(2), 
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
        monto: (this.precioUSD * tasas.uruguay).toFixed(2), 
        moneda: 'UYU' 
      },
      venezuela: { 
        monto: (this.precioUSD * tasas.venezuela).toFixed(2), 
        moneda: 'VES' 
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
