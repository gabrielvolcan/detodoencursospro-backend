// ========================================
// 📦 MODELO GENÉRICO DE PRODUCTO
// Soporta CURSOS, LIBROS, EBOOKS, PLANTILLAS, ETC.
// ========================================

const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  // ========================================
  // INFORMACIÓN BÁSICA (para todos los productos)
  // ========================================
  titulo: {
    type: String,
    required: true
  },
  
  subtitulo: String,
  
  descripcion: {
    type: String,
    required: true
  },
  
  descripcionLarga: String,  // HTML/Markdown permitido
  
  imagen: {
    type: String,
    required: true
  },
  
  imagenes: [String],  // Galería de imágenes adicionales
  
  // ========================================
  // 🎯 TIPO DE PRODUCTO (clave principal)
  // ========================================
  tipo: {
    type: String,
    enum: [
      'curso',           // Curso con videos
      'libro',           // Libro PDF
      'ebook',           // Ebook digital
      'plantilla',       // Plantillas (PSD, Figma, etc)
      'guia',            // Guías descargables
      'software',        // Programas/apps
      'bundle',          // Paquete de productos
      'recurso',         // Recursos gráficos
      'otro'             // Otro tipo
    ],
    required: true
  },
  
  // ========================================
  // CATEGORÍA Y TAGS
  // ========================================
  categoria: {
    type: String,
    required: true
  },
  
  tags: [String],
  
  // ========================================
  // PRECIOS (por país)
  // ========================================
  precioUSD: {
    type: Number,
    required: true
  },
  
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
  
  // ========================================
  // 📹 CONTENIDO PARA CURSOS (solo si tipo='curso')
  // ========================================
  videos: [{
    titulo: String,
    url: String,
    duracion: Number,  // en minutos
    orden: Number,
    descripcion: String,
    recursos: [String]  // Links a materiales adicionales
  }],
  
  duracion: String,  // "12 horas", "3 meses"
  nivel: {
    type: String,
    enum: ['Principiante', 'Intermedio', 'Avanzado', 'Todos']
  },
  
  // ========================================
  // 📦 ARCHIVOS DESCARGABLES (para libros, ebooks, plantillas, etc)
  // ========================================
  archivos: [{
    nombre: {
      type: String,
      required: true
    },
    descripcion: String,
    url: {
      type: String,
      required: true  // URL en Cloudinary, S3, etc
    },
    cloudinaryId: String,  // Para eliminar después
    tipo: {
      type: String,
      enum: ['pdf', 'epub', 'mobi', 'zip', 'rar', 'psd', 'ai', 'fig', 'xd', 'docx', 'xlsx', 'exe', 'dmg', 'otro']
    },
    tamaño: String,      // "5.2 MB"
    tamañoBytes: Number,
    extension: String,   // "pdf", "zip"
    orden: Number,
    esVistPrevia: Boolean  // Si es una muestra gratis
  }],
  
  // ========================================
  // METADATOS ESPECÍFICOS POR TIPO
  // ========================================
  metadatos: {
    // Para libros/ebooks:
    autor: String,
    paginas: Number,
    isbn: String,
    editorial: String,
    añoPublicacion: Number,
    idioma: String,
    
    // Para software:
    version: String,
    compatibilidad: [String],  // ["Windows", "Mac", "Linux"]
    requisitos: String,
    
    // Para plantillas:
    software: String,  // "Photoshop", "Figma", etc
    versionSoftware: String,
    capas: Boolean,
    
    // Para cursos:
    instructor: String,
    certificado: Boolean,
    
    // General:
    actualizaciones: Boolean,  // Si incluye actualizaciones gratis
    soporte: String           // "6 meses", "Ilimitado"
  },
  
  // ========================================
  // LO QUE INCLUYE (lista de características)
  // ========================================
  incluye: [{
    icono: String,  // Nombre del icono lucide-react
    texto: String   // "Acceso de por vida"
  }],
  
  // ========================================
  // VISTA PREVIA (muestra gratis)
  // ========================================
  vistaPrevia: {
    activa: Boolean,
    tipo: String,  // 'video', 'pdf', 'imagenes'
    url: String,   // URL de la vista previa
    descripcion: String
  },
  
  // ========================================
  // ESTADÍSTICAS
  // ========================================
  estudiantes: {
    type: Number,
    default: 0
  },
  
  descargas: {
    type: Number,
    default: 0
  },
  
  valoracion: {
    promedio: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // ========================================
  // ESTADO Y VISIBILIDAD
  // ========================================
  activo: {
    type: Boolean,
    default: true
  },
  
  destacado: {
    type: Boolean,
    default: false
  },
  
  nuevo: {
    type: Boolean,
    default: false
  },
  
  oferta: {
    activa: Boolean,
    porcentajeDescuento: Number,
    fechaInicio: Date,
    fechaFin: Date
  },
  
  // ========================================
  // LÍMITES Y RESTRICCIONES
  // ========================================
  limites: {
    descargasMaximas: Number,      // null = ilimitadas
    diasAcceso: Number,             // null = permanente
    dispositivosMaximos: Number     // null = ilimitados
  },
  
  // ========================================
  // SEO
  // ========================================
  slug: {
    type: String,
    unique: true
  },
  
  metaTitle: String,
  metaDescription: String,
  
}, {
  timestamps: true
});

// Índices para búsqueda rápida
productoSchema.index({ tipo: 1, activo: 1 });
productoSchema.index({ categoria: 1 });
productoSchema.index({ destacado: 1 });
productoSchema.index({ slug: 1 });

// Generar slug automáticamente
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