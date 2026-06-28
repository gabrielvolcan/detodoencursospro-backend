const mongoose = require('mongoose');
const { construirPreciosPorPais } = require('../utils/precios');

const temaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  videoUrl: {
    type: String,
    default: ''
  },
  // Contenido de texto/prompts para lecciones sin video
  descripcion: {
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
  // ========================================
  // ✅ CORREGIDO: precioUSD ahora tiene default en lugar de required
  // ========================================
  precioUSD: {
    type: Number,
    default: 0,
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

  // Calcular precios por país desde la fuente única de tasas (utils/precios.js)
  if (this.isModified('precioUSD') || this.isModified('esGratuito')) {
    this.precios = construirPreciosPorPais(this.precioUSD);
  }
  next();
});

module.exports = mongoose.model('Curso', cursoSchema);
