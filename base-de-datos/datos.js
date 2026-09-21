export const areas = [
  {
    nombre: 'Experiencia y conversión',
    inputs: [
      [20, 80, 1],
      [81, 120, 2],
      [121, 160, 3],
      [161, 200, 4]
    ],
    preguntas: [
      {
        pregunta: 'Actualmente ¿qué canales digitales usas en tu plan comercial?',
        alternativas: [
          ['Paginas web, email marketing y redes', 10],
          ['Pagina web y Redes sociales (Facebook + IG)', 20],
          ['Solo redes sociales', 30],
          ['Solo Whatsapp', 40]
        ]
      },
      {
        pregunta: '¿Cómo captas nuevos clientes?',
        alternativas: [
          ['Realizo campañas en redes sociales', 20],
          ['Uso el formulario de mi pagina web', 30],
          ['El boca a boca de mis clientes', 40],
          ['Publicidad física (volantes)', 10]
        ]
      },
      {
        pregunta: 'Actualmente ¿Cómo gestionas a los clientes captados?',
        alternativas: [
          ['Manualmente en un excel', 30],
          ['Realizó algunas automatizaciones', 20],
          ['Tengo un sistema (CRM)', 10],
          ['No tengo un proceso claro', 40]
        ]
      },
      {
        pregunta: '¿Cuánto invierte aproximadamente mensualmente en publicidad digital?',
        alternativas: [
          ['No invertimos', 40],
          ['Menos de $400', 30],
          ['$400–$1500', 20],
          ['Mas de $2000', 10]
        ]
      }
    ]
  },
  {
    nombre: 'Datos y medición',
    inputs: [
      [40, 100, 1],
      [101, 140, 2],
      [141, 190, 3],
      [191, 250, 4]
    ],
    preguntas: [
      {
        pregunta: '¿Que tipo de campañas realizas?',
        alternativas: [
          ['Hago campañas de prospectos', 10],
          ['Hago campañas de promoción', 20],
          ['Solo invierto en algunas publicaciones', 40],
          ['Hago campañas para posicionar mi marca', 30]
        ]
      },
      {
        pregunta: '¿Qué métricas utilizan para evaluar sus campañas?',
        alternativas: [
          ['Conversiones', 15],
          ['Clics e impresiones', 30],
          ['Metricas avanzadas (CTR, CAC, ROAS)', 5],
          ['No medimos resultados', 50]
        ]
      },
      {
        pregunta: 'Realizas acciones adicionales a las campañas publicitarias?',
        alternativas: [
          ['Remarketing', 15],
          ['Hacemos seguimiento en pipelines', 10],
          ['No de momento', 50],
          ['otro', 25]
        ]
      },
      {
        pregunta: '¿Cuántos clientes nuevos recibes mensualmente?',
        alternativas: [
          ['Menos de 500 leads', 40],
          ['de 500 a 1500 leads', 30],
          ['1500 a 5000 leads', 20],
          ['Mas de 5000 leads', 10]
        ]
      }
    ]
  },
  {
    nombre: 'Tecnología y automatización',
    inputs: [
      [40, 70, 1],
      [71, 100, 2],
      [101, 130, 3]
    ],
    preguntas: [
      {
        pregunta: '¿Cuántos terminan comprando o cierran la compra aproximandamente?',
        alternativas: [
          ['Menos del 10%', 50],
          ['del 10% a 15%', 30],
          ['del 15% al 20%', 15],
          ['Mas del 20%', 5]
        ]
      },
      {
        pregunta: '¿Dónde suelen producirse más errores o retrasos?',
        alternativas: [
          ['Captación de clientes', 15],
          ['Seguimiento comercial y postventa', 20],
          ['Gestión interna', 25],
          ['No tenemos identificado el problema', 40]
        ]
      },
      {
        pregunta: '¿En qué punto crees que pierden más clientes?',
        alternativas: [
          ['Al visitar la web/redes para solicitar información', 15],
          ['Durante el proceso comercial', 20],
          ['Despues de comprar', 25],
          ['No lo sabemos', 40]
        ]
      }
    ]
  },
  {
    nombre: 'Innovación',
    inputs: [
      [20, 50, 1],
      [51, 80, 2]
    ],
    preguntas: [
      {
        pregunta:
          'Cuándo fue la última vez que hiciste una mejora importante en tu producto, servicio o experiencia digital?',
        alternativas: [
          ['Hace más de 2 años', 40],
          ['Hace 1–2 años', 30],
          ['Hace menos de 6 meses', 20],
          ['Estamos realizando mejoras actualmente', 10]
        ]
      },
      {
        pregunta: '¿Cuándo fue la última vez que analizaron o rediseñaron la experiencia digital de sus clientes?',
        alternativas: [
          ['Nunca', 40],
          ['Hace más de 2 años', 30],
          ['Hace menos de un año', 20],
          ['Lo hacemos continuamente', 10]
        ]
      }
    ]
  }
];

export const administradorInicial = {
  nombre: 'Administrador principal',
  correo: 'miguelangelrubiov@gmail.com',
  claveHash:
    'scrypt$1819f4e0178bb06d7127440ef0c3a2bd$cc1bf4d803200aee5e498dd11ad81d4539ea323b67e137db130a0101249d4eebfce93c2a25dbb1331a9d236c1fabfaa87c59b68f0c581cae539e975e68fc4e3e'
};
