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
    { id: "gallows", kind: "tower", name: "Gallows Tree", art: "assets/tower-gallows.jpg", blurb: "Long-range executioner. Marks what it hits: marked foes take +15% from everything." },
    { id: "font",   kind: "tower", name: "Blood Font",    art: "assets/tower-font.jpg",   blurb: "Heals you while you stand near it; anoints nearby towers (+20% fire rate)." },
    // weapons
    { id: "hellfire", kind: "weapon", name: "Hellfire Rounds",   art: "assets/icon-hellfire.jpg", blurb: "Bolts wreathed in hellfire." },
    { id: "twin",     kind: "weapon", name: "Twin Seal",         art: "assets/icon-twin.jpg",     blurb: "One seal, two deaths. Each bolt a little weaker." },
    { id: "cadence",  kind: "weapon", name: "Reaper's Cadence",  art: "assets/icon-cadence.jpg",  blurb: "The drum that sets the reaping tempo." },
    { id: "pierce",   kind: "weapon", name: "Piercing Sigil",    art: "assets/icon-pierce.jpg",   blurb: "What it kills, it kills through." },
    { id: "axe",      kind: "weapon", name: "Executioner's Mass",art: "assets/icon-axe.jpg",      blurb: "It falls heaviest on the finishing blow." },
    { id: "chill",    kind: "weapon", name: "Gravechill Rounds", art: "assets/icon-chill.jpg",    blurb: "Your bolts chill what they touch." },
    { id: "storm",    kind: "weapon", name: "Storm Sigil",       art: "assets/icon-storm.jpg",    blurb: "Every fifth bolt calls the lightning down: it chains." },
    // relics
    { id: "boots",   kind: "relic", name: "Gravewind Boots",  art: "assets/icon-boots.jpg",  blurb: "The gravewind carries you." },
    { id: "chalice", kind: "relic", name: "Sanguine Chalice", art: "assets/icon-chalice.jpg",blurb: "Drink deep; the blood provides." },
    { id: "magnet",  kind: "relic", name: "Ashen Lodestone",  art: "assets/icon-magnet.jpg", blurb: "Ash remembers its owner." },
    { id: "ward",    kind: "relic", name: "Widow's Ward",     art: "assets/icon-ward.jpg",   blurb: "She watches still. The shield re-forms after each save." },
    { id: "thorns",  kind: "relic", name: "Thornmail Mantle", art: "assets/icon-thorns.jpg", blurb: "What strikes you, bleeds." },
    { id: "brand",   kind: "relic", name: "Martyr's Brand",   art: "assets/icon-brand.jpg",  blurb: "The nearer death, the harder you hit." },
    // consumables
    { id: "vial",    kind: "consumable", name: "Blood Vial",    art: "assets/icon-vial.jpg",    blurb: "Warm. Fresh. Yours, mostly." },
    { id: "draught", kind: "consumable", name: "Wrath Draught", art: "assets/icon-draught.jpg", blurb: "Tastes of copper and fury." },
    { id: "candle",  kind: "consumable", name: "Saint's Candle",art: "assets/icon-candle.jpg",  blurb: "A saint is listening." },
    { id: "seal",    kind: "consumable", name: "Gilded Seal",   art: "assets/icon-seal.jpg",   blurb: "Your next pack holds +1 card, and fortune leans in." },
  ];

  const TOWERS = {
    spire: { dmg: 11, rate: 1.7, range: 195, boltSpeed: 560 },
    bell:  { auraDps: 7, auraRange: 155, slow: 0.30, tollEvery: 3.0 },
    pyre:  { dmg: 17, rate: 0.75, range: 215, burnDps: 9, burnSecs: 3.0, burnRadius: 46 },
    frost: { dmg: 30, rate: 0.55, range: 235, chillSlow: 0.35, chillSecs: 1.6 },
    gallows: { dmg: 58, rate: 0.5, range: 330, markSecs: 4, markAmp: 0.15 },
    font:  { auraRange: 130, healPerSec: 1.3, anointRate: 1.20 },
  };

  const PLAYER_BASE = { hp: 100, speed: 218, dmg: 13, rate: 2.0, proj: 1, pierce: 0, critC: 0.05, critM: 2.0, radius: 20, collectR: 52 };

  const ENEMIES = {
    husk:    { hp: 22,  speed: 64,  dmg: 8,  r: 16, ash: 1, mass: 1.0 },
    cultist: { hp: 16,  speed: 90,  dmg: 7,  r: 15, ash: 1, mass: 0.9 },
    wraith:  { hp: 12,  speed: 140, dmg: 6,  r: 14, ash: 1, mass: 0.55 },
    brute:   { hp: 100, speed: 35,  dmg: 16, r: 24, ash: 3, mass: 3.4 },
    plague:  { hp: 30,  speed: 47,  dmg: 10, r: 18, ash: 2, explodeDmg: 26, explodeR: 66, mass: 1.15 },
    abbot:   { hp: 2400, speed: 47, dmg: 18, r: 30, ash: 25, mass: 7 },
    vesper:  { hp: 8500, speed: 40, dmg: 22, r: 38, ash: 100, mass: 9 },
  };

  function waveSpec(w) {
    const count = Math.round(30 * Math.pow(1.27, w - 1));
    const hpScale = Math.pow(1.24, w - 1) * (w <= 2 ? 1.08 : 1);
    const bossScale = 1 + 0.10 * (w - 1); // bosses scale gently; they are a DPS check, not a sponge wall
    const dmgScale = 1 + 0.045 * (w - 1);
    const duration = Math.round((34 + 4 * w) * (w >= 7 ? 0.45 : w <= 3 ? 0.36 : 0.55)); // seconds over which the wave spawns — compressed: the horde arrives like weather, not a queue
    let mix;
    if (w === 1) mix = { husk: 0.8, cultist: 0.2 };
    else if (w === 2) mix = { husk: 0.75, cultist: 0.25 };
    else if (w === 3) mix = { husk: 0.55, cultist: 0.23, wraith: 0.14, plague: 0.08 };
    else if (w < 7)  mix = { husk: 0.44, cultist: 0.20, wraith: 0.15, brute: 0.12, plague: 0.09 };
    else mix = { husk: 0.38, cultist: 0.20, wraith: 0.17, brute: 0.15, plague: 0.10 };
    return { count, hpScale, bossScale, dmgScale, duration, mix, boss: w === 10 ? "vesper" : (w === 5 ? "abbot" : null) };
  }

  const PACK = { cardsPerPack: 3, baseCost: 40, costGrowth: 1.35, maxFieldTowers: 6, towerLevelCap: 5, towerLevelMult: 1.45 };

  /* The arena art is gameplay: pillars block bolts, the ritual circle
     consecrates, the corner braziers burn. Positions match assets/arena.jpg. */
  const WORLD = {
    circle: { x: 480, y: 312, r: 118 },
    pillars: [
      { x: 346, y: 48, r: 30 }, { x: 622, y: 48, r: 30 },
      { x: 58, y: 232, r: 30 }, { x: 908, y: 238, r: 30 },
      { x: 58, y: 405, r: 30 }, { x: 908, y: 410, r: 30 },
      { x: 352, y: 596, r: 30 }, { x: 622, y: 592, r: 30 },
    ],
    braziers: [
      { x: 140, y: 92 }, { x: 828, y: 86 }, { x: 136, y: 552 }, { x: 830, y: 556 },
    ],
    brazierR: 84, brazierDps: 16, consecration: 1.45,
  };

  const OMENS = [
    { id: "bloodmoon", name: "Blood Moon",    desc: "The dead run fast tonight (+20% speed). Ash falls thick (+50%).", enemySpeed: 1.2, ashMult: 1.5 },
    { id: "silent",    name: "Silent Night",  desc: "No wraiths dare the dark. Brutes swell (+35% HP).", noWraith: true, bruteHp: 1.35 },
    { id: "emberstorm",name: "Ember Storm",   desc: "The sky itself fights: embers strike the horde — and anything standing still.", emberStorm: true },
    { id: "thinveil",  name: "The Thin Veil", desc: "Anointed elites walk among the dead (3× as many). They die rich.", eliteMult: 3 },
    { id: "packrats",  name: "Pack Rats",     desc: "Something nested in the walls. Tomorrow's first pack holds +1 card.", packBonus: 1 },
    { id: "stillair",  name: "Still Air",     desc: "Nothing stirs. A plain night, if any night here is plain.", plain: true },
  ];

  const DIFFS = {
    vigil:   { name: "Vigil",   hp: 1.0,  dmg: 1.0,  luck: 0 },
    torment: { name: "Torment", hp: 1.35, dmg: 1.25, luck: 6 }, // luck: % shifted from Common to better tiers
  };

  const SYNERGIES = [
    { id: "thermal", name: "Thermal Shock", needs: ["pyre", "frost"], desc: "Burning a chilled foe (or chilling a burning one) shocks it for +60% damage." },
    { id: "kindled", name: "Kindled Bolts", needs: ["hellfire", "pyre"], desc: "Your bolts ignite: hits leave a small burn." },
    { id: "resonance", name: "Resonance", needs: ["bell", "cadence"], desc: "The Grave Bell tolls faster and its toll bursts for damage." },
    { id: "stormtwin", name: "Storm Twins", needs: ["storm", "twin"], desc: "Chain lightning jumps +1 target per extra projectile you fire." },
    { id: "thorns-ward", name: "The Widow's Thorns", needs: ["thorns", "ward"], desc: "When the Ward eats a hit, thorns burst outward." },
    { id: "font-chalice", name: "Sanguine Font", needs: ["font", "chalice"], desc: "The Blood Font also drinks nearby ash shards and returns them as health." },
  ];

  /* THE TITHE — every morning the cathedral demands a choice.
     Every offering is a boon with a price. Refusing is also a choice. */
  const REWARDS = [
    { id: "braziers", name: "Stoke the Braziers", text: "The braziers burn double tonight." },
    { id: "doors",    name: "Bar the Doors",      text: "The dead come 10% slower tonight." },
    { id: "blood",    name: "Blood the Circle",   text: "Towers deal +15% tonight; consecration rises to +90%." },
    { id: "crypts",   name: "Open the Crypts",    text: "A free pack, right now." },
    { id: "hoard",    name: "Gather the Ash",     text: "Gain 60 ash now." },
    { id: "silence",  name: "Refuse the Omen",    text: "Cast tonight's omen out — boon and curse alike. A plain night, chosen by you." },
    { id: "bell",     name: "Cheap Bells",        text: "Packs cost 12 less today." },
    { id: "pray",     name: "Pray at the Font",   text: "Heal 40 HP now." },
  ];

  /* THE CATHEDRAL FLOOR — 25x21 tiles of 36px. '#' wall (impassable, blocks
     bolts and sight), 'r' rubble (impassable until smashed, low — bolts pass),
     'f' grave-fog (passable; hides whatever stands in it from towers, bolts
     and cultist eyes — unless a brazier's light burns it off). */
  const TILE = 40, COLS = 24, ROWS = 16;
  const MAP = [
    "........................",
    "........#......#........",
    ".##ff..............ff##.",
    ".#..ff............ff..#.",
    "...ff.r..........r.ff...",
    ".#....................#.",
    "....##.f........f.##....",
    "...r................r...",
    "...r................r...",
    "....##.f........f.##....",
    ".#....................#.",
    "...ff.r..........r.ff...",
    ".#..ff............ff..#.",
    ".##ff..............ff##.",
    "........#......#........",
    "........................",
  ];
  const TERRAIN = { rubbleHp: 45, barrierCost: 12, barrierHp: 130, barrierMax: 8 };
  const api = { RARITIES, KIND_WEIGHTS, CARDS, TOWERS, PLAYER_BASE, ENEMIES, waveSpec, PACK, WORLD, OMENS, DIFFS, SYNERGIES, REWARDS, TILE, COLS, ROWS, MAP, TERRAIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.GRIM = api;
})(typeof window !== "undefined" ? window : globalThis);
