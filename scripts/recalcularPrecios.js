const mongoose = require('mongoose');
const Curso = require('../models/Curso');
require('dotenv').config();

const migrarYRecalcularPrecios = async () => {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    const cursos = await Curso.find({});
    console.log(`📚 Encontrados ${cursos.length} cursos para migrar\n`);

    const tasas = {
      peru: 3.36,
      chile: 894,
      argentina: 1490,
      uruguay: 39,
      venezuela: 1,
      internacional: 1
    };

    let migrados = 0;
    let actualizados = 0;

    for (const curso of cursos) {
      let precioBase = curso.precioUSD;

      // Si NO tiene precioUSD pero tiene precio viejo, migrar
      if (!precioBase && curso.precio) {
        precioBase = curso.precio;
        curso.precioUSD = precioBase;
        migrados++;
        console.log(`🔄 Migrando "${curso.titulo}"`);
        console.log(`   precio → precioUSD: $${precioBase}`);
      }

      // Si ahora tiene precioBase, calcular precios por país
      if (precioBase) {
        curso.precios = {
          peru: { 
            monto: Math.round(precioBase * tasas.peru), 
            moneda: 'PEN' 
          },
          chile: { 
            monto: Math.round(precioBase * tasas.chile), 
            moneda: 'CLP' 
          },
          argentina: { 
            monto: Math.round(precioBase * tasas.argentina), 
            moneda: 'ARS' 
          },
          uruguay: { 
            monto: Math.round(precioBase * tasas.uruguay), 
            moneda: 'UYU' 
          },
          venezuela: { 
            monto: precioBase, 
            moneda: 'USD' 
          },
          internacional: { 
            monto: precioBase, 
            moneda: 'USD' 
          }
        };

        await curso.save();
        actualizados++;
        
        console.log(`✅ "${curso.titulo}"`);
        console.log(`   💵 USD: $${precioBase}`);
        console.log(`   🇵🇪 Perú: S/${curso.precios.peru.monto}`);
        console.log(`   🇨🇱 Chile: $${curso.precios.chile.monto.toLocaleString('es')}`);
        console.log(`   🇦🇷 Argentina: $${curso.precios.argentina.monto.toLocaleString('es')}\n`);
      } else {
        console.log(`⚠️  "${curso.titulo}" - NO TIENE PRECIO (lo dejamos gratis)\n`);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎉 ¡Proceso completado!`);
    console.log(`   📦 Cursos migrados: ${migrados}`);
    console.log(`   ✅ Cursos actualizados: ${actualizados}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

migrarYRecalcularPrecios();