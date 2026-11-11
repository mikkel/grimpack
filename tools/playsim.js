/* GRIMPACK playsim — a bot plays FULL runs (movement, kiting, dashing,
   tower placement with real pillar line-of-sight, omens, synergies) against
   the real balance.js numbers. Aggregate sim.js checks the power curve;
   this checks whether a run is actually survivable moment to moment.
   Usage: node tools/playsim.js [runs] [torment] */
const G = require("../balance.js");
const W = 960, H = 640, WORLD = G.WORLD;
const SPOTS = [ // bot placement order: four inside the circle, then two wide
  { x: 480, y: 196 }, { x: 372, y: 312 }, { x: 588, y: 312 }, { x: 480, y: 428 },
  { x: 252, y: 168 }, { x: 708, y: 452 },
];
function losBlocked(x1, y1, x2, y2) {
  for (const p of WORLD.pillars) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    let t = ((p.x - x1) * dx + (p.y - y1) * dy) / l2; t = Math.max(0, Math.min(1, t));
    if (Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy)) < p.r - 2) return true;
  } return false;
}
const inCircle = (x, y) => Math.hypot(x - WORLD.circle.x, y - WORLD.circle.y) < WORLD.circle.r;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function playRun(diff) {
  const B = G.PLAYER_BASE;
  const P = { x: 480, y: 380, hp: B.hp, maxHp: B.hp, dmg: B.dmg, rate: B.rate, proj: B.proj, pierce: B.pierce,
    critC: B.critC, critM: B.critM, speed: B.speed, collectR: B.collectR, regen: 0, shieldReady: false, shieldCd: 0, shieldMax: 0,
    revives: 0, wrathWave: false, fireCd: 0, invuln: 0, hitCount: 0, stormEvery: 0, chillSlow: 0, chillSecs: 0,
    thorns: 0, brandPct: 0, dashCd: 0, r: B.radius, dmgTaken: 0 };
  let towers = [], enemies = [], shards = [], hand = {}, placed = {}, owned = {};
  let ashes = 0, packCost = G.PACK.baseCost, freePacks = 1, dry = 0, bonusCards = 0, kills = 0;
  const hasSyn = id => { const s = G.SYNERGIES.find(x => x.id === id); return s && s.needs.every(n => owned[n]); };

  function rollCard() {
    const tot = Object.values(G.KIND_WEIGHTS).reduce((a, b) => a + b, 0);
    let x = Math.random() * tot, acc = 0, kind = "weapon";
    for (const [k, w] of Object.entries(G.KIND_WEIGHTS)) { acc += w; if (x < acc) { kind = k; break; } }
    const pool = G.CARDS.filter(c => c.kind === kind);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function rollRarity(luck) {
    const wts = G.RARITIES.map((r, i) => i === 0 ? Math.max(10, r.weight - luck) : r.weight + luck / 4);
    let x = Math.random() * wts.reduce((a, b) => a + b, 0), a2 = 0;
    for (let i = 0; i < 5; i++) { a2 += wts[i]; if (x < a2) return i; } return 0;
  }
  function openPack(packsThisBuild) {
    const n = G.PACK.cardsPerPack + bonusCards; bonusCards = 0;
    const foil = packsThisBuild >= 2; let rarePlus = false;
    for (let s = 0; s < n; s++) {
      let ri = rollRarity(diff.luck);
      if (s === 0 && dry >= 2 && ri < 2) ri = 2;
      if (foil) ri = Math.min(4, ri + 1);
      if (ri >= 2) rarePlus = true;
      apply(rollCard(), ri);
    }
    dry = rarePlus ? 0 : dry + 1;
  }
  function apply(def, ri) {
    const m = G.RARITIES[ri].mult; owned[def.id] = (owned[def.id] || 0) + 1;
    if (def.kind === "tower") {
      const up = (placed[def.id] || []).filter(t => t.level < G.PACK.towerLevelCap).sort((a, b) => a.level - b.level)[0];
      if (up) up.level++;
      else { hand[def.id] = hand[def.id] || { count: 0, mult: 1 }; hand[def.id].count++; hand[def.id].mult = Math.max(hand[def.id].mult, m); placeFromHand(); }
    } else if (def.kind === "weapon") {
      if (def.id === "hellfire") P.dmg += 8 * m;
      if (def.id === "cadence") P.rate += 0.38 * m;
      if (def.id === "twin") { P.proj += 1; P.dmg *= 0.92; }
      if (def.id === "pierce") P.pierce += m >= 2.3 ? 2 : 1;
      if (def.id === "axe") { P.critC += 0.07 * m; P.critM += 0.12 * m; }
      if (def.id === "chill") { P.chillSlow = Math.max(P.chillSlow, 0.2 * Math.min(m, 2)); P.chillSecs = Math.max(P.chillSecs, 1.1 * Math.min(m, 2)); }
      if (def.id === "storm") P.stormEvery = P.stormEvery ? Math.max(3, P.stormEvery - 1) : Math.max(3, Math.round(6 - m));
    } else if (def.kind === "relic") {
      if (def.id === "boots") P.speed += 16 * m;
      if (def.id === "chalice") { P.maxHp += Math.round(18 * m); P.regen += 0.25 * m; P.hp += 18 * m; }
      if (def.id === "magnet") P.collectR += 34 * m;
      if (def.id === "ward") { P.shieldMax = Math.max(8, 26 - 4 * m); if (!P.shieldReady) { P.shieldReady = true; P.shieldCd = P.shieldMax; } }
      if (def.id === "thorns") P.thorns += 7 * m;
      if (def.id === "brand") P.brandPct += 0.005 * m;
    } else {
      if (def.id === "vial") P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.35);
      if (def.id === "draught") P.wrathNext = true;
      if (def.id === "candle") P.revives += 1;
      if (def.id === "seal") bonusCards += 1;
    }
  }
  function placeFromHand() {
    for (const id of Object.keys(hand)) {
      while (hand[id].count > 0 && towers.length < G.PACK.maxFieldTowers) {
        const used = new Set(towers.map(t => t.x + "," + t.y));
        const spot = SPOTS.find(s => !used.has(s.x + "," + s.y)); if (!spot) break;
        const tw = { type: id, x: spot.x, y: spot.y, level: 1, mult: hand[id].mult, cd: 0 };
        towers.push(tw); placed[id] = placed[id] || []; placed[id].push(tw); hand[id].count--;
      }
    }
  }
  function buildPhase() {
    let n = 0;
    while (freePacks > 0) { freePacks--; openPack(n++); }
    while (ashes >= packCost) { ashes -= packCost; packCost = Math.round(packCost * G.PACK.costGrowth); openPack(n++); }
    placeFromHand();
    // overcharge: rich bot reinforces its weakest tower before the night
    while (ashes >= 130) {
      const tw = towers.filter(t => t.level < G.PACK.towerLevelCap).sort((a, b) => a.level - b.level)[0];
      if (!tw) break; ashes -= 20; tw.level++;
    }
  }

  let omen = null, nextOmen = G.OMENS[Math.floor(Math.random() * G.OMENS.length)];
  for (let wave = 1; wave <= 10; wave++) {
    buildPhase();
    omen = nextOmen; nextOmen = G.OMENS[Math.floor(Math.random() * G.OMENS.length)];
    if (omen.packBonus) bonusCards += omen.packBonus;
    P.wrathWave = !!P.wrathNext; P.wrathNext = false;
    const spec = G.waveSpec(wave);
    let queue = [];
    for (let i = 0; i < spec.count; i++) {
      let x = Math.random(), acc = 0, type = "husk";
      for (const [k, f] of Object.entries(spec.mix)) { acc += f; if (x < acc) { type = k; break; } }
      if (omen.noWraith && type === "wraith") type = "husk";
      queue.push(type);
    }
    if (spec.boss) queue.push(spec.boss);
    let hpEnter = P.hp / P.maxHp, t = 0, spawnT = 0, emberT = 4, strike = null;
    const dt = 0.1;
    while (true) {
      t += dt;
      if (t > 420) return { result: "timeout", wave, hpEnter, dmgTaken: P.dmgTaken };
      // spawn
      spawnT -= dt;
      if (queue.length && spawnT <= 0) {
        spawnT = (spec.duration / spec.count) * (2 + Math.floor(Math.random() * 4)) * (0.75 + Math.random() * 0.5);
        const knot = 2 + Math.floor(Math.random() * 4);
        const ring = wave >= 4 && Math.random() < 0.25, baseA = Math.random() * 6.283;
        for (let i = 0; i < knot && queue.length; i++) {
          const type = queue.pop(), base = G.ENEMIES[type], boss = type === "abbot" || type === "vesper";
          const edge = Math.floor(Math.random() * 4);
          const ringA = ring ? baseA + (i / Math.max(1, knot)) * 6.283 : null;
          let hp = base.hp * (boss ? spec.bossScale : spec.hpScale) * diff.hp;
          if (omen.bruteHp && type === "brute") hp *= omen.bruteHp;
          const elite = !boss && Math.random() < 0.04 * (omen.eliteMult || 1); if (elite) hp *= 3.2;
          enemies.push({ type, boss, elite, x: ringA != null ? P.x + Math.cos(ringA) * 330 : (edge < 2 ? Math.random() * W : (edge === 2 ? -30 : W + 30)),
            y: ringA != null ? P.y + Math.sin(ringA) * 330 : (edge < 2 ? (edge === 0 ? -30 : H + 30) : Math.random() * H), hp, maxHp: hp,
            speed: base.speed * (0.9 + Math.random() * 0.2) * (omen.enemySpeed || 1), dmg: base.dmg * spec.dmgScale * diff.dmg * (elite ? 1.3 : 1),
            r: base.r * (elite ? 1.35 : 1), ash: base.ash * (elite ? 6 : 1), slowT: 0, slowF: 0, chillT: 0, burnT: 0, burnDps: 0, burnAcc: 0,
            markT: 0, hitCd: 0, flickerT: Math.random() * 2, enraged: false, tollCd: 6, summonCd: 7, lungeCd: 2 + Math.random() * 2, lungeT: 0, chargeCd: 3 + Math.random() * 3, chargeT: 0, windT: 0, ringA: null });
        }
      }
      // --- bot movement: orbit inside the circle, flee pressure, grab ash when safe
      let fleeX = 0, fleeY = 0, near = 0, nearestE = null, nd = 1e9;
      for (const e of enemies) { const d = dist(P, e); if (d < nd) { nd = d; nearestE = e; } if (d < 130) { fleeX += (P.x - e.x) / (d || 1) * (130 - d); fleeY += (P.y - e.y) / (d || 1) * (130 - d); near++; } }
      let tx = WORLD.circle.x + Math.cos(t * 0.35) * 140, ty = WORLD.circle.y + Math.sin(t * 0.35) * 140;
      if (nd > 170 && shards.length) { let bs = null, bd = 1e9; for (const s of shards) { const d = dist(P, s); if (d < bd) { bd = d; bs = s; } } if (bs) { tx = bs.x; ty = bs.y; } }
      let mx = (tx - P.x) + fleeX * 2.2, my = (ty - P.y) + fleeY * 2.2;
      const ml = Math.hypot(mx, my) || 1;
      // dash out of contact
      P.dashCd = Math.max(0, P.dashCd - dt);
      if (nd < 46 && P.dashCd <= 0 && nearestE) { P.x += (P.x - nearestE.x) / (nd || 1) * 150; P.y += (P.y - nearestE.y) / (nd || 1) * 150; P.dashCd = 2.6; P.invuln = Math.max(P.invuln, 0.2); }
      P.x = Math.max(18, Math.min(W - 18, P.x + mx / ml * P.speed * dt * Math.min(1, ml / 60 + 0.3)));
      P.y = Math.max(18, Math.min(H - 18, P.y + my / ml * P.speed * dt * Math.min(1, ml / 60 + 0.3)));
      P.invuln = Math.max(0, P.invuln - dt);
      P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
      P.shieldCd -= dt; if (P.shieldMax && !P.shieldReady && P.shieldCd <= 0) P.shieldReady = true;
      // --- towers (instant-hit approximation with travel factor 0.92) ---
      for (const tw of towers) {
        const def = G.TOWERS[tw.type], lvM = Math.pow(G.PACK.towerLevelMult, tw.level - 1), cons = inCircle(tw.x, tw.y) ? 1.3 : 1;
        tw.cd -= dt;
        if (tw.type === "font") { if (dist(P, tw) < def.auraRange + P.r) P.hp = Math.min(P.maxHp, P.hp + def.healPerSec * tw.mult * lvM * dt); continue; }
        if (tw.type === "bell") {
          if (tw.cd <= 0) {
            tw.cd = def.tollEvery / (Math.pow(G.PACK.towerLevelMult, tw.level - 1)) * (hasSyn("resonance") ? 0.75 : 1);
            for (const e of enemies) if (dist(tw, e) <= def.auraRange) {
              hurt(e, def.auraDps * tw.mult * lvM * def.tollEvery * cons);
              e.slowT = Math.max(e.slowT, 0.4); e.slowF = Math.max(e.slowF, def.slow);
              if (hasSyn("resonance")) hurt(e, 4);
            }
          }
          continue;
        }
        let tgt = null, bd = 1e9;
        for (const e of enemies) { if (e.type === "wraith" && e.flickerT % 2.6 > 1.9) continue; const d = dist(tw, e); if (d < def.range && d < bd && !losBlocked(tw.x, tw.y, e.x, e.y)) { bd = d; tgt = e; } }
        if (tgt && tw.cd <= 0) {
          let rate = def.rate * (Math.pow(G.PACK.towerLevelMult, tw.level - 1));
          for (const f of towers) if (f.type === "font" && dist(f, tw) < 150) { rate *= G.TOWERS.font.anointRate; break; }
          tw.cd = 1 / rate;
          hurt(tgt, def.dmg * tw.mult * lvM * cons * 0.92);
          if (tw.type === "frost") { tgt.slowT = Math.max(tgt.slowT, def.chillSecs); tgt.slowF = Math.max(tgt.slowF, def.chillSlow); tgt.chillT = Math.max(tgt.chillT, def.chillSecs); if (tgt.burnT > 0) shock(tgt, def.dmg); }
          if (tw.type === "gallows") tgt.markT = def.markSecs;
          if (tw.type === "pyre") { tgt.burnT = Math.max(tgt.burnT, 0.4); tgt.burnDps = Math.max(tgt.burnDps, def.burnDps * tw.mult * lvM * cons); }
        }
      }
      // --- player bolts (instant, 6% lost to pillars/movement) ---
      P.fireCd -= dt;
      if (P.fireCd <= 0) {
        let tgt = null, bd = 1e9;
        for (const e of enemies) { if (e.type === "wraith" && e.flickerT % 2.6 > 1.9) continue; const d = dist(P, e); if (d < bd) { bd = d; tgt = e; } }
        if (tgt) {
          P.fireCd = 1 / (P.rate * (inCircle(P.x, P.y) ? 1.15 : 1));
          const missing = 1 - P.hp / P.maxHp;
          const base = P.dmg * (P.wrathWave ? 1.25 : 1) * (1 + P.brandPct * missing * 100);
          for (let i = 0; i < P.proj; i++) {
            const crit = Math.random() < P.critC;
            hurt(tgt, base * (crit ? P.critM : 1) * 0.94);
            P.hitCount++;
            if (P.chillSecs) { const wb = tgt.burnT > 0; tgt.slowT = Math.max(tgt.slowT, P.chillSecs); tgt.slowF = Math.max(tgt.slowF, P.chillSlow); tgt.chillT = Math.max(tgt.chillT, P.chillSecs); if (wb) shock(tgt, base); }
            if (hasSyn("kindled")) { tgt.burnT = Math.max(tgt.burnT, 1.2); tgt.burnDps = Math.max(tgt.burnDps, 5); if (tgt.chillT > 0) shock(tgt, base); }
            if (P.stormEvery && P.hitCount % P.stormEvery === 0) {
              let left = 2 + (P.proj - 1) * (hasSyn("stormtwin") ? 1 : 0), cur = tgt; const seen = new Set([tgt]);
              while (left-- > 0) { let nx = null, nd2 = 150; for (const o of enemies) if (!seen.has(o) && dist(cur, o) < nd2) { nd2 = dist(cur, o); nx = o; } if (!nx) break; seen.add(nx); hurt(nx, base * 0.6); cur = nx; }
            }
          }
        }
      }
      // --- boss specials (radial bolts approximated as pressure) ---
      for (const e of [...enemies]) {
        if (!e.boss) continue;
        e.tollCd -= dt;
        if (e.tollCd <= 0) { e.tollCd = e.type === "vesper" ? 5.2 : 6; if (dist(P, e) < 520 && P.invuln <= 0 && Math.random() < (e.type === "vesper" ? 0.30 : 0.35)) damagePlayer(e.type === "vesper" ? 12 : 10, e); }
        if (e.type === "vesper") { e.summonCd -= dt; if (e.summonCd <= 0 && enemies.length < 60) { e.summonCd = 7; for (let k = 0; k < 3; k++) { const b = G.ENEMIES.wraith; enemies.push({ type: "wraith", boss: false, x: e.x + 40, y: e.y, hp: b.hp * spec.hpScale * diff.hp, maxHp: b.hp * spec.hpScale * diff.hp, speed: b.speed, dmg: b.dmg * spec.dmgScale * diff.dmg, r: b.r, ash: b.ash, slowT: 0, slowF: 0, chillT: 0, burnT: 0, burnDps: 0, burnAcc: 0, markT: 0, hitCd: 0, flickerT: 0, tollCd: 9, summonCd: 9, lungeCd: 3, lungeT: 0 }); } } }
      }
      // --- ember storm ---
      if (omen.emberStorm) {
        emberT -= dt;
        if (emberT <= 0 && !strike) { emberT = 3.4 + Math.random() * 2.2; const np2 = Math.random() < 0.4; strike = { x: np2 ? P.x + 40 : (enemies[0] ? enemies[0].x : 480), y: np2 ? P.y : (enemies[0] ? enemies[0].y : 320), t: 0.85 }; }
      }
      if (strike) { strike.t -= dt; if (strike.t <= 0) { for (const e of [...enemies]) if (dist(strike, e) < 58 + e.r) hurt(e, 55); if (dist(strike, P) < 58 + P.r && Math.random() > 0.7) damagePlayer(14, null); strike = null; } }
      // --- enemies act ---
      for (const e of enemies) {
        e.flickerT += dt; if (e.markT > 0) e.markT -= dt; if (e.chillT > 0) e.chillT -= dt;
        if (e.type === "brute" && !e.enraged && e.hp < e.maxHp * 0.3) e.enraged = true;
        if (e.burnT > 0) { e.burnT -= dt; e.burnAcc += e.burnDps * dt; if (e.burnAcc >= 1) { const d = Math.floor(e.burnAcc); e.burnAcc -= d; hurt(e, d); } }
        const stacks = Math.floor(t / 20);
        let sp = e.speed * (e.enraged ? 1.45 : 1) * (1 + 0.04 * stacks);
        if (e.type === "wraith") { e.lungeCd -= dt; if (e.lungeT > 0) { e.lungeT -= dt; sp *= 1.9; } else if (e.lungeCd <= 0 && dist(P, e) < 135) { e.lungeT = 0.6; e.lungeCd = 3.2; } }
        if (e.type === "brute") { e.chargeCd -= dt; if (e.windT > 0) { e.windT -= dt; sp *= 0.3; if (e.windT <= 0) { e.chargeT = 0.8; e.chargeCd = 5; } } else if (e.chargeT > 0) { e.chargeT -= dt; sp *= 2.2; } else if (e.chargeCd <= 0) { const dd = dist(P, e); if (dd > 170 && dd < 330) e.windT = 0.4; else e.chargeCd = 0.5; } }
        if (e.slowT > 0) { e.slowT -= dt; sp *= (1 - e.slowF); if (e.slowT <= 0) e.slowF = 0; }
        for (const c of enemies) if (c.type === "cultist" && c !== e && dist(c, e) < 95) { sp *= 1.12; break; }
        for (const bz of WORLD.braziers) if (Math.hypot(e.x - bz.x, e.y - bz.y) < WORLD.brazierR) { e.burnT = Math.max(e.burnT, 0.4); e.burnDps = Math.max(e.burnDps, WORLD.brazierDps); break; }
        const pvx = mx / (ml || 1) * P.speed, pvy = my / (ml || 1) * P.speed;
        const a = Math.atan2(P.y + pvy * 0.22 - e.y, P.x + pvx * 0.22 - e.x);
        let mx2 = Math.cos(a) * sp, my2 = Math.sin(a) * sp;
        for (const o of enemies) { if (o === e) continue; const d = dist(o, e), rr = e.r + o.r; if (d > 0.01 && d < rr) { mx2 -= (o.x - e.x) / d * (rr - d) * 3.2; my2 -= (o.y - e.y) / d * (rr - d) * 3.2; } }
        e.x += mx2 * dt; e.y += my2 * dt;
        e.hitCd -= dt;
        if (dist(P, e) < e.r + P.r && e.hitCd <= 0) { e.hitCd = 0.85; damagePlayer(e.dmg * (1 + 0.03 * Math.floor(t / 20)), e); }
      }
      // deaths
      for (const e of [...enemies]) if (e.hp <= 0) {
        enemies.splice(enemies.indexOf(e), 1); kills++;
        const n = Math.round(e.ash * (omen.ashMult || 1));
        for (let i = 0; i < n; i++) shards.push({ x: e.x + (Math.random() * 24 - 12), y: e.y + (Math.random() * 24 - 12), age: 0 });
        if (e.type === "plague") { for (const o of [...enemies]) if (dist(o, e) < G.ENEMIES.plague.explodeR + o.r) hurt(o, G.ENEMIES.plague.explodeDmg); if (dist(P, e) < G.ENEMIES.plague.explodeR + P.r) damagePlayer(G.ENEMIES.plague.explodeDmg * 0.8, e); }
      }
      // shards
      const fontSyn = hasSyn("font-chalice");
      for (const s of shards) {
        s.age = (s.age || 0) + dt;
        if (s.age > 25) { s.got = true; continue; }
        let got = false;
        if (fontSyn) for (const f of towers) if (f.type === "font" && Math.hypot(f.x - s.x, f.y - s.y) < G.TOWERS.font.auraRange) { got = true; P.hp = Math.min(P.maxHp, P.hp + 0.35); break; }
        if (!got && dist(P, s) < P.collectR) { s.x += (P.x - s.x) * 6 * dt; s.y += (P.y - s.y) * 6 * dt; if (dist(P, s) < P.r + 8) { got = true; ashes++; } }
        s.got = got;
      }
      shards = shards.filter(s => !s.got);
      if (P.hp <= 0) return { result: "dead", wave, hpEnter, dmgTaken: P.dmgTaken };
      if (!queue.length && !enemies.length) break;
    }
    if (shards.length) { ashes += Math.ceil(shards.length / 2); shards = []; } // dawn vacuum, halved
    freePacks++;
    function hurt(e, dmg) { if (e.markT > 0) dmg *= 1.15; e.hp -= dmg; }
    function shock(e, base) { if (hasSyn("thermal") && e.chillT > 0 && e.burnT > 0) hurt(e, base * 0.6 + 6); }
    function damagePlayer(dmg, src) {
      if (P.invuln > 0) return;
      if (P.shieldReady) { P.shieldReady = false; P.shieldCd = P.shieldMax || 22; P.invuln = 0.6;
        if (hasSyn("thorns-ward") && P.thorns > 0) for (const o of enemies) if (dist(P, o) < 96 + o.r) hurt(o, P.thorns * 2.2); return; }
      P.hp -= dmg; P.invuln = 0.3; P.dmgTaken += dmg;
      if (P.thorns > 0) for (const o of enemies) if (dist(P, o) < 74 + o.r) hurt(o, P.thorns * 0.75);
      if (P.hp <= 0 && P.revives > 0) { P.revives--; P.hp = P.maxHp * 0.5; P.invuln = 2; }
    }
  }
  return { result: "win", wave: 10, hpEnter: P.hp / P.maxHp, endHp: P.hp / P.maxHp, dmgTaken: P.dmgTaken };
}

const RUNS = parseInt(process.argv[2] || "200", 10);
const diff = process.argv[3] === "torment" ? G.DIFFS.torment : G.DIFFS.vigil;
let wins = 0; const deathWave = {}, results = []; const endHps = [];
for (let i = 0; i < RUNS; i++) {
  const r = playRun(diff);
  results.push(r);
  if (r.result === "win") wins++;
  else deathWave[r.wave] = (deathWave[r.wave] || 0) + 1;
}
console.log(`PLAYSIM (${diff.name}) — ${RUNS} bot runs`);
console.log(`win rate: ${(wins / RUNS * 100).toFixed(0)}%   (bot ≈ a competent, cautious player)`);
console.log("deaths by night:", Object.entries(deathWave).sort((a, b) => a[0] - b[0]).map(([w, n]) => `N${w}:${n}`).join("  ") || "none");
const reached10 = results.filter(r => r.wave === 10).length;
console.log(`reached night 10: ${reached10}/${RUNS}`);
const winHps = results.filter(r => r.result === "win").map(r => r.endHp).sort((a, b) => a - b);
if (winHps.length) console.log(`median winner HP%: ${(winHps[Math.floor(winHps.length / 2)] * 100).toFixed(0)}%`);
const dt2 = results.map(r => r.dmgTaken || 0).sort((a, b) => a - b);
console.log(`median damage taken per run: ${dt2[Math.floor(dt2.length / 2)].toFixed(0)} HP (max ${dt2[dt2.length - 1].toFixed(0)})`);
