const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  // ========================================
  // CAMPOS BÁSICOS OBLIGATORIOS
  // ========================================
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
    enum: ['libro', 'ebook', 'curso', 'plantilla', 'guia', 'software', 'recurso', 'bundle'],
    default: 'libro'
  },
  categoria: {
    type: String,
    required: [true, 'La categoría es obligatoria']
  },
  
  // ========================================
  // ARCHIVOS Y MULTIMEDIA
  // ========================================
  imagen: {
    type: String,
    default: 'https://via.placeholder.com/400x300?text=Producto'
  },
  archivoURL: {
    type: String,
    required: [true, 'La URL del archivo es obligatoria']
  },
  archivoPeso: {
    type: String,
    default: ''
  },
  
  // ========================================
  // PRECIO Y MONEDAS
  // ========================================
  precioUSD: {
    type: Number,
    default: 0,
    min: 0
  },
  precios: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // ========================================
  // ESTADOS Y GESTIÓN
  // ========================================
  activo: {
    type: Boolean,
    default: true
  },
  destacado: {
    type: Boolean,
    default: false
  },
  gratis: {
    type: Boolean,
    default: false
  },
  nuevo: {
    type: Boolean,
    default: false
  },
  
  // ========================================
  // ESTADÍSTICAS
  // ========================================
  totalVentas: {
    type: Number,
    default: 0
  },
  totalCompradores: {
    type: Number,
    default: 0
  },
  descargas: {
    type: Number,
    default: 0
  },
  estudiantes: {
    type: Number,
    default: 0
  },
  
  // ========================================
  // VALORACIÓN
  // ========================================
  valoracion: {
    promedio: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // ========================================
  // CAMPOS OPCIONALES (MIXED)
  // ========================================
  subtitulo: String,
  descripcionLarga: String,
  tags: { type: [String], default: [] },
  imagenes: { type: [String], default: [] },
  metadatos: { type: mongoose.Schema.Types.Mixed, default: {} },
  videos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  archivos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  incluye: { type: [mongoose.Schema.Types.Mixed], default: [] },
  oferta: { type: mongoose.Schema.Types.Mixed, default: {} },
  limites: { type: mongoose.Schema.Types.Mixed, default: {} },
  slug: String
  
}, {
  timestamps: true,
  strict: false
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