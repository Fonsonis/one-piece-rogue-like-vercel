// ============ GRAND LINE LIKE — Datos del juego ============
// Roguelike de One Piece inspirado en la estructura de pokelike.
// Proyecto fan sin ánimo de lucro. Gráficos propios (emoji/CSS).

const TYPES = {
  Corte:     { color: '#b0b7c3', emoji: '⚔️' },
  Golpe:     { color: '#d9832e', emoji: '👊' },
  Disparo:   { color: '#8a7d5c', emoji: '🎯' },
  Fuego:     { color: '#e8542f', emoji: '🔥' },
  Agua:      { color: '#3f8fd6', emoji: '🌊' },
  Rayo:      { color: '#e8c832', emoji: '⚡' },
  Hielo:     { color: '#8fd0e8', emoji: '❄️' },
  Tierra:    { color: '#9b6b3f', emoji: '⛰️' },
  Viento:    { color: '#9fd6a8', emoji: '💨' },
  Veneno:    { color: '#9b59b6', emoji: '☠️' },
  Oscuridad: { color: '#4a4458', emoji: '🌑' },
  Haki:      { color: '#2c2c54', emoji: '👁️' },
  Fruta:     { color: '#c94f7c', emoji: '🍈' },
};

// ---- Categorías de daño: físico (ATQ vs DEF) o especial (ESP_ATQ vs ESP_DEF)
const PHYS_TYPES = ['Corte', 'Golpe', 'Disparo'];
const isPhysType = t => PHYS_TYPES.includes(t);

// ---- Stats de combate compartidos (base para todos los personajes)
const BASE_EVA = 0.05;      // 5% de esquiva base
const BASE_CRIT = 0.05;     // 5% de prob. de crítico base
const BASE_CRIT_DMG = 1.5;  // x1.5 de daño crítico base

// ---- Tags de Naturaleza (interacciones pasivas) ----
// FRUTA: usuario de Fruta del Diablo · HAKI: capaz de imbuir Haki.
// Regla núcleo: sin HAKI contra un defensor FRUTA, el daño se reduce un 50%.
// Un atacante con HAKI anula por completo esa reducción.
const FRUTA_NOHAKI_MULT = 0.5;

// CHART[atacante][tipo del defensor] — +25% daño fuerte / -25% daño débil
const CHART = {
  Corte:     { Viento: 1.25, Tierra: 0.75 },
  Golpe:     { Tierra: 1.25, Viento: 0.75 },
  Disparo:   { Rayo: 1.25, Corte: 0.75 },
  Fuego:     { Hielo: 1.25, Agua: 0.75 },
  Hielo:     { Agua: 1.25, Fuego: 0.75 },
  Agua:      { Fuego: 1.25, Rayo: 0.75 },
  Rayo:      { Agua: 1.25, Tierra: 0.75 },
  Viento:    { Fuego: 1.25, Hielo: 0.75 },
  Tierra:    { Rayo: 1.25, Golpe: 0.75 },
  Veneno:    { Veneno: 0.75 },
  Oscuridad: { Haki: 0.75 },
  Haki:      {},
  Fruta:     {},
};

// Efectos de daño especiales (se aplican por tags/estados en el cálculo)
const CHART_NOTES = {
  Agua:      'Daño x1.5 a usuarios FRUTA',
  Viento:    'Propaga el 20% del daño al siguiente enemigo',
  Veneno:    'Ignora el 20% de DEF/ESP_DEF; -25% contra Veneno',
  Oscuridad: 'Daño x1.35 a cualquier usuario FRUTA',
};

function typeMult(atkType, defTypes) {
  let m = 1;
  for (const t of defTypes) {
    const row = CHART[atkType];
    if (row && row[t] !== undefined) m *= row[t];
  }
  return m;
}

// ============ MOVIMIENTOS ============
// power 0 => movimiento de apoyo (effect obligatorio)
const MOVES = {
  // Golpe
  punetazo:      { name: 'Puñetazo',            type: 'Golpe',   power: 40, acc: 1 },
  patada:        { name: 'Patada',              type: 'Golpe',   power: 45, acc: 1 },
  pistolagoma:   { name: 'Pistola de Goma',     type: 'Golpe',   power: 50, acc: 0.95 },
  bazookagoma:   { name: 'Bazooka de Goma',     type: 'Golpe',   power: 70, acc: 0.9 },
  gatlinggoma:   { name: 'Gatling de Goma',     type: 'Golpe',   power: 90, acc: 0.85 },
  jetpistol:     { name: 'Jet Pistol',          type: 'Golpe',   power: 110, acc: 0.9 },
  kingkonggun:   { name: 'King Kong Gun',       type: 'Golpe',   power: 140, acc: 0.8 },
  colliershoot:  { name: 'Collier Shoot',       type: 'Golpe',   power: 65, acc: 0.95 },
  mutonshoot:    { name: 'Mouton Shot',         type: 'Golpe',   power: 85, acc: 0.9 },
  cabezazo:      { name: 'Cabezazo',            type: 'Golpe',   power: 55, acc: 0.95 },
  karatepez:     { name: 'Karate Gyojin',       type: 'Golpe',   power: 75, acc: 0.9 },
  // Corte
  corte:         { name: 'Corte',               type: 'Corte',   power: 45, acc: 1 },
  onigiri:       { name: 'Oni Giri',            type: 'Corte',   power: 70, acc: 0.95 },
  toragari:      { name: 'Tora Gari',           type: 'Corte',   power: 90, acc: 0.9 },
  santoryuogi:   { name: 'Santoryu Ogi',        type: 'Corte',   power: 120, acc: 0.85 },
  ashura:        { name: 'Ashura',              type: 'Corte',   power: 145, acc: 0.8 },
  cortedoble:    { name: 'Corte Doble',         type: 'Corte',   power: 60, acc: 0.95 },
  garra:         { name: 'Garra de Gato',       type: 'Corte',   power: 65, acc: 0.95 },
  hachaguerra:   { name: 'Hacha de Guerra',     type: 'Corte',   power: 80, acc: 0.85 },
  cuchillas:     { name: 'Cuchillas Circenses', type: 'Corte',   power: 60, acc: 0.9 },
  dientessierra: { name: 'Dientes de Sierra',   type: 'Corte',   power: 85, acc: 0.9 },
  // Disparo
  tirachinas:    { name: 'Tirachinas',          type: 'Disparo', power: 45, acc: 1 },
  estrellafuego: { name: 'Estrella de Fuego',   type: 'Fuego',   power: 65, acc: 0.9 },
  estrellaplomo: { name: 'Estrella de Plomo',   type: 'Disparo', power: 70, acc: 0.95 },
  kabuto:        { name: 'Kabuto Verde',        type: 'Disparo', power: 95, acc: 0.9 },
  rifle:         { name: 'Rifle de Marine',     type: 'Disparo', power: 60, acc: 0.9 },
  canonazo:      { name: 'Cañonazo',            type: 'Disparo', power: 85, acc: 0.8 },
  arpon:         { name: 'Arpón',               type: 'Disparo', power: 65, acc: 0.9 },
  // Fuego
  llamarada:     { name: 'Llamarada',           type: 'Fuego',   power: 75, acc: 0.9 },
  diablejambe:   { name: 'Diable Jambe',        type: 'Fuego',   power: 110, acc: 0.85 },
  // Agua
  chorroagua:    { name: 'Chorro de Agua',      type: 'Agua',    power: 50, acc: 1 },
  tiburonazo:    { name: 'Tiburón Dardo',       type: 'Agua',    power: 80, acc: 0.9 },
  aquajet:       { name: 'Torpedo Acuático',    type: 'Agua',    power: 95, acc: 0.85 },
  // Rayo
  descarga:      { name: 'Descarga',            type: 'Rayo',    power: 55, acc: 0.95 },
  thundertempo:  { name: 'Thunderbolt Tempo',   type: 'Rayo',    power: 90, acc: 0.85 },
  // Viento
  rafaga:        { name: 'Ráfaga',              type: 'Viento',  power: 50, acc: 1 },
  ciclontempo:   { name: 'Cyclone Tempo',       type: 'Viento',  power: 80, acc: 0.9 },
  humoblanco:    { name: 'White Blow',          type: 'Viento',  power: 85, acc: 0.9 },
  // Veneno
  gasmh5:        { name: 'Gas Venenoso MH5',    type: 'Veneno',  power: 75, acc: 0.85 },
  puaveneno:     { name: 'Púa Venenosa',        type: 'Veneno',  power: 55, acc: 0.95 },
  // Tierra
  rocazo:        { name: 'Rocazo',              type: 'Tierra',  power: 60, acc: 0.9 },
  terremoto:     { name: 'Pisotón Sísmico',     type: 'Tierra',  power: 85, acc: 0.85 },
  // Oscuridad / Haki
  golpebajo:     { name: 'Golpe Bajo',          type: 'Oscuridad', power: 60, acc: 0.95 },
  hakiarm:       { name: 'Haki de Armadura',    type: 'Haki',    power: 85, acc: 0.95 },
  hakirey:       { name: 'Haki del Rey',        type: 'Haki',    power: 120, acc: 0.85 },
  // Apoyo
  carnecomida:   { name: 'Devorar Carne',       type: 'Golpe',   power: 0, acc: 1, effect: 'heal40' },
  animo:         { name: 'Grito de Ánimo',      type: 'Golpe',   power: 0, acc: 1, effect: 'atkup' },
  guardia:       { name: 'Guardia Férrea',      type: 'Golpe',   power: 0, acc: 1, effect: 'defup' },
  // --- Compendio: Sombrero de Paja ---
  remedytouch:   { name: 'Remedy Touch',        type: 'Golpe',   power: 0, acc: 1, effect: 'heal40' },
  monsterpoint:  { name: 'Monster Point',       type: 'Golpe',   power: 100, acc: 0.85 },
  clutch:        { name: 'Cien Fleurs: Clutch', type: 'Fruta',   power: 70, acc: 0.95 },
  demoniofleur:  { name: 'Demonio Fleur',       type: 'Fruta', power: 100, acc: 0.85 },
  strongright:   { name: 'Strong Right',        type: 'Golpe',   power: 70, acc: 0.95 },
  radicalbeam:   { name: 'Radical Beam',        type: 'Rayo',    power: 110, acc: 0.85 },
  soulsolid:     { name: 'Soul Solid',          type: 'Hielo',   power: 75, acc: 0.9 },
  lullaby:       { name: 'Lullaby Flurry',      type: 'Hielo',   power: 95, acc: 0.85 },
  buraikan:      { name: 'Buraikan',            type: 'Agua',    power: 110, acc: 0.85 },
  // --- Compendio: leyendas y jefes ---
  kamusari:      { name: 'Kamusari',            type: 'Haki',    power: 130, acc: 0.8 },
  shimayurashi:  { name: 'Shima Yurashi',       type: 'Tierra',  power: 140, acc: 0.75 },
  bolobreath:    { name: 'Bolo Breath',         type: 'Fuego',   power: 120, acc: 0.85 },
  kaendaiko:     { name: 'Kaen Daiko',          type: 'Fuego',   power: 145, acc: 0.75 },
  soulpocus:     { name: 'Soul Pocus',          type: 'Oscuridad', power: 100, acc: 0.9 },
  ikoku:         { name: 'Ikoku',               type: 'Oscuridad', power: 130, acc: 0.8 },
  kamusarirojo:  { name: 'Kamusari Carmesí',    type: 'Haki',    power: 135, acc: 0.8 },
  blackhole:     { name: 'Black Hole',          type: 'Oscuridad', power: 125, acc: 0.85 },
  // --- Compendio: facciones ---
  shambles:      { name: 'Shambles',            type: 'Fruta',   power: 85, acc: 0.95 },
  gammaknife:    { name: 'Gamma Knife',         type: 'Fruta',   power: 110, acc: 0.85 },
  punkrotten:    { name: 'Punk Rotten',         type: 'Rayo',    power: 105, acc: 0.85 },
  cortemundo:    { name: 'Corte del Mejor Espadachín', type: 'Corte', power: 130, acc: 0.85 },
  desertspada:   { name: 'Desert Spada',        type: 'Tierra',  power: 100, acc: 0.9 },
  parasite:      { name: 'Parasite',            type: 'Fruta',   power: 90, acc: 0.9 },
  ursusshock:    { name: 'Ursus Shock',         type: 'Fruta',   power: 115, acc: 0.8 },
  meromellow:    { name: 'Mero Mero Mellow',    type: 'Fruta',   power: 95, acc: 0.9 },
  daifunka:      { name: 'Dai Funka',           type: 'Fuego',   power: 130, acc: 0.8 },
  yasakani:      { name: 'Yasakani no Magatama', type: 'Rayo',   power: 125, acc: 0.85 },
  iceage:        { name: 'Ice Age',             type: 'Hielo',   power: 125, acc: 0.8 },
  galaxyimpact:  { name: 'Galaxy Impact',       type: 'Haki',    power: 125, acc: 0.8 },
  vientolibre:   { name: 'Vientos de Libertad', type: 'Viento',  power: 120, acc: 0.85 },
  hiken:         { name: 'Hiken',               type: 'Fuego',   power: 115, acc: 0.85 },
  rokuogan:      { name: 'Rokuogan',            type: 'Haki',    power: 120, acc: 0.85 },
  distortion:    { name: 'Distortion Future',   type: 'Fruta',   power: 80, acc: 0.9 },
  togentotsuka:  { name: 'Togen Totsuka',       type: 'Corte',   power: 135, acc: 0.8 },
  raimeihakke:   { name: 'Raimei Hakke',        type: 'Haki',    power: 115, acc: 0.85 },
  llamalunaria:  { name: 'Llama Lunaria',       type: 'Fuego',   power: 110, acc: 0.85 },
  virusmomia:    { name: 'Virus Momia',         type: 'Veneno',  power: 105, acc: 0.85 },
  mochitsuki:    { name: 'Mochi Tsuki',         type: 'Fruta',   power: 105, acc: 0.85 },
  llamasfenix:   { name: 'Llamas del Fénix',    type: 'Fuego',   power: 0, acc: 1, effect: 'heal40' },
  daienkai:      { name: 'Dai Enkai: Entei',    type: 'Fuego',   power: 135, acc: 0.8 },
};

