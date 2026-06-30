const express = require('express');
const router = express.Router();
const Evento = require('../models/Evento');
const { auth, esAdmin } = require('../middleware/auth');

// Deriva la "fuente" de tráfico a partir del utm o del referrer.
function derivarFuente(referrer, utm) {
  if (utm && String(utm).trim()) {
    const u = String(utm).trim().toLowerCase();
    const map = { ig: 'Instagram', fb: 'Facebook', whatsapp: 'WhatsApp', wa: 'WhatsApp' };
    return map[u] || (u.charAt(0).toUpperCase() + u.slice(1));
  }
  if (!referrer) return 'Directo';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('detodoencursos')) return 'Directo';
    if (host.includes('google')) return 'Google';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
    if (host.includes('t.co') || host.includes('twitter') || host === 'x.com') return 'Twitter/X';
    if (host.includes('youtube') || host.includes('youtu.be')) return 'YouTube';
    if (host.includes('tiktok')) return 'TikTok';
    if (host.includes('whatsapp') || host.includes('wa.me')) return 'WhatsApp';
    if (host.includes('bing')) return 'Bing';
    if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
    return host;
  } catch (e) {
    return 'Directo';
  }
}

// ========================================
// POST /api/analytics/track  (público) — registra una visita/vista
// ========================================
router.post('/track', async (req, res) => {
  try {
    const { tipo, path, itemId, itemNombre, itemTipo, referrer, utmSource, visitante } = req.body || {};
    const fuente = derivarFuente(referrer, utmSource);
    await Evento.create({
      tipo: tipo === 'item' ? 'item' : 'page',
      path: String(path || '').slice(0, 200),
      itemId: String(itemId || '').slice(0, 60),
      itemNombre: String(itemNombre || '').slice(0, 160),
      itemTipo: String(itemTipo || '').slice(0, 40),
      fuente,
      referrer: String(referrer || '').slice(0, 300),
      utmSource: String(utmSource || '').slice(0, 60),
      visitante: String(visitante || '').slice(0, 60)
    });
    res.status(204).end();
  } catch (e) {
    res.status(204).end(); // nunca romper la navegación del usuario por analítica
  }
});

// ========================================
// GET /api/analytics/resumen  (admin) — agregados para el panel
// ?dias=30
// ========================================
router.get('/resumen', auth, esAdmin, async (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 30, 1), 365);
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
    const baseMatch = { createdAt: { $gte: desde } };

    const [totales, fuentes, paginas, items, serie] = await Promise.all([
      // visitas (page) y visitantes únicos
      Evento.aggregate([
        { $match: { ...baseMatch, tipo: 'page' } },
        { $group: { _id: null, visitas: { $sum: 1 }, visitantes: { $addToSet: '$visitante' } } },
        { $project: { _id: 0, visitas: 1, visitantes: { $size: { $setDifference: ['$visitantes', [''] ] } } } }
      ]),
      // de dónde lo ven: visitantes únicos por fuente
      Evento.aggregate([
        { $match: { ...baseMatch, tipo: 'page' } },
        { $group: { _id: '$fuente', visitantes: { $addToSet: '$visitante' }, visitas: { $sum: 1 } } },
        { $project: { _id: 0, fuente: '$_id', visitas: 1, visitantes: { $size: { $setDifference: ['$visitantes', ['']] } } } },
        { $sort: { visitas: -1 } },
        { $limit: 12 }
      ]),
      // páginas más vistas
      Evento.aggregate([
        { $match: { ...baseMatch, tipo: 'page' } },
        { $group: { _id: '$path', visitas: { $sum: 1 } } },
        { $project: { _id: 0, path: '$_id', visitas: 1 } },
        { $sort: { visitas: -1 } },
        { $limit: 12 }
      ]),
      // productos/cursos más vistos
      Evento.aggregate([
        { $match: { ...baseMatch, tipo: 'item' } },
        { $group: { _id: { nombre: '$itemNombre', tipo: '$itemTipo' }, vistas: { $sum: 1 } } },
        { $project: { _id: 0, nombre: '$_id.nombre', tipo: '$_id.tipo', vistas: 1 } },
        { $sort: { vistas: -1 } },
        { $limit: 12 }
      ]),
      // serie por día (para mini-gráfico)
      Evento.aggregate([
        { $match: { ...baseMatch, tipo: 'page' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, visitas: { $sum: 1 } } },
        { $project: { _id: 0, dia: '$_id', visitas: 1 } },
        { $sort: { dia: 1 } }
      ])
    ]);

    res.json({
      dias,
      visitas: totales[0]?.visitas || 0,
      visitantes: totales[0]?.visitantes || 0,
      fuentes,
      paginas,
      items,
      serie
    });
  } catch (e) {
    console.error('Error en analítica:', e);
    res.status(500).json({ error: 'Error al obtener la analítica' });
  }
});

module.exports = router;
