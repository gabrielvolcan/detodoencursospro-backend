const express = require('express');
const router = express.Router();
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Compra = require('../models/Compra');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta si no existe
if (!fs.existsSync('uploads/comprobantes')) {
  fs.mkdirSync('uploads/comprobantes', { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/comprobantes/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comprobante-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes'));
  }
});

// Crear orden de compra manual (sin Stripe)
router.post('/crear-orden-manual', auth, async (req, res) => {
  try {
    const { cursosIds, metodoPago, moneda, pais } = req.body;

    // Validar que pais sea válido
    const paisesValidos = ['peru', 'chile', 'argentina', 'uruguay', 'venezuela', 'internacional'];
    const paisNormalizado = pais ? pais.toLowerCase() : 'internacional';
    
    if (!paisesValidos.includes(paisNormalizado)) {
      return res.status(400).json({ error: 'País no válido' });
    }

    // Obtener cursos
    const cursos = await Curso.find({ _id: { $in: cursosIds }, activo: true });

    if (cursos.length !== cursosIds.length) {
      return res.status(400).json({ error: 'Algunos cursos no están disponibles' });
    }

    // Calcular total según el país
    let total = 0;
    let monedaFinal = moneda || 'USD';
    
    const cursosConPrecio = cursos.map(curso => {
      let precioDelCurso;
      
      // Obtener precio según el país
      if (curso.precios && curso.precios[paisNormalizado]) {
        precioDelCurso = curso.precios[paisNormalizado].monto;
        monedaFinal = curso.precios[paisNormalizado].moneda;
      } 
      // Fallback 1: usar precioUSD
      else if (curso.precioUSD) {
        precioDelCurso = curso.precioUSD;
        monedaFinal = 'USD';
      }
      // Fallback 2: usar precio viejo
      else if (curso.precio) {
        precioDelCurso = curso.precio;
        monedaFinal = 'USD';
      }
      // Fallback 3: error
      else {
        throw new Error(`El curso "${curso.titulo}" no tiene precio configurado`);
      }
      
      total += precioDelCurso;
      
      return {
        curso: curso._id,
        precio: precioDelCurso,
        moneda: monedaFinal
      };
    });

    // Validar que el total sea un número válido
    if (isNaN(total) || total <= 0) {
      return res.status(400).json({ 
        error: 'Error calculando el total. Verifica que los cursos tengan precios configurados.' 
      });
    }

    // Crear compra pendiente
    const compra = new Compra({
      usuario: req.usuario._id,
      cursos: cursosConPrecio,
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

    res.status(201).json({
      compraId: compra._id,
      total: compra.total,
      moneda: compra.moneda,
      mensaje: 'Orden creada. Por favor sube tu comprobante de pago.'
    });
  } catch (error) {
    console.error('Error creando orden:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir comprobante de pago
router.post('/subir-comprobante/:compraId', auth, upload.single('comprobante'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const compra = await Compra.findById(req.params.compraId);

    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    if (compra.usuario.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const fileUrl = `/uploads/comprobantes/${req.file.filename}`;

    compra.comprobante = {
      url: fileUrl,
      nombreArchivo: req.file.filename,
      fechaSubida: new Date()
    };
    compra.estadoPago = 'en_revision';

    await compra.save();

    res.json({
      mensaje: 'Comprobante subido exitosamente. Tu pago está en revisión.',
      compra,
      comprobanteUrl: fileUrl
    });
  } catch (error) {
    console.error('Error subiendo comprobante:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener mis compras
router.get('/mis-compras', auth, async (req, res) => {
  try {
    const compras = await Compra.find({ usuario: req.usuario._id })
      .populate('cursos.curso')
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