const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');
const Compra = require('../models/Compra');
const { auth } = require('../middleware/auth');

// Crear sesión de checkout
router.post('/crear-checkout', auth, async (req, res) => {
  try {
    const { cursosIds } = req.body;

    // Obtener cursos
    const cursos = await Curso.find({ _id: { $in: cursosIds }, activo: true });

    if (cursos.length !== cursosIds.length) {
      return res.status(400).json({ error: 'Algunos cursos no están disponibles' });
    }

    // Crear line items para Stripe
    const lineItems = cursos.map(curso => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: curso.titulo,
          description: curso.descripcionCorta,
          images: [curso.imagen]
        },
        unit_amount: Math.round(curso.precio * 100) // Convertir a centavos
      },
      quantity: 1
    }));

    // Crear compra pendiente
    const compra = new Compra({
      usuario: req.usuario._id,
      cursos: cursos.map(c => ({ curso: c._id, precio: c.precio })),
      total: cursos.reduce((sum, c) => sum + c.precio, 0),
      metodoPago: 'stripe',
      estadoPago: 'pendiente',
      datosFacturacion: {
        nombre: req.usuario.nombre,
        email: req.usuario.email,
        telefono: req.usuario.telefono
      }
    });

    await compra.save();

    // Crear sesión de Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/carrito`,
      customer_email: req.usuario.email,
      metadata: {
        compraId: compra._id.toString(),
        usuarioId: req.usuario._id.toString()
      }
    });

    // Actualizar compra con session ID
    compra.stripeSessionId = session.id;
    await compra.save();

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creando checkout:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar pago exitoso
router.get('/verificar-pago/:sessionId', auth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    if (session.payment_status === 'paid') {
      const compra = await Compra.findOne({ stripeSessionId: session.id });

      if (!compra) {
        return res.status(404).json({ error: 'Compra no encontrada' });
      }

      // Si ya fue procesada, retornar
      if (compra.estadoPago === 'completado') {
        return res.json({ mensaje: 'Pago ya procesado', compra });
      }

      // Actualizar compra
      compra.estadoPago = 'completado';
      compra.stripePaymentId = session.payment_intent;
      await compra.save();

      // Agregar cursos al usuario
      const usuario = await Usuario.findById(compra.usuario);
      
      for (const item of compra.cursos) {
        const yaComprado = usuario.cursosComprados.some(
          c => c.curso.toString() === item.curso.toString()
        );

        if (!yaComprado) {
          usuario.cursosComprados.push({
            curso: item.curso,
            fechaCompra: new Date(),
            precioCompra: item.precio,
            progresoVideos: []
          });

          // Incrementar contador de estudiantes
          await Curso.findByIdAndUpdate(item.curso, {
            $inc: { estudiantes: 1 }
          });
        }
      }

      await usuario.save();

      res.json({ 
        mensaje: 'Pago completado exitosamente',
        compra,
        cursos: compra.cursos
      });
    } else {
      res.status(400).json({ error: 'El pago no se ha completado' });
    }
  } catch (error) {
    console.error('Error verificando pago:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook de Stripe (opcional pero recomendado)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Error webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Aquí puedes procesar el pago si no usas la verificación manual
    console.log('Pago completado via webhook:', session.id);
  }

  res.json({ received: true });
});

// Obtener historial de compras del usuario
router.get('/mis-compras', auth, async (req, res) => {
  try {
    const compras = await Compra.find({ 
      usuario: req.usuario._id,
      estadoPago: 'completado'
    })
    .populate('cursos.curso')
    .sort({ createdAt: -1 });

    res.json(compras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