// ============ PERSONAJES ============
// base: [hp, atk, def, spd] a nivel 5 aprox
const CHARS = {
  // --- Iniciales ---
  luffy: {
    name: 'Luffy', emoji: '👒', types: ['Golpe', 'Fruta'],
    base: [24, 12, 8, 10], rareza: 3,
    learnset: [[1, 'pistolagoma'], [8, 'bazookagoma'], [13, 'gatlinggoma'], [26, 'kingkonggun']],
    evo: { lvl: 20, to: 'luffy2' },
    desc: 'Chico de goma que quiere ser Rey de los Piratas.',
  },
  luffy2: {
    name: 'Luffy: Gears y Haki', emoji: '👒', types: ['Golpe', 'Fruta'],
    base: [30, 16, 10, 15], rareza: 4,
    learnset: [[20, 'jetpistol'], [30, 'hakiarm'], [38, 'kingkonggun']],
    desc: 'Gear Second al nivel 20, Armadura al 30 y Gear Fourth al 38.',
  },
  zoro: {
    name: 'Zoro', emoji: '🗡️', types: ['Corte'],
    base: [23, 13, 9, 9], rareza: 3,
    learnset: [[1, 'corte'], [7, 'onigiri'], [14, 'toragari'], [25, 'santoryuogi']],
    evo: { lvl: 20, to: 'zoro2' },
    desc: 'Espadachín de tres espadas. Se pierde hasta en línea recta.',
  },
  zoro2: {
    name: 'Zoro Santoryu', emoji: '🗡️', types: ['Corte', 'Haki'],
    base: [29, 17, 11, 12], rareza: 4,
    learnset: [[20, 'santoryuogi'], [30, 'hakiarm'], [36, 'ashura']],
    desc: 'El estilo de las tres espadas perfeccionado.',
  },
  nami: {
    name: 'Nami', emoji: '🍊', types: ['Rayo', 'Viento'],
    base: [20, 11, 7, 12], rareza: 3,
    learnset: [[1, 'rafaga'], [6, 'descarga'], [13, 'ciclontempo'], [24, 'thundertempo']],
    evo: { lvl: 20, to: 'nami2' },
    desc: 'Navegante y ladrona. Le encantan los mapas y las Berries.',
  },
  nami2: {
    name: 'Nami Clima-Tact', emoji: '🍊', types: ['Rayo', 'Viento'],
    base: [26, 15, 9, 16], rareza: 4,
    learnset: [[20, 'thundertempo'], [28, 'ciclontempo']],
    desc: 'Domina el clima con su bastón.',
  },
  // --- Reclutables East Blue ---
  coby: {
    name: 'Coby', emoji: '🧢', types: ['Golpe'],
    base: [18, 8, 7, 8], rareza: 1,
    learnset: [[1, 'punetazo'], [10, 'cabezazo'], [18, 'karatepez']],
    evo: { lvl: 16, to: 'coby2' },
    desc: 'Un chico miedoso que sueña con ser almirante.',
  },
  coby2: {
    name: 'Coby Marine', emoji: '⚓', types: ['Golpe', 'Haki'],
    base: [24, 12, 10, 11], rareza: 2,
    learnset: [[16, 'karatepez'], [26, 'hakiarm']],
    desc: 'Entrenado por la Marina. Ya no tiembla (casi).',
  },
  usopp: {
    name: 'Usopp', emoji: '🎯', types: ['Disparo'],
    base: [19, 10, 6, 11], rareza: 2,
    learnset: [[1, 'tirachinas'], [8, 'estrellafuego'], [15, 'estrellaplomo'], [24, 'kabuto']],
    evo: { lvl: 22, to: 'usopp2' },
    desc: 'Francotirador mentiroso con 8000 seguidores.',
  },
  usopp2: {
    name: 'Sogeking', emoji: '🎭', types: ['Disparo', 'Fuego'],
    base: [25, 14, 8, 13], rareza: 3,
    learnset: [[22, 'kabuto'], [30, 'estrellafuego']],
    desc: 'El rey de los francotiradores, venido de la isla de los tiradores.',
  },
  sanji: {
    name: 'Sanji', emoji: '🚬', types: ['Golpe', 'Fuego'],
    base: [22, 12, 8, 12], rareza: 3,
    learnset: [[1, 'patada'], [9, 'colliershoot'], [16, 'mutonshoot'], [26, 'diablejambe']],
    desc: 'Cocinero de patada demoledora. Jamás golpea con las manos.',
  },
  johnny: {
    name: 'Johnny', emoji: '🕶️', types: ['Corte'],
    base: [17, 9, 7, 9], rareza: 1,
    learnset: [[1, 'corte'], [12, 'cortedoble']],
    desc: 'Cazarrecompensas de poca monta pero gran corazón.',
  },
  yosaku: {
    name: 'Yosaku', emoji: '🪖', types: ['Corte'],
    base: [18, 9, 8, 8], rareza: 1,
    learnset: [[1, 'corte'], [12, 'cortedoble']],
    desc: 'Compañero inseparable de Johnny. Necesita vitamina C.',
  },
  piratanovato: {
    name: 'Pirata Novato', emoji: '🏴‍☠️', types: ['Golpe'],
    base: [16, 8, 6, 7], rareza: 1,
    learnset: [[1, 'punetazo'], [10, 'cabezazo']],
    desc: 'Acaba de hacerse a la mar. Aún se marea.',
  },
  marineraso: {
    name: 'Marine Raso', emoji: '⚓', types: ['Disparo'],
    base: [16, 8, 7, 7], rareza: 1,
    learnset: [[1, 'rifle'], [12, 'canonazo']],
    desc: 'Soldado de la Marina. Cumple órdenes sin preguntar.',
  },
  bandido: {
    name: 'Bandido de Montaña', emoji: '🪓', types: ['Golpe', 'Tierra'],
    base: [18, 9, 7, 6], rareza: 1,
    learnset: [[1, 'punetazo'], [9, 'rocazo'], [17, 'terremoto']],
    desc: 'Roba en tierra porque el mar le da miedo.',
  },
  pescador: {
    name: 'Pescador Bravo', emoji: '🎣', types: ['Agua'],
    base: [17, 8, 7, 8], rareza: 1,
    learnset: [[1, 'chorroagua'], [11, 'arpon']],
    desc: 'Conoce cada corriente del East Blue.',
  },
  piratapayaso: {
    name: 'Pirata Payaso', emoji: '🤡', types: ['Corte'],
    base: [17, 9, 6, 9], rareza: 1,
    learnset: [[1, 'cuchillas'], [12, 'cortedoble']],
    desc: 'Tripulante de Buggy. Odia que hablen de narices.',
  },
  piratagato: {
    name: 'Pirata Gato Negro', emoji: '🐈‍⬛', types: ['Corte', 'Oscuridad'],
    base: [18, 10, 6, 10], rareza: 2,
    learnset: [[1, 'garra'], [11, 'golpebajo']],
    desc: 'Sigiloso tripulante del capitán Kuro.',
  },
  cocinapirata: {
    name: 'Cocinero de Krieg', emoji: '🍳', types: ['Golpe', 'Fuego'],
    base: [18, 9, 8, 8], rareza: 2,
    learnset: [[1, 'patada'], [10, 'llamarada']],
    desc: 'Lucha con sartenes y mal genio.',
  },
  gyojin: {
    name: 'Hombre-Pez', emoji: '🦈', types: ['Agua', 'Golpe'],
    base: [20, 11, 8, 9], rareza: 2,
    learnset: [[1, 'chorroagua'], [9, 'karatepez'], [18, 'tiburonazo']],
    desc: 'Diez veces más fuerte que un humano bajo el agua.',
  },
  gaimon: {
    name: 'Gaimon', emoji: '📦', types: ['Tierra'],
    base: [19, 8, 11, 5], rareza: 2,
    learnset: [[1, 'rocazo'], [14, 'terremoto']],
    desc: 'Lleva 20 años atrapado en un cofre del tesoro.',
  },
  chouchou: {
    name: 'Chouchou', emoji: '🐕', types: ['Golpe'],
    base: [15, 8, 6, 10], rareza: 1,
    learnset: [[1, 'cabezazo'], [10, 'punetazo']],
    desc: 'Perro fiel que custodia la tienda de su dueño.',
  },
  // --- Jefes / élite (no reclutables) ---
  alvida: {
    name: 'Alvida', emoji: '🔨', types: ['Golpe'],
    base: [22, 11, 9, 6], rareza: 2, boss: true,
    learnset: [[1, 'cabezazo'], [8, 'punetazo']],
    desc: 'La mujer más "bella" de todos los mares. Según ella.',
  },
  helmeppo: {
    name: 'Helmeppo', emoji: '💇', types: ['Corte'],
    base: [18, 8, 7, 7], rareza: 1, boss: true,
    learnset: [[1, 'corte']],
    desc: 'Hijo mimado del capitán Morgan.',
  },
  morgan: {
    name: 'Capitán Morgan', emoji: '🪓', types: ['Corte', 'Tierra'],
    base: [26, 13, 10, 7], rareza: 3, boss: true,
    learnset: [[1, 'hachaguerra'], [10, 'terremoto']],
    desc: 'Marine tirano con mandíbula de acero y mano de hacha.',
  },
  mohji: {
    name: 'Mohji y Richie', emoji: '🦁', types: ['Golpe'],
    base: [20, 10, 8, 8], rareza: 2, boss: true,
    learnset: [[1, 'garra'], [10, 'cabezazo']],
    desc: 'El domador y su león gigante.',
  },
  cabaji: {
    name: 'Cabaji', emoji: '🚲', types: ['Corte'],
    base: [20, 10, 7, 11], rareza: 2, boss: true,
    learnset: [[1, 'cuchillas'], [10, 'cortedoble']],
    desc: 'Acróbata espadachín sobre un monociclo.',
  },
  buggy: {
    name: 'Buggy el Payaso', emoji: '🤡', types: ['Corte', 'Fruta'],
    base: [27, 13, 9, 10], rareza: 3, boss: true,
    learnset: [[1, 'cuchillas'], [1, 'buggyball'], [8, 'cortedoble'], [16, 'muggyball']],
    desc: 'Comió la fruta Bara Bara. Las espadas no le hacen nada.',
  },
  sham: {
    name: 'Sham y Buchi', emoji: '🐱', types: ['Corte', 'Oscuridad'],
    base: [21, 10, 8, 10], rareza: 2, boss: true,
    learnset: [[1, 'garra'], [10, 'golpebajo']],
    desc: 'Los hermanos Nyaban del barco del Gato Negro.',
  },
  kuro: {
    name: 'Capitán Kuro', emoji: '🐈‍⬛', types: ['Corte', 'Oscuridad'],
    base: [28, 14, 9, 14], rareza: 3, boss: true,
    learnset: [[1, 'garra'], [10, 'cortedoble'], [18, 'golpebajo']],
    desc: 'El de los mil planes. Tan rápido que nadie lo ve venir.',
  },
  gin: {
    name: 'Gin', emoji: '⛓️', types: ['Golpe'],
    base: [23, 12, 9, 10], rareza: 2, boss: true,
    learnset: [[1, 'punetazo'], [10, 'mutonshoot']],
    desc: 'El "Demonio" de la flota de Krieg.',
  },
  pearl: {
    name: 'Pearl', emoji: '🛡️', types: ['Golpe', 'Fuego'],
    base: [24, 10, 13, 6], rareza: 2, boss: true,
    learnset: [[1, 'punetazo'], [10, 'llamarada']],
    desc: 'Se cree invencible tras sus escudos de perla.',
  },
  krieg: {
    name: 'Don Krieg', emoji: '💣', types: ['Disparo', 'Veneno'],
    base: [30, 14, 12, 8], rareza: 3, boss: true,
    learnset: [[1, 'canonazo'], [10, 'puaveneno'], [18, 'gasmh5']],
    desc: 'El pirata más fuerte del East Blue. Armado hasta los dientes.',
  },
  chuu: {
    name: 'Chuu', emoji: '💋', types: ['Agua', 'Disparo'],
    base: [23, 12, 8, 10], rareza: 2, boss: true,
    learnset: [[1, 'chorroagua'], [10, 'arpon']],
    desc: 'Hombre-pez que escupe agua como balas.',
  },
  kuroobi: {
    name: 'Kuroobi', emoji: '🥋', types: ['Agua', 'Golpe'],
    base: [24, 13, 10, 9], rareza: 2, boss: true,
    learnset: [[1, 'karatepez'], [10, 'tiburonazo']],
    desc: 'Maestro del karate gyojin, cinturón negro.',
  },
  hachi: {
    name: 'Hachi', emoji: '🐙', types: ['Corte', 'Agua'],
    base: [24, 12, 9, 9], rareza: 2, boss: true,
    learnset: [[1, 'cortedoble'], [10, 'onigiri']],
    desc: 'Pulpo de seis espadas. En el fondo, buena gente.',
  },
  arlong: {
    name: 'Arlong', emoji: '🦈', types: ['Agua', 'Corte'],
    base: [32, 16, 12, 11], rareza: 4, boss: true,
    learnset: [[1, 'dientessierra'], [10, 'tiburonazo'], [20, 'aquajet']],
    desc: 'Tiburón sierra que desprecia a los humanos.',
  },
  tashigi: {
    name: 'Tashigi', emoji: '👓', types: ['Corte'],
    base: [25, 13, 10, 12], rareza: 3, boss: true,
    learnset: [[1, 'onigiri'], [12, 'toragari']],
    desc: 'Sargento de la Marina obsesionada con las espadas famosas.',
  },
  smoker: {
    name: 'Capitán Smoker', emoji: '💨', types: ['Viento', 'Fruta'],
    base: [34, 16, 13, 12], rareza: 5, boss: true,
    learnset: [[1, 'humoblanco'], [12, 'golpebajo'], [20, 'hakiarm']],
    desc: 'El Cazador Blanco. Su cuerpo es humo: atrápalo si puedes.',
  },
  // ===== COMPENDIO: Sombrero de Paja (núcleo) =====
  chopper: {
    name: 'Chopper', emoji: '🦌', types: ['Fruta', 'Golpe'],
    base: [25, 8, 9, 9], rareza: 3,
    learnset: [[1, 'remedytouch'], [8, 'punetazo'], [16, 'cabezazo'], [24, 'monsterpoint']],
    desc: 'Reno médico de nariz azul. Los cumplidos no le hacen feliz, ¡idiota!',
  },
  robin: {
    name: 'Nico Robin', emoji: '🌸', types: ['Fruta', 'Oscuridad'],
    base: [21, 10, 8, 10], rareza: 3,
    learnset: [[1, 'clutch'], [12, 'golpebajo'], [24, 'demoniofleur']],
    desc: 'Arqueóloga que hace florecer brazos donde quiera.',
  },
  franky: {
    name: 'Franky', emoji: '🤖', types: ['Disparo', 'Golpe'],
    base: [30, 11, 13, 7], rareza: 3,
    learnset: [[1, 'strongright'], [10, 'canonazo'], [22, 'radicalbeam']],
    desc: 'Ciborg carpintero. ¡SUUUPER cargado de cola!',
  },
  brook: {
    name: 'Brook', emoji: '💀', types: ['Corte', 'Hielo'],
    base: [19, 9, 7, 14], rareza: 3,
    learnset: [[1, 'soulsolid'], [10, 'cortedoble'], [20, 'lullaby']],
    desc: 'Esqueleto músico y espadachín. ¡Yohohoho!',
  },
  jinbe: {
    name: 'Jinbe', emoji: '🐋', types: ['Agua', 'Golpe'],
    base: [33, 12, 11, 8], rareza: 4,
    learnset: [[1, 'karatepez'], [10, 'tiburonazo'], [22, 'buraikan']],
    desc: 'Caballero del Mar, maestro del karate gyojin.',
  },
  // ===== COMPENDIO: Emperadores y leyendas =====
  roger: {
    name: 'Gol D. Roger', emoji: '👑', types: ['Haki'],
    base: [34, 17, 13, 13], rareza: 5, boss: true,
    learnset: [[1, 'kamusari'], [15, 'hakirey']],
    desc: 'El Rey de los Piratas. Lo dejó todo en aquel lugar.',
  },
  newgate: {
    name: 'Barbablanca', emoji: '🔱', types: ['Tierra', 'Fruta'],
    base: [38, 17, 14, 8], rareza: 5, boss: true,
    learnset: [[1, 'terremoto'], [15, 'shimayurashi']],
    desc: 'El hombre más fuerte del mundo. Parte el cielo y el mar.',
  },
  kaido: {
    name: 'Kaido', emoji: '🐉', types: ['Fuego', 'Fruta'],
    base: [40, 17, 15, 9], rareza: 5, boss: true,
    learnset: [[1, 'bolobreath'], [18, 'kaendaiko']],
    desc: 'La criatura más fuerte. Si es uno contra uno, apuesta por Kaido.',
  },
  bigmom: {
    name: 'Big Mom', emoji: '🍰', types: ['Oscuridad', 'Fruta'],
    base: [38, 16, 14, 8], rareza: 5, boss: true,
    learnset: [[1, 'soulpocus'], [16, 'ikoku']],
    desc: 'Emperatriz golosa que roba almas y años de vida.',
  },
  shanks: {
    name: 'Shanks', emoji: '🍷', types: ['Haki'],
    base: [34, 17, 12, 14], rareza: 5, boss: true,
    learnset: [[1, 'hakiarm'], [14, 'kamusarirojo']],
    desc: 'El Pelirrojo. Un solo brazo le basta para gobernar el mar.',
  },
  teach: {
    name: 'Barbanegra', emoji: '🌑', types: ['Oscuridad', 'Fruta'],
    base: [36, 16, 12, 9], rareza: 5, boss: true,
    learnset: [[1, 'blackhole'], [12, 'terremoto']],
    desc: 'Dos frutas en un solo cuerpo. La oscuridad lo traga todo. Zehahaha.',
  },
  // ===== COMPENDIO: facciones del mundo =====
  law: {
    name: 'Trafalgar Law', emoji: '🩺', types: ['Fruta', 'Corte'],
    base: [24, 12, 9, 12], rareza: 4,
    learnset: [[1, 'shambles'], [10, 'onigiri'], [20, 'gammaknife']],
    desc: 'Cirujano de la Muerte. Dentro de su Room, él es el bisturí.',
  },
  kid: {
    name: 'Eustass Kid', emoji: '🧲', types: ['Fruta', 'Rayo'],
    base: [26, 13, 10, 8], rareza: 4,
    learnset: [[1, 'punetazo'], [12, 'punkrotten']],
    desc: 'Magnetiza chatarra y la convierte en brazos gigantes.',
  },
  mihawk: {
    name: 'Dracule Mihawk', emoji: '🦅', types: ['Corte', 'Haki'],
    base: [28, 16, 11, 12], rareza: 5, boss: true,
    learnset: [[1, 'onigiri'], [12, 'cortemundo']],
    desc: 'El mejor espadachín del mundo. Ojos de halcón.',
  },
  crocodile: {
    name: 'Crocodile', emoji: '🐊', types: ['Tierra', 'Fruta'],
    base: [27, 13, 11, 9], rareza: 4, boss: true,
    learnset: [[1, 'desertspada'], [12, 'terremoto']],
    desc: 'La arena del desierto obedece su garfio.',
  },
  doflamingo: {
    name: 'Doflamingo', emoji: '🦩', types: ['Fruta', 'Corte'],
    base: [27, 14, 10, 12], rareza: 4, boss: true,
    learnset: [[1, 'parasite'], [10, 'cortedoble']],
    desc: 'El Joker. Mueve los hilos de todos, literalmente.',
  },
  kuma: {
    name: 'Bartholomew Kuma', emoji: '🐾', types: ['Fruta', 'Golpe'],
    base: [30, 13, 14, 7], rareza: 4, boss: true,
    learnset: [[1, 'punetazo'], [12, 'ursusshock']],
    desc: 'Sus zarpas repelen cualquier cosa... incluso el dolor.',
  },
  hancock: {
    name: 'Boa Hancock', emoji: '🐍', types: ['Fruta', 'Golpe'],
    base: [24, 13, 9, 12], rareza: 4,
    learnset: [[1, 'meromellow'], [10, 'patada']],
    desc: 'Emperatriz Pirata. Enamorarse de ella sale muy caro.',
  },
  akainu: {
    name: 'Akainu', emoji: '🌋', types: ['Fuego', 'Fruta'],
    base: [30, 16, 13, 8], rareza: 5, boss: true,
    learnset: [[1, 'llamarada'], [14, 'daifunka']],
    desc: 'Almirante de Flota. Su justicia absoluta arde como el magma.',
  },
  kizaru: {
    name: 'Kizaru', emoji: '✨', types: ['Rayo', 'Fruta'],
    base: [26, 14, 10, 15], rareza: 5, boss: true,
    learnset: [[1, 'descarga'], [14, 'yasakani']],
    desc: 'Almirante a la velocidad de la luz. Qué miedo, ¿verdad?',
  },
  aokiji: {
    name: 'Aokiji', emoji: '🧊', types: ['Hielo', 'Fruta'],
    base: [28, 13, 12, 9], rareza: 5, boss: true,
    learnset: [[1, 'soulsolid'], [12, 'iceage']],
    desc: 'Ex-almirante perezoso. Congela océanos en su siesta.',
  },
  garp: {
    name: 'Monkey D. Garp', emoji: '👊', types: ['Golpe', 'Haki'],
    base: [30, 16, 12, 10], rareza: 5, boss: true,
    learnset: [[1, 'punetazo'], [12, 'galaxyimpact']],
    desc: 'El Héroe de la Marina. Sus puños hunden montañas.',
  },
  dragon: {
    name: 'Monkey D. Dragon', emoji: '🌀', types: ['Viento', 'Haki'],
    base: [30, 15, 12, 12], rareza: 5, boss: true,
    learnset: [[1, 'rafaga'], [12, 'vientolibre']],
    desc: 'El criminal más buscado del mundo. Lidera la revolución.',
  },
  sabo: {
    name: 'Sabo', emoji: '🎩', types: ['Fuego', 'Haki'],
    base: [26, 14, 10, 12], rareza: 4,
    learnset: [[1, 'patada'], [12, 'hiken']],
    desc: 'Jefe de Estado Mayor revolucionario. Heredó la llama de su hermano.',
  },
  lucci: {
    name: 'Rob Lucci', emoji: '🐆', types: ['Fruta', 'Haki'],
    base: [26, 14, 11, 13], rareza: 4, boss: true,
    learnset: [[1, 'garra'], [14, 'rokuogan']],
    desc: 'Asesino del CP0. El leopardo más letal del Gobierno.',
  },
  bonney: {
    name: 'Jewelry Bonney', emoji: '🍕', types: ['Fruta'],
    base: [22, 11, 9, 11], rareza: 3,
    learnset: [[1, 'punetazo'], [10, 'distortion']],
    desc: 'Devora pizza y distorsiona la edad de quien la molesta.',
  },
  vegapunk: {
    name: 'Dr. Vegapunk', emoji: '🧠', types: ['Disparo', 'Rayo'],
    base: [20, 9, 9, 8], rareza: 3,
    learnset: [[1, 'descarga'], [8, 'guardia'], [14, 'radicalbeam']],
    desc: 'El mayor genio del mundo, repartido en seis cuerpos.',
  },
  oden: {
    name: 'Kozuki Oden', emoji: '🍢', types: ['Corte', 'Haki'],
    base: [30, 16, 11, 12], rareza: 5, boss: true,
    learnset: [[1, 'onigiri'], [14, 'togentotsuka']],
    desc: 'Daimio de Wano. Sus dos espadas dejaron cicatriz hasta en Kaido.',
  },
  yamato: {
    name: 'Yamato', emoji: '🐺', types: ['Rayo', 'Hielo'],
    base: [28, 14, 11, 11], rareza: 4,
    learnset: [[1, 'cabezazo'], [12, 'raimeihakke']],
    desc: 'Guardián lobuno de Wano que sueña con zarpar.',
  },
  king: {
    name: 'King', emoji: '🦖', types: ['Fuego', 'Fruta'],
    base: [28, 14, 13, 11], rareza: 4, boss: true,
    learnset: [[1, 'llamarada'], [12, 'llamalunaria']],
    desc: 'El último Lunaria. Su llama alterna defensa y velocidad.',
  },
  queen: {
    name: 'Queen', emoji: '🦕', types: ['Veneno', 'Fruta'],
    base: [32, 13, 13, 7], rareza: 4, boss: true,
    learnset: [[1, 'puaveneno'], [12, 'virusmomia']],
    desc: 'Científico ciborg de las Bestias. Esparce plagas bailando.',
  },
  katakuri: {
    name: 'Katakuri', emoji: '🍡', types: ['Fruta', 'Haki'],
    base: [28, 14, 11, 12], rareza: 5, boss: true,
    learnset: [[1, 'mochitsuki'], [14, 'hakiarm']],
    desc: 'Ve el futuro un instante antes de que ocurra.',
  },
  marco: {
    name: 'Marco el Fénix', emoji: '🐦', types: ['Fuego', 'Fruta'],
    base: [27, 12, 11, 12], rareza: 4,
    learnset: [[1, 'llamarada'], [10, 'llamasfenix']],
    desc: 'Sus llamas azules no queman: curan.',
  },
  ace: {
    name: 'Portgas D. Ace', emoji: '🔥', types: ['Fuego', 'Fruta'],
    base: [26, 14, 10, 12], rareza: 4,
    learnset: [[1, 'llamarada'], [10, 'hiken'], [20, 'daienkai']],
    desc: 'Puño de Fuego, comandante de Barbablanca. Hermano de Luffy.',
  },
};

