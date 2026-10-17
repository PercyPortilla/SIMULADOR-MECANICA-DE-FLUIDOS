export const PALETTE_PRESETS = Object.freeze({
  upn: Object.freeze({
    label: 'UPN',
    description: 'Amarillo institucional, negro y grises técnicos.',
    theme: Object.freeze({ accent: '#ffb81c', background: '#0a0c0f', panel: '#14181d', text: '#f4f4f2' }),
    scene: Object.freeze({ terrain: '#c9b48d', road: '#776f63', concrete: '#a7a6a1', structuralSteel: '#59646a', processSteel: '#8d999d', pipeSteel: '#607e8a', pipeHdpe: '#24292c', safetyYellow: '#ffb81c', mineral: '#8d6848', vehicleYellow: '#e3a320' }),
  }),
  industrial: Object.freeze({
    label: 'Industrial oscuro',
    description: 'Azul petróleo, acero y ámbar.',
    theme: Object.freeze({ accent: '#d6a15f', background: '#0b1117', panel: '#101b22', text: '#e8eef2' }),
    scene: Object.freeze({ terrain: '#b7aa90', road: '#6e6559', concrete: '#929893', structuralSteel: '#65757a', processSteel: '#9ca8a8', pipeSteel: '#638c9c', pipeHdpe: '#30383b', safetyYellow: '#d5a51e', mineral: '#84644a', vehicleYellow: '#d49a1e' }),
  }),
  mineral: Object.freeze({
    label: 'Mineral',
    description: 'Ocres, beige y gris roca.',
    theme: Object.freeze({ accent: '#c78b4e', background: '#14110e', panel: '#211b16', text: '#efe7dc' }),
    scene: Object.freeze({ terrain: '#c9b58f', road: '#8d7b64', concrete: '#9f9a90', structuralSteel: '#706d67', processSteel: '#a09b91', pipeSteel: '#6c8185', pipeHdpe: '#333333', safetyYellow: '#d9a82d', mineral: '#9d6d45', vehicleYellow: '#d69b27' }),
  }),
  technical: Object.freeze({
    label: 'Técnico claro',
    description: 'Blanco, gris y azul técnico.',
    theme: Object.freeze({ accent: '#1769aa', background: '#eef2f5', panel: '#ffffff', text: '#17212a' }),
    scene: Object.freeze({ terrain: '#d1c4aa', road: '#8b8378', concrete: '#b3b5b2', structuralSteel: '#667985', processSteel: '#aeb9bb', pipeSteel: '#467b92', pipeHdpe: '#3a4246', safetyYellow: '#d4a11d', mineral: '#927055', vehicleYellow: '#d59b22' }),
  }),
  contrast: Object.freeze({
    label: 'Alto contraste',
    description: 'Optimizada para proyección en aula.',
    theme: Object.freeze({ accent: '#ffd447', background: '#050607', panel: '#111418', text: '#ffffff' }),
    scene: Object.freeze({ terrain: '#d8c49a', road: '#726558', concrete: '#bdbdb8', structuralSteel: '#6d7f87', processSteel: '#b6c3c5', pipeSteel: '#4d9bb9', pipeHdpe: '#20272a', safetyYellow: '#ffd447', mineral: '#a16f45', vehicleYellow: '#f0ac24' }),
  }),
});

export function getPalettePreset(id) {
  return PALETTE_PRESETS[id] ?? PALETTE_PRESETS.industrial;
}
