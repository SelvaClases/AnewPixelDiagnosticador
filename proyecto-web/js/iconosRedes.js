// Iconos de redes sociales en SVG (blancos, pensados para ir sobre el círculo de color de cada red).
const SVG = 'http://www.w3.org/2000/svg';

export const NOMBRES_RED = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp'
};

const relleno = (d, extra = {}) => ['path', { d, fill: 'currentColor', ...extra }];
const trazo = (etiqueta, atributos) => [etiqueta, { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, ...atributos }];

const FORMAS = {
  instagram: [
    trazo('rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 5 }),
    trazo('circle', { cx: 12, cy: 12, r: 3.8 }),
    ['circle', { cx: 17.2, cy: 6.8, r: 1.1, fill: 'currentColor' }]
  ],
  facebook: [
    relleno('M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21z')
  ],
  linkedin: [
    ['rect', { x: 4, y: 9, width: 3.5, height: 11, fill: 'currentColor' }],
    ['circle', { cx: 5.75, cy: 5.5, r: 2, fill: 'currentColor' }],
    relleno('M10 9h3.4v1.6c.5-.9 1.7-1.9 3.5-1.9 3.6 0 4.1 2.3 4.1 5.3V20h-3.5v-5.3c0-1.3 0-2.9-1.8-2.9s-2.1 1.4-2.1 2.8V20H10z')
  ],
  tiktok: [
    relleno('M16.6 3c.3 2.2 1.7 3.6 3.9 3.8v3.1c-1.4.1-2.7-.3-3.9-1.1v6.1a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.2a2.5 2.5 0 1 0 1.6 2.3V3z')
  ],
  youtube: [
    relleno(
      'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z',
      { 'fill-rule': 'evenodd' }
    )
  ],
  whatsapp: [
    trazo('path', { d: 'M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }),
    relleno(
      'M9.2 7.6c-.3 0-.7.1-1 .5-.3.4-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.3 2.4.9 2.9.8 3.5.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.4l-2-.9c-.3-.1-.5-.1-.7.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.5-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.5-.4-.5-.6-.5z',
      { transform: 'translate(1.8 1.8) scale(0.85)' }
    )
  ]
};

export function iconoRed(plataforma) {
  const svg = document.createElementNS(SVG, 'svg');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  (FORMAS[plataforma] || []).forEach(([etiqueta, atributos]) => {
    const forma = document.createElementNS(SVG, etiqueta);
    Object.entries(atributos).forEach(([nombre, valor]) => forma.setAttribute(nombre, valor));
    svg.append(forma);
  });

  return svg;
}
