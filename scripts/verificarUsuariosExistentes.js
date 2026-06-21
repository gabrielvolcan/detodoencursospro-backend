require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

const verificarUsuarios = async () => {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Conectado a MongoDB');
    
    // Marcar todos los usuarios existentes como verificados
    const resultado = await Usuario.updateMany(
      { emailVerificado: false },
      { 
        $set: { 
          emailVerificado: true,
          tokenVerificacion: undefined,
          tokenVerificacionExpira: undefined
        }
      }
    );
    
    console.log(`✅ ${resultado.modifiedCount} usuarios marcados como verificados`);
    
    // Mostrar usuarios actualizados
    const usuarios = await Usuario.find().select('nombre email emailVerificado');
    console.log('\n📋 Usuarios en la base de datos:');
    usuarios.forEach(u => {
      console.log(`- ${u.nombre} (${u.email}): ${u.emailVerificado ? '✅ Verificado' : '❌ No verificado'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

verificarUsuarios();