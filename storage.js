const SAVE_KEY = "spacedome_save_v1";

export const SHOP_ITEMS = [
  { id: "multishot", name: "Cannoni Gemelli", desc: "Parti con più colpi in parallelo", max: 3, baseCost: 40 },
  { id: "shield", name: "Corazza Iniziale", desc: "Parti con cariche scudo extra", max: 3, baseCost: 40 },
  { id: "speed", name: "Motori Potenziati", desc: "Velocità di base maggiore", max: 3, baseCost: 30 },
  { id: "bomb", name: "Carica Supernova", desc: "La bomba parte già carica", max: 3, baseCost: 35 },
  { id: "life", name: "Vita Extra", desc: "Un cuore in più a inizio partita", max: 2, baseCost: 80 },
];

function defaultSave() {
  return {
    highScore: 0,
    cosmicDust: 0,
    shop: { multishot: 0, shield: 0, speed: 0, bomb: 0, life: 0 },
    settings: { sfx: 0.8, music: 0.5, muted: false, shake: true, haptics: true },
    seenHint: false,
  };
}

let cache = null;

export function loadSave() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { cache = defaultSave(); return cache; }
    const parsed = JSON.parse(raw);
    cache = { ...defaultSave(), ...parsed, shop: { ...defaultSave().shop, ...(parsed.shop || {}) }, settings: { ...defaultSave().settings, ...(parsed.settings || {}) } };
  } catch (e) {
    cache = defaultSave();
  }
  return cache;
}

export function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(cache)); } catch (e) { /* storage unavailable */ }
}

export function shopItemCost(item, currentLevel) {
  return Math.round(item.baseCost * Math.pow(1.6, currentLevel));
}

export function resetProgress() {
  cache = defaultSave();
  persist();
  return cache;
}
