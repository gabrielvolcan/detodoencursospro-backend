const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  // Información básica
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  subtitulo: {
    type: String,
    trim: true
  },
  descripcion: {
    type: String,
    required: true
  },
  descripcionLarga: String,
  tipo: {
    type: String,
    required: true,
    enum: ['curso', 'libro', 'ebook', 'plantilla', 'guia', 'software', 'bundle', 'recurso', 'otro']
  },
  categoria: {
    type: String,
    required: true,
    trim: true
  },
  tags: [String],
  
  // Imagen
  imagen: {
    type: String,
    required: true
  },
  imagenes: [String],
  
  // Precio base en USD
  precioUSD: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Precios calculados automáticamente (NO required)
  precios: {
    internacional: {
      monto: Number,
      moneda: { type: String, default: 'USD' }
    },
    peru: {
      monto: Number,
      moneda: { type: String, default: 'PEN' }
    },
    chile: {
      monto: Number,
      moneda: { type: String, default: 'CLP' }
    },
    argentina: {
      monto: Number,
      moneda: { type: String, default: 'ARS' }
    },
    uruguay: {
      monto: Number,
      moneda: { type: String, default: 'UYU' }
    },
    venezuela: {
      monto: Number,
      moneda: { type: String, default: 'VES' }
    }
  },
  
  // Videos (solo para cursos)
  videos: [{
    titulo: String,
    url: String,
    duracion: Number,
    orden: Number,
    descripcion: String
  }],
  
  // Archivos descargables
  archivos: [{
    nombre: String,
    descripcion: String,
    url: String,
    tipo: String,
    tamaño: String,
    orden: Number,
    esVistPrevia: Boolean
  }],
  
  // Metadatos según tipo
  metadatos: {
    autor: String,
    paginas: Number,
    isbn: String,
    editorial: String,
    añoPublicacion: Number,
    idioma: String,
    version: String,
    compatibilidad: [String],
    requisitos: String,
    software: String,
    versionSoftware: String,
    capas: Boolean,
    instructor: String,
    certificado: Boolean,
    actualizaciones: Boolean,
    soporte: String
  },
  
  // Lo que incluye
  incluye: [{
    texto: String,
    icono: String
  }],
  
  // Oferta
  oferta: {
    activa: { type: Boolean, default: false },
    porcentajeDescuento: { type: Number, default: 0 },
    fechaInicio: Date,
    fechaFin: Date
  },
  
  // Límites
  limites: {
    descargasMaximas: Number,
    diasAcceso: Number,
    dispositivosMaximos: Number
  },
  
  // Valoración y estadísticas
  valoracion: {
    promedio: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  estudiantes: { type: Number, default: 0 },
  descargas: { type: Number, default: 0 },
  
  // Estados
  activo: { type: Boolean, default: true },
  destacado: { type: Boolean, default: false },
  nuevo: { type: Boolean, default: false },
  
  // SEO
  slug: { type: String, unique: true, sparse: true }
  
}, {
  timestamps: true
});

// Generar slug antes de guardar
productoSchema.pre('save', function(next) {
  if (this.isModified('titulo') && !this.slug) {
    this.slug = this.titulo
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  next();
});

module.exports = mongoose.model('Producto', productoSchema);