/* GRIMPACK — game logic. Balance numbers all live in balance.js (window.GRIM). */
(function () {
  "use strict";
  const G = window.GRIM;
  const W = 960, H = 640;
  const cv = document.getElementById("game"), ctx = cv.getContext("2d");
  const $ = id => document.getElementById(id);

  // ---------- images ----------
  const IMG = {};
  function loadImg(key, src) { const i = new Image(); i.src = src; IMG[key] = i; }
  loadImg("arena", "assets/arena.jpg"); loadImg("hero", "assets/hero.jpg");
  loadImg("husk", "assets/husk.jpg"); loadImg("cultist", "assets/cultist.jpg");
  loadImg("wraith", "assets/wraith.jpg"); loadImg("brute", "assets/brute.jpg");
  loadImg("boss", "assets/boss.jpg"); loadImg("abbot", "assets/cultist.jpg");
  loadImg("vesper", "assets/boss.jpg");
  const CARDMAP = {}; for (const c of G.CARDS) { CARDMAP[c.id] = c; loadImg("card_" + c.id, c.art); }

  // ---------- audio (WebAudio synth, zero files) ----------
  let AC = null, muted = false;
  function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    try {
      const a = ac(), o = a.createOscillator(), g = a.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.05, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
    } catch (e) { /* audio is garnish */ }
  }
  function noiseBurst(dur, vol) {
    if (muted) return;
    try {
      const a = ac(), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = a.createBufferSource(); s.buffer = buf;
      const g = a.createGain(); g.gain.value = vol || 0.12;
      const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 900;
      s.connect(f).connect(g).connect(a.destination); s.start();
    } catch (e) {}
  }
  const SFX = {
    shoot: () => tone(720 + Math.random() * 120, 0.06, "square", 0.016, 240),
    hit:   () => tone(190 + Math.random() * 60, 0.05, "sawtooth", 0.02, 90),
    die:   () => tone(140, 0.16, "sawtooth", 0.035, 45),
    hurt:  () => { tone(110, 0.2, "sawtooth", 0.07, 60); noiseBurst(0.12, 0.08); },
    toll:  () => { tone(196, 0.9, "sine", 0.10); tone(98, 1.1, "sine", 0.07); },
    rip:   () => noiseBurst(0.35, 0.16),
    flip:  r => tone(420 + r * 130, 0.22, "triangle", 0.06, 900 + r * 260),
    ash:   () => tone(1250 + Math.random() * 300, 0.07, "sine", 0.02, 1800),
    place: () => tone(150, 0.14, "triangle", 0.07, 70),
    win:   () => { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.35, "triangle", 0.06), i * 140)); },
    lose:  () => { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => tone(f, 0.4, "triangle", 0.06), i * 170)); },
  };

  // ---------- state ----------
  let state = "title"; // title | build | wave | pack | over | win
  let paused = false, lastT = 0, runTime = 0;
  let player, enemies, bolts, ebolts, towers, shards, zones, parts, texts;
  let wave = 0, spawnQueue = [], spawnTimer = 0, waveActive = false;
  let ashes = 0, kills = 0, packsOpened = 0, packCost = G.PACK.baseCost, freePacks = 0, dryPacks = 0;
  let hand = {};           // towerId -> {count, bestMult}
  let placedCount = {};    // towerId -> placed towers[]
  let collection = [];     // every card pulled {id, rarityIdx}
  let selectedHand = null, moveTower = null, mouse = { x: 0, y: 0 };
  let bossRef = null, shake = 0, hitFlash = 0;

  function reset() {
    const B = G.PLAYER_BASE;
    player = { x: W / 2, y: H / 2 + 60, hp: B.hp, maxHp: B.hp, dmg: B.dmg, rate: B.rate, proj: B.proj,
      pierce: B.pierce, critC: B.critC, critM: B.critM, speed: B.speed, collectR: B.collectR,
      regen: 0, shieldCd: 0, shieldReady: false, revives: 0, wrathNext: false, fireCd: 0, invuln: 0, r: B.radius };
    enemies = []; bolts = []; ebolts = []; towers = []; shards = []; zones = []; parts = []; texts = [];
    wave = 0; spawnQueue = []; waveActive = false; runTime = 0;
    ashes = 0; kills = 0; packsOpened = 0; packCost = G.PACK.baseCost; freePacks = 1; dryPacks = 0;
    hand = {}; placedCount = {}; collection = []; selectedHand = null; moveTower = null; bossRef = null;
    $("log").innerHTML = ""; $("collection").innerHTML = '<p class="empty">Nothing pulled yet. The pack provides.</p>';
    updateHUD(); renderHand(); updatePackButton();
  }

  // ---------- logging / HUD ----------
  function log(msg, cls) {
    const p = document.createElement("p"); if (cls) p.className = cls; p.textContent = msg;
    const el = $("log"); el.prepend(p); while (el.children.length > 40) el.lastChild.remove();
  }
  function fmtTime(s) { return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }
  function updateHUD() {
    $("hp-fill").style.width = Math.max(0, player.hp / player.maxHp * 100) + "%";
    $("hp-text").textContent = Math.ceil(player.hp) + "/" + player.maxHp;
    $("hud-wave").textContent = wave === 0 ? "—" : wave + " / 10" + (waveActive ? ` · ${enemies.length + spawnQueue.length} left` : "");
    $("hud-ashes").textContent = ashes;
    $("hud-kills").textContent = kills;
    $("hud-time").textContent = fmtTime(runTime);
    if (bossRef && bossRef.hp > 0) { $("boss-bar").classList.remove("hidden"); $("boss-fill").style.width = Math.max(0, bossRef.hp / bossRef.maxHp * 100) + "%"; }
    else $("boss-bar").classList.add("hidden");
  }
  function updatePackButton() {
    const b = $("btn-pack");
    if (state === "wave") { b.disabled = true; return; }
    if (freePacks > 0) { b.disabled = false; $("pack-btn-label").textContent = `Open Pack — FREE (${freePacks})`; }
    else if (ashes >= packCost) { b.disabled = false; $("pack-btn-label").textContent = `Buy Pack — ${packCost} ashes`; }
    else { b.disabled = true; $("pack-btn-label").textContent = `Pack — ${packCost} ashes (need ${packCost - ashes} more)`; }
  }
  function renderHand() {
    const el = $("hand"); el.innerHTML = "";
    const ids = Object.keys(hand).filter(id => hand[id].count > 0);
    if (!ids.length) { el.innerHTML = '<span class="hand-empty">No towers in hand.</span>'; return; }
    for (const id of ids) {
      const c = CARDMAP[id], d = document.createElement("div");
      d.className = "hand-chip" + (selectedHand === id ? " selected" : "");
      d.innerHTML = `<img src="${c.art}" alt=""><span>${c.name}</span><b>×${hand[id].count}</b>`;
      d.onclick = () => { selectedHand = selectedHand === id ? null : id; moveTower = null; renderHand(); };
      el.appendChild(d);
    }
  }
  function renderCollection() {
    const el = $("collection"); el.innerHTML = "";
    const agg = {};
    for (const p of collection) { agg[p.id] = agg[p.id] || { n: 0, best: 0 }; agg[p.id].n++; agg[p.id].best = Math.max(agg[p.id].best, p.rarityIdx); }
    for (const [id, a] of Object.entries(agg)) {
      const c = CARDMAP[id], r = G.RARITIES[a.best];
      const row = document.createElement("div"); row.className = "col-row";
      row.innerHTML = `<img src="${c.art}" alt=""><span>${c.name} <span class="rar" style="color:${r.color}">best: ${r.name}</span></span><span class="cnt">×${a.n}</span>`;
      el.appendChild(row);
    }
    if (!Object.keys(agg).length) el.innerHTML = '<p class="empty">Nothing pulled yet. The pack provides.</p>';
  }

  // ---------- cards & packs ----------
  function rollRarityIdx() {
    let x = Math.random() * 100, acc = 0;
    for (let i = 0; i < G.RARITIES.length; i++) { acc += G.RARITIES[i].weight; if (x < acc) return i; }
    return 0;
  }
  function rollCard() {
    const tot = Object.values(G.KIND_WEIGHTS).reduce((a, b) => a + b, 0);
    let x = Math.random() * tot, acc = 0, kind = "weapon";
    for (const [k, w] of Object.entries(G.KIND_WEIGHTS)) { acc += w; if (x < acc) { kind = k; break; } }
    const pool = G.CARDS.filter(c => c.kind === kind);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function rollPack() {
    const cards = [];
    let gotRarePlus = false;
    for (let s = 0; s < G.PACK.cardsPerPack; s++) {
      let ri = rollRarityIdx();
      if (s === 0 && dryPacks >= 2 && ri < 2) ri = 2; // pity: third dry pack guarantees Rare+
      if (ri >= 2) gotRarePlus = true;
      cards.push({ def: rollCard(), rarityIdx: ri });
    }
    dryPacks = gotRarePlus ? 0 : dryPacks + 1;
    return cards;
  }
  function describeCard(pull) {
    const { def, rarityIdx } = pull, m = G.RARITIES[rarityIdx].mult, T = G.TOWERS[def.id];
    switch (def.id) {
      case "spire": return `Bolts ${Math.round(T.dmg * m)} dmg × ${T.rate}/s`;
      case "bell":  return `Aura ${Math.round(T.auraDps * m)}/s, slows ${Math.round(T.slow * 100)}%`;
      case "pyre":  return `Embers ${Math.round(T.dmg * m)} dmg, ground burns ${Math.round(T.burnDps * m)}/s`;
      case "frost": return `Shots ${Math.round(T.dmg * m)} dmg, chill ${Math.round(T.chillSlow * 100)}%`;
      case "hellfire": return `+${Math.round(8 * m)} bolt damage`;
      case "twin":  return `+1 projectile`;
      case "cadence": return `+${(0.38 * m).toFixed(2)} shots/s`;
      case "pierce": return `Bolts pierce +${m >= 2.3 ? 2 : 1}`;
      case "axe":   return `+${Math.round(7 * m)}% crit, +${Math.round(12 * m)}% crit dmg`;
      case "boots": return `+${Math.round(16 * m)} move speed`;
      case "chalice": return `+${Math.round(18 * m)} max HP, +${(0.35 * m).toFixed(2)}/s regen`;
      case "magnet": return `+${Math.round(34 * m)} ash-collect radius`;
      case "ward":  return `Shield blocks a hit, re-forms in ${Math.max(8, Math.round(26 - 4 * m))}s`;
      case "vial":  return `Heal ${Math.round(player.maxHp * 0.35)} HP now`;
      case "draught": return `+25% damage next wave`;
      case "candle": return `+1 death-cheat (revive at 50%)`;
      default: return def.blurb;
    }
  }
  function applyCard(pull) {
    const { def, rarityIdx } = pull, m = G.RARITIES[rarityIdx].mult, R = G.RARITIES[rarityIdx];
    collection.push({ id: def.id, rarityIdx });
    log(`${R.name} ${def.name} — ${describeCard(pull)}`, rarityIdx >= 4 ? "legendary" : rarityIdx === 3 ? "epic" : rarityIdx === 2 ? "rare" : "");
    if (def.kind === "tower") {
      const placed = (placedCount[def.id] || []).filter(t => t.level < G.PACK.towerLevelCap);
      if (placed.length) {
        placed.sort((a, b) => a.level - b.level)[0].level++;
        burst(placed[0].x, placed[0].y, "#ffd94a", 14);
        log(`→ ${def.name} upgraded to level ${placed[0].level}.`);
      } else {
        hand[def.id] = hand[def.id] || { count: 0, bestMult: 1 };
        hand[def.id].count++; hand[def.id].bestMult = Math.max(hand[def.id].bestMult, m);
        renderHand();
      }
    } else if (def.kind === "weapon") {
      if (def.id === "hellfire") player.dmg += 8 * m;
      if (def.id === "cadence") player.rate += 0.38 * m;
      if (def.id === "twin") { player.proj += 1; player.dmg *= 0.92; }
      if (def.id === "pierce") player.pierce += m >= 2.3 ? 2 : 1;
      if (def.id === "axe") { player.critC += 0.07 * m; player.critM += 0.12 * m; }
    } else if (def.kind === "relic") {
      if (def.id === "boots") player.speed += 16 * m;
      if (def.id === "chalice") { const add = 18 * m; player.maxHp += Math.round(add); player.regen += 0.35 * m; heal(add); }
      if (def.id === "magnet") player.collectR += 34 * m;
      if (def.id === "ward") { player.shieldMax = Math.max(8, 26 - 4 * m); if (!player.shieldReady) { player.shieldReady = true; player.shieldCd = player.shieldMax; } }
    } else if (def.kind === "consumable") {
      if (def.id === "vial") heal(player.maxHp * 0.35);
      if (def.id === "draught") player.wrathNext = true;
      if (def.id === "candle") player.revives += 1;
    }
    renderCollection(); updateHUD();
  }
  function heal(n) { player.hp = Math.min(player.maxHp, player.hp + n); }

  // pack modal flow
  let currentPack = null, flipped = 0;
  function openPack() {
    if (state !== "build") return;
    if (freePacks > 0) freePacks--;
    else if (ashes >= packCost) { ashes -= packCost; packCost = Math.round(packCost * G.PACK.costGrowth); }
    else return;
    packsOpened++; state = "pack"; currentPack = null; flipped = 0;
    $("pack-modal").classList.remove("hidden");
    $("pack-closed").style.display = ""; $("pack-cards").classList.add("hidden");
    $("pack-cards").innerHTML = ""; $("btn-collect").classList.add("hidden");
    updatePackButton(); updateHUD();
  }
  $("pack-img").addEventListener("click", () => {
    if (currentPack) return;
    SFX.rip(); currentPack = rollPack();
    $("pack-closed").style.display = "none";
    const wrap = $("pack-cards"); wrap.classList.remove("hidden");
    currentPack.forEach((pull, i) => {
      const R = G.RARITIES[pull.rarityIdx], d = document.createElement("div");
      d.className = "gcard";
      d.innerHTML = `<div class="inner">
        <div class="face back"><img src="assets/card-back.jpg" alt=""></div>
        <div class="face front" style="border-color:${R.color}">
          <img src="${pull.def.art}" alt="">
          <div class="cbody">
            <span class="cname">${pull.def.name}</span>
            <span class="crar" style="color:${R.color}">${R.name} · ${pull.def.kind}</span>
            <span class="cstat">${describeCard(pull)}</span>
            <span class="cblurb">${pull.def.blurb}</span>
          </div></div></div>`;
      d.onclick = () => {
        if (d.classList.contains("flipped")) return;
        d.classList.add("flipped"); SFX.flip(pull.rarityIdx); flipped++;
        if (flipped >= currentPack.length) $("btn-collect").classList.remove("hidden");
      };
      wrap.appendChild(d);
      setTimeout(() => { if (!d.classList.contains("flipped")) d.click(); }, 2500 + i * 900); // no dead air
    });
  });
  $("btn-collect").addEventListener("click", () => {
    if (!currentPack) return;
    for (const pull of currentPack) applyCard(pull);
    currentPack = null; state = "build";
    $("pack-modal").classList.add("hidden");
    updatePackButton(); updateHUD();
  });
  $("btn-pack").addEventListener("click", openPack);

  // ---------- waves & combat ----------
  function buildSpawnQueue(w) {
    const spec = G.waveSpec(w), q = [];
    for (let i = 0; i < spec.count; i++) {
      let x = Math.random(), acc = 0, type = "husk";
      for (const [k, f] of Object.entries(spec.mix)) { acc += f; if (x < acc) { type = k; break; } }
      q.push(type);
    }
    // shuffle, but keep brutes spread out
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    if (spec.boss) q.push(spec.boss);
    return q;
  }
  function spawnEnemy(type) {
    const spec = G.waveSpec(wave), base = G.ENEMIES[type];
    const edge = Math.floor(Math.random() * 4); let x, y;
    if (edge === 0) { x = Math.random() * W; y = -30; } else if (edge === 1) { x = Math.random() * W; y = H + 30; }
    else if (edge === 2) { x = -30; y = Math.random() * H; } else { x = W + 30; y = Math.random() * H; }
    const isBoss = type === "abbot" || type === "vesper";
    const hp = base.hp * (isBoss ? spec.bossScale : spec.hpScale);
    const e = { type, x, y, hp, maxHp: hp, speed: base.speed * (0.9 + Math.random() * 0.2), dmg: base.dmg * spec.dmgScale,
      r: base.r, ash: base.ash, slowT: 0, slowF: 0, burnT: 0, burnDps: 0, hitCd: 0, boss: isBoss,
      summonCd: 4, tollCd: 6, img: IMG[type], wob: Math.random() * 6.28 };
    enemies.push(e);
    if (isBoss) { bossRef = e; $("boss-name").textContent = type === "vesper" ? "VESPER, MOTHER OF BELLS" : "THE ABBOT"; SFX.toll(); banner(type === "vesper" ? "☠ VESPER ☠" : "THE ABBOT TOLLS"); }
    return e;
  }
  function banner(txt) { const b = $("wave-banner"); b.textContent = txt; b.classList.remove("hidden"); setTimeout(() => b.classList.add("hidden"), 2600); }
  function beginWave() {
    if (state !== "build") return;
    if (freePacks > 0) { log("You begin the night with an unopened pack. It will keep."); }
    selectedHand = null; moveTower = null; renderHand();
    wave++; waveActive = true; state = "wave";
    spawnQueue = buildSpawnQueue(wave); spawnTimer = 0;
    if (player.wrathNext) { player.wrathWave = true; player.wrathNext = false; log("Wrath Draught: +25% damage this wave."); }
    banner(wave === 10 ? "☠ THE FINAL NIGHT ☠" : "NIGHT " + wave);
    $("phase-title").textContent = "Night " + wave;
    $("phase-text").textContent = wave === 5 ? "Something tolls in the dark. The Abbot comes." : wave === 10 ? "Vesper rises. End this." : "Survive. The pack provides for the living.";
    $("btn-begin").disabled = true; $("btn-pack").disabled = true;
    updateHUD();
  }
  function endWave() {
    waveActive = false; state = "build"; bossRef = null;
    player.wrathWave = false;
    if (wave >= 10) return endRun(true);
    freePacks++; SFX.toll();
    log(`Night ${wave} survived. A fresh pack drops from the dark.`);
    $("phase-title").textContent = "Night " + wave + " Survived";
    $("phase-text").textContent = "Tear the pack. Place your towers. Then descend again.";
    $("btn-begin").disabled = false; $("btn-begin").textContent = "Begin Night " + (wave + 1) + " ☾";
    updatePackButton(); updateHUD();
  }
  function endRun(wonGame) {
    state = wonGame ? "win" : "over";
    $("end-title").textContent = wonGame ? "DAWN, OF A SORT" : "THE NIGHT TAKES YOU";
    $("end-title").style.color = wonGame ? "#ffd94a" : "#d7263d";
    $("end-stats").innerHTML = `${wonGame ? "Vesper is silent. The cathedral is yours." : "You fell on night " + wave + "."}<br>` +
      `Survived <b>${fmtTime(runTime)}</b> · Slain <b>${kills}</b> · Packs torn <b>${packsOpened}</b> · Cards pulled <b>${collection.length}</b>`;
    $("end-screen").classList.remove("hidden");
    wonGame ? SFX.win() : SFX.lose(); updateHUD();
  }
  function burst(x, y, color, n) { for (let i = 0; i < n && parts.length < 420; i++) { const a = Math.random() * 6.28, s = 40 + Math.random() * 130; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, t: 0, color, size: 1.5 + Math.random() * 2.5 }); } }
  function floatText(x, y, txt, color) { if (texts.length < 40) texts.push({ x, y, txt, color, t: 0 }); }
  function damageEnemy(e, dmg, crit, silent) {
    e.hp -= dmg; e.flash = 0.08;
    if (!silent) floatText(e.x + (Math.random() * 16 - 8), e.y - e.r - 4, String(Math.round(dmg)), crit ? "#ffd94a" : "#e8e2d4");
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; kills++; SFX.die(); burst(e.x, e.y, e.type === "wraith" ? "#9fd8ff" : "#c93b2e", e.boss ? 46 : 10);
      for (let i = 0; i < e.ash; i++) shards.push({ x: e.x + (Math.random() * 24 - 12), y: e.y + (Math.random() * 24 - 12), vx: 0, vy: 0, t: Math.random() * 6 });
      if (e.boss) { bossRef = null; shake = 14; log(e.type === "vesper" ? "VESPER FALLS." : "The Abbot is silenced. His ashes scatter — collect them."); }
    }
  }
  function hurtPlayer(dmg) {
    if (player.invuln > 0 || state !== "wave") return;
    if (player.shieldReady) { player.shieldReady = false; player.shieldCd = player.shieldMax || 22; player.invuln = 0.6; burst(player.x, player.y, "#e8efff", 16); floatText(player.x, player.y - 34, "WARD!", "#bcd3ff"); return; }
    player.hp -= dmg; player.invuln = 0.3; hitFlash = 0.25; shake = Math.max(shake, 5); SFX.hurt();
    if (player.hp <= 0) {
      if (player.revives > 0) { player.revives--; player.hp = player.maxHp * 0.5; player.invuln = 2; shake = 16; burst(player.x, player.y, "#ffd94a", 40); log("The Saint's Candle gutters — and holds. You rise at half strength."); SFX.toll(); }
      else { player.hp = 0; endRun(false); }
    }
    updateHUD();
  }

  // ---------- update ----------
  const keys = {};
  addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    if (e.key.toLowerCase() === "p") togglePause();
    if (e.key.toLowerCase() === "m") toggleMute();
    if (e.key === " " && state === "build") beginWave();
    if (e.key === "Escape") { selectedHand = null; moveTower = null; renderHand(); }
  });
  addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
  function togglePause() { if (state === "wave" || state === "build") { paused = !paused; $("btn-pause").textContent = paused ? "▶" : "⏸"; } }
  function toggleMute() { muted = !muted; $("btn-mute").textContent = muted ? "🔇" : "🔊"; }
  $("btn-pause").onclick = togglePause; $("btn-mute").onclick = toggleMute;

  function nearestEnemy(x, y, maxD) {
    let best = null, bd = maxD;
    for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function rollCrit() { return Math.random() < player.critC; }

  function update(dt) {
    if (state === "wave") runTime += dt;
    // player movement (build + wave)
    if (state === "build" || state === "wave") {
      let dx = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
      let dy = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
      if (dx && dy) { dx *= 0.707; dy *= 0.707; }
      player.x = Math.min(W - player.r, Math.max(player.r, player.x + dx * player.speed * dt));
      player.y = Math.min(H - player.r, Math.max(player.r, player.y + dy * player.speed * dt));
      if (player.regen) heal(player.regen * dt);
      if (player.invuln > 0) player.invuln -= dt;
      if (player.shieldMax && !player.shieldReady) { player.shieldCd -= dt; if (player.shieldCd <= 0) { player.shieldReady = true; burst(player.x, player.y, "#bcd3ff", 8); } }
    }
    if (state !== "wave") { updateFx(dt); return; }

    // spawning — burst knots at one edge point feel like a swarm, not a queue
    const spec = G.waveSpec(wave);
    if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const knot = spawnQueue[0] === "abbot" || spawnQueue[0] === "vesper" ? 1 : 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < knot && spawnQueue.length; i++) spawnEnemy(spawnQueue.shift());
        spawnTimer = spec.duration / spec.count * knot * (0.75 + Math.random() * 0.5);
      }
    }
    // player auto-fire
    player.fireCd -= dt;
    if (player.fireCd <= 0) {
      const tgt = nearestEnemy(player.x, player.y, 620);
      if (tgt) {
        player.fireCd = 1 / player.rate;
        const baseA = Math.atan2(tgt.y - player.y, tgt.x - player.x), n = player.proj;
        for (let i = 0; i < n; i++) {
          const a = baseA + (n > 1 ? (i - (n - 1) / 2) * 0.11 : 0);
          bolts.push({ x: player.x, y: player.y, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, dmg: player.dmg * (player.wrathWave ? 1.25 : 1), pierce: player.pierce, life: 1.2, kind: "bolt" });
        }
        SFX.shoot();
      } else player.fireCd = 0.08;
    }
    // towers
    for (const t of towers) {
      const T = G.TOWERS[t.type], lvM = Math.pow(G.PACK.towerLevelMult, t.level - 1);
      if (t.type === "bell") {
        t.tollT = (t.tollT || 0) - dt;
        for (const e of enemies) { if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < T.auraRange) { e.slowF = Math.max(e.slowF, T.slow); e.slowT = Math.max(e.slowT, 0.15); damageEnemySilent(e, T.auraDps * t.mult * lvM * dt); } }
        if (t.tollT <= 0) { t.tollT = T.tollEvery; t.ring = 0.5; if (nearestEnemy(t.x, t.y, T.auraRange)) SFX.toll(); }
      } else {
        t.cd -= dt;
        if (t.cd <= 0) {
          const tgt = nearestEnemy(t.x, t.y, T.range);
          if (tgt) {
            t.cd = 1 / T.rate;
            if (t.type === "spire") bolts.push({ x: t.x, y: t.y - 8, vx: 0, vy: 0, homing: tgt, speed: T.boltSpeed, dmg: T.dmg * t.mult * lvM, pierce: 0, life: 1.1, kind: "spire" });
            if (t.type === "frost") bolts.push({ x: t.x, y: t.y - 8, vx: 0, vy: 0, homing: tgt, speed: 480, dmg: T.dmg * t.mult * lvM, pierce: 0, life: 1.1, kind: "frost", chill: T.chillSlow, chillSecs: T.chillSecs });
            if (t.type === "pyre") bolts.push({ x: t.x, y: t.y - 8, tx: tgt.x, ty: tgt.y, sx: t.x, sy: t.y - 8, prog: 0, dur: Math.max(0.35, Math.hypot(tgt.x - t.x, tgt.y - t.y) / 430), dmg: T.dmg * t.mult * lvM, kind: "ember", burnDps: T.burnDps * t.mult * lvM, burnSecs: T.burnSecs, burnRadius: T.burnRadius });
          } else t.cd = 0.1;
        }
      }
      if (t.ring > 0) t.ring -= dt;
    }
    // bolts
    for (const b of bolts) {
      if (b.kind === "ember") {
        b.prog += dt / b.dur;
        b.x = b.sx + (b.tx - b.sx) * b.prog; b.y = b.sy + (b.ty - b.sy) * b.prog - Math.sin(b.prog * Math.PI) * 46;
        if (b.prog >= 1) { b.dead = true; zones.push({ x: b.tx, y: b.ty, r: b.burnRadius, dps: b.burnDps, t: b.burnSecs }); burst(b.tx, b.ty, "#ff7a26", 8); const e = nearestEnemy(b.tx, b.ty, 40); if (e) damageEnemy(e, b.dmg, false); }
        continue;
      }
      if (b.homing) { if (b.homing.dead) { b.dead = true; continue; } const a = Math.atan2(b.homing.y - b.y, b.homing.x - b.x); b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life <= 0) b.dead = true;
      for (const e of enemies) {
        if (e.dead || b.dead) continue;
        if (b.hitSet && b.hitSet.has(e)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6) {
          const crit = b.kind === "bolt" ? rollCrit() : false;
          damageEnemy(e, b.dmg * (crit ? player.critM : 1), crit); SFX.hit();
          if (b.chill) { e.slowF = Math.max(e.slowF, b.chill); e.slowT = Math.max(e.slowT, b.chillSecs); }
          if (b.pierce > 0) { b.pierce--; b.hitSet = b.hitSet || new Set(); b.hitSet.add(e); }
          else b.dead = true;
        }
      }
    }
    bolts = bolts.filter(b => !b.dead);
    // burn zones
    for (const z of zones) { z.t -= dt; for (const e of enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r * 0.5) { e.burnT = Math.max(e.burnT, 0.2); e.burnDps = Math.max(e.burnDps, z.dps); } }
    zones = zones.filter(z => z.t > 0);
    // enemies
    for (const e of enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.burnT > 0) { e.burnT -= dt; damageEnemySilent(e, e.burnDps * dt); if (e.dead) continue; }
      const slow = e.slowT > 0 ? 1 - e.slowF : 1; if (e.slowT > 0) e.slowT -= dt; else e.slowF = 0;
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(a) * e.speed * slow * dt; e.y += Math.sin(a) * e.speed * slow * dt;
      // light separation so knots don't stack into one sprite
      for (const o of enemies) { if (o !== e && !o.dead) { const d = Math.hypot(o.x - e.x, o.y - e.y), min = (o.r + e.r) * 0.8; if (d > 0 && d < min) { e.x -= (o.x - e.x) / d * (min - d) * 0.3; e.y -= (o.y - e.y) / d * (min - d) * 0.3; } } }
      e.hitCd -= dt;
      if (Math.hypot(player.x - e.x, player.y - e.y) < e.r + player.r && e.hitCd <= 0) { e.hitCd = 0.85; hurtPlayer(e.dmg); }
      if (e.type === "abbot") { e.summonCd -= dt; if (e.summonCd <= 0 && enemies.filter(x => !x.dead).length < 90) { e.summonCd = 4; const h = spawnEnemy("husk"); h.x = e.x + 30; h.y = e.y + 10; burst(e.x, e.y, "#a41623", 8); } }
      if (e.type === "vesper") { e.tollCd -= dt; if (e.tollCd <= 0) { e.tollCd = 6; SFX.toll(); shake = Math.max(shake, 6); for (let i = 0; i < 10; i++) { const aa = i / 10 * 6.283; ebolts.push({ x: e.x, y: e.y, vx: Math.cos(aa) * 165, vy: Math.sin(aa) * 165, dmg: 10 * spec.dmgScale, life: 3.4, r: 7 }); } for (let i = 0; i < 3; i++) { const w = spawnEnemy("wraith"); w.x = e.x + (Math.random() * 90 - 45); w.y = e.y + (Math.random() * 90 - 45); } } }
    }
    enemies = enemies.filter(e => !e.dead);
    // enemy bolts (Vesper's toll-bursts)
    for (const b of ebolts) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life <= 0) b.dead = true; if (!b.dead && Math.hypot(player.x - b.x, player.y - b.y) < player.r + b.r) { b.dead = true; hurtPlayer(b.dmg); } }
    ebolts = ebolts.filter(b => !b.dead);
    // ash shards
    for (const s of shards) {
      s.t += dt * 3;
      const d = Math.hypot(player.x - s.x, player.y - s.y);
      if (d < player.collectR * 2.1) { const pull = d < player.collectR ? 430 : 190; s.x += (player.x - s.x) / (d || 1) * pull * dt; s.y += (player.y - s.y) / (d || 1) * pull * dt; }
      if (d < player.r + 9) { s.dead = true; ashes++; SFX.ash(); updatePackButton(); }
    }
    shards = shards.filter(s => !s.dead);
    updateFx(dt);
    if (waveActive && !spawnQueue.length && !enemies.length && state === "wave") endWave();
    updateHUD();
  }
  function damageEnemySilent(e, dmg) { damageEnemy(e, dmg, false, true); } // aura/burn ticks: no float-text spam
  function updateFx(dt) {
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    parts = parts.filter(p => p.t < p.life);
    for (const t of texts) { t.t += dt; t.y -= 34 * dt; }
    texts = texts.filter(t => t.t < 0.8);
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    if (hitFlash > 0) hitFlash -= dt;
  }

  // ---------- render ----------
  function drawToken(x, y, r, img, ring) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.clip();
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    else { ctx.fillStyle = "#333"; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.strokeStyle = ring; ctx.lineWidth = 2; ctx.stroke();
  }
  function render() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (IMG.arena.complete) ctx.drawImage(IMG.arena, 0, 0, W, H); else { ctx.fillStyle = "#0b0a09"; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(0, 0, W, H);
    // burn zones
    for (const z of zones) { const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r); g.addColorStop(0, "rgba(255,140,40,0.5)"); g.addColorStop(1, "rgba(255,80,20,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill(); }
    // placement range preview
    if (state === "build" && (selectedHand || moveTower)) {
      const id = selectedHand || moveTower.type, T = G.TOWERS[id];
      const range = T.range || T.auraRange || 150;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, range, 0, 6.283); ctx.fillStyle = "rgba(255,217,74,0.07)"; ctx.fill(); ctx.strokeStyle = "rgba(255,217,74,0.4)"; ctx.stroke();
    }
    // ash shards
    for (const s of shards) { ctx.fillStyle = "#ffb066"; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.t); ctx.fillRect(-2.6, -2.6, 5.2, 5.2); ctx.restore(); }
    // towers
    for (const t of towers) {
      const T = G.TOWERS[t.type];
      if (t.type === "bell" && state === "wave") { ctx.beginPath(); ctx.arc(t.x, t.y, T.auraRange, 0, 6.283); ctx.fillStyle = "rgba(180,160,255,0.045)"; ctx.fill(); }
      if (t.ring > 0) { ctx.beginPath(); ctx.arc(t.x, t.y, T.auraRange * (1 - t.ring / 0.5) + 10, 0, 6.283); ctx.strokeStyle = "rgba(200,180,255,0.5)"; ctx.stroke(); }
      drawToken(t.x, t.y, 24, IMG["card_" + t.type], moveTower === t ? "#ffd94a" : "#6b5a3e");
      ctx.fillStyle = "#ffd94a"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
      if (t.level > 1) ctx.fillText("★".repeat(t.level), t.x, t.y + 38);
    }
    // enemies
    for (const e of enemies) {
      const bob = Math.sin(runTime * 6 + e.wob) * 2;
      drawToken(e.x, e.y + bob * 0.3, e.r, e.img, e.boss ? "#d7263d" : e.type === "wraith" ? "#7fb8d8" : "#54452e");
      if (e.flash > 0) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fillStyle = "rgba(255,240,220,0.45)"; ctx.fill(); }
      if (e.slowT > 0) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, 6.283); ctx.strokeStyle = "rgba(140,200,255,0.65)"; ctx.stroke(); }
      if (e.hp < e.maxHp) { const w = e.r * 2; ctx.fillStyle = "#20090b"; ctx.fillRect(e.x - e.r, e.y - e.r - 10, w, 4); ctx.fillStyle = e.boss ? "#d7263d" : "#a41623"; ctx.fillRect(e.x - e.r, e.y - e.r - 10, w * Math.max(0, e.hp / e.maxHp), 4); }
    }
    // bolts
    for (const b of bolts) {
      ctx.fillStyle = b.kind === "frost" ? "#aee2ff" : b.kind === "ember" ? "#ff9a3c" : "#ffc46b";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.kind === "ember" ? 6 : 4, 0, 6.283); ctx.fill();
    }
    for (const b of ebolts) { ctx.fillStyle = "#ff5d73"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); }
    // player
    if (state !== "title" && state !== "over") {
      if (!(player.invuln > 0 && Math.floor(runTime * 14) % 2 && state === "wave")) drawToken(player.x, player.y, player.r, IMG.hero, player.shieldReady ? "#bcd3ff" : "#c9a227");
      if (player.shieldReady) { ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 6, 0, 6.283); ctx.strokeStyle = "rgba(160,190,255,0.5)"; ctx.stroke(); }
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(player.x - 26, player.y - player.r - 14, 52, 5);
      ctx.fillStyle = "#c1272d"; ctx.fillRect(player.x - 26, player.y - player.r - 14, 52 * Math.max(0, player.hp / player.maxHp), 5);
    }
    // particles & texts
    for (const p of parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
    ctx.font = "bold 13px Georgia"; ctx.textAlign = "center";
    for (const t of texts) { ctx.globalAlpha = 1 - t.t / 0.8; ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y); }
    ctx.globalAlpha = 1;
    if (hitFlash > 0) { ctx.fillStyle = `rgba(164,22,35,${hitFlash * 0.55})`; ctx.fillRect(0, 0, W, H); }
    if (paused) { ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#d8d2c4"; ctx.font = "42px Georgia"; ctx.textAlign = "center"; ctx.fillText("PAUSED", W / 2, H / 2); }
    ctx.restore();
  }
  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0); lastT = ts;
    if (!paused && state !== "title") update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- placement input ----------
  function canvasPos(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) }; }
  cv.addEventListener("mousemove", e => { mouse = canvasPos(e); });
  cv.addEventListener("click", e => {
    if (state !== "build") return;
    const p = canvasPos(e);
    if (moveTower) {
      moveTower.x = p.x; moveTower.y = p.y; moveTower = null; SFX.place(); renderHand(); return;
    }
    if (selectedHand) {
      if ((placedCount._total || 0) >= G.PACK.maxFieldTowers && !placedCount[selectedHand]) { log("The field holds six towers. Pull a duplicate to upgrade instead."); return; }
      const id = selectedHand, info = hand[id];
      const t = { type: id, x: p.x, y: p.y, level: 1, mult: info.bestMult, cd: 0, tollT: 0, ring: 0 };
      towers.push(t); (placedCount[id] = placedCount[id] || []).push(t); placedCount._total = (placedCount._total || 0) + 1;
      info.count--; if (info.count <= 0) selectedHand = null;
      SFX.place(); burst(p.x, p.y, "#ffd94a", 10); renderHand(); return;
    }
    const t = towers.find(t => Math.hypot(t.x - p.x, t.y - p.y) < 28);
    if (t) { moveTower = t; log(`${CARDMAP[t.type].name} Lv${t.level} — click where it should stand. Esc to cancel.`); }
  });

  // ---------- buttons ----------
  $("btn-begin").addEventListener("click", beginWave);
  $("btn-start").addEventListener("click", () => {
    ac(); reset(); state = "build";
    $("title-screen").classList.add("hidden");
    $("phase-title").textContent = "The Vigil Begins";
    log("Your first pack waits. Tear it open.");
  });
  $("btn-restart").addEventListener("click", () => {
    $("end-screen").classList.add("hidden"); reset(); state = "build";
    $("btn-begin").disabled = false; $("btn-begin").textContent = "Begin Night 1 ☾";
    $("phase-title").textContent = "The Vigil Begins";
    $("phase-text").textContent = "Open your first pack, place what the dead provide, then begin the night.";
  });

  reset();
  requestAnimationFrame(loop);
})();
