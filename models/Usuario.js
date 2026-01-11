const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  telefono: {
    type: String,
    default: ''
  },
  rol: {
    type: String,
    enum: ['usuario', 'admin'],
    default: 'usuario'
  },
  // ========================================
  // ✉️ CAMPOS DE VERIFICACIÓN DE EMAIL
  // ========================================
  emailVerificado: {
    type: Boolean,
    default: false
  },
  tokenVerificacion: {
    type: String
  },
  tokenVerificacionExpira: {
    type: Date
  },
  // ========================================
  // 🔑 CAMPOS DE RECUPERACIÓN DE CONTRASEÑA
  // ========================================
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  // ========================================
  // 📚 CURSOS COMPRADOS
  // ========================================
  cursosComprados: [{
    curso: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Curso'
    },
    fechaCompra: {
      type: Date,
      default: Date.now
    },
    precioCompra: Number,
    progresoVideos: [{
      type: String
    }],
    completado: {
      type: Boolean,
      default: false
    },
    fechaCompletado: Date,
    certificado: {
      generado: {
        type: Boolean,
        default: false
      },
      url: String,
      fechaGeneracion: Date,
      codigoCertificado: String
    }
  }],
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Encriptar password antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Método para comparar passwords
usuarioSchema.methods.compararPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema);