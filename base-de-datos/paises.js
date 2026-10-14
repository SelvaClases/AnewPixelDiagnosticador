const DOMINIOS_PAIS = {
  'diagnostico-app-mx.anewpixel.com': 'MX',
  'diagnostico-app-pe.anewpixel.com': 'PE'
};

export function paisDesdeHost(host) {
  const limpio = String(host || '').trim().toLowerCase();
  return DOMINIOS_PAIS[limpio] || '';
}
