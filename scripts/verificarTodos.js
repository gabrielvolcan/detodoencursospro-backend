require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

const verificar = async () => {
  try {
    await mongoose.connect('mongodb+srv://gabrielalejandrovolcan_db_user:ZLZuTTB6nGwBEU6B@cluster0.kbw4fz6.mongodb.net/cursos-camaras?retryWrites=true&w=majority');
    
    console.log('✅ Conectado a MongoDB');
    
    // ACTUALIZAR TODOS (incluyendo los que no tienen el campo)
    const resultado = await Usuario.updateMany(
      {
        $or: [
          { emailVerificado: { $ne: true } },  // No es true
          { emailVerificado: { $exists: false } }  // No existe el campo
        ]
      },
      { 
        $set: { emailVerificado: true },
        $unset: { tokenVerificacion: "", tokenVerificacionExpira: "" }
      }
    );
    
    console.log(`✅ ${resultado.modifiedCount} usuarios actualizados`);
    
    const usuarios = await Usuario.find().select('nombre email emailVerificado');
    console.log('\n📋 Usuarios en la base de datos:');
    usuarios.forEach(u => {
      const icono = u.emailVerificado ? '✅' : '❌';
      console.log(`${icono} ${u.nombre} (${u.email})`);
    });
    
    console.log('\n✅ ¡Proceso completado!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

verificar();