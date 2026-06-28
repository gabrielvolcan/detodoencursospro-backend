const express = require('express');
const router = express.Router();
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Compra = require('../models/Compra');
const Producto = require('../models/Producto');
const { auth } = require('../middleware/auth');
const { notificarNuevaCompra, notificarComprobanteSubido } = require('../services/telegramService');
const { limitadorSubidaArchivos } = require('../middleware/security');
const { PAISES_VALIDOS, precioItemPorPais } = require('../utils/precios');
const { obtenerMetodosPago } = require('../config/metodosPago');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Mapa mimetype validado -> extensión segura (la extensión NO se deriva del nombre del usuario)
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

// Los comprobantes se guardan en MongoDB (persistentes entre redeploys).
// multer mantiene el archivo en memoria; no se escribe a disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) && MIME_EXT[file.mimetype] !== undefined;
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes'));
  }
});

// Valida los magic bytes reales del buffer subido (defensa contra mimetype/extensión falsificados).
// Devuelve true si la firma coincide con jpg/png/webp/gif.
function validarMagicBytes(buf) {
  if (!buf || buf.length < 12) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return true;
  // GIF: 47 49 46 38 (GIF8)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WEBP: "RIFF" .... "WEBP"
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
}

// Métodos de pago del país solicitado (datos sensibles: solo usuarios autenticados).
// Devuelve únicamente el país pedido, nunca el listado completo.
router.get('/metodos-pago/:pais', auth, (req, res) => {
  try {
    const metodos = obtenerMetodosPago(req.params.pais);
    res.json(metodos);
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los métodos de pago' });
  }
});

// Crear orden de compra manual (sin Stripe)
router.post('/crear-orden-manual', auth, async (req, res) => {
  try {
    const { cursosIds, productosIds, metodoPago, moneda, pais } = req.body;

    // Validar que metodoPago y sus campos existan (evita crash 500 si vienen undefined)
    if (!metodoPago || typeof metodoPago !== 'object' || !metodoPago.tipo) {
      return res.status(400).json({ error: 'Método de pago no válido' });
    }

    const cursosArr = Array.isArray(cursosIds) ? cursosIds : [];
    const productosArr = Array.isArray(productosIds) ? productosIds : [];

    // La orden debe tener al menos un curso o un producto
    if (cursosArr.length === 0 && productosArr.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos un curso o producto' });
    }

    // Validar que pais sea válido
    const paisNormalizado = pais ? pais.toLowerCase() : 'internacional';

    if (!PAISES_VALIDOS.includes(paisNormalizado)) {
      return res.status(400).json({ error: 'País no válido' });
    }

    let total = 0;
    let monedaFinal = moneda || 'USD';

    // Precio de un ítem (curso/producto) según el país, desde la fuente única (utils/precios.js).
    const calcularPrecio = (item) => precioItemPorPais(item, paisNormalizado);

    // Cursos
    const cursos = cursosArr.length
      ? await Curso.find({ _id: { $in: cursosArr }, activo: true })
      : [];
    if (cursos.length !== cursosArr.length) {
      return res.status(400).json({ error: 'Algunos cursos no están disponibles' });
    }
    const cursosConPrecio = cursos.map(curso => {
      const p = calcularPrecio(curso);
      if (!p) throw new Error(`El curso "${curso.titulo}" no tiene precio configurado`);
      total += p.precio;
      monedaFinal = p.moneda;
      return { curso: curso._id, precio: p.precio, moneda: p.moneda };
    });

    // Productos digitales
    const productos = productosArr.length
      ? await Producto.find({ _id: { $in: productosArr }, activo: true })
      : [];
    if (productos.length !== productosArr.length) {
      return res.status(400).json({ error: 'Algunos productos no están disponibles' });
    }
    const productosConPrecio = productos.map(prod => {
      const p = calcularPrecio(prod);
      if (!p) throw new Error(`El producto "${prod.titulo}" no tiene precio configurado`);
      total += p.precio;
      monedaFinal = p.moneda;
      return { producto: prod._id, precio: p.precio, moneda: p.moneda };
    });

    // Validar que el total sea un número válido
    if (isNaN(total) || total <= 0) {
      return res.status(400).json({
        error: 'Error calculando el total. Verifica que los ítems tengan precios configurados.'
      });
    }

    // Crear compra pendiente
    const compra = new Compra({
      usuario: req.usuario._id,
      cursos: cursosConPrecio,
      productos: productosConPrecio,
      total: Math.round(total * 100) / 100, // Redondear a 2 decimales
      moneda: monedaFinal,
      pais: paisNormalizado,
      metodoPago: {
        tipo: metodoPago.tipo,
        nombre: metodoPago.nombre,
        pais: paisNormalizado
      },
      estadoPago: 'pendiente',
      datosFacturacion: {
        nombre: req.usuario.nombre,
        email: req.usuario.email,
        telefono: req.usuario.telefono,
        pais: paisNormalizado
      }
    });

    await compra.save();

    // 📣 Notificar a Telegram (cursos + productos)
    notificarNuevaCompra({
      nombre: req.usuario.nombre,
      email:  req.usuario.email,
      total:  compra.total,
      moneda: compra.moneda,
      metodo: metodoPago.nombre || metodoPago.tipo,
      cursos: [...cursos.map(c => c.titulo), ...productos.map(p => p.titulo)],
      pais:   paisNormalizado
    });

    res.status(201).json({
      compraId: compra._id,
      total: compra.total,
      moneda: compra.moneda,
      mensaje: 'Orden creada. Por favor sube tu comprobante de pago.'
    });
  } catch (error) {
    console.error('Error creando orden:', error);
    res.status(500).json({ error: 'Error al crear la orden' });
  }
});