// ============ OBJETOS ============
const ITEMS = {
  carne:        { name: 'Carne',              emoji: '🍖', desc: 'Restaura 30 PS.', price: 100, kind: 'heal', val: 30 },
  carnereal:    { name: 'Carne Real',         emoji: '🍗', desc: 'Restaura 80 PS.', price: 250, kind: 'heal', val: 80 },
  bocadillo:    { name: 'Plato de Sanji',     emoji: '🍱', desc: 'Restaura todos los PS.', price: 500, kind: 'heal', val: 9999 },
  sake:         { name: 'Sake de Binks',      emoji: '🍶', desc: 'Revive a un nakama con la mitad de PS.', price: 400, kind: 'revive', val: 0.5 },
  cartel:       { name: 'Cartel de Recluta',  emoji: '📜', desc: 'Al tentar la suerte, rompe 1 cadena garantizada.', price: 150, kind: 'ball', val: 1 },
  carteldorado: { name: 'Cartel Dorado',      emoji: '🏅', desc: 'Al tentar la suerte, rompe 2 cadenas garantizadas.', price: 350, kind: 'ball', val: 2 },
  cartelbuster: { name: 'Buster Call',        emoji: '📯', desc: 'Rompe las 3 cadenas: reclutamiento garantizado.', price: 800, kind: 'ball', val: 3.5 },
  proteina:     { name: 'Proteína de Franky', emoji: '🥤', desc: '+2 ATQ permanente al nakama activo.', price: 600, kind: 'boost', stat: 1 },
  hierro:       { name: 'Placa de Hierro',    emoji: '🛡️', desc: '+2 DEF permanente al nakama activo.', price: 600, kind: 'boost', stat: 2 },
  fruta_diablo: { name: 'Fruta del Diablo',   emoji: '🍈', desc: 'Concede un nuevo Tag/Sinergia elemental a 2 nakamas activos.', price: 1000, kind: 'fruta' },
};

