const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  // Campos obligatorios básicos
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  imagen: {
    type: String,
    required: true
  },
  precioUSD: {
    type: Number,
    required: true,
    min: 0
  },
  
  // TODO lo demás es opcional
  subtitulo: String,
  descripcionLarga: String,
  tags: [String],
  imagenes: [String],
  
  precios: mongoose.Schema.Types.Mixed,
  metadatos: mongoose.Schema.Types.Mixed,
  videos: [mongoose.Schema.Types.Mixed],
  archivos: [mongoose.Schema.Types.Mixed],
  incluye: [mongoose.Schema.Types.Mixed],
  oferta: mongoose.Schema.Types.Mixed,
  limites: mongoose.Schema.Types.Mixed,
  
  valoracion: {
    promedio: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  estudiantes: { type: Number, default: 0 },
  descargas: { type: Number, default: 0 },
  activo: { type: Boolean, default: true },
  destacado: { type: Boolean, default: false },
  nuevo: { type: Boolean, default: false },
  slug: String
  
}, {
  timestamps: true,
  strict: false
});

productoSchema.pre('save', function(next) {
  if (this.isModified('titulo') && !this.slug) {
    this.slug = this.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('Producto', productoSchema);