export const TIPOS_PREGUNTA = {
  unica: {
    nombre: 'Respuesta única',
    detalle: 'El cliente elige una sola opción'
  },
  multiple: {
    nombre: 'Respuestas múltiples',
    detalle: 'Casillas: el cliente marca varias y cada una pondera'
  },
  abierta: {
    nombre: 'Respuesta abierta',
    detalle: 'El cliente escribe con sus palabras y no suma puntaje'
  }
};

const sumar = (valores) => valores.reduce((total, valor) => total + valor, 0);

export function agruparPorArea(preguntas) {
  const areas = new Map();

  preguntas.forEach((pregunta) => {
    if (!areas.has(pregunta.area)) {
      areas.set(pregunta.area, []);
    }
    areas.get(pregunta.area).push(pregunta);
  });

  return [...areas].map(([nombre, items]) => ({ nombre, preguntas: items }));
}

export function rangoPosible(pregunta) {
  if (pregunta.tipo === 'abierta' || !pregunta.alternativas.length) {
    return { minimo: 0, maximo: 0 };
  }

  const scores = pregunta.alternativas.map((alternativa) => Number(alternativa.score));

  if (pregunta.tipo === 'unica') {
    return { minimo: Math.min(...scores), maximo: Math.max(...scores) };
  }

  const negativos = sumar(scores.filter((score) => score < 0));
  const positivos = sumar(scores.filter((score) => score > 0));

  return {
    minimo: negativos < 0 ? negativos : pregunta.obligatoria ? Math.min(...scores) : 0,
    maximo: positivos > 0 ? positivos : pregunta.obligatoria ? Math.max(...scores) : 0
  };
}

export function rangoPosibleDeArea(preguntas) {
  const rangos = preguntas.filter((pregunta) => pregunta.activa).map(rangoPosible);

  return {
    minimo: sumar(rangos.map((rango) => rango.minimo)),
    maximo: sumar(rangos.map((rango) => rango.maximo))
  };
}

export function huecosDeCobertura(inputs, minimo, maximo) {
  const huecos = [];
  let cursor = minimo;

  [...inputs]
    .sort((a, b) => a.minimo - b.minimo)
    .forEach((rango) => {
      if (rango.minimo > cursor && cursor <= maximo) {
        huecos.push([cursor, Math.min(rango.minimo - 1, maximo)]);
      }
      cursor = Math.max(cursor, rango.maximo + 1);
    });

  if (cursor <= maximo) {
    huecos.push([cursor, maximo]);
  }

  return huecos;
}