// ============ SAGAS / ISLAS ============
// Las sagas se construyen al final del archivo (ver "COMPENDIO POR SAGAS"):
// cada personaje pertenece a una saga y las islas se generan por saga.

// Eventos de misterio
const MYSTERY_EVENTS = [
  { id: 'tesoro', text: '¡Encuentras un cofre enterrado con {n} Berries!', kind: 'berries', min: 150, max: 400 },
  { id: 'item', text: 'Un aldeano agradecido te regala un objeto.', kind: 'item' },
  { id: 'ambush', text: '¡Es una emboscada! Un pirata salta de los arbustos.', kind: 'battle' },
  { id: 'fuente', text: 'Encuentras aguas termales. Todo tu equipo recupera PS.', kind: 'healall' },
  { id: 'entrenamiento', text: 'Un viejo maestro entrena a tu nakama activo. ¡+2 ATQ!', kind: 'boost' },
  { id: 'trampa', text: '¡Pisas una trampa de red! Tu nakama activo pierde 10 PS.', kind: 'damage', val: 10 },
  { id: 'recluta', text: '¡Un pirata errante se une a tu banda!', kind: 'recruit' },
  { id: 'fruta', text: '¡Encuentras una misteriosa Fruta del Diablo entre la maleza! 🍈', kind: 'fruta' },
];

// ============ LORE: fichas del compendio (SP, pasivas, definitivas) ============
// Datos adaptados del documento de diseño "Compendio y Sistema de Cartas".
// sp = Haki / Poder Especial (escala base, como atk/def).
const LORE = {
  // --- Sombrero de Paja ---
  luffy: {
    sp: 10, clase: 'Zoan Mítica / Haki', faccion: 'Sombrero de Paja',
  },
  zoro: {
    sp: 8, clase: 'Haki / Marcial', faccion: 'Sombrero de Paja',
  },
  nami: {
    sp: 12, clase: 'Científico / Clima', faccion: 'Sombrero de Paja',
  },
  usopp: {
    sp: 9, clase: 'Científico / Francotirador', faccion: 'Sombrero de Paja',
  },
  sanji: {
    sp: 10, clase: 'Haki / Fuego / Científico', faccion: 'Sombrero de Paja',
  },
  chopper: {
    sp: 11, clase: 'Zoan / Médico', faccion: 'Sombrero de Paja',
  },
  robin: {
    sp: 12, clase: 'Paramecia / Control', faccion: 'Sombrero de Paja',
  },
  franky: {
    sp: 8, clase: 'Científico / Ciborg / Tanque', faccion: 'Sombrero de Paja',
  },
  brook: {
    sp: 11, clase: 'Paramecia / Hielo / Soporte', faccion: 'Sombrero de Paja',
  },
  jinbe: {
    sp: 9, clase: 'Gyojin Karate / Tanque / Agua', faccion: 'Sombrero de Paja',
  },
  // --- Emperadores, leyendas y jefes finales ---
  roger: {
    clase: 'Líder Legendario / Haki Puro', faccion: 'Piratas de Roger',
  },
  newgate: {
    clase: 'Coloso / Destructor', faccion: 'Piratas de Barbablanca',
  },
  kaido: {
    clase: 'Super Tanque / Bestia', faccion: 'Piratas de las Bestias',
  },
  bigmom: {
    clase: 'Control / Daño Híbrido', faccion: 'Piratas de Big Mom',
  },
  shanks: {
    clase: 'Asesino / Conquistador', faccion: 'Piratas del Pelirrojo',
  },
  teach: {
    clase: 'Inhabilitador Dual', faccion: 'Piratas de Barbanegra',
  },
  // --- Facciones del mundo ---
  law: {
    clase: 'Táctico / Soporte', faccion: 'Peor Generación / Piratas Heart',
  },
  kid: {
    clase: 'Brawler / Destructor', faccion: 'Peor Generación',
  },
  mihawk: {
    clase: 'Duelista / Asesino', faccion: 'Cross Guild / Ex-Shichibukai',
  },
  akainu: {
    clase: 'Destructor Ofensivo', faccion: 'Marina (Almirante de Flota)',
  },
  kizaru: {
    clase: 'Velocista / Sniper', faccion: 'Marina (Almirante)',
  },
  aokiji: {
    clase: 'Control de Masas', faccion: 'Ex-Marina',
  },
  garp: {
    clase: 'Luchador / Rompedor', faccion: 'Marina (Vicealmirante)',
  },
  dragon: {
    clase: 'Líder / Viento y Clima', faccion: 'Ejército Revolucionario',
  },
  oden: {
    clase: 'Espadachín Dual', faccion: 'País de Wano / Piratas de Roger',
  },
  smoker: {
    clase: 'Capitán de Humo', faccion: 'Marina',
  },
  crocodile: {
    clase: 'Control / Desecador', faccion: 'Cross Guild / Baroque Works',
  },
  doflamingo: {
    clase: 'Titiritero / DPS', faccion: 'Familia Donquixote',
  },
  kuma: {
    clase: 'Tanque / Expulsor', faccion: 'Revolucionarios / Ex-Shichibukai',
  },
  hancock: {
    clase: 'Inhabilitadora / DPS', faccion: 'Piratas Kuja',
  },
  akainu: {
    clase: 'Destructor Ofensivo', faccion: 'Marina (Almirante de Flota)',
  },
  kizaru: {
    clase: 'Velocista / Sniper', faccion: 'Marina (Almirante)',
  },
  aokiji: {
    clase: 'Control de Masas', faccion: 'Ex-Marina',
  },
  garp: {
    clase: 'Luchador / Rompedor', faccion: 'Marina (Vicealmirante)',
  },
  dragon: {
    clase: 'Líder / Viento y Clima', faccion: 'Ejército Revolucionario',
  },
  sabo: {
    clase: 'Artes Marciales / Fuego', faccion: 'Ejército Revolucionario',
  },
  lucci: {
    clase: 'Asesino / Depredador', faccion: 'CP0 / Gobierno Mundial',
  },
  bonney: {
    clase: 'Alteradora Temporal', faccion: 'Peor Generación',
  },
  vegapunk: {
    clase: 'Soporte Tecnológico', faccion: 'Ciencia de Egghead',
  },
  oden: {
    clase: 'Espadachín Dual', faccion: 'País de Wano / Piratas de Roger',
  },
  yamato: {
    clase: 'Guardián / Hielo', faccion: 'País de Wano',
  },
  king: {
    clase: 'Modo Defensivo / Veloz (Lunaria)', faccion: 'Piratas de las Bestias',
  },
  queen: {
    clase: 'Científico / Tanque Ciborg', faccion: 'Piratas de las Bestias / MADS',
  },
  katakuri: {
    clase: 'Duelista / Esquiva Pura', faccion: 'Piratas de Big Mom',
  },
  marco: {
    clase: 'Soporte Vital / Volador', faccion: 'Piratas de Barbablanca',
  },
  ace: {
    clase: 'Artillero Elemental', faccion: 'Piratas de Barbablanca',
  },
  buggy: {
    clase: 'Engañador / Inmune a Cortes', faccion: 'Cross Guild / Yonko',
  },
};

// ============ COMPENDIO POR SAGAS (generador) ============
// Cada fila: [id, nombre, emoji, rareza, tipos, flags]
// flags: 'b' = jefe/villano (no reclutable en salvaje), 'n' = nakama de la banda.
// Los ids ya definidos arriba solo reciben su saga (y flag nakama si procede).
const TYPE_LADDER = {
  Corte: ['corte', 'cortedoble', 'toragari'], Golpe: ['punetazo', 'cabezazo', 'mutonshoot'],
  Disparo: ['rifle', 'estrellaplomo', 'canonazo'], Fuego: ['llamarada', 'hiken', 'daifunka'],
  Agua: ['chorroagua', 'tiburonazo', 'aquajet'], Rayo: ['descarga', 'raimeihakke', 'yasakani'],
  Hielo: ['soulsolid', 'lullaby', 'iceage'], Tierra: ['rocazo', 'terremoto', 'desertspada'],
  Viento: ['rafaga', 'ciclontempo', 'humoblanco'], Veneno: ['puaveneno', 'gasmh5', 'virusmomia'],
  Oscuridad: ['golpebajo', 'soulpocus', 'blackhole'], Haki: ['hakiarm', 'rokuogan', 'hakirey'],
  Fruta: ['clutch', 'parasite', 'ursusshock'],
};
// Técnicas genéricas: mismas potencias y precisiones que las plantillas históricas,
// pero sin atribuir a cientos de personajes las frutas o el Haki del Rey de otros.
const GENERIC_MOVE_NAMES = {
  Corte:['Corte básico','Corte doble','Corte certero'], Golpe:['Golpe básico','Golpe frontal','Impacto contundente'],
  Disparo:['Disparo','Disparo preciso','Artillería'], Fuego:['Llamarada','Ráfaga ígnea','Explosión de fuego'],
  Agua:['Chorro de agua','Onda marina','Torpedo acuático'], Rayo:['Descarga','Pulso eléctrico','Tormenta eléctrica'],
  Hielo:['Golpe helado','Ráfaga helada','Ventisca'], Tierra:['Rocazo','Impacto sísmico','Ruptura terrestre'],
  Viento:['Ráfaga','Vendaval','Tornado'], Veneno:['Púa venenosa','Gas tóxico','Nube venenosa'],
  Oscuridad:['Golpe bajo','Presión sombría','Asalto sombrío'], Haki:['Armadura','Impacto de Haki','Haki concentrado'],
  Fruta:['Técnica de Fruta','Dominio de Fruta','Poder de Fruta'],
};
for (const [type, names] of Object.entries(GENERIC_MOVE_NAMES)) {
  TYPE_LADDER[type] = TYPE_LADDER[type].map((source, i) => {
    const id = `generic_${type.toLowerCase()}_${i}`;
    MOVES[id] = {...MOVES[source], name:names[i], type};
    return id;
  });
}
MOVES.buggyball = {name:'Buggy Ball', type:'Disparo', power:55, acc:.90};
MOVES.muggyball = {name:'Muggy Ball', type:'Disparo', power:85, acc:.90};
MOVES.tonfagin = {...MOVES.mutonshoot, name:'Tonfas del Demonio'};
MOVES.sorukoby = {...MOVES.karatepez, name:'Golpe con Soru'};
MOVES.jetgatling = {...MOVES.kingkonggun, name:'Jet Gatling'};
CHARS.gin.learnset = CHARS.gin.learnset.map(([l,m]) => [l,m === 'mutonshoot' ? 'tonfagin' : m]);
for (const id of ['coby','coby2']) CHARS[id].learnset = CHARS[id].learnset.map(([l,m]) => [l,m === 'karatepez' ? 'sorukoby' : m]);

const R_BASE = { 1: [16, 8, 7, 8], 2: [20, 10, 8, 9], 3: [24, 12, 9, 11], 4: [28, 14, 11, 12], 5: [34, 16, 13, 13] };

function defineGenChars(sagaId, rows) {
  for (const [id, name, emoji, rareza, types, flags] of rows) {
    if (!CHARS[id]) {
      const [hp, atk, df, spd] = R_BASE[rareza];
      const jit = (id.length % 3) - 1;
      const t1 = types[0], t2 = types[1] || types[0];
      CHARS[id] = {
        name, emoji: emoji || TYPES[t1].emoji, types,
        base: [hp + jit, atk + (jit > 0 ? 1 : 0), df, Math.max(4, spd - (jit < 0 ? 1 : 0))],
        rareza, generated:true,
        boss: flags.includes('b') || undefined,
        learnset: [[1, TYPE_LADDER[t1][0]], [10, TYPE_LADDER[t2][1]], [20, TYPE_LADDER[t1][2]]],
        desc: flags.includes('b') ? 'Un temible adversario que bloquea tu camino.'
          : flags.includes('n') ? 'Nakama de la tripulación del Sombrero de Paja.'
          : 'Un rostro conocido de este mar, dispuesto a unirse a una buena banda.',
      };
    }
    CHARS[id].saga = sagaId;
    if (flags.includes('n')) CHARS[id].nakama = true;
  }
}

defineGenChars('eastblue', [
  ['luffy','Luffy','',3,['Golpe'],'n'], ['zoro','Zoro','',3,['Corte'],'n'], ['nami','Nami','',3,['Rayo'],'n'],
  ['usopp','Usopp','',2,['Disparo'],'n'], ['sanji','Sanji','',3,['Golpe'],'n'],
  ['coby','Coby','',1,['Golpe'],''], ['johnny','Johnny','',1,['Corte'],''], ['yosaku','Yosaku','',1,['Corte'],''],
  ['piratanovato','','',1,['Golpe'],''], ['marineraso','','',1,['Disparo'],''], ['bandido','','',1,['Golpe'],''],
  ['pescador','','',1,['Agua'],''], ['piratapayaso','','',1,['Corte'],''], ['piratagato','','',2,['Corte'],''],
  ['cocinapirata','','',2,['Golpe'],''], ['gyojin','','',2,['Agua'],''], ['gaimon','Gaimon','',2,['Tierra'],''],
  ['chouchou','Chouchou','',1,['Golpe'],''],
  ['alvida','','',2,['Golpe'],'b'], ['helmeppo','','',1,['Corte'],'b'], ['morgan','','',3,['Corte'],'b'],
  ['mohji','','',2,['Golpe'],'b'], ['cabaji','','',2,['Corte'],'b'], ['buggy','','',3,['Corte'],'b'],
  ['sham','','',2,['Corte'],'b'], ['kuro','','',3,['Corte'],'b'], ['gin','','',2,['Golpe'],'b'],
  ['pearl','','',2,['Golpe'],'b'], ['krieg','','',3,['Disparo'],'b'], ['chuu','','',2,['Agua'],'b'],
  ['kuroobi','','',2,['Agua'],'b'], ['hachi','','',2,['Corte'],'b'], ['arlong','','',4,['Agua'],'b'],
  ['tashigi','','',3,['Corte'],'b'], ['smoker','','',5,['Viento'],'b'], ['mihawk','','',5,['Corte'],'b'],
  ['kaya','Kaya','🌼',1,['Viento'],''], ['merry','Merry','🐑',1,['Golpe'],''],
  ['ninjin','Ninjin','🥕',1,['Disparo'],''], ['piiman','Piiman','🫑',1,['Disparo'],''], ['tamanegi','Tamanegi','🧅',1,['Disparo'],''],
  ['boodle','Boodle','🎩',1,['Golpe'],''], ['zeff','Zeff','🦵',3,['Golpe','Fuego'],''],
  ['patty','Patty','🍤',1,['Golpe'],''], ['carnecook','Carne','🍳',1,['Golpe'],''],
  ['bellemere','Belle-mère','🍊',2,['Disparo'],''], ['nojiko','Nojiko','🍹',1,['Viento'],''], ['genzo','Genzo','🌀',1,['Golpe'],''],
  ['kuina','Kuina','🎋',2,['Corte'],''], ['koushirou','Koushirou','⛩️',2,['Corte'],''],
  ['makino','Makino','🍺',1,['Viento'],''], ['woopslap','Woop Slap','📯',1,['Golpe'],''],
  ['ipponmatsu','Ipponmatsu','🗡️',1,['Corte'],''], ['bogard','Bogard','🤠',2,['Corte'],''], ['brandnew','Brandnew','📋',1,['Disparo'],''],
  ['higuma','Higuma','🐻',1,['Corte'],'b'], ['jango','Jango','🌀',1,['Corte'],'b'],
  ['fullbody','Fullbody','💍',1,['Golpe'],'b'], ['nezumi','Nezumi','🐭',1,['Disparo'],'b'], ['ripper','Ripper','⚓',1,['Disparo'],'b'],
]);

defineGenChars('alabasta', [
  ['chopper','Chopper','',3,['Fruta'],'n'],
  ['vivi','Nefertari Vivi','👸',3,['Viento'],'n'], ['karoo','Karoo','🦆',2,['Viento'],'n'],
  ['igaram','Igaram','🎷',2,['Disparo'],''], ['cobra','Nefertari Cobra','👑',2,['Haki'],''],
  ['chaka','Chaka','🐺',3,['Corte','Fruta'],''], ['pell','Pell','🦅',3,['Viento','Fruta'],''],
  ['kohza','Kohza','🏜️',2,['Golpe'],''], ['toto','Toto','⛏️',1,['Tierra'],''],
  ['kureha','Dr. Kureha','🍶',3,['Veneno'],''], ['hiriluk','Dr. Hiriluk','🍄',1,['Veneno'],''],
  ['dalton','Dalton','🐂',3,['Golpe','Fruta'],''], ['dorry','Dorry','🗡️',3,['Corte','Tierra'],''], ['brogy','Brogy','🪓',3,['Golpe','Tierra'],''],
  ['wapol','Wapol','👄',3,['Golpe','Fruta'],'b'], ['chess','Chess','🏹',2,['Disparo'],'b'], ['kuromarimo','Kuromarimo','🟢',2,['Golpe'],'b'],
  ['gem','Gem (Mr. 5)','💥',2,['Fuego','Fruta'],'b'], ['mikita','Mikita (Miss Valentine)','☂️',2,['Golpe','Fruta'],'b'],
  ['galdino','Galdino (Mr. 3)','🕯️',2,['Tierra','Fruta'],'b'], ['marianne','Miss Goldenweek','🎨',1,['Oscuridad'],'b'],
  ['mr4','Mr. 4','⚾',2,['Golpe'],'b'], ['merrychristmas','Miss Merry Christmas','🦡',2,['Tierra','Fruta'],'b'],
  ['bentham','Bentham (Mr. 2)','🦢',3,['Golpe','Fruta'],'b'],
  ['dazbones','Daz Bones (Mr. 1)','🔪',3,['Corte','Fruta'],'b'], ['paula','Paula (Doublefinger)','🌵',3,['Corte','Fruta'],'b'],
  ['hina','Hina','🕊️',3,['Fruta'],'b'], ['crocodile','','',4,['Tierra'],'b'],
]);

defineGenChars('skypiea', [
  ['robin','Nico Robin','',3,['Fruta'],'n'],
  ['ganfall','Gan Fall','🐴',3,['Viento'],''], ['pierre','Pierre','🐦',1,['Viento'],''],
  ['conis','Conis','🎵',1,['Viento'],''], ['pagaya','Pagaya','🔧',1,['Disparo'],''],
  ['wyper','Wyper','🛡️',3,['Disparo','Fuego'],''], ['kamakiri','Kamakiri','🗡️',2,['Corte'],''],
  ['braham','Braham','🔫',2,['Disparo'],''], ['genbo','Genbo','🪨',2,['Tierra'],''],
  ['raki','Raki','🏹',1,['Disparo'],''], ['aisa','Aisa','👂',1,['Haki'],''],
  ['cricket','Mont Blanc Cricket','🌰',2,['Golpe'],''], ['masira','Masira','🐵',2,['Golpe'],''], ['shoujou','Shoujou','🦧',2,['Golpe'],''],
  ['noland','Mont Blanc Noland','🌳',3,['Corte'],''], ['kalgara','Kalgara','🔥',3,['Corte','Fuego'],''],
  ['bellamy','Bellamy','🌀',2,['Golpe','Fruta'],'b'], ['sarquiss','Sarquiss','🔪',2,['Corte'],'b'],
  ['satori','Satori','⚪',2,['Viento'],'b'], ['shura','Shura','🔥',2,['Fuego'],'b'],
  ['gedatsu','Gedatsu','☁️',2,['Golpe'],'b'], ['ohm','Ohm','🐕',3,['Corte'],'b'], ['yama','Yama','⛰️',2,['Tierra'],'b'],
  ['enel','Enel','⚡',5,['Rayo','Fruta'],'b'],
]);

defineGenChars('water7', [
  ['franky','Franky','',3,['Disparo'],'n'],
  ['iceburg','Iceburg','🐹',3,['Golpe'],''], ['paulie','Paulie','🪢',2,['Corte'],''],
  ['lulu','Peepley Lulu','💈',2,['Corte'],''], ['tilestone','Tilestone','🔨',2,['Golpe'],''],
  ['kokoro','Kokoro','🍶',2,['Agua'],''], ['chimney','Chimney','🐰',1,['Golpe'],''], ['gonbe','Gonbe','🐱',1,['Golpe'],''],
  ['zambai','Zambai','🪖',2,['Disparo'],''], ['kiwi','Kiwi','🍸',1,['Corte'],''], ['mozu','Mozu','🍹',1,['Corte'],''],
  ['tom','Tom','🐟',3,['Golpe','Agua'],''], ['yokozuna','Yokozuna','🐸',2,['Golpe'],''],
  ['oimo','Oimo','🪵',2,['Golpe','Tierra'],''], ['kashi','Kashi','🪓',2,['Corte','Tierra'],''],
  ['tbone','T-Bone','🦴',2,['Corte'],''],
  ['wanze','Wanze','🍜',1,['Golpe'],'b'], ['nero','Nero','🦦',1,['Corte'],'b'],
  ['blueno','Blueno','🚪',3,['Golpe','Fruta'],'b'], ['kaku','Kaku','🦒',3,['Corte','Fruta'],'b'],
  ['kalifa','Kalifa','🫧',3,['Golpe','Fruta'],'b'], ['jabra','Jabra','🐺',3,['Golpe','Fruta'],'b'],
  ['kumadori','Kumadori','🎭',2,['Golpe'],'b'], ['fukuro','Fukuro','🦉',2,['Golpe'],'b'],
  ['spandam','Spandam','🐘',1,['Corte'],'b'], ['lucci','','',4,['Fruta'],'b'],
]);

defineGenChars('thriller', [
  ['brook','Brook','',3,['Corte'],'n'],
  ['lola','Lola','💋',2,['Golpe'],''], ['cindry','Victoria Cindry','🍽️',2,['Golpe'],''],
  ['kumashi','Kumashi','🧸',1,['Golpe'],''], ['risky','Risky Brothers','🦴',1,['Golpe'],''],
  ['hildon','Hildon','🦇',1,['Oscuridad'],'b'], ['tararan','Tararan','🕷️',2,['Veneno'],'b'],
  ['perona','Perona','👻',3,['Oscuridad','Fruta'],'b'], ['absalom','Absalom','🦁',3,['Golpe','Fruta'],'b'],
  ['hogback','Dr. Hogback','🧪',2,['Veneno'],'b'], ['ryuma','Ryuma','⚔️',4,['Corte','Oscuridad'],'b'],
  ['oars','Oars','🧟',4,['Golpe','Tierra'],'b'], ['moria','Gecko Moria','🦎',5,['Oscuridad','Fruta'],'b'],
]);

defineGenChars('marineford', [
  ['jinbe','Jinbe','',4,['Agua'],'n'],
  ['hancock','','',4,['Fruta'],''], ['sandersonia','Boa Sandersonia','🐍',3,['Fruta'],''], ['marigold','Boa Marigold','🐍',3,['Fruta','Veneno'],''],
  ['gloriosa','Gloriosa','🐍',2,['Haki'],''], ['marguerite','Marguerite','🏹',2,['Disparo'],''],
  ['dadan','Curly Dadan','🍖',2,['Golpe'],''], ['dogra','Dogra','🔪',1,['Corte'],''], ['magra','Magra','🐓',1,['Golpe'],''],
  ['rouge','Portgas D. Rouge','🌺',2,['Haki'],''],
  ['ivankov','Emporio Ivankov','💜',4,['Golpe','Fruta'],''], ['inazuma','Inazuma','✂️',3,['Corte','Fruta'],''],
  ['jozu','Jozu','💎',4,['Golpe','Fruta'],''], ['vista','Vista','🌹',4,['Corte'],''], ['thatch','Thatch','🍳',3,['Corte'],''],
  ['izo','Izo','🎎',3,['Disparo'],''], ['haruta','Haruta','🗡️',2,['Corte'],''], ['atmos','Atmos','🐃',2,['Golpe'],''],
  ['fossa','Fossa','🔥',2,['Corte','Fuego'],''], ['curiel','Curiel','💣',2,['Disparo'],''], ['namur','Namur','🦈',2,['Agua'],''],
  ['blenheim','Blenheim','⚒️',2,['Golpe'],''], ['rakuyo','Rakuyo','⛓️',2,['Golpe'],''], ['blamenco','Blamenco','🔨',2,['Golpe'],''],
  ['kingdew','Kingdew','🥊',2,['Golpe'],''], ['speedjiru','Speed Jiru','🏇',2,['Corte'],''],
  ['squard','Squard','⚔️',2,['Corte'],''], ['whiteybay','Whitey Bay','🧊',2,['Hielo'],''], ['oarsjr','Little Oars Jr.','🗿',3,['Golpe','Tierra'],''],
  ['tsuru','Tsuru','🧺',3,['Fruta'],''], ['stronger','Stronger','🐴',1,['Golpe'],''],
  ['magellan','Magellan','☠️',4,['Veneno','Fruta'],'b'], ['hannyabal','Hannyabal','👹',3,['Corte'],'b'],
  ['sadie','Sadie','🪶',2,['Golpe'],'b'], ['saldeath','Saldeath','🔱',2,['Disparo'],'b'],
  ['domino','Domino','🕶️',2,['Golpe'],'b'], ['minotauros','Minotauros','🐮',2,['Golpe'],'b'],
  ['momonga','Momonga','🗡️',3,['Corte'],'b'], ['onigumo','Onigumo','🕸️',3,['Corte'],'b'],
  ['doberman','Doberman','🐕',3,['Corte'],'b'], ['johngiant','John Giant','🗽',3,['Corte','Tierra'],'b'],
  ['strawberry','Strawberry','🍓',3,['Corte'],'b'], ['yamakaji','Yamakaji','🔥',3,['Corte'],'b'],
  ['sengoku','Sengoku','🐏',5,['Haki','Fruta'],'b'],
  ['burgess','Jesus Burgess','🤼',3,['Golpe'],'b'], ['shiryu','Shiryu','🌧️',4,['Corte'],'b'],
  ['vanaugur','Van Augur','🔭',3,['Disparo'],'b'], ['lafitte','Laffitte','🎩',3,['Viento'],'b'],
  ['devon','Catarina Devon','🦊',3,['Fruta'],'b'], ['sanjuanwolf','Sanjuan Wolf','🏔️',4,['Tierra'],'b'],
  ['pizarro','Avalo Pizarro','🐱',3,['Tierra','Fruta'],'b'], ['vascoshot','Vasco Shot','🍶',3,['Golpe'],'b'],
  ['docq','Doc Q','🪓',3,['Veneno'],'b'],
  ['whitebeard2','','',5,['Tierra'],'b'],
]);

defineGenChars('gyojin', [
  ['neptune','Neptune','🔱',3,['Agua'],''], ['shirahoshi','Shirahoshi','🧜‍♀️',3,['Agua','Haki'],''],
  ['fukaboshi','Fukaboshi','🦈',3,['Agua','Corte'],''], ['ryuboshi','Ryuboshi','🎼',2,['Agua'],''], ['manboshi','Manboshi','💃',2,['Agua'],''],
  ['otohime','Otohime','👑',2,['Haki'],''], ['camie','Camie','🧜‍♀️',1,['Agua'],''], ['pappag','Pappag','⭐',1,['Agua'],''],
  ['shyarly','Shyarly','🔮',2,['Agua'],''], ['den','Den','🐟',2,['Agua'],''],
  ['aladine','Aladine','🩺',2,['Agua'],''], ['praline','Praline','🦈',2,['Agua'],''], ['fishertiger','Fisher Tiger','☀️',4,['Agua','Golpe'],''],
  ['hammond','Hammond','🐡',1,['Disparo'],'b'], ['hyouzou','Hyouzou','🐙',2,['Corte','Veneno'],'b'],
  ['dosun','Dosun','🔨',2,['Golpe'],'b'], ['zeo','Zeo','🫥',2,['Oscuridad'],'b'],
  ['daruma','Daruma','🦷',2,['Corte'],'b'], ['ikaros','Ikaros Much','🦑',2,['Corte'],'b'],
  ['decken','Vander Decken IX','🎯',3,['Disparo','Fruta'],'b'], ['wadatsumi','Wadatsumi','🐡',3,['Golpe','Tierra'],'b'],
  ['hody','Hody Jones','🦈',4,['Agua','Golpe'],'b'],
]);

defineGenChars('dressrosa', [
  ['law','','',4,['Fruta'],''], ['sabo','','',4,['Fuego'],''],
  ['koala','Koala','🐨',2,['Golpe'],''], ['hack','Hack','🐠',2,['Golpe','Agua'],''],
  ['brownbeard','Brownbeard','🐊',2,['Golpe'],''], ['mocha','Mocha','🍫',1,['Golpe'],''],
  ['baby5','Baby 5','🔫',3,['Disparo','Fruta'],''], ['viola','Viola','💃',2,['Haki','Fruta'],''],
  ['kyros','Kyros','🦵',4,['Corte'],''], ['rebecca','Rebecca','🛡️',2,['Corte'],''],
  ['rikudold','Riku Dold III','👑',2,['Corte'],''], ['scarlett','Scarlett','🌹',1,['Haki'],''],
  ['elizabello','Elizabello II','🥊',3,['Golpe'],''], ['dagama','Dagama','🧠',1,['Corte'],''], ['tanklepanto','Tank Lepanto','🛡️',1,['Corte'],''],
  ['cavendish','Cavendish','🐎',4,['Corte'],''], ['suleiman','Suleiman','⚔️',2,['Corte'],''],
  ['bartolomeo','Bartolomeo','🐔',3,['Fruta'],''], ['gambia','Gambia','🌵',1,['Disparo'],''],
  ['sai','Sai','🔱',3,['Golpe'],''], ['boo','Boo','🪖',2,['Golpe'],''], ['chinjao','Chinjao','🌀',3,['Golpe','Haki'],''],
  ['ideo','Ideo','🥊',2,['Golpe','Fuego'],''], ['bluegilly','Blue Gilly','🦵',2,['Golpe'],''],
  ['abdullah','Abdullah','🔪',1,['Corte'],''], ['jeet','Jeet','🏹',1,['Disparo'],''],
  ['leo','Leo','🪡',2,['Golpe'],''], ['mansherry','Mansherry','🌸',2,['Fruta'],''], ['hajrudin','Hajrudin','⛰️',3,['Golpe','Tierra'],''],
  ['orlumbus','Orlumbus','🚣',2,['Golpe'],''], ['columbus','Columbus','🧭',1,['Golpe'],''],
  ['caesar','Caesar Clown','🧪',3,['Veneno','Fruta'],'b'], ['monet','Monet','❄️',3,['Hielo','Fruta'],'b'],
  ['vergo','Vergo','🎋',3,['Golpe','Haki'],'b'],
  ['sugar','Sugar','🍇',2,['Fruta'],'b'], ['jora','Jora','🎨',2,['Fruta'],'b'], ['buffalo','Buffalo','🚁',2,['Fruta'],'b'],
  ['trebol','Trebol','🟢',3,['Fruta','Veneno'],'b'], ['diamante','Diamante','🃏',3,['Corte','Fruta'],'b'],
  ['pica','Pica','🗿',3,['Tierra','Fruta'],'b'], ['senorpink','Señor Pink','🍼',2,['Golpe','Fruta'],'b'],
  ['laog','Lao G','👊',2,['Golpe'],'b'], ['dellinger','Dellinger','👠',2,['Golpe'],'b'],
  ['machvise','Machvise','⚖️',2,['Golpe','Fruta'],'b'], ['gladius','Gladius','💥',2,['Fruta'],'b'],
  ['fujitora','Issho (Fujitora)','🌌',5,['Tierra','Fruta'],'b'],
]);

defineGenChars('wholecake', [
  ['katakuri','','',5,['Fruta'],''],
  ['reiju','Vinsmoke Reiju','🦋',3,['Veneno','Golpe'],''], ['sora','Vinsmoke Sora','🕊️',2,['Haki'],''],
  ['cosette','Cosette','🍰',1,['Golpe'],''], ['pudding','Charlotte Pudding','🍮',3,['Fruta','Haki'],''],
  ['chiffon','Charlotte Chiffon','🎀',2,['Golpe'],''], ['morgans','Morgans','📰',2,['Viento','Fruta'],''],
  ['pekoms','Pekoms','🦁',2,['Golpe','Fruta'],''], ['streusen','Streusen','🍴',2,['Corte','Fruta'],''],
  ['kingbaum','King Baum','🌳',2,['Tierra'],''],
  ['zeus2','Zeus','☁️',2,['Rayo'],''], ['prometheus','Prometheus','☀️',2,['Fuego'],''],
  ['napoleon','Napoleon','👒',2,['Corte'],''], ['hera','Hera','🌩️',2,['Rayo'],''],
  ['tamago','Tamago','🥚',2,['Corte'],'b'], ['bobbin','Bobbin','🕯️',2,['Golpe'],'b'],
  ['judge','Vinsmoke Judge','🧬',4,['Disparo','Corte'],'b'], ['ichiji','Vinsmoke Ichiji','✨',3,['Golpe','Fuego'],'b'],
  ['niji','Vinsmoke Niji','⚡',3,['Golpe','Rayo'],'b'], ['yonji','Vinsmoke Yonji','🟢',3,['Golpe'],'b'],
  ['cracker','Charlotte Cracker','🍪',4,['Corte','Fruta'],'b'], ['brulee','Charlotte Brûlée','🪞',2,['Fruta'],'b'],
  ['perospero','Charlotte Perospero','🍭',3,['Fruta'],'b'], ['daifuku','Charlotte Daifuku','🧞',3,['Corte','Fruta'],'b'],
  ['oven','Charlotte Oven','♨️',3,['Fuego','Fruta'],'b'], ['opera','Charlotte Opera','🍦',2,['Fruta'],'b'],
  ['smoothie','Charlotte Smoothie','🍹',4,['Corte','Fruta'],'b'], ['montdor','Charlotte Mont-d\'Or','📚',2,['Fruta'],'b'],
  ['amande','Charlotte Amande','🗡️',2,['Corte'],'b'], ['galette','Charlotte Galette','🥞',2,['Fruta'],'b'],
  ['snack','Charlotte Snack','🍘',3,['Corte'],'b'], ['flampe','Charlotte Flampe','🪃',1,['Disparo'],'b'],
  ['moscato','Charlotte Moscato','🍨',2,['Golpe'],'b'], ['bavarois','Charlotte Bavarois','🍮',2,['Golpe'],'b'],
  ['anana','Charlotte Anana','🍍',1,['Corte'],'b'],
  ['bigmom','','',5,['Oscuridad'],'b'],
]);

