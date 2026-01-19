const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  // Campos obligatorios básicos
  titulo: {
    type: String,
    required: [true, 'El título es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria']
  },
  tipo: {
    type: String,
    required: [true, 'El tipo es obligatorio'],
    default: 'libro'
  },
  categoria: {
    type: String,
    required: [true, 'La categoría es obligatoria']
  },
  
  // CAMBIO IMPORTANTE: imagen y precioUSD con defaults
  imagen: {
    type: String,
    default: 'https://via.placeholder.com/400x300?text=Producto'
  },
  precioUSD: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Todo lo demás opcional con Mixed
  subtitulo: String,
  descripcionLarga: String,
  tags: { type: [String], default: [] },
  imagenes: { type: [String], default: [] },
  
  precios: { type: mongoose.Schema.Types.Mixed, default: {} },
  metadatos: { type: mongoose.Schema.Types.Mixed, default: {} },
  videos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  archivos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  incluye: { type: [mongoose.Schema.Types.Mixed], default: [] },
  oferta: { type: mongoose.Schema.Types.Mixed, default: {} },
  limites: { type: mongoose.Schema.Types.Mixed, default: {} },
  
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
  strict: false  // Permite campos extra sin error
});

// Auto-generar slug
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