const mongoose = require('mongoose');

// ========================================
// 📊 Evento de analítica propia (visitas y vistas de producto/curso)
// Lo usa el panel admin para mostrar "de dónde lo ven" y "cuál más ven".
// Se autolimpia a los 180 días (TTL) para no crecer infinito.
// ========================================
const eventoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['page', 'item'], default: 'page' }, // page = visita, item = vio un producto/curso
  path: { type: String, default: '' },
  itemId: { type: String, default: '' },
  itemNombre: { type: String, default: '' },
  itemTipo: { type: String, default: '' }, // curso / producto
  fuente: { type: String, default: 'Directo' }, // derivada del referrer/utm en el server
  referrer: { type: String, default: '' },
  utmSource: { type: String, default: '' },
  visitante: { type: String, default: '' }, // id anónimo del navegador (para contar únicos)
  createdAt: { type: Date, default: Date.now }
});

// TTL: borra eventos de más de 180 días
eventoSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('Evento', eventoSchema);