defineGenChars('wano', [
  ['kaido','','',5,['Fuego'],'b'], ['yamato','','',4,['Rayo'],''], ['oden','','',5,['Corte'],''],
  ['king','','',4,['Fuego'],'b'], ['queen','','',4,['Veneno'],'b'], ['kid','','',4,['Fruta'],''],
  ['kinemon','Kin\'emon','🦊',3,['Corte','Fuego'],''], ['momonosuke','Momonosuke','🐉',2,['Fruta'],''],
  ['hiyori','Kozuki Hiyori','🌙',2,['Haki'],''], ['toki','Kozuki Toki','⏳',2,['Fruta'],''],
  ['sukiyaki','Kozuki Sukiyaki','👘',2,['Corte'],''], ['denjiro','Denjiro','🎲',4,['Corte'],''],
  ['kiku','Kikunojo','🌸',3,['Corte'],''], ['raizo','Raizo','🥷',3,['Corte','Viento'],''],
  ['ashuradoji','Ashura Doji','👹',3,['Corte'],''], ['kawamatsu','Kawamatsu','🐟',3,['Corte','Agua'],''],
  ['shinobu','Shinobu','🍡',2,['Fruta'],''], ['hyogoro','Hyogoro','🌸',3,['Golpe','Haki'],''],
  ['yasuie','Shimotsuki Yasuie','😂',2,['Corte'],''], ['ushimaru','Shimotsuki Ushimaru','🏹',3,['Corte'],''],
  ['tama','Tama','🍡',1,['Fruta'],''], ['toko','Toko','😄',1,['Golpe'],''], ['otsuru2','O-Tsuru','🍵',1,['Golpe'],''],
  ['hitetsu','Tenguyama Hitetsu','👺',2,['Corte'],''],
  ['inuarashi','Inuarashi','🐶',4,['Corte'],''], ['nekomamushi','Nekomamushi','🐱',4,['Golpe'],''],
  ['carrot','Carrot','🐰',3,['Golpe','Rayo'],''], ['pedro','Pedro','🐆',3,['Corte'],''],
  ['wanda','Wanda','🐕',2,['Corte'],''], ['shishilian','Shishilian','🦁',2,['Corte'],''],
  ['killer','Killer','🌀',3,['Corte'],''], ['drake','X Drake','🦖',3,['Corte','Fruta'],''],
  ['zunesha','Zunesha','🐘',4,['Tierra','Haki'],''],
  ['hawkins','Basil Hawkins','🎴',3,['Oscuridad','Fruta'],'b'], ['apoo','Scratchmen Apoo','🎵',3,['Rayo','Fruta'],'b'],
  ['holdem','Holdem','🦁',2,['Fuego'],'b'], ['speed','Speed','🐴',2,['Golpe'],''],
  ['babanuki','Babanuki','🐘',2,['Disparo'],'b'], ['dobon','Dobon','🦛',2,['Golpe'],'b'],
  ['daifugo','Daifugo','🦂',2,['Veneno'],'b'], ['batman','Batman','🦇',2,['Disparo'],'b'],
  ['gazelleman','Gazelleman','🦌',2,['Golpe'],'b'], ['baohuang','Bao Huang','🐭',1,['Oscuridad'],'b'],
  ['fukurokuju','Fukurokuju','🥷',3,['Oscuridad'],'b'], ['kanjuro','Kanjuro','🎨',3,['Fruta','Oscuridad'],'b'],
  ['orochi','Kurozumi Orochi','🐍',3,['Fruta','Oscuridad'],'b'],
  ['jack','Jack','🐘',4,['Golpe','Fruta'],'b'], ['ulti','Ulti','🦕',3,['Golpe','Fruta'],'b'],
  ['pageone','Page One','🦖',3,['Golpe','Fruta'],'b'], ['whoswho','Who\'s-Who','🐅',3,['Corte','Fruta'],'b'],
  ['sasaki','Sasaki','🦕',3,['Golpe','Fruta'],'b'], ['blackmaria','Black Maria','🕷️',3,['Fuego','Fruta'],'b'],
  ['fugan','Fugan','🌬️',2,['Viento'],'b'], ['jaki','Jaki','🤖',2,['Golpe'],'b'], ['goki','Goki','🤖',2,['Golpe'],'b'],
]);

defineGenChars('egghead', [
  ['vegapunk','','',3,['Disparo'],''], ['bonney','','',3,['Fruta'],''], ['kuma','','',4,['Fruta'],''],
  ['dragon','','',5,['Viento'],''], ['roger','','',5,['Haki'],''], ['shanks','','',5,['Haki'],''],
  ['newgate','','',5,['Tierra'],''], ['teach','','',5,['Oscuridad'],'b'], ['garp','','',5,['Golpe'],''],
  ['akainu','','',5,['Fuego'],'b'], ['kizaru','','',5,['Rayo'],'b'], ['aokiji','','',5,['Hielo'],''],
  ['marco','','',4,['Fuego'],''], ['ace','','',4,['Fuego'],''], ['doflamingo','','',4,['Fruta'],'b'],
  ['shaka','Shaka','🟠',3,['Haki'],''], ['lilith','Lilith','😈',3,['Disparo'],''],
  ['edison','Edison','💡',2,['Rayo'],''], ['pythagoras','Pythagoras','📐',2,['Disparo'],''],
  ['atlas','Atlas','🔧',3,['Golpe'],''], ['stussy','Stussy','🕷️',3,['Oscuridad'],''],
  ['karasu','Karasu','🐦‍⬛',3,['Oscuridad','Viento'],''], ['betty','Belo Betty','🚩',3,['Haki','Fruta'],''],
  ['morley','Morley','⛏️',3,['Tierra','Fruta'],''], ['lindbergh','Lindbergh','🐱',2,['Disparo'],''],
  ['rayleigh','Silvers Rayleigh','⚙️',5,['Haki','Corte'],''], ['gaban','Scopper Gaban','🪓',4,['Corte'],''],
  ['crocus','Crocus','🌸',3,['Golpe'],''], ['benn','Benn Beckman','🔫',4,['Disparo','Haki'],''],
  ['luckyroux','Lucky Roux','🍗',3,['Disparo'],''], ['yasopp','Yasopp','🎯',3,['Disparo'],''],
  ['rockstar','Rockstar','🎸',2,['Corte'],''],
  ['rocinante','Donquixote Rocinante','🪶',3,['Oscuridad','Fruta'],''], ['homing','Donquixote Homing','🕊️',1,['Haki'],''],
  ['mjosgard','Donquixote Mjosgard','🙏',1,['Golpe'],''],
  ['weevil','Edward Weevil','🍼',3,['Corte'],'b'], ['bakkin','Miss Bakkin','👵',1,['Golpe'],'b'],
  ['york','York','🌙',3,['Veneno'],'b'],
  ['ssnake','S-Snake','🐍',3,['Fruta'],'b'], ['shawk','S-Hawk','🦅',3,['Corte','Fruta'],'b'],
  ['sshark','S-Shark','🦈',3,['Agua','Golpe'],'b'], ['sbear','S-Bear','🐾',3,['Fruta'],'b'],
  ['sflamingo','S-Flamingo','🦩',3,['Fruta'],'b'], ['sgecko','S-Gecko','🦎',3,['Oscuridad'],'b'],
  ['scroc','S-Crocodile','🐊',3,['Tierra'],'b'],
  ['ryokugyu','Aramaki (Ryokugyu)','🌲',5,['Tierra','Fruta'],'b'],
  ['charlos','Charlos','🫧',1,['Golpe'],'b'], ['rosward','Rosward','👑',1,['Corte'],'b'], ['shalria','Shalria','👛',1,['Golpe'],'b'],
  ['garling','Figarland Garling','⚔️',5,['Corte','Haki'],'b'],
  ['saturn','Jaygarcia Saturn','🕷️',5,['Oscuridad','Fruta'],'b'], ['mars','Marcus Mars','🐦',5,['Viento','Fruta'],'b'],
  ['warcury','Topman Warcury','🐗',5,['Golpe','Fruta'],'b'], ['nusjuro','Ethanbaron V. Nusjuro','🐴',5,['Corte','Hielo'],'b'],
  ['jupeter','Shepherd Ju Peter','🪱',5,['Tierra','Fruta'],'b'], ['im','Im','👁️',5,['Oscuridad','Haki'],'b'],
  ['xebec','Rocks D. Xebec','🪨',5,['Oscuridad','Haki'],'b'], ['shiki','Shiki','🦁',4,['Viento','Fruta'],'b'],
  ['john','Captain John','💰',2,['Corte'],'b'], ['sengoku2','Kong','🦍',4,['Golpe'],'b'],
  ['joyboy','Joy Boy','☀️',5,['Golpe','Haki'],''], ['lili','Nefertari D. Lili','🏺',3,['Haki'],''],
  ['emeth','Emeth','🤖',4,['Golpe','Tierra'],''],
]);

// ============ CROSSOVER DE ANIME ============
// Personajes de otras series para el evento de crossover (camino alternativo
// tras el jefe final de cada saga). No aparecen en islas, mercado ni Torre.
defineGenChars('crossover', [
  // Naruto
  ['naruto', 'Naruto Uzumaki', '🍥', 4, ['Viento', 'Haki'], ''],
  ['sasuke', 'Sasuke Uchiha', '🦅', 4, ['Rayo', 'Fuego'], ''],
  ['kakashi', 'Kakashi Hatake', '🐺', 4, ['Rayo', 'Corte'], ''],
  ['madara', 'Madara Uchiha', '🌒', 5, ['Fuego', 'Oscuridad'], 'b'],
  ['orochimaru', 'Orochimaru', '🐍', 4, ['Veneno', 'Oscuridad'], 'b'],
  // Jujutsu Kaisen
  ['itadori', 'Yuji Itadori', '👊', 4, ['Golpe', 'Oscuridad'], ''],
  ['yuta', 'Yuta Okkotsu', '⚔️', 4, ['Corte', 'Haki'], ''],
  ['gojo', 'Satoru Gojo', '🕶️', 4, ['Oscuridad', 'Haki'], ''],
  ['sukuna', 'Ryomen Sukuna', '👹', 5, ['Corte', 'Oscuridad'], 'b'],
  // Kimetsu no Yaiba
  ['tanjiro', 'Tanjiro Kamado', '🌊', 4, ['Agua', 'Fuego'], ''],
  ['zenitsu', 'Zenitsu Agatsuma', '⚡', 4, ['Rayo', 'Corte'], ''],
  ['inosuke', 'Inosuke Hashibira', '🐗', 4, ['Corte', 'Golpe'], ''],
  ['nezuko', 'Nezuko Kamado', '🎀', 4, ['Fuego', 'Oscuridad'], ''],
  ['kibutsuji', 'Muzan Kibutsuji', '🩸', 5, ['Oscuridad', 'Veneno'], 'b'],
  // Dragon Ball
  ['goku', 'Goku', '🐒', 4, ['Golpe', 'Haki'], ''],
  ['vegeta', 'Vegeta', '💥', 4, ['Golpe', 'Rayo'], ''],
  ['gohan', 'Gohan', '🥋', 4, ['Golpe', 'Rayo'], ''],
  ['gokuui', 'Goku Ultra Instinto', '✨', 5, ['Golpe', 'Haki'], 'b'],
  ['jiren', 'Jiren', '👽', 5, ['Golpe', 'Haki'], 'b'],
  ['cell', 'Cell', '🦗', 5, ['Veneno', 'Rayo'], 'b'],
  ['frieza', 'Freezer', '❄️', 5, ['Hielo', 'Oscuridad'], 'b'],
  ['zenosama', 'Zeno-sama', '🌌', 5, ['Oscuridad', 'Haki'], 'b'],
  // One Punch Man
  ['saitama', 'Saitama', '👨‍🦲', 5, ['Golpe', 'Haki'], 'b'],
  ['genos', 'Genos', '🤖', 4, ['Fuego', 'Rayo'], ''],
  ['garou', 'Garou', '🐺', 4, ['Golpe', 'Oscuridad'], ''],
  ['tatsumaki', 'Tatsumaki', '🌪️', 4, ['Viento', 'Haki'], ''],
]);

// Series del evento: jefes posibles (bosses) y los 3 reclutas predefinidos (rewards)
const CROSSOVER_SERIES = {
  naruto:     { name: 'Naruto',           emoji: '🍥', bosses: ['madara', 'orochimaru'], rewards: ['naruto', 'sasuke', 'kakashi'] },
  jjk:        { name: 'Jujutsu Kaisen',   emoji: '👹', bosses: ['sukuna'],               rewards: ['itadori', 'yuta', 'gojo'] },
  kimetsu:    { name: 'Kimetsu no Yaiba', emoji: '🩸', bosses: ['kibutsuji'],            rewards: ['tanjiro', 'zenitsu', 'inosuke'] },
  dragonball: { name: 'Dragon Ball',      emoji: '🐉', bosses: ['jiren', 'cell', 'frieza', 'gokuui', 'zenosama'], rewards: ['goku', 'vegeta', 'gohan'] },
  onepunch:   { name: 'One Punch Man',    emoji: '👊', bosses: ['saitama'],              rewards: ['genos', 'garou', 'tatsumaki'] },
};
const CROSSOVER_BOOST = 0.5; // el jefe del crossover recibe +50% de Daño y Defensa

// Cualquier personaje sin saga (formas evolucionadas, etc.) hereda la de su base o East Blue
for (const [id, c] of Object.entries(CHARS)) {
  if (!c.saga) {
    let base = id;
    for (const [evoId, ch] of Object.entries(CHARS)) {
      if (ch.evo && ch.evo.to === id) { base = evoId; break; }
    }
    c.saga = (CHARS[base] && CHARS[base].saga) || 'eastblue';
  }
}

