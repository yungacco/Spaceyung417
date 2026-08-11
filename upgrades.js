export const ICONS = {
  multishot: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20V8"/><path d="M6 20V13"/><path d="M18 20V13"/><path d="M12 4 L16 9 L8 9 Z" fill="currentColor" stroke="none"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 L20 6.5 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6.5 Z"/><path d="M9 12 L11 14 L15.5 9.5" stroke-linecap="round"/></svg>`,
  speed: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z"/></svg>`,
  bomb: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 1 L14.2 8.6 L22 11 L14.2 13.4 L12 21 L9.8 13.4 L2 11 L9.8 8.6 Z"/></svg>`,
  life: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 21 C7 17 3 13.4 3 9.2 C3 6.3 5.3 4 8.1 4 C9.8 4 11.2 4.9 12 6.2 C12.8 4.9 14.2 4 15.9 4 C18.7 4 21 6.3 21 9.2 C21 13.4 17 17 12 21 Z"/></svg>`,
};

export const UPGRADES = [
  {
    id: "multishot",
    name: "Cannoni Gemelli",
    icon: ICONS.multishot,
    maxLevel: 6,
    describe: (lvl) => `Spara ${lvl + 2} proiettili in parallelo (era ${lvl + 1})`,
  },
  {
    id: "shield",
    name: "Scudo Energetico",
    icon: ICONS.shield,
    maxLevel: 6,
    describe: (lvl) => `+1 carica scudo e ricarica più veloce (livello ${lvl + 2})`,
  },
  {
    id: "speed",
    name: "Propulsione",
    icon: ICONS.speed,
    maxLevel: 8,
    describe: (lvl) => `+16% velocità di manovra (livello ${lvl + 2})`,
  },
  {
    id: "bomb",
    name: "Nucleo Supernova",
    icon: ICONS.bomb,
    maxLevel: 6,
    describe: (lvl) => `Ricarica la bomba più in fretta (livello ${lvl + 2})`,
  },
];

export function pickUpgrades(player, count = 3) {
  const available = UPGRADES.filter((u) => {
    const lvl = player[`${u.id}Level`] ?? 0;
    return lvl < u.maxLevel;
  });
  const pool = available.length ? available : UPGRADES;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picks = [];
  for (let i = 0; i < count; i++) picks.push(shuffled[i % shuffled.length]);
  return picks;
}
