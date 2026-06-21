require('dotenv').config();
const mongoose = require('mongoose');
const Curso = require('../models/Curso');
const Usuario = require('../models/Usuario');

const cursosEjemplo = [
  {
    titulo: "Fundamentos de Instalación de Cámaras CCTV",
    descripcion: "Aprende desde cero todos los conceptos básicos para instalar sistemas de vigilancia profesionales. Incluye teoría sobre tipos de cámaras, cableado, DVR/NVR y configuración inicial.",
    descripcionCorta: "Curso completo para principiantes en instalación de cámaras de seguridad y sistemas CCTV básicos",
    categoria: "Básico",
    precio: 49.99,
    precioAnterior: 79.99,
    imagen: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800",
    duracion: "8 horas",
    nivel: "Principiante",
    destacado: true,
    contenido: [
      { titulo: "Introducción a sistemas CCTV", descripcion: "Historia, tipos y aplicaciones" },
      { titulo: "Componentes principales", descripcion: "Cámaras, cables, DVR/NVR" },
      { titulo: "Herramientas necesarias", descripcion: "Kit básico del instalador" },
      { titulo: "Práctica de instalación", descripcion: "Primer proyecto completo" }
    ],
    calificacion: 4.8,
    estudiantes: 342
  },
  {
    titulo: "Configuración Avanzada de NVR y Grabación",
    descripcion: "Domina la configuración profesional de sistemas de grabación en red. Aprende sobre almacenamiento, redundancia, acceso remoto y optimización de recursos.",
    descripcionCorta: "Configuración experta de NVR, grabación continua, detección de movimiento y acceso remoto",
    categoria: "Avanzado",
    precio: 89.99,
    precioAnterior: 129.99,
    imagen: "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=800",
    duracion: "12 horas",
    nivel: "Avanzado",
    destacado: true,
    contenido: [
      { titulo: "Arquitectura de NVR", descripcion: "Diseño y planificación" },
      { titulo: "Almacenamiento y RAID", descripcion: "Configuración de discos duros" },
      { titulo: "Acceso remoto seguro", descripcion: "VPN y DDNS" },
      { titulo: "Optimización de grabación", descripcion: "Calidad vs espacio" }
    ],
    calificacion: 4.9,
    estudiantes: 189
  },
  {
    titulo: "Instalación de Cámaras IP y Networking",
    descripcion: "Especialízate en cámaras IP modernas y conceptos de networking. Incluye configuración de switches PoE, VLANs y troubleshooting de red.",
    descripcionCorta: "Curso completo de cámaras IP, redes, PoE y configuración profesional de networking",
    categoria: "Intermedio",
    precio: 69.99,
    imagen: "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800",
    duracion: "10 horas",
    nivel: "Intermedio",
    destacado: true,
    contenido: [
      { titulo: "Fundamentos de redes", descripcion: "TCP/IP, subnetting básico" },
      { titulo: "Power over Ethernet", descripcion: "PoE, PoE+ y switches" },
      { titulo: "Configuración de cámaras IP", descripcion: "Web interface y ONVIF" },
      { titulo: "Resolución de problemas", descripcion: "Troubleshooting de red" }
    ],
    calificacion: 4.7,
    estudiantes: 267
  },
  {
    titulo: "Sistemas de Alarma Integrados",
    descripcion: "Aprende a integrar cámaras con sistemas de alarma, sensores de movimiento y automatización. Crea sistemas de seguridad completos.",
    descripcionCorta: "Integración de cámaras con alarmas, sensores y sistemas de automatización del hogar",
    categoria: "Especializado",
    precio: 79.99,
    imagen: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    duracion: "9 horas",
    nivel: "Intermedio",
    contenido: [
      { titulo: "Sensores y detectores", descripcion: "PIR, magnéticos, contactos" },
      { titulo: "Integración con CCTV", descripcion: "Grabación por eventos" },
      { titulo: "Centrales de alarma", descripcion: "DSC, Paradox, Ajax" },
      { titulo: "Automatización", descripcion: "Smart home integration" }
    ],
    calificacion: 4.6,
    estudiantes: 145
  },
  {
    titulo: "Instalación Empresarial y Certificación",
    descripcion: "Curso avanzado para proyectos empresariales. Incluye diseño de sistemas grandes, cableado estructurado, fibra óptica y certificaciones profesionales.",
    descripcionCorta: "Proyectos empresariales, cableado estructurado, fibra óptica y preparación para certificación",
    categoria: "Avanzado",
    precio: 129.99,
    precioAnterior: 199.99,
    imagen: "https://images.unsplash.com/photo-1551808525-51a94da548ce?w=800",
    duracion: "16 horas",
    nivel: "Avanzado",
    contenido: [
      { titulo: "Diseño de proyectos grandes", descripcion: "Planificación y cotización" },
      { titulo: "Cableado estructurado", descripcion: "Normas TIA/EIA" },
      { titulo: "Fibra óptica", descripcion: "Fusión y conectores" },
      { titulo: "Certificación profesional", descripcion: "Preparación para exámenes" }
    ],
    calificacion: 5.0,
    estudiantes: 98
  },
  {
    titulo: "Mantenimiento Preventivo de Sistemas CCTV",
    descripcion: "Aprende las mejores prácticas para mantener sistemas de vigilancia funcionando óptimamente. Incluye diagnóstico, limpieza y actualización de firmware.",
    descripcionCorta: "Mantenimiento, diagnóstico de fallas, actualización de firmware y servicio post-venta",
    categoria: "Básico",
    precio: 39.99,
    imagen: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800",
    duracion: "6 horas",
    nivel: "Todos los niveles",
    contenido: [
      { titulo: "Rutinas de mantenimiento", descripcion: "Calendario y checklist" },
      { titulo: "Limpieza de equipos", descripcion: "Lentes, sensores y ventiladores" },
      { titulo: "Actualización de firmware", descripcion: "Proceso seguro" },
      { titulo: "Diagnóstico de fallas", descripcion: "Troubleshooting sistemático" }
    ],
    calificacion: 4.5,
    estudiantes: 234
  }
];

const poblarDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Limpiar cursos existentes
    await Curso.deleteMany({});
    console.log('🗑️  Cursos anteriores eliminados');

    // Crear cursos
    await Curso.insertMany(cursosEjemplo);
    console.log(`✅ ${cursosEjemplo.length} cursos creados exitosamente`);

    // Crear admin SOLO desde variables de entorno. Nunca credenciales hardcodeadas.
    const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.log('⚠️  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no definidos: se omite la creación del admin.');
    } else {
      let admin = await Usuario.findOne({ email: ADMIN_EMAIL.toLowerCase() });

      if (!admin) {
        admin = new Usuario({
          nombre: 'Administrador',
          email: ADMIN_EMAIL.toLowerCase(),
          password: ADMIN_PASSWORD, // se hashea en el pre-save del modelo
          rol: 'admin',
          emailVerificado: true
        });
        await admin.save();
        console.log('✅ Usuario admin creado:', ADMIN_EMAIL.toLowerCase());
      } else {
        console.log('ℹ️  El admin ya existe, no se recrea.');
      }
    }

    console.log('\n🎉 Base de datos poblada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

poblarDB();