// Definitivas propias: nunca se toma una técnica ajena por compartir tipo.
const SIGNATURE_MOVES = {
  zoro:'santoryuogi', zoro2:'ashura', nami:'thundertempo', nami2:'thundertempo',
  usopp:'kabuto', usopp2:'estrellafuego', sanji:'diablejambe', chopper:'monsterpoint',
  robin:'demoniofleur', franky:'radicalbeam', brook:'lullaby', jinbe:'buraikan',
  buggy:'muggyball', roger:'kamusari', newgate:'shimayurashi', kaido:'kaendaiko',
  bigmom:'ikoku', shanks:'kamusarirojo', teach:'blackhole', law:'gammaknife', kid:'punkrotten',
  mihawk:'cortemundo', akainu:'daifunka', kizaru:'yasakani', aokiji:'iceage', garp:'galaxyimpact',
  dragon:'vientolibre', oden:'togentotsuka', smoker:'humoblanco', crocodile:'desertspada',
  doflamingo:'parasite', kuma:'ursusshock', hancock:'meromellow', sabo:'hiken', lucci:'rokuogan',
  bonney:'distortion', yamato:'raimeihakke', king:'llamalunaria', queen:'virusmomia',
  katakuri:'mochitsuki', ace:'daienkai',
};
for (const [id,move] of Object.entries(SIGNATURE_MOVES)) {
  if (!CHARS[id]) continue;
  CHARS[id].ultimate = move;
  if (CHARS[id].generated) CHARS[id].learnset[2] = [20,move];
}

// ============ CONSTRUCCIÓN DE SAGAS E ISLAS ============
const SAGA_DEFS = [
  { id: 'eastblue', name: 'EAST BLUE', img: 'Images/east-blue-portada.jpg', color: '#3f8fd6', islands: [
    ['Shells Town', ['helmeppo', 'morgan']], ['Orange Town', ['mohji', 'cabaji', 'buggy']],
    ['Villa Syrup', ['sham', 'kuro']], ['Baratie', ['gin', 'pearl', 'krieg']],
    ['Arlong Park', ['chuu', 'kuroobi', 'hachi', 'arlong']], ['Loguetown', ['tashigi', 'smoker']],
  ]},
  { id: 'alabasta', name: 'ALABASTA', img: 'Images/portada-saga-alabasta.jpg', color: '#d9a441', islands: [
    ['Whiskey Peak', ['mikita', 'gem']], ['Little Garden', ['marianne', 'galdino']],
    ['Isla Drum', ['chess', 'kuromarimo', 'wapol']], ['Rainbase', ['mr4', 'merrychristmas', 'bentham']],
    ['Alubarna', ['paula', 'dazbones', 'crocodile']],
  ]},
  { id: 'skypiea', name: 'SKYPIEA', img: 'Images/portada-saga-skypiea.jpg', color: '#9fd6e8', islands: [
    ['Jaya', ['sarquiss', 'bellamy']], ['Playa Angel', ['satori', 'shura']],
    ['Upper Yard', ['gedatsu', 'ohm', 'yama']], ['Santuario de Dios', ['enel']],
  ]},
  { id: 'water7', name: 'WATER 7', img: 'Images/portada-saga-water-seven.jpg', color: '#5aa8c4', islands: [
    ['Water 7', ['wanze', 'nero']], ['Tren Marino', ['tbone', 'blueno']],
    ['Enies Lobby', ['kumadori', 'fukuro', 'jabra']], ['Torre de la Justicia', ['kaku', 'kalifa', 'lucci']],
  ]},
  { id: 'thriller', name: 'THRILLER BARK', img: 'Images/portada-saga-thriller-bark.jpg', color: '#6e5a8a', islands: [
    ['Niebla Fantasma', ['hildon', 'tararan']], ['Mansión Hogback', ['hogback', 'absalom']],
    ['Jardín Helado', ['ryuma', 'perona']], ['Mástil Mayor', ['oars', 'moria']],
  ]},
  { id: 'marineford', name: 'MARINEFORD', img: 'Images/portada-saga-marine-fort.jpg', color: '#c45a5a', islands: [
    ['Amazon Lily', ['sadie', 'domino']], ['Impel Down Nv1-3', ['saldeath', 'minotauros', 'hannyabal']],
    ['Impel Down Nv4-6', ['magellan']], ['Bahía de Marineford', ['momonga', 'onigumo', 'johngiant']],
    ['Plaza Ejecución', ['strawberry', 'doberman', 'sengoku']],
  ]},
  { id: 'gyojin', name: 'ISLA GYOJIN', img: 'Images/portada-saga-gyogin.jpg', color: '#3fbfae', islands: [
    ['Bosque Marino', ['hammond', 'hyouzou']], ['Distrito Gyojin', ['dosun', 'zeo', 'daruma']],
    ['Palacio Ryugu', ['ikaros', 'decken']], ['Plaza Gyoncorde', ['wadatsumi', 'hody']],
  ]},
  { id: 'dressrosa', name: 'DRESSROSA', img: 'Images/portada-saga-dressrossa.jpg', color: '#d96a8a', islands: [
    ['Punk Hazard', ['monet', 'vergo', 'caesar']], ['Puerto de Acacia', ['sugar', 'jora', 'buffalo']],
    ['Coliseo Corrida', ['dellinger', 'laog', 'machvise']], ['Palacio Real', ['gladius', 'senorpink', 'diamante']],
    ['Campo de Flores', ['pica', 'trebol', 'doflamingo']], ['Puerto Final', ['fujitora']],
  ]},
  { id: 'wholecake', name: 'WHOLE CAKE', color: '#e88ab0', islands: [
    ['Bosque Seductor', ['brulee', 'kingbaum2'] ], ['Ciudad Dulce', ['bobbin', 'cracker']],
    ['Castillo Whole Cake', ['opera', 'tamago', 'perospero']], ['La Boda', ['daifuku', 'oven', 'smoothie']],
    ['Isla Cacao', ['katakuri']], ['Huida Final', ['bigmom']],
  ]},
  { id: 'wano', name: 'PAÍS DE WANO', img: 'Images/portada-saga-wano.jpg', color: '#b03a3a', islands: [
    ['Kuri', ['holdem', 'speed2']], ['Udon', ['dobon', 'daifugo', 'babanuki']],
    ['La Capital', ['batman', 'gazelleman', 'fukurokuju']], ['Onigashima Exterior', ['ulti', 'pageone', 'jack']],
    ['Castillo del Cráneo', ['sasaki', 'blackmaria', 'whoswho']], ['Cúpula', ['king', 'queen']],
    ['Techo del Mundo', ['orochi', 'kaido']],
  ]},
  { id: 'egghead', name: 'EGGHEAD', img: 'Images/portada-saga-egghead.jpg', color: '#7a5ad9', islands: [
    ['Laboratorio', ['ssnake', 'shawk', 'sshark']], ['Fábrica', ['sbear', 'sflamingo', 'sgecko']],
    ['Ciudad Futura', ['scroc', 'york']], ['Asalto Marine', ['ryokugyu', 'kizaru']],
    ['Los Cinco Ancianos', ['saturn', 'mars', 'warcury']], ['Trono Vacío', ['nusjuro', 'jupeter', 'im']],
  ]},
];

// Corrige ids especiales de los defs (referencias con sufijos)
const BOSS_ALIASES = { kingbaum2: 'brulee', speed2: 'holdem' };

// Las formas evolucionadas nunca aparecen como encuentros (sus movimientos
// empiezan a nivel alto y saldrían sin ataques)
const EVOLVED_FORMS = new Set(Object.values(CHARS).filter(c => c.evo).map(c => c.evo.to));

// ============ EXTENSIÓN DE STATS ============
// Amplía cada base [hp, atk, def, spd] a [hp, atk, def, spatk, spdef, spd].
// El reparto físico/especial se deriva del tipo primario: los tipos físicos
// (Corte/Golpe/Disparo) pegan más con ATQ; el resto, con ESP_ATQ.
for (const c of Object.values(CHARS)) {
  if (c.base.length === 4) {
    const [hp, atk, def, spd] = c.base;
    const phys = isPhysType(c.types[0]);
    const spatk = Math.max(4, phys ? atk - 2 : atk + 1);
    const spdef = Math.max(4, phys ? def - 1 : def + 1);
    c.base = [hp, phys ? atk : Math.max(4, atk - 1), def, spatk, spdef, spd];
  }
}

// ============ DIVISIÓN CANÓNICA DE SAGAS ============
// Reasigna cada personaje a la saga donde aparece en la historia real.
const SAGA_FIXES = {
  // East Blue — Piratas del Pelirrojo
  shanks: 'eastblue', benn: 'eastblue', luckyroux: 'eastblue', yasopp: 'eastblue', rockstar: 'eastblue',
  // Alabasta — Marina
  tashigi: 'alabasta', smoker: 'alabasta', fullbody: 'alabasta', jango: 'alabasta',
  // Skypiea — Piratas de Barbanegra en Jaya
  docq: 'skypiea', stronger: 'skypiea', lafitte: 'skypiea', burgess: 'skypiea', vanaugur: 'skypiea',
  // Marineford — Sabaody, Barbablanca, Barbanegra, Marina, Tenryuubito y flashbacks
  kid: 'marineford', killer: 'marineford', drake: 'marineford', hawkins: 'marineford', apoo: 'marineford',
  bonney: 'marineford', rayleigh: 'marineford', camie: 'marineford', pappag: 'marineford',
  newgate: 'marineford', marco: 'marineford', ace: 'marineford', teach: 'marineford',
  akainu: 'marineford', kizaru: 'marineford', aokiji: 'marineford', garp: 'marineford',
  bogard: 'marineford', brandnew: 'marineford', coby: 'marineford', coby2: 'marineford', helmeppo: 'marineford',
  rosward: 'marineford', charlos: 'marineford', shalria: 'marineford', sabo: 'marineford',
  // Isla Gyojin — Piratas del Sol
  jinbe: 'gyojin',
  // Dressrosa — Familia Donquixote
  doflamingo: 'dressrosa', rocinante: 'dressrosa', homing: 'dressrosa',
  // Whole Cake — Zou y Levely
  inuarashi: 'wholecake', nekomamushi: 'wholecake', carrot: 'wholecake', wanda: 'wholecake',
  pedro: 'wholecake', shishilian: 'wholecake', zunesha: 'wholecake',
  koala: 'wholecake', hack: 'wholecake', mjosgard: 'wholecake',
  karasu: 'wholecake', betty: 'wholecake', morley: 'wholecake', lindbergh: 'wholecake',
  // Wano
  hera: 'wano', ryokugyu: 'wano',
  // Saga Final — Elbaf
  oimo: 'egghead', kashi: 'egghead',
};
for (const [id, s] of Object.entries(SAGA_FIXES)) if (CHARS[id]) CHARS[id].saga = s;
// 'whitebeard2' era un duplicado sin nombre de Barbablanca: newgate ocupa su sitio
delete CHARS.whitebeard2;

// Iniciales: solo Luffy está desbloqueado al inicio. El resto de nakamas deben encontrarse o reclutarse.
const NAKAMA_STARTERS = ['luffy'];
const STRAW_HAT_MEMBERS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji',
  'chopper', 'robin', 'franky', 'brook', 'jinbe'].filter(id => CHARS[id]);

const SAGAS = SAGA_DEFS.map((d, i) => {
  // Dificultad entre sagas aumenta de forma exponencial (East Blue: 8, Alabasta: 15, Skypiea: 22...)
  const startLvl = Math.round(8 + 7 * i + (i >= 3 ? Math.pow(i - 2, 2.2) * 2.2 : 0));
  const totalIslands = d.islands.length;
  const mobs = Object.keys(CHARS).filter(id =>
    CHARS[id].saga === d.id && (!CHARS[id].boss || CHARS[id].rareza === 5) && !CHARS[id].nakama && !EVOLVED_FORMS.has(id));
  const nakamas = Object.keys(CHARS).filter(id =>
    CHARS[id].saga === d.id && CHARS[id].nakama && !EVOLVED_FORMS.has(id));
  const pool = [...new Set([...mobs, ...nakamas])]; // los nakamas y legendarios 5⭐ también aparecen en salvaje
  return {
    id: d.id, name: d.name, sub: `Saga ${i + 1}`, img: `/art/scenes/${d.id === 'thriller' ? 'thrillerbark' : d.id}.webp`, color: d.color,
    starters: NAKAMA_STARTERS,
    islands: d.islands.map(([name, bossesRaw], k) => {
      const bosses = bossesRaw.map(b => BOSS_ALIASES[b] || b).filter(b => CHARS[b]);
      // Dificultad entre islas dentro de una saga aumenta de forma lineal pero considerable (+8 niveles por isla)
      const lvl0 = startLvl + k * 8;
      const rowsCount = totalIslands === 1 ? 14 : (6 + Math.min(3, Math.floor(k / 2)));
      return {
        name, boss: bosses,
        bossLvl: bosses.map((b, j) => lvl0 + 6 + j + CHARS[b].rareza),
        pool, lvl: [lvl0, lvl0 + 6],
        rows: rowsCount,
        singleIslandSaga: totalIslands === 1,
        final: k === d.islands.length - 1,
      };
    }),
  };
});
