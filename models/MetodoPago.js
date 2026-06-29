const mongoose = require('mongoose');

// ========================================
// 💳 MÉTODOS DE PAGO POR PAÍS (editables desde el panel admin)
// Un documento por país. Reemplaza al config estático: ahora las cuentas
// se pueden modificar sin redeploy. El config sigue como semilla/fallback.
// ========================================
const metodoSchema = new mongoose.Schema({
  tipo: { type: String, default: 'transferencia' },
  nombre: { type: String, required: true },
  instrucciones: { type: String, default: '' }
}, { _id: false });

const metodoPagoSchema = new mongoose.Schema({
  pais: { type: String, required: true, unique: true, lowercase: true, trim: true }, // codigo: internacional, peru, chile...
  nombre: { type: String, required: true }, // nombre visible del país
  metodos: { type: [metodoSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('MetodoPago', metodoPagoSchema);