// Subir comprobante de pago
router.post('/subir-comprobante/:compraId', auth, limitadorSubidaArchivos, upload.single('comprobante'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    // Validar los magic bytes REALES del archivo (defensa contra mimetype/extensión falsificados).
    if (!validarMagicBytes(req.file.buffer)) {
      return res.status(400).json({ error: 'El archivo no es una imagen válida' });
    }

    const compra = await Compra.findById(req.params.compraId);

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (compra.usuario.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Nombre no adivinable + extensión derivada del mimetype validado
    const ext = MIME_EXT[req.file.mimetype] || '.bin';
    const nombreArchivo = 'comprobante-' + crypto.randomBytes(16).toString('hex') + ext;
    // URL = endpoint autenticado que sirve la imagen desde Mongo
    const fileUrl = `/api/pagos-manual/comprobante/${compra._id}`;

    compra.comprobante = {
      url: fileUrl,
      nombreArchivo,
      mimetype: req.file.mimetype,
      data: req.file.buffer, // guardado persistente en MongoDB
      fechaSubida: new Date()
    };
    compra.estadoPago = 'en_revision';

    await compra.save();

    // 📣 Notificar a Telegram
    notificarComprobanteSubido({
      nombre:   req.usuario.nombre,
      email:    req.usuario.email,
      total:    compra.total,
      moneda:   compra.moneda,
      metodo:   compra.metodoPago?.nombre || compra.metodoPago?.tipo || 'Manual',
      compraId: compra._id
    });

    // No devolver el buffer de la imagen en la respuesta
    compra.comprobante.data = undefined;

    res.json({
      mensaje: 'Comprobante subido exitosamente. Tu pago está en revisión.',
      compra,
      comprobanteUrl: fileUrl
    });
  } catch (error) {
    console.error('Error subiendo comprobante:', error);
    res.status(500).json({ error: 'Error al subir el comprobante' });
  }
});

// Servir el comprobante de pago (PII) — SOLO al dueño de la compra o a un admin.
// La imagen vive en MongoDB (persistente); se trae explícitamente el campo data.
router.get('/comprobante/:compraId', auth, async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.compraId)
      .select('+comprobante.data');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    // Autorización: dueño de la compra o admin
    const esDueno = compra.usuario.toString() === req.usuario._id.toString();
    if (!esDueno && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!compra.comprobante?.data) {
      return res.status(404).json({ error: 'Esta compra no tiene comprobante' });
    }

    res.set('Content-Type', compra.comprobante.mimetype || 'image/jpeg');
    res.set('Cache-Control', 'private, no-store');
    return res.send(compra.comprobante.data);
  } catch (error) {
    console.error('Error sirviendo comprobante:', error);
    res.status(500).json({ error: 'Error al obtener el comprobante' });
  }
});

// Obtener mis compras
router.get('/mis-compras', auth, async (req, res) => {
  try {
    const compras = await Compra.find({ usuario: req.usuario._id })
      .populate('cursos.curso')
      .populate('productos.producto')
      .sort({ createdAt: -1 });

    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalle de una compra
router.get('/compra/:id', auth, async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id)
      .populate('cursos.curso')
      .populate('productos.producto')
      .populate('usuario', 'nombre email');

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    // Solo el usuario dueño o admin puede ver
    if (compra.usuario._id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(compra);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;