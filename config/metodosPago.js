// ========================================
// 💳 MÉTODOS DE PAGO MANUAL POR PAÍS (datos del receptor de pagos)
// Contiene datos personales/bancarios. Vive SOLO en el backend y se sirve
// vía GET /api/pagos-manual/metodos-pago/:pais (autenticado), de modo que
// NUNCA se incluyen en el bundle público del frontend.
// ========================================
const METODOS_PAGO_POR_PAIS = {
  internacional: {
    nombre: 'Internacional',
    metodos: [
      {
        tipo: 'transferencia',
        nombre: 'Transferencia Internacional',
        instrucciones: `Contactar vía WhatsApp para coordinar pago
Email: detodoencursos@gmail.com
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  peru: {
    nombre: 'Perú',
    metodos: [
      {
        tipo: 'bcp',
        nombre: 'BCP - Yape',
        instrucciones: `BCP 💵
GABRIEL VOLCAN
Cuenta: 37005887674096
CCI: 00237010588767409657
Yape: 989228665
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  chile: {
    nombre: 'Chile',
    metodos: [
      {
        tipo: 'falabella',
        nombre: 'Banco Falabella',
        instrucciones: `Yoryelis Manzaneda
RUT: 26.974.264-K
Email: manzanedayoryelis@gmail.com
Cuenta Corriente: 15170139561
Banco Falabella
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  argentina: {
    nombre: 'Argentina',
    metodos: [
      {
        tipo: 'mercadopago',
        nombre: 'Mercado Pago',
        instrucciones: `👤 Gabriel Volcan
¡Hola! 😀 Te comparto mis datos para que puedas enviarme pesos a través de Mercado Pago👇

Alias: gabriel.040.dejar.mp
CVU: 0000003100074314194223
Nombre: Gabriel Humberto Volcan Altuve`
      }
    ]
  },
  venezuela: {
    nombre: 'Venezuela',
    metodos: [
      {
        tipo: 'pagomovil',
        nombre: 'Pago Móvil - Banco de Venezuela',
        instrucciones: `Teléfono: 04129229098
Cédula: 25011281
Banco: 0102 Bco de Vzla
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  },
  uruguay: {
    nombre: 'Uruguay',
    metodos: [
      {
        tipo: 'prex',
        nombre: 'Prex',
        instrucciones: `Gabriel Volcan
Cuenta Prex: 1771890
Concepto: Pago Curso + Tu Nombre`
      }
    ]
  }
};

// Devuelve los métodos del país pedido; cae a 'internacional' si no existe.
const obtenerMetodosPago = (codigoPais) => {
  const codigo = (codigoPais || 'internacional').toLowerCase();
  return METODOS_PAGO_POR_PAIS[codigo] || METODOS_PAGO_POR_PAIS.internacional;
};

module.exports = { METODOS_PAGO_POR_PAIS, obtenerMetodosPago };
