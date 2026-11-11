/* GRIMPACK balance simulator — Monte Carlo over pack luck.
   Models expected player+tower DPS growth from pack pulls (same numbers as
   balance.js) vs each wave's total HP. Not a gameplay sim: it checks the
   power curve, clear times and luck spread. Run: node tools/sim.js [runs] */
const G = require("../balance.js");

function rollRarity(rng) {
  let x = rng() * 100, acc = 0;
  for (let i = 0; i < G.RARITIES.length; i++) { acc += G.RARITIES[i].weight; if (x < acc) return i; }
  return 0;
}
function rollKind(rng) {
  const tot = Object.values(G.KIND_WEIGHTS).reduce((a, b) => a + b, 0);
  let x = rng() * tot, acc = 0;
  for (const [k, w] of Object.entries(G.KIND_WEIGHTS)) { acc += w; if (x < acc) return k; }
  return "weapon";
}
// mulberry32
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const byKind = {};
for (const c of G.CARDS) (byKind[c.kind] = byKind[c.kind] || []).push(c);

function towerDps(id, mult, level) {
  const t = G.TOWERS[id], lv = Math.pow(G.PACK.towerLevelMult, level - 1);
  switch (id) {
    case "spire": return t.dmg * t.rate * mult * lv;
    case "bell":  return t.auraDps * mult * lv * 3.5;      // ~3.5 enemies in aura on average
    case "pyre":  return (t.dmg * t.rate + t.burnDps * t.burnSecs * 0.6) * mult * lv;
    case "frost": return t.dmg * t.rate * mult * lv;
  }
  return 0;
}

function simulateRun(rand) {
  const P = { ...G.PLAYER_BASE };
  let towers = {}; // id -> {level, mult}
  let dryPacks = 0;
  const rows = [];
  const openPack = () => {
    let gotRarePlus = false;
    for (let s = 0; s < G.PACK.cardsPerPack; s++) {
      let ri = rollRarity(rand);
      if (s === 0 && dryPacks >= 2 && ri < 2) ri = 2; // pity
      if (ri >= 2) gotRarePlus = true;
      const m = G.RARITIES[ri].mult;
      const kind = rollKind(rand);
      const pool = byKind[kind];
      const card = pool[Math.floor(rand() * pool.length)];
      apply(card, m);
    }
    dryPacks = gotRarePlus ? 0 : dryPacks + 1;
  };
  function apply(card, m) {
    if (card.kind === "weapon") {
      if (card.id === "hellfire") P.dmg += 8 * m;
      if (card.id === "cadence") P.rate += 0.38 * m;
      if (card.id === "twin") P.proj += 1;
      if (card.id === "pierce") P.pierce += m >= 2.3 ? 2 : 1;
      if (card.id === "axe") { P.critC += 0.07 * m; P.critM += 0.12 * m; }
    } else if (card.kind === "tower") {
      if (towers[card.id]) towers[card.id].level = Math.min(G.PACK.towerLevelCap, towers[card.id].level + 1);
      else if (Object.keys(towers).length < G.PACK.maxFieldTowers) towers[card.id] = { level: 1, mult: m };
      else towers[card.id] = { level: 1, mult: m }; // hand overflow ignored in sim (rare)
    } else if (card.kind === "relic") {
      if (card.id === "chalice") P.hp += 18 * m;
    }
    // consumables: no DPS effect in sim (vial/draught/candle are survival slack)
  }
  function dps(bossWave) {
    const critF = 1 + P.critC * (P.critM - 1);
    const pierceF = bossWave ? 1 + 0.10 * P.pierce : 1 + 0.30 * P.pierce;
    let d = P.dmg * P.rate * P.proj * Math.pow(0.88, P.proj - 1) * critF * pierceF;
    for (const [id, t] of Object.entries(towers)) d += towerDps(id, t.mult, t.level) * 0.8; // placement uptime
    return d;
  }
  let ashes = 0, packCost = G.PACK.baseCost, extraPacks = 0;
  openPack(); // starting pack
  for (let w = 1; w <= 10; w++) {
    const spec = G.waveSpec(w);
    let avgHp = 0; for (const [k, f] of Object.entries(spec.mix)) avgHp += G.ENEMIES[k].hp * f;
    let totalHp = spec.count * avgHp * spec.hpScale;
    if (spec.boss) totalHp += G.ENEMIES[spec.boss].hp * spec.bossScale;
    const myDps = dps(!!spec.boss);
    const clearTime = totalHp / (myDps * 0.62); // 0.62: targeting/travel/kite inefficiency
    rows.push({ wave: w, dps: myDps, totalHp, clearTime, window: spec.duration + 30 });
    // income: ~1.15 ash/kill modelled, 80% collected
    ashes += spec.count * 1.15 * 0.8;
    openPack(); // reward pack after the wave
    while (w >= 3 && ashes >= packCost) { ashes -= packCost; packCost = Math.round(packCost * G.PACK.costGrowth); extraPacks++; openPack(); }
  }
  return rows;
}

const RUNS = parseInt(process.argv[2] || "600", 10);
const all = [];
for (let i = 0; i < RUNS; i++) all.push(simulateRun(rng(1234 + i * 7919)));
console.log(`runs=${RUNS}`);
console.log("wave | medDPS | medEnemyHP | medClear(s) | clearWindow(s) | p25 margin | med margin | verdict");
for (let w = 0; w < 10; w++) {
  const col = all.map(r => r[w]).sort((a, b) => (a.totalHp / (a.dps * 0.62)) - (b.totalHp / (b.dps * 0.62)));
  const med = col[Math.floor(col.length / 2)];
  const margins = all.map(r => (r[w].dps * 0.62) / (r[w].totalHp / r[w].window)).sort((a, b) => a - b);
  const p25 = margins[Math.floor(margins.length * 0.25)], p50 = margins[Math.floor(margins.length / 2)];
  const verdict = p25 >= 1.0 ? "ok" : (p50 >= 1.0 ? "tight for unlucky" : "WALL");
  console.log(`${String(w + 1).padStart(4)} | ${med.dps.toFixed(0).padStart(6)} | ${med.totalHp.toFixed(0).padStart(10)} | ${med.clearTime.toFixed(0).padStart(11)} | ${med.window.toFixed(0).padStart(14)} | ${p25.toFixed(2).padStart(10)} | ${p50.toFixed(2).padStart(10)} | ${verdict}`);
}
const total = all.map(r => r.reduce((a, x) => a + Math.min(x.clearTime, x.window + 60), 0)).sort((a, b) => a - b);
console.log(`median modelled clear-time sum: ${(total[Math.floor(total.length / 2)] / 60).toFixed(1)} min (excl. build/pack time)`);
