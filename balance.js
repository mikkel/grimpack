/* GRIMPACK balance data — shared by game.js (browser) and tools/sim.js (node).
   All tuning numbers live here so the simulator and the game never drift. */
(function (root) {
  "use strict";

  const RARITIES = [
    { name: "Common",    color: "#d8d2c4", weight: 52,  mult: 1.0 },
    { name: "Magic",     color: "#5b8cff", weight: 30,  mult: 1.5 },
    { name: "Rare",      color: "#ffd94a", weight: 12,  mult: 2.3 },
    { name: "Epic",      color: "#b45cff", weight: 4.5, mult: 3.4 },
    { name: "Legendary", color: "#ff7a26", weight: 1.5, mult: 5.0 },
  ];

  /* kind weights when a card slot is rolled */
  const KIND_WEIGHTS = { tower: 34, weapon: 30, relic: 22, consumable: 14 };

  const CARDS = [
    // towers
    { id: "spire",  kind: "tower", name: "Bone Spire",    art: "assets/tower-bone.jpg",  blurb: "Fast bolts from a tower of bones." },
    { id: "bell",   kind: "tower", name: "Grave Bell",    art: "assets/tower-bell.jpg",  blurb: "Tolls: slows and chips everything near." },
    { id: "pyre",   kind: "tower", name: "Soul Pyre",     art: "assets/tower-pyre.jpg",  blurb: "Lobs embers that leave burning ground." },
    { id: "frost",  kind: "tower", name: "Frost Obelisk", art: "assets/tower-frost.jpg", blurb: "Heavy shots that chill the damned." },
    // weapons
    { id: "hellfire", kind: "weapon", name: "Hellfire Rounds",   art: "assets/icon-hellfire.jpg", blurb: "Bolts wreathed in hellfire." },
    { id: "twin",     kind: "weapon", name: "Twin Seal",         art: "assets/icon-twin.jpg",     blurb: "One seal, two deaths. Each bolt a little weaker." },
    { id: "cadence",  kind: "weapon", name: "Reaper's Cadence",  art: "assets/icon-cadence.jpg",  blurb: "The drum that sets the reaping tempo." },
    { id: "pierce",   kind: "weapon", name: "Piercing Sigil",    art: "assets/icon-pierce.jpg",   blurb: "What it kills, it kills through." },
    { id: "axe",      kind: "weapon", name: "Executioner's Mass",art: "assets/icon-axe.jpg",      blurb: "It falls heaviest on the finishing blow." },
    // relics
    { id: "boots",   kind: "relic", name: "Gravewind Boots",  art: "assets/icon-boots.jpg",  blurb: "The gravewind carries you." },
    { id: "chalice", kind: "relic", name: "Sanguine Chalice", art: "assets/icon-chalice.jpg",blurb: "Drink deep; the blood provides." },
    { id: "magnet",  kind: "relic", name: "Ashen Lodestone",  art: "assets/icon-magnet.jpg", blurb: "Ash remembers its owner." },
    { id: "ward",    kind: "relic", name: "Widow's Ward",     art: "assets/icon-ward.jpg",   blurb: "She watches still. The shield re-forms after each save." },
    // consumables
    { id: "vial",    kind: "consumable", name: "Blood Vial",    art: "assets/icon-vial.jpg",    blurb: "Warm. Fresh. Yours, mostly." },
    { id: "draught", kind: "consumable", name: "Wrath Draught", art: "assets/icon-draught.jpg", blurb: "Tastes of copper and fury." },
    { id: "candle",  kind: "consumable", name: "Saint's Candle",art: "assets/icon-candle.jpg",  blurb: "A saint is listening." },
  ];

  const TOWERS = {
    spire: { dmg: 11, rate: 1.7, range: 195, boltSpeed: 560 },
    bell:  { auraDps: 7, auraRange: 155, slow: 0.30, tollEvery: 3.0 },
    pyre:  { dmg: 17, rate: 0.75, range: 215, burnDps: 9, burnSecs: 3.0, burnRadius: 46 },
    frost: { dmg: 30, rate: 0.55, range: 235, chillSlow: 0.35, chillSecs: 1.6 },
  };

  const PLAYER_BASE = { hp: 100, speed: 218, dmg: 13, rate: 2.0, proj: 1, pierce: 0, critC: 0.05, critM: 2.0, radius: 20, collectR: 52 };

  const ENEMIES = {
    husk:    { hp: 22,  speed: 54,  dmg: 8,  r: 16, ash: 1 },
    cultist: { hp: 16,  speed: 80,  dmg: 7,  r: 15, ash: 1 },
    wraith:  { hp: 12,  speed: 122, dmg: 6,  r: 14, ash: 1 },
    brute:   { hp: 100, speed: 35,  dmg: 16, r: 24, ash: 3 },
    abbot:   { hp: 2400, speed: 47, dmg: 18, r: 30, ash: 25 },
    vesper:  { hp: 8500, speed: 40, dmg: 22, r: 38, ash: 100 },
  };

  function waveSpec(w) {
    const count = Math.round(22 * Math.pow(1.22, w - 1));
    const hpScale = Math.pow(1.22, w - 1);
    const bossScale = 1 + 0.10 * (w - 1); // bosses scale gently; they are a DPS check, not a sponge wall
    const dmgScale = 1 + 0.045 * (w - 1);
    const duration = 34 + 4 * w; // seconds over which the wave spawns
    let mix;
    if (w === 1) mix = { husk: 1 };
    else if (w === 2) mix = { husk: 0.75, cultist: 0.25 };
    else if (w === 3) mix = { husk: 0.60, cultist: 0.25, wraith: 0.15 };
    else if (w < 7)  mix = { husk: 0.50, cultist: 0.22, wraith: 0.16, brute: 0.12 };
    else mix = { husk: 0.44, cultist: 0.22, wraith: 0.18, brute: 0.16 };
    return { count, hpScale, bossScale, dmgScale, duration, mix, boss: w === 10 ? "vesper" : (w === 5 ? "abbot" : null) };
  }

  const PACK = { cardsPerPack: 3, baseCost: 40, costGrowth: 1.35, maxFieldTowers: 6, towerLevelCap: 5, towerLevelMult: 1.45 };

  const api = { RARITIES, KIND_WEIGHTS, CARDS, TOWERS, PLAYER_BASE, ENEMIES, waveSpec, PACK };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GRIM = api;
})(typeof window !== "undefined" ? window : globalThis);
