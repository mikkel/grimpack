/* GRIMPACK v2 — game logic. Balance numbers live in balance.js (window.GRIM).
   The arena art is gameplay: pillars block bolts, the ritual circle
   consecrates, braziers burn, blood stays where it fell. */
(function () {
  "use strict";
  const G = window.GRIM;
  const W = 960, H = 640;
  const cv = document.getElementById("game"), ctx = cv.getContext("2d");
  const $ = id => document.getElementById(id);
  const WORLD = G.WORLD;

  // ---------- images ----------
  const IMG = {};
  function loadImg(key, src) { const i = new Image(); i.src = src; IMG[key] = i; }
  loadImg("arena", "assets/arena.jpg"); loadImg("hero", "assets/spr/spr-hero.webp");
  loadImg("husk", "assets/spr/spr-husk.webp"); loadImg("cultist", "assets/spr/spr-cultist.webp");
  loadImg("wraith", "assets/spr/spr-wraith.webp"); loadImg("brute", "assets/spr/spr-brute.webp");
  loadImg("plague", "assets/spr/spr-plague.webp"); loadImg("abbot", "assets/spr/spr-abbot.webp");
  loadImg("vesper", "assets/spr/spr-vesper.webp");
  loadImg("wall", "assets/wall.jpg"); loadImg("rubble", "assets/spr/spr-rubble.webp"); loadImg("barricade", "assets/spr/spr-barricade.webp");
  const SPR_TOWER = { spire: "spr-spire", bell: "spr-bell", pyre: "spr-pyre", frost: "spr-frost", gallows: "spr-gallows", font: "spr-font" };
  for (const [id, f] of Object.entries(SPR_TOWER)) loadImg("spr_" + id, "assets/spr/" + f + ".webp");
  const CARDMAP = {}; for (const c of G.CARDS) { CARDMAP[c.id] = c; loadImg("card_" + c.id, c.art); }

  // ---------- audio ----------
  let AC = null, muted = false;
  const dirge = $("dirge");
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
    } catch (e) {}
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
  const SND = {};
  for (const n of ["shoot", "hit", "die", "hurt", "toll", "rip", "flip", "ash", "place", "dash", "boom", "shock", "win", "lose"]) {
    const a = new Audio("assets/sfx/" + n + ".mp3"); a.preload = "auto"; SND[n] = a;
  }
  function playSnd(name, vol, rateJitter) {
    if (muted) return false;
    const a = SND[name];
    if (!a || a.readyState < 2) return false;
    const c = a.cloneNode();
    c.volume = vol; c.playbackRate = 1 + (Math.random() - 0.5) * (rateJitter || 0);
    c.play().catch(() => {});
    return true;
  }
  const SFX = {
    shoot: () => { if (!playSnd("shoot", 0.40, 0.18)) tone(720 + Math.random() * 120, 0.06, "square", 0.016, 240); },
    hit:   () => { if (!playSnd("hit", 0.42, 0.2)) tone(190 + Math.random() * 60, 0.05, "sawtooth", 0.02, 90); },
    die:   () => { if (!playSnd("die", 0.5, 0.25)) tone(140, 0.16, "sawtooth", 0.035, 45); },
    hurt:  () => { if (!playSnd("hurt", 0.75, 0.1)) { tone(110, 0.2, "sawtooth", 0.07, 60); noiseBurst(0.12, 0.08); } },
    toll:  () => { if (!playSnd("toll", 0.85, 0.04)) { tone(196, 0.9, "sine", 0.10); tone(98, 1.1, "sine", 0.07); } },
    rip:   () => { if (!playSnd("rip", 0.8, 0.1)) noiseBurst(0.35, 0.16); },
    flip:  r => { if (!playSnd("flip", 0.65, 0.1)) tone(420 + r * 130, 0.22, "triangle", 0.06, 900 + r * 260); },
    ash:   () => { if (!playSnd("ash", 0.36, 0.22)) tone(1250 + Math.random() * 300, 0.07, "sine", 0.02, 1800); },
    place: () => { if (!playSnd("place", 0.7, 0.08)) tone(150, 0.14, "triangle", 0.07, 70); },
    dash:  () => { if (!playSnd("dash", 0.45, 0.15)) noiseBurst(0.14, 0.05); },
    boom:  () => { if (!playSnd("boom", 0.85, 0.1)) { tone(70, 0.4, "sawtooth", 0.12, 34); noiseBurst(0.3, 0.14); } },
    shock: () => { if (!playSnd("shock", 0.5, 0.2)) tone(1400, 0.12, "square", 0.03, 300); },
    win:   () => { if (!playSnd("win", 0.8, 0)) [392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.35, "triangle", 0.06), i * 140)); },
    lose:  () => { if (!playSnd("lose", 0.8, 0)) [330, 262, 196, 131].forEach((f, i) => setTimeout(() => tone(f, 0.4, "triangle", 0.06), i * 170)); },
  };
  function setMusic(on) { if (!dirge) return; dirge.volume = 0.42; if (on && !muted) dirge.play().catch(() => {}); else dirge.pause(); }

  // ---------- state ----------
  let state = "title";
  let paused = false, lastT = 0, runTime = 0, hitStop = 0;
  let player, enemies, bolts, ebolts, towers, shards, zones, parts, texts, decals, zaps;
  let wave = 0, spawnQueue = [], spawnTimer = 0, waveActive = false;
  let ashes = 0, kills = 0, streak = 0, packsOpened = 0, packCost = G.PACK.baseCost, freePacks = 0, dryPacks = 0;
  let hand = {}, placedCount = {}, collection = [], owned = {};
  let selectedHand = null, moveTower = null, mouse = { x: 0, y: 0 }, touchTarget = null;
  let bossRef = null, shake = 0, hitFlash = 0, waveTime = 0, deepenStacks = 0, deepenShown = 0;
  let placingBarrier = false;
  let corpses = [], embers = [], titheId = null, tonightTithe = null, tithePending = false, beginArmed = false;
  let diff = G.DIFFS.vigil, omen = null, nextOmen = null;
  let packsThisBuild = 0, bonusCards = 0, emberTimer = 5, strikeWarn = null;
  let best = JSON.parse(localStorage.getItem("grimpack-best") || '{"nights":0,"kills":0,"wins":0,"bestTime":0}');

  function hasSyn(id) { const s = G.SYNERGIES.find(x => x.id === id); return s && s.needs.every(n => owned[n]); }
  function reset() {
    const B = G.PLAYER_BASE;
    player = { x: W / 2, y: H / 2 + 60, hp: B.hp, maxHp: B.hp, dmg: B.dmg, rate: B.rate, proj: B.proj,
      pierce: B.pierce, critC: B.critC, critM: B.critM, speed: B.speed, collectR: B.collectR,
      regen: 0, shieldCd: 0, shieldMax: 0, shieldReady: false, revives: 0, wrathNext: false, wrathWave: false,
      fireCd: 0, invuln: 0, r: B.radius, chillSlow: 0, chillSecs: 0, stormEvery: 0, hitCount: 0, vx: 0, vy: 0, walkPh: 0,
      thorns: 0, brandPct: 0, dashCd: 0, dashT: 0, dashDx: 0, dashDy: 0, lastDx: 1, lastDy: 0 };
    enemies = []; bolts = []; ebolts = []; towers = []; shards = []; zones = []; parts = []; texts = []; decals = []; zaps = []; corpses = []; embers = [];
    for (let i = 0; i < 26; i++) embers.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 12, ph: Math.random() * 6.28 });
    titheId = null; tonightTithe = null; tithePending = false; beginArmed = false; $("tithe-box").classList.add("hidden");
    buildGrid(); placingBarrier = false;
    wave = 0; spawnQueue = []; waveActive = false; runTime = 0; hitStop = 0;
    ashes = 0; kills = 0; streak = 0; packsOpened = 0; packCost = G.PACK.baseCost; freePacks = 1; dryPacks = 0;
    hand = {}; placedCount = {}; collection = []; owned = {};
    selectedHand = null; moveTower = null; bossRef = null; packsThisBuild = 0; bonusCards = 0;
    nextOmen = G.OMENS[Math.floor(Math.random() * G.OMENS.length)]; omen = null;
    $("log").innerHTML = ""; renderCollection(); updateHUD(); renderHand(); updatePackButton(); showOmenPreview();
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
    updateBarrierButton();
    $("hud-kills").textContent = kills;
    $("hud-time").textContent = fmtTime(runTime);
    $("hud-dash").textContent = player.dashCd > 0 ? "↯ " + player.dashCd.toFixed(1) : "↯ ready";
    $("hud-dash").style.color = player.dashCd > 0 ? "#8a7f6a" : "#ffd94a";
    if (bossRef && bossRef.hp > 0) { $("boss-bar").classList.remove("hidden"); $("boss-fill").style.width = Math.max(0, bossRef.hp / bossRef.maxHp * 100) + "%"; }
    else $("boss-bar").classList.add("hidden");
  }
  function packPrice() { return titheId === "bell" ? Math.max(10, packCost - 12) : packCost; }
  function updatePackButton() {
    const b = $("btn-pack"), price = packPrice();
    if (state === "wave") { b.disabled = true; return; }
    if (freePacks > 0) { b.disabled = false; $("pack-btn-label").textContent = `Open Pack — FREE (${freePacks})`; }
    else if (ashes >= price) { b.disabled = false; $("pack-btn-label").textContent = `Buy Pack — ${price} ashes`; }
    else { b.disabled = true; $("pack-btn-label").textContent = `Pack — ${price} ashes (need ${price - ashes} more)`; }
  }
  function offerTithes() {
    const pool = [...G.TITHES].sort(() => Math.random() - 0.5).slice(0, 3);
    const box = $("tithe-box"), opts = $("tithe-opts"); opts.innerHTML = "";
    for (const t of pool) {
      const b = document.createElement("button"); b.className = "tithe-opt";
      const afford = t.cost === "ash" ? ashes >= t.amt : t.cost === "hp" ? player.hp > t.amt + 5 : true;
      b.disabled = !afford;
      b.innerHTML = `${t.name} <small>${t.text}${afford ? "" : " (cannot pay)"}</small>`;
      b.onclick = () => chooseTithe(t);
      opts.appendChild(b);
    }
    box.classList.remove("hidden"); tithePending = true; beginArmed = false;
  }
  function chooseTithe(t) {
    if (t) {
      titheId = t.id;
      if (t.cost === "ash") ashes -= t.amt;
      if (t.cost === "hp") { player.hp -= t.amt; floatText(player.x, player.y - 40, "-" + t.amt + " HP — THE CIRCLE DRINKS", "#d7263d"); }
      if (t.id === "crypts") { freePacks++; log("Something old wakes in the crypts. A pack slides out of the dark — free."); }
      if (t.id === "hoard") { ashes += 25; log("You hoard the ash. The dead notice. They always notice."); }
      if (t.id === "pray") { heal(30); log("You pray at the Font. It answers — once. Tonight it runs dry."); }
      log(`Tithe chosen: ${t.name}.`, "rare");
    } else log("No offering. The cathedral says nothing. It doesn't have to.");
    tithePending = false;
    $("tithe-box").classList.add("hidden");
    updateHUD(); updatePackButton();
  }
  $("tithe-skip").addEventListener("click", () => chooseTithe(null));
  function showOmenPreview() {
    if (wave >= 10) return;
    $("phase-text").innerHTML = `Tonight's omen: <b style="color:#ffd94a">${nextOmen.name}</b> — ${nextOmen.desc}` +
      `<br><span style="opacity:.75">Open packs, place towers (the ritual circle consecrates them: +30% damage), then begin.</span>`;
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
    for (const s of G.SYNERGIES) if (s.needs.every(n => owned[n])) {
      const row = document.createElement("div"); row.className = "col-row";
      row.innerHTML = `<span style="color:#7dff9a">✦ SYNERGY — ${s.name}</span>`;
      row.title = s.desc; el.appendChild(row);
    }
    if (!Object.keys(agg).length) el.innerHTML = '<p class="empty">Nothing pulled yet. The pack provides.</p>';
  }

  // ---------- cards & packs ----------
  function rollRarityIdx(luckShift) {
    // luckShift moves weight from Common toward the better tiers (Torment, Gilded Seal)
    const wts = G.RARITIES.map((r, i) => i === 0 ? Math.max(10, r.weight - (luckShift || 0)) : r.weight + (luckShift || 0) / 4);
    let x = Math.random() * wts.reduce((a, b) => a + b, 0), acc = 0;
    for (let i = 0; i < G.RARITIES.length; i++) { acc += wts[i]; if (x < acc) return i; }
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
    const nCards = G.PACK.cardsPerPack + bonusCards; bonusCards = 0;
    const foil = packsThisBuild >= 2; // third pack in one build phase is a FOIL pack
    const luck = diff.luck;
    const cards = [];
    let gotRarePlus = false;
    for (let s = 0; s < nCards; s++) {
      let ri = rollRarityIdx(luck);
      if (s === 0 && dryPacks >= 2 && ri < 2) ri = 2; // pity
      if (foil) ri = Math.min(4, ri + 1);
      if (ri >= 2) gotRarePlus = true;
      cards.push({ def: rollCard(), rarityIdx: ri, foil });
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
      case "gallows": return `Shots ${Math.round(T.dmg * m)} dmg, range ${T.range}, marks prey`;
      case "font":  return `Heals ${(T.healPerSec * m).toFixed(1)}/s nearby, anoints towers`;
      case "hellfire": return `+${Math.round(8 * m)} bolt damage`;
      case "twin":  return `+1 projectile`;
      case "cadence": return `+${(0.38 * m).toFixed(2)} shots/s`;
      case "pierce": return `Bolts pierce +${m >= 2.3 ? 2 : 1}`;
      case "axe":   return `+${Math.round(7 * m)}% crit, +${Math.round(12 * m)}% crit dmg`;
      case "chill": return `Bolts chill ${Math.round(20 * m)}% for ${(1.1 * m).toFixed(1)}s`;
      case "storm": return `Every ${Math.max(3, Math.round(6 - m))}th hit: lightning chains`;
      case "boots": return `+${Math.round(16 * m)} move speed`;
      case "chalice": return `+${Math.round(18 * m)} max HP, +${(0.25 * m).toFixed(2)}/s regen`;
      case "magnet": return `+${Math.round(34 * m)} ash-collect radius`;
      case "ward":  return `Shield blocks a hit, re-forms in ${Math.max(8, Math.round(26 - 4 * m))}s`;
      case "thorns": return `Attackers take ${Math.round(7 * m)} thorn damage`;
      case "brand": return `+${Math.round(0.5 * m * 10) / 10}% damage per 1% HP missing`;
      case "vial":  return `Heal ${Math.round(player.maxHp * 0.35)} HP now`;
      case "draught": return `+25% damage next wave`;
      case "candle": return `+1 death-cheat (revive at 50%)`;
      case "seal":  return `Next pack: +1 card, better luck`;
      default: return def.blurb;
    }
  }
  function applyCard(pull) {
    const { def, rarityIdx } = pull, m = G.RARITIES[rarityIdx].mult, R = G.RARITIES[rarityIdx];
    collection.push({ id: def.id, rarityIdx }); owned[def.id] = (owned[def.id] || 0) + 1;
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
      if (def.id === "chill") { player.chillSlow = Math.max(player.chillSlow, 0.20 * Math.min(m, 2)); player.chillSecs = Math.max(player.chillSecs, 1.1 * Math.min(m, 2)); }
      if (def.id === "storm") player.stormEvery = player.stormEvery ? Math.max(3, player.stormEvery - 1) : Math.max(3, Math.round(6 - m));
    } else if (def.kind === "relic") {
      if (def.id === "boots") player.speed += 16 * m;
      if (def.id === "chalice") { const add = 18 * m; player.maxHp += Math.round(add); player.regen += 0.25 * m; heal(add); }
      if (def.id === "magnet") player.collectR += 34 * m;
      if (def.id === "ward") { player.shieldMax = Math.max(8, 26 - 4 * m); if (!player.shieldReady) { player.shieldReady = true; player.shieldCd = player.shieldMax; } }
      if (def.id === "thorns") player.thorns += 7 * m;
      if (def.id === "brand") player.brandPct += 0.005 * m;
    } else if (def.kind === "consumable") {
      if (def.id === "vial") heal(player.maxHp * 0.35);
      if (def.id === "draught") player.wrathNext = true;
      if (def.id === "candle") player.revives += 1;
      if (def.id === "seal") { bonusCards += 1; dryPacks = Math.max(0, dryPacks - 1); log("The Gilded Seal promises a fatter, luckier pack."); }
    }
    renderCollection(); updateHUD();
  }
  function heal(n) { player.hp = Math.min(player.maxHp, player.hp + n); }

  // pack modal flow
  let currentPack = null, flipped = 0;
  function openPack() {
    if (state !== "build") return;
    if (freePacks > 0) freePacks--;
    else if (ashes >= packPrice()) { ashes -= packPrice(); packCost = Math.round(packCost * G.PACK.costGrowth); }
    else return;
    packsOpened++; packsThisBuild++; state = "pack"; currentPack = null; flipped = 0;
    $("pack-modal").classList.remove("hidden");
    $("pack-closed").style.display = ""; $("pack-cards").classList.add("hidden");
    $("pack-cards").innerHTML = ""; $("btn-collect").classList.add("hidden");
    $("foil-note").textContent = packsThisBuild >= 3 ? "" : (packsThisBuild === 2 ? "One more pack this vigil and it turns FOIL — every card +1 rarity." : "");
    updatePackButton(); updateHUD();
  }
  $("pack-img").addEventListener("click", () => {
    if (currentPack) return;
    SFX.rip(); currentPack = rollPack();
    if (currentPack[0] && currentPack[0].foil) { $("foil-note").textContent = "✦ FOIL PACK — every card raised a rarity ✦"; hitStop = Math.max(hitStop, 0.08); }
    $("pack-closed").style.display = "none";
    const wrap = $("pack-cards"); wrap.classList.remove("hidden");
    currentPack.forEach((pull, i) => {
      const R = G.RARITIES[pull.rarityIdx], d = document.createElement("div");
      d.className = "gcard";
      d.innerHTML = `<div class="inner">
        <div class="face back"><img src="assets/card-back.jpg" alt="">
          <button class="trade-btn" title="Burn 25 ashes to trade this card for a new pull">↻ trade · 25 ash</button></div>
        <div class="face front" style="border-color:${R.color}">
          <img src="${pull.def.art}" alt="">
          <div class="cbody">
            <span class="cname">${pull.def.name}</span>
            <span class="crar" style="color:${R.color}">${R.name} · ${pull.def.kind}</span>
            <span class="cstat">${describeCard(pull)}</span>
            <span class="cblurb">${pull.def.blurb}</span>
            <button class="trade-btn" title="Burn 25 ashes to trade this card for a new pull">↻ trade · 25 ash</button>
          </div></div></div>`;
      const trades = d.querySelectorAll(".trade-btn");
      trades.forEach(tr => { if (ashes < 25) tr.disabled = true; });
      const doTrade = ev => {
        ev.stopPropagation();
        if (ashes < 25 || d.dataset.traded) return;
        d.dataset.traded = "1";
        ashes -= 25;
        let nri = rollRarityIdx(diff.luck); if (pull.foil) nri = Math.min(4, nri + 1);
        const np = { def: rollCard(), rarityIdx: nri, foil: pull.foil };
        currentPack[i] = np;
        d.querySelector(".front").style.borderColor = G.RARITIES[np.rarityIdx].color;
        d.querySelector(".front img").src = np.def.art;
        d.querySelector(".cname").textContent = np.def.name;
        const cr = d.querySelector(".crar"); cr.textContent = `${G.RARITIES[np.rarityIdx].name} · ${np.def.kind}`; cr.style.color = G.RARITIES[np.rarityIdx].color;
        d.querySelector(".cstat").textContent = describeCard(np);
        d.querySelector(".cblurb").textContent = np.def.blurb;
        trades.forEach(tr => tr.remove()); noiseBurst(0.15, 0.08);
        log("The dead accept your trade."); updateHUD(); updatePackButton();
      };
      trades.forEach(tr => tr.onclick = doTrade);
      d.onclick = () => {
        if (d.classList.contains("flipped")) return;
        d.classList.add("flipped"); SFX.flip(pull.rarityIdx);
        if (pull.rarityIdx >= 4) { hitStop = Math.max(hitStop, 0.1); SFX.toll(); }
        flipped++;
        if (flipped >= currentPack.length) $("btn-collect").classList.remove("hidden");
      };
      wrap.appendChild(d);
      setTimeout(() => { if (!d.classList.contains("flipped")) d.click(); }, 2500 + i * 900);
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
  function updateBarrierButton() {
    const b = $("btn-barrier");
    if (state !== "build") { b.classList.add("hidden"); return; }
    b.classList.remove("hidden");
    b.textContent = placingBarrier ? "Click the floor to raise it (Esc to stop)" : `🧱 Raise Barricade — ${G.TERRAIN.barrierCost} ash (${barriers.length}/${G.TERRAIN.barrierMax})`;
    b.disabled = !placingBarrier && (ashes < G.TERRAIN.barrierCost || barriers.length >= G.TERRAIN.barrierMax);
  }
  $("btn-barrier").addEventListener("click", () => { placingBarrier = !placingBarrier; selectedHand = null; renderHand(); updateBarrierButton(); });

  // ---------- world geometry ----------
  function inCircle(x, y) { return Math.hypot(x - WORLD.circle.x, y - WORLD.circle.y) < WORLD.circle.r; }

  // ---------- the cathedral floor: tiles, flow-field, fog ----------
  const TILE = G.TILE, COLS = G.COLS, ROWS = G.ROWS;
  let grid = [], rubbleHp = {}, barriers = [], flow = new Int32Array(COLS * ROWS), flowTimer = 0;
  const tIdx = (c, r) => r * COLS + c;
  const tileOf = (x, y) => [Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE))), Math.max(0, Math.min(ROWS - 1, Math.floor(y / TILE)))];
  const tileCenter = (c, r) => [c * TILE + TILE / 2, r * TILE + TILE / 2];
  function charAt(c, r) { return (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? '#' : grid[r][c]; }
  function barrierAt(c, r) { return barriers.find(b => b.c === c && b.r === r) || null; }
  function moveBlocked(c, r) { const ch = charAt(c, r); return ch === '#' || ch === 'r' || !!barrierAt(c, r); }
  function boltBlocked(c, r) { return charAt(c, r) === '#' || !!barrierAt(c, r); }
  function buildGrid() {
    grid = G.MAP.map(row => row.split("")); rubbleHp = {}; barriers = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === 'r') rubbleHp[c + "," + r] = G.TERRAIN.rubbleHp;
  }
  function buildFlow() {
    flow.fill(1e9);
    const [pc, pr] = tileOf(player.x, player.y);
    const q = [[pc, pr]]; flow[tIdx(pc, pr)] = 0;
    for (let h = 0; h < q.length; h++) {
      const [c, r] = q[h], d = flow[tIdx(c, r)];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const i = tIdx(nc, nr);
        if (flow[i] === 1e9 && !moveBlocked(nc, nr)) { flow[i] = d + 1; q.push([nc, nr]); }
      }
    }
  }
  function losBlocked(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(1, Math.floor(d / 9));
    for (let i = 1; i < steps; i++) {
      const [c, r] = tileOf(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps);
      if (boltBlocked(c, r)) return true;
    }
    return false;
  }
  function pillarHit(x, y) { const [c, r] = tileOf(x, y); return boltBlocked(c, r); }
  function inFogAt(x, y) {
    const [c, r] = tileOf(x, y);
    if (charAt(c, r) !== 'f') return false;
    for (const bz of WORLD.braziers) if (Math.hypot(bz.x - x, bz.y - y) < WORLD.brazierR + 12) return false; // brazier light burns the fog off
    return true;
  }
  function collideTiles(ent, isPlayer) {
    const rr0 = ent.r * 0.85; // hitboxes run smaller than sprites: one-tile lanes stay passable
    const [c0, r0] = tileOf(ent.x, ent.y);
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      const solid = charAt(c, r) === '#' || charAt(c, r) === 'r' || (!isPlayer && !!barrierAt(c, r));
      if (!solid) continue;
      const nx = Math.max(c * TILE, Math.min(ent.x, c * TILE + TILE)), ny = Math.max(r * TILE, Math.min(ent.y, r * TILE + TILE));
      const dx = ent.x - nx, dy = ent.y - ny, d = Math.hypot(dx, dy);
      if (d < rr0) {
        if (d < 0.01) ent.x += (ent.x < c * TILE + TILE / 2 ? -1 : 1) * 2;
        else { ent.x = nx + dx / d * rr0; ent.y = ny + dy / d * rr0; }
      }
    }
  }
  function damageBlocker(c, r, dmg) {
    const b = barrierAt(c, r);
    if (b) {
      b.hp -= dmg; burst(c * TILE + 18, r * TILE + 18, "#a98a54", 3);
      if (b.hp <= 0) { barriers = barriers.filter(x => x !== b); burst(c * TILE + 18, r * TILE + 18, "#a98a54", 16); SFX.place(); log("A barricade is smashed apart."); buildFlow(); }
      return;
    }
    const k = c + "," + r;
    if (rubbleHp[k] != null) {
      rubbleHp[k] -= dmg; burst(c * TILE + 18, r * TILE + 18, "#8a7f6a", 3);
      if (rubbleHp[k] <= 0) { delete rubbleHp[k]; grid[r][c] = '.'; burst(c * TILE + 18, r * TILE + 18, "#8a7f6a", 18); SFX.place(); buildFlow(); }
    }
  }

  // ---------- waves & combat ----------
  function buildSpawnQueue(w) {
    const spec = G.waveSpec(w), q = [];
    for (let i = 0; i < spec.count; i++) {
      let x = Math.random(), acc = 0, type = "husk";
      for (const [k, f] of Object.entries(spec.mix)) { acc += f; if (x < acc) { type = k; break; } }
      if (omen && omen.noWraith && type === "wraith") type = "husk";
      q.push(type);
    }
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    if (spec.boss) q.push(spec.boss);
    return q;
  }
  function spawnEnemy(type, ringAngle) {
    const spec = G.waveSpec(wave), base = G.ENEMIES[type];
    const edge = Math.floor(Math.random() * 4); let x, y;
    if (ringAngle != null) { x = player.x + Math.cos(ringAngle) * 330; y = player.y + Math.sin(ringAngle) * 330; }
    else if (edge === 0) { x = Math.random() * W; y = -30; } else if (edge === 1) { x = Math.random() * W; y = H + 30; }
    else if (edge === 2) { x = -30; y = Math.random() * H; } else { x = W + 30; y = Math.random() * H; }
    const isBoss = type === "abbot" || type === "vesper";
    let hp = base.hp * (isBoss ? spec.bossScale : spec.hpScale) * diff.hp;
    if (omen && omen.bruteHp && type === "brute") hp *= omen.bruteHp;
    const elite = !isBoss && Math.random() < 0.04 * (omen && omen.eliteMult ? omen.eliteMult : 1) * (tonightTithe === "crypts" ? 3 : 1);
    if (elite) hp *= 3.2;
    const e = { type, x, y, hp, maxHp: hp, speed: base.speed * (0.9 + Math.random() * 0.2) * (omen && omen.enemySpeed ? omen.enemySpeed : 1) * (tonightTithe === "doors" ? 0.9 : 1),
      dmg: base.dmg * spec.dmgScale * diff.dmg * (elite ? 1.3 : 1), r: base.r * (elite ? 1.35 : 1), ash: base.ash * (elite ? 6 : 1),
      slowT: 0, slowF: 0, chillT: 0, burnT: 0, burnDps: 0, markT: 0, shockCd: 0, hitCd: 0, boss: isBoss, elite,
      summonCd: 4, tollCd: 6, img: IMG[type], wob: Math.random() * 6.28, flickerT: Math.random() * 2, enraged: false, exploded: false, lungeCd: 2 + Math.random() * 2, lungeT: 0, chargeCd: 3 + Math.random() * 3, chargeT: 0, windT: 0, animT: Math.random() * 6.28, vx: 0, vy: 0, atkPop: 0 };
    enemies.push(e);
    if (isBoss) { bossRef = e; $("boss-name").textContent = type === "vesper" ? "VESPER, MOTHER OF BELLS" : "THE ABBOT"; SFX.toll(); setTimeout(() => SFX.toll(), 350); banner(type === "vesper" ? "☠ VESPER ☠" : "THE ABBOT TOLLS"); shake = 10; }
    return e;
  }
  function banner(txt) { const b = $("wave-banner"); b.textContent = txt; b.classList.remove("hidden"); setTimeout(() => b.classList.add("hidden"), 2600); }
  function beginWave() {
    placingBarrier = false;
    if (state !== "build") return;
    if (tithePending && !beginArmed) { beginArmed = true; const b = $("tithe-box"); b.classList.add("flash"); setTimeout(() => b.classList.remove("flash"), 1100); log("The cathedral waits for an offering. Choose — or begin anyway (click Begin again)."); return; }
    if (freePacks > 0) log("You begin the night with an unopened pack. It will keep.");
    selectedHand = null; moveTower = null; renderHand();
    wave++; waveActive = true; state = "wave"; packsThisBuild = 0; waveTime = 0; deepenStacks = 0; deepenShown = 0;
    omen = nextOmen; nextOmen = G.OMENS[Math.floor(Math.random() * G.OMENS.length)];
    if (omen && omen.packBonus) bonusCards += omen.packBonus;
    spawnQueue = buildSpawnQueue(wave); spawnTimer = 0; emberTimer = 4;
    tonightTithe = titheId; titheId = null;
    if (tonightTithe === "bell") { waveTime = 40; log("The bell was rung early. The night begins already deepened."); }
    if (tonightTithe === "silence") { omen = null; log("The omen is cast out. A plain night — chosen."); }
    if (tonightTithe === "braziers") { const extra = Math.floor(spawnQueue.length * 0.15); for (let i = 0; i < extra; i++) spawnQueue.push(Math.random() < 0.7 ? "husk" : "cultist"); log("The brazier-light draws them. More dead tonight."); }
    if (player.wrathNext) { player.wrathWave = true; player.wrathNext = false; log("Wrath Draught: +25% damage this wave."); }
    banner((wave === 10 ? "☠ THE FINAL NIGHT ☠ " : "NIGHT " + wave) + (omen && !omen.plain ? " — " + omen.name.toUpperCase() : ""));
    $("phase-title").textContent = "Night " + wave + (omen ? " · " + omen.name : "");
    $("phase-text").textContent = wave === 5 ? "Something tolls in the dark. The Abbot comes." : wave === 10 ? "Vesper rises. End this." : "Survive. The pack provides for the living.";
    $("btn-begin").disabled = true; $("btn-pack").disabled = true;
    updateHUD();
  }
  function endWave() {
    waveActive = false; state = "build"; bossRef = null; omen = null; strikeWarn = null;
    if (shards.length) { const kept = Math.ceil(shards.length / 2); ashes += kept; log(`Dawn stirs the ash — it remembers its owner. +${kept} ashes gathered (${shards.length - kept} guttered out in the dark).`); shards = []; }
    player.wrathWave = false;
    if (wave >= 10) return endRun(true);
    if (tonightTithe === "doors") log("The barred doors cost you: no free pack this morning.");
    else freePacks++;
    tonightTithe = null; SFX.toll();
    log(`Night ${wave} survived. A fresh pack drops from the dark.`);
    $("phase-title").textContent = "Night " + wave + " Survived";
    showOmenPreview();
    $("btn-begin").disabled = false; $("btn-begin").textContent = "Begin Night " + (wave + 1) + " ☾";
    updatePackButton(); updateHUD();
    if (wave >= 1 && wave < 10) offerTithes();
  }
  function endRun(wonGame) {
    state = wonGame ? "win" : "over";
    setMusic(false);
    best.nights = Math.max(best.nights, wave); best.kills = Math.max(best.kills, kills);
    if (wonGame) { best.wins++; best.bestTime = best.bestTime ? Math.min(best.bestTime, runTime) : runTime; }
    localStorage.setItem("grimpack-best", JSON.stringify(best));
    $("end-art").src = wonGame ? "assets/dawn-art.jpg" : "assets/title-art.jpg";
    $("end-title").textContent = wonGame ? "DAWN, OF A SORT" : "THE NIGHT TAKES YOU";
    $("end-title").style.color = wonGame ? "#ffd94a" : "#d7263d";
    $("end-stats").innerHTML = `${wonGame ? "Vesper is silent. The cathedral is yours." : "You fell on night " + wave + "."}<br>` +
      `Survived <b>${fmtTime(runTime)}</b> · Slain <b>${kills}</b> · Packs torn <b>${packsOpened}</b> · Cards pulled <b>${collection.length}</b><br>` +
      `<span style="opacity:.75">Best: ${best.nights} nights · ${best.kills} slain · ${best.wins} dawn(s)${best.bestTime ? " · fastest dawn " + fmtTime(best.bestTime) : ""}</span>`;
    $("end-screen").classList.remove("hidden");
    wonGame ? SFX.win() : SFX.lose(); updateHUD();
  }
  function burst(x, y, color, n) { for (let i = 0; i < n && parts.length < 460; i++) { const a = Math.random() * 6.28, s = 40 + Math.random() * 140; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, t: 0, color, size: 1.5 + Math.random() * 2.5 }); } }
  function floatText(x, y, txt, color) { if (texts.length < 44) texts.push({ x, y, txt, color, t: 0 }); }
  function maybeShock(e, baseDmg) {
    if (!hasSyn("thermal") || e.shockCd > 0 || e.dead) return;
    if (e.chillT > 0 && e.burnT > 0) {
      e.shockCd = 0.6; const d = baseDmg * 0.6 + 6;
      SFX.shock(); burst(e.x, e.y, "#ffe9a8", 10); floatText(e.x, e.y - e.r - 16, "SHOCK " + Math.round(d), "#ffe9a8");
      damageEnemy(e, d, false, true);
    }
  }
  function damageEnemy(e, dmg, crit, silent) {
    if (e.dead) return;
    if (e.markT > 0) dmg *= 1.15;
    e.hp -= dmg; e.flash = 0.08;
    if (!silent) floatText(e.x + (Math.random() * 16 - 8), e.y - e.r - 4, String(Math.round(dmg)), crit ? "#ffd94a" : "#e8e2d4");
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; kills++; streak++; SFX.die();
      corpses.push({ img: e.img, x: e.x, y: e.y, s: e.r * 3.4, t: 0, dir: Math.random() < 0.5 ? -1 : 1, boss: e.boss }); if (corpses.length > 40) corpses.shift();
      burst(e.x, e.y, e.type === "wraith" ? "#9fd8ff" : e.type === "plague" ? "#b6d94a" : "#c93b2e", e.boss ? 46 : 10);
      decals.push({ x: e.x, y: e.y, r: e.r * (0.8 + Math.random() * 0.7), a: 0.34 }); if (decals.length > 260) decals.shift();
      const ashN = Math.round(e.ash * (omen && omen.ashMult ? omen.ashMult : 1) * (tonightTithe === "hoard" ? 0.7 : 1));
      for (let i = 0; i < ashN; i++) shards.push({ x: e.x + (Math.random() * 24 - 12), y: e.y + (Math.random() * 24 - 12), vx: 0, vy: 0, t: Math.random() * 6, age: 0 });
      if (streak > 0 && streak % 25 === 0) { ashes += 5; floatText(player.x, player.y - 40, "RAMPAGE +5 ash", "#ff7a26"); log(`Rampage — ${streak} slain without a scratch. The dead provide (+5 ashes).`); updatePackButton(); }
      if (e.elite) { hitStop = Math.max(hitStop, 0.05); log("An Anointed one falls. It died rich."); }
      if (e.type === "plague" && !e.exploded) explodePlague(e);
      if (e.boss) { bossRef = null; shake = 14; hitStop = Math.max(hitStop, 0.12); log(e.type === "vesper" ? "VESPER FALLS." : "The Abbot is silenced. His ashes scatter — collect them."); }
    }
  }
  function explodePlague(e) {
    e.exploded = true; SFX.boom(); shake = Math.max(shake, 7);
    burst(e.x, e.y, "#b6d94a", 22);
    const R = G.ENEMIES.plague.explodeR, D = G.ENEMIES.plague.explodeDmg;
    for (const o of [...enemies]) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < R + o.r) damageEnemy(o, D, false);
    if (Math.hypot(player.x - e.x, player.y - e.y) < R + player.r) hurtPlayer(D * 0.8);
    const [ec0, er0] = tileOf(e.x, e.y);
    for (let r = er0 - 3; r <= er0 + 3; r++) for (let c = ec0 - 3; c <= ec0 + 3; c++) {
      const [cx2, cy2] = tileCenter(c, r);
      if (Math.hypot(cx2 - e.x, cy2 - e.y) < R + 20 && (charAt(c, r) === 'r' || barrierAt(c, r))) damageBlocker(c, r, 60);
    }
  }
  function damageEnemySilent(e, dmg) { damageEnemy(e, dmg, false, true); }
  function hurtPlayer(dmg, attacker) {
    if (player.invuln > 0 || state !== "wave") return;
    if (player.shieldReady) {
      player.shieldReady = false; player.shieldCd = player.shieldMax || 22; player.invuln = 0.6;
      burst(player.x, player.y, "#e8efff", 16); floatText(player.x, player.y - 34, "WARD!", "#bcd3ff");
      if (hasSyn("thorns-ward") && player.thorns > 0) { for (const o of [...enemies]) if (!o.dead && Math.hypot(o.x - player.x, o.y - player.y) < 96 + o.r) damageEnemy(o, player.thorns * 2.2, false); burst(player.x, player.y, "#ff5d73", 18); }
      return;
    }
    player.hp -= dmg; player.invuln = 0.3; hitFlash = 0.25; shake = Math.max(shake, 5); streak = 0; SFX.hurt();
    if (player.thorns > 0) for (const o of [...enemies]) if (!o.dead && Math.hypot(o.x - player.x, o.y - player.y) < 74 + o.r) damageEnemy(o, player.thorns * (0.5 + Math.random() * 0.5), false, true);
    if (player.hp <= 0) {
      if (player.revives > 0) { player.revives--; player.hp = player.maxHp * 0.5; player.invuln = 2; shake = 16; burst(player.x, player.y, "#ffd94a", 40); log("The Saint's Candle gutters — and holds. You rise at half strength."); SFX.toll(); }
      else { player.hp = 0; endRun(false); }
    }
    updateHUD();
  }

  const keys = {};
  addEventListener("keydown", e => {
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key === " " && state === "build") { e.preventDefault(); beginWave(); }
    if (e.key === " " && state === "wave") { e.preventDefault(); tryDash(); }
    if (e.key.toLowerCase() === "shift" && state === "wave") tryDash();
    if (e.key.toLowerCase() === "p" && (state === "wave" || state === "build")) togglePause();
    if (e.key.toLowerCase() === "m") toggleMute();
    if (e.key === "Escape") { selectedHand = null; moveTower = null; placingBarrier = false; updateBarrierButton(); renderHand(); }
  });
  addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
  function togglePause() { paused = !paused; $("pause-overlay").classList.toggle("hidden", !paused); }
  function toggleMute() { muted = !muted; $("btn-mute").textContent = muted ? "🔇" : "🔊"; if (dirge) { muted ? dirge.pause() : (state === "wave" || state === "build") && dirge.play().catch(() => {}); } }
  $("btn-mute").addEventListener("click", toggleMute);
  $("btn-pause").addEventListener("click", () => { if (state === "wave" || state === "build") togglePause(); });
  function tryDash() {
    if (player.dashCd > 0) return;
    let dx = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
    let dy = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
    if (!dx && !dy) { dx = player.lastDx; dy = player.lastDy; }
    const l = Math.hypot(dx, dy) || 1;
    player.dashDx = dx / l; player.dashDy = dy / l; player.dashT = 0.16; player.dashCd = 2.6; SFX.dash();
  }
  function chainZap(from, firstHit, baseDmg) {
    const jumps = 2 + Math.max(0, player.proj - 1) * (hasSyn("stormtwin") ? 1 : 0);
    let cur = firstHit, ox = from.x, oy = from.y; const seen = new Set([firstHit]);
    for (let j = 0; j <= jumps && cur; j++) {
      zaps.push({ x1: ox, y1: oy, x2: cur.x, y2: cur.y, t: 0, ttl: 0.16 });
      if (j > 0 || cur !== firstHit) damageEnemy(cur, baseDmg * 0.6, false);
      ox = cur.x; oy = cur.y;
      let best = null, bd = 150;
      for (const o of enemies) if (!o.dead && !seen.has(o) && Math.hypot(o.x - ox, o.y - oy) < bd) { bd = Math.hypot(o.x - ox, o.y - oy); best = o; }
      if (best) seen.add(best);
      cur = best;
    }
    SFX.shock();
  }
  function towerFireRate(tw, def) {
    let r = def.rate * (Math.pow(G.PACK.towerLevelMult, tw.level - 1));
    for (const f of towers) if (f.type === "font" && Math.hypot(f.x - tw.x, f.y - tw.y) < 150) { r *= G.TOWERS.font.anointRate; break; }
    if (tw.type === "bell" && hasSyn("resonance")) r *= 1.33;
    return r;
  }
  function fireBolt(from, target, dmg, opts) {
    const a = Math.atan2(target.y - from.y, target.x - from.x);
    bolts.push({ x: from.x, y: from.y, vx: Math.cos(a) * (opts.speed || 620), vy: Math.sin(a) * (opts.speed || 620),
      dmg, pierce: opts.pierce || 0, hits: new Set(), kind: opts.kind || "bolt", chillSlow: opts.chillSlow || 0, chillSecs: opts.chillSecs || 0,
      mark: !!opts.mark, homing: opts.homing ? target : null, zoneDps: opts.zoneDps || 0, playerBolt: from === player });
    if (from === player) SFX.shoot();
  }
  function update(dt) {
    runTime += dt;
    if (waveActive) {
      waveTime += dt;
      const st = Math.floor(waveTime / 20);
      if (st > deepenStacks) {
        deepenStacks = st;
        if (st > deepenShown) { deepenShown = st; banner("☾ THE NIGHT DEEPENS ☾"); log("The night deepens: the dead quicken (+4% speed, +3% bite). End it soon."); }
      }
    }
    if (hitFlash > 0) hitFlash -= dt * 2.4;
    // embers, floating texts, zaps, blood never forgets
    for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    for (const em of embers) { em.x += (em.vx + Math.sin(runTime * 0.7 + em.ph) * 6) * dt; em.y += em.vy * dt; if (em.y < -8) { em.y = H + 8; em.x = Math.random() * W; } if (em.x < -8) em.x = W + 8; if (em.x > W + 8) em.x = -8; }
    for (const c of corpses) c.t += dt; corpses = corpses.filter(c => c.t < 2.6);
    parts = parts.filter(p => p.t < p.life);
    for (const t of texts) { t.t += dt; t.y -= 34 * dt; } texts = texts.filter(t => t.t < 0.9);
    for (const z of zaps) z.t += dt; zaps = zaps.filter(z => z.t < z.ttl);
    player.invuln = Math.max(0, player.invuln - dt); player.shieldCd -= dt; player.dashCd = Math.max(0, player.dashCd - dt);
    if (player.shieldMax && !player.shieldReady && player.shieldCd <= 0) { player.shieldReady = true; floatText(player.x, player.y - 34, "ward re-formed", "#bcd3ff"); }
    heal(player.regen * dt);
    // --- movement (+ dash, touch) ---
    let dx = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
    let dy = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);
    if (touchTarget) { const tdx = touchTarget.x - player.x, tdy = touchTarget.y - player.y; if (Math.hypot(tdx, tdy) > 14) { dx = tdx; dy = tdy; } else { dx = 0; dy = 0; } }
    const dl = Math.hypot(dx, dy);
    const px0 = player.x, py0 = player.y;
    if (player.dashT > 0) {
      player.dashT -= dt; player.x += player.dashDx * 950 * dt; player.y += player.dashDy * 950 * dt;
      player.invuln = Math.max(player.invuln, 0.05);
      if (Math.random() < 0.8) parts.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, t: 0, color: "#d7263d", size: 3 });
    } else if (dl > 0) {
      player.lastDx = dx / dl; player.lastDy = dy / dl;
      const [ptc, ptr] = tileOf(player.x, player.y);
      const vault = barrierAt(ptc, ptr) ? 0.55 : 1; // vaulting your own barricades costs speed
      player.x += dx / dl * player.speed * vault * dt; player.y += dy / dl * player.speed * vault * dt;
    }
    player.x = Math.max(18, Math.min(W - 18, player.x)); player.y = Math.max(18, Math.min(H - 18, player.y));
    collideTiles(player, true);
    flowTimer -= dt; if (flowTimer <= 0) { flowTimer = 0.35; buildFlow(); }
    if (dt > 0) { player.vx = (player.x - px0) / dt; player.vy = (player.y - py0) / dt; }
    const spd = Math.hypot(player.vx, player.vy);
    player.walkPh += dt * (2 + spd / 22);
    // --- spawns ---
    if (waveActive && spawnQueue.length) {
      spawnTimer -= dt;
      const spec = G.waveSpec(wave);
      if (spawnTimer <= 0) {
        spawnTimer = (spec.duration / spec.count) * (2 + Math.floor(Math.random() * 4)) * (0.75 + Math.random() * 0.5);
        const knot = 2 + Math.floor(Math.random() * 4);
        const ring = wave >= 2 && Math.random() < 0.30; // THE DEAD RISE AROUND YOU — from Night 2, wherever you stand
        const baseA = Math.random() * 6.283;
        if (ring) floatText(player.x, player.y - 52, "THE DEAD RISE AROUND YOU", "#ff5d2e");
        for (let i = 0; i < knot && spawnQueue.length; i++) spawnEnemy(spawnQueue.pop(), ring ? baseA + (i / Math.max(1, knot)) * 6.283 : null);
      }
    }
    // --- ember storm ---
    if (waveActive && omen && omen.emberStorm) {
      emberTimer -= dt;
      if (emberTimer <= 0 && !strikeWarn) {
        emberTimer = 3.4 + Math.random() * 2.2;
        const nearPlayer = Math.random() < 0.4;
        strikeWarn = { x: nearPlayer ? player.x + (Math.random() * 120 - 60) : (enemies.length ? enemies[Math.floor(Math.random() * enemies.length)].x : Math.random() * W),
                       y: nearPlayer ? player.y + (Math.random() * 120 - 60) : (enemies.length ? enemies[0].y : Math.random() * H), t: 0.85 };
      }
    }
    if (strikeWarn) {
      strikeWarn.t -= dt;
      if (strikeWarn.t <= 0) {
        const s = strikeWarn; strikeWarn = null; SFX.boom(); burst(s.x, s.y, "#ff7a26", 20); shake = Math.max(shake, 4);
        for (const e of [...enemies]) if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < 58 + e.r) damageEnemy(e, 55, false);
        if (Math.hypot(player.x - s.x, player.y - s.y) < 58 + player.r) hurtPlayer(14);
      }
    }
    // --- towers ---
    for (const tw of towers) {
      const def = G.TOWERS[tw.type], lvM = Math.pow(G.PACK.towerLevelMult, tw.level - 1) * (tonightTithe === "blood" ? 1.15 : 1), cons = inCircle(tw.x, tw.y) ? (tonightTithe === "blood" ? 1.9 : WORLD.consecration) : 1;
      tw.cd -= dt;
      if (tw.type === "font") {
        if (tonightTithe !== "pray" && Math.hypot(player.x - tw.x, player.y - tw.y) < def.auraRange + player.r) heal(def.healPerSec * tw.mult * lvM * dt * (inCircle(tw.x, tw.y) ? WORLD.consecration : 1));
        continue;
      }
      if (tw.type === "bell") {
        if (tw.cd <= 0) {
          let any = false;
          for (const e of enemies) {
            if (e.dead || Math.hypot(e.x - tw.x, e.y - tw.y) > def.auraRange) continue;
            any = true;
            const before = e.hp;
            damageEnemySilent(e, def.auraDps * tw.mult * lvM * def.tollEvery * cons);
            e.slowT = Math.max(e.slowT, 0.4); e.slowF = Math.max(e.slowF, def.slow);
            if (hasSyn("resonance")) damageEnemySilent(e, 4);
            if (e.dead && before > 0) { /* died by toll */ }
          }
          if (any && waveActive) { SFX.toll(); tw.tollAnim = 1; }
          tw.cd = def.tollEvery / (Math.pow(G.PACK.towerLevelMult, tw.level - 1)) * (hasSyn("resonance") ? 0.75 : 1);
        }
        continue;
      }
      const range = def.range;
      let tgt = null, bd = 1e9;
      for (const e of enemies) {
        if (e.dead || (e.type === "wraith" && e.flickerT % 2.6 > 1.9)) continue;
        const d = Math.hypot(e.x - tw.x, e.y - tw.y);
        if (d < range && d < bd && !e.hiddenNow && !losBlocked(tw.x, tw.y, e.x, e.y)) { bd = d; tgt = e; }
      }
      if (tgt && tw.cd <= 0) {
        tw.cd = 1 / towerFireRate(tw, def); tw.recoil = 1; tw.faceA = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
        const dmg = def.dmg * tw.mult * lvM * cons;
        if (tw.type === "pyre") fireBolt(tw, tgt, dmg, { kind: "ember", speed: 460, zoneDps: def.burnDps * tw.mult * lvM * cons });
        else if (tw.type === "gallows") fireBolt(tw, tgt, dmg, { kind: "spike", speed: 760, mark: true, homing: true });
        else if (tw.type === "frost") fireBolt(tw, tgt, dmg, { kind: "frost", speed: 560, chillSlow: def.chillSlow, chillSecs: def.chillSecs });
        else fireBolt(tw, tgt, dmg, { kind: "spike", speed: 700 });
      }
    }
    // --- player fire (the circle feeds the knight too) ---
    player.fireCd -= dt;
    if (waveActive && player.fireCd <= 0) {
      let tgt = null, bd = 1e9;
      for (const e of enemies) { if (e.dead || e.hiddenNow || (e.type === "wraith" && e.flickerT % 2.6 > 1.9)) continue; const d = Math.hypot(e.x - player.x, e.y - player.y); if (d < bd) { bd = d; tgt = e; } }
      if (tgt) {
        const rateMult = (inCircle(player.x, player.y) ? 1.15 : 1);
        player.fireCd = 1 / (player.rate * rateMult);
        const missing = 1 - player.hp / player.maxHp;
        const dmgBase = player.dmg * (player.wrathWave ? 1.25 : 1) * (1 + player.brandPct * missing * 100) * (inCircle(player.x, player.y) ? 1.2 : 1); // the circle feeds the knight too
        for (let i = 0; i < player.proj; i++) {
          const crit = Math.random() < player.critC;
          const dmg = dmgBase * (crit ? player.critM : 1) * (player.proj > 1 ? 1 : 1);
          const spread = (i - (player.proj - 1) / 2) * 0.09;
          const a = Math.atan2(tgt.y - player.y, tgt.x - player.x) + spread;
          bolts.push({ x: player.x, y: player.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, dmg, crit, pierce: player.pierce, hits: new Set(), kind: "bolt", playerBolt: true, chillSlow: player.chillSlow, chillSecs: player.chillSecs });
        }
        SFX.shoot();
      }
    }
    // --- bolts ---
    for (const b of bolts) {
      if (b.homing && !b.homing.dead) { const a = Math.atan2(b.homing.y - b.y, b.homing.x - b.x), sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (pillarHit(b.x, b.y)) { b.dead = true; burst(b.x, b.y, "#8a7f6a", 3); continue; }
      for (const e of enemies) {
        if (e.dead || b.hits.has(e) || (e.type === "wraith" && e.flickerT % 2.6 > 1.9)) continue;
        if (!e.hiddenNow && Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) {
          b.hits.add(e);
          damageEnemy(e, b.dmg, b.crit);
          if (!b.crit) SFX.hit();
          if (b.chillSecs) { const wasBurning = e.burnT > 0; e.slowT = Math.max(e.slowT, b.chillSecs); e.slowF = Math.max(e.slowF, b.chillSlow); e.chillT = Math.max(e.chillT, b.chillSecs); if (wasBurning) maybeShock(e, b.dmg); }
          if (b.mark) e.markT = G.TOWERS.gallows.markSecs;
          if (b.kind === "ember" && !b.zoned) { b.zoned = true; zones.push({ x: e.x, y: e.y, r: G.TOWERS.pyre.burnRadius, dps: b.zoneDps, ttl: G.TOWERS.pyre.burnSecs }); }
          if (b.playerBolt) {
            player.hitCount++;
            if (hasSyn("kindled")) { e.burnT = Math.max(e.burnT, 1.2); e.burnDps = Math.max(e.burnDps, 5); if (e.chillT > 0) maybeShock(e, b.dmg); }
            if (player.stormEvery && player.hitCount % player.stormEvery === 0) chainZap(b, e, b.dmg);
            if (b.kind === "bolt" && e.dead && Math.random() < 0.3) { /* ash handled at death */ }
          }
          if (b.pierce > 0) b.pierce--; else { b.dead = true; }
          break;
        }
      }
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true;
    }
    bolts = bolts.filter(b => !b.dead);
    // boss specials
    for (const e of enemies) {
      if (!e.boss || e.dead) continue;
      if (e.type === "abbot") {
        e.tollCd -= dt;
        if (e.tollCd <= 0) {
          e.tollCd = 6; SFX.toll(); shake = Math.max(shake, 3);
          for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 6, dmg: 10 }); }
        }
      } else if (e.type === "vesper") {
        e.tollCd -= dt; e.summonCd -= dt;
        if (e.tollCd <= 0) {
          e.tollCd = 5.2; SFX.toll(); shake = Math.max(shake, 4);
          for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283 + Math.random() * 0.2; ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 6, dmg: 12 }); }
        }
        if (e.summonCd <= 0 && enemies.length < 60) { e.summonCd = 7; for (let k = 0; k < 3; k++) { const w = spawnEnemy("wraith"); w.x = e.x + (Math.random() * 90 - 45); w.y = e.y + (Math.random() * 90 - 45); } }
      }
    }
    for (const b of ebolts) { b.x += b.vx * dt; b.y += b.vy * dt; if (pillarHit(b.x, b.y)) { b.dead = true; continue; } if (Math.hypot(player.x - b.x, player.y - b.y) < player.r + b.r) { b.dead = true; hurtPlayer(b.dmg, null); } if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) b.dead = true; }
    ebolts = ebolts.filter(b => !b.dead);
    // --- enemies ---
    for (const e of enemies) {
      if (e.flash > 0) e.flash -= dt;
      if (e.markT > 0) e.markT -= dt;
      if (e.chillT > 0) e.chillT -= dt;
      if (e.shockCd > 0) e.shockCd -= dt;
      e.flickerT += dt;
      if (e.type === "brute" && !e.enraged && e.hp < e.maxHp * 0.3) { e.enraged = true; floatText(e.x, e.y - e.r - 10, "ENRAGED", "#ff5d2e"); }
      if (e.burnT > 0) { e.burnT -= dt; e.burnAcc = (e.burnAcc || 0) + e.burnDps * dt; if (e.burnAcc >= 1) { const d = Math.floor(e.burnAcc); e.burnAcc -= d; damageEnemySilent(e, d); } if (e.dead) continue; }
      let sp = e.speed * (e.enraged ? 1.45 : 1) * (1 + 0.04 * deepenStacks);
      if (e.type === "wraith") {
        e.lungeCd -= dt;
        if (e.lungeT > 0) { e.lungeT -= dt; sp *= 1.9; }
        else if (e.lungeCd <= 0 && Math.hypot(player.x - e.x, player.y - e.y) < 135) { e.lungeT = 0.6; e.lungeCd = 3.2; }
      }
      if (e.type === "brute") {
        e.chargeCd -= dt;
        if (e.windT > 0) { e.windT -= dt; sp *= 0.3; if (e.windT <= 0) { e.chargeT = 0.8; e.chargeCd = 5; } }
        else if (e.chargeT > 0) { e.chargeT -= dt; sp *= 2.2; }
        else if (e.chargeCd <= 0) { const dd = Math.hypot(player.x - e.x, player.y - e.y); if (dd > 170 && dd < 330) e.windT = 0.4; else e.chargeCd = 0.5; }
      }
      if (e.slowT > 0) { e.slowT -= dt; sp *= (1 - e.slowF); if (e.slowT <= 0) e.slowF = 0; }
      for (const c of enemies) if (!c.dead && c.type === "cultist" && c !== e && Math.hypot(c.x - e.x, c.y - e.y) < 95) { sp *= 1.12; break; }
      // braziers burn what wanders close
      for (const bz of WORLD.braziers) if (Math.hypot(e.x - bz.x, e.y - bz.y) < WORLD.brazierR) { e.burnT = Math.max(e.burnT, 0.4); e.burnDps = Math.max(e.burnDps, WORLD.brazierDps * (tonightTithe === "braziers" ? 2 : 1)); break; }
      // GRAVE-FOG: hidden inside it; bursting out of it is an ambush
      const fogNow = inFogAt(e.x, e.y);
      if (fogNow) e.inFog = true;
      else if (e.inFog) { e.inFog = false; e.ambushT = 1.0; }
      e.hiddenNow = fogNow;
      if (e.ambushT > 0) { e.ambushT -= dt; sp *= 1.35; }
      let mx, my;
      if (e.type === "wraith") {
        const a = Math.atan2(player.y + player.vy * 0.22 - e.y, player.x + player.vx * 0.22 - e.x);
        mx = Math.cos(a) * sp; my = Math.sin(a) * sp;
      } else {
        // FLOW-FIELD: the dead pour through the cathedral's lanes toward the knight,
        // and chew through whatever the knight puts in their way.
        const [ec, er] = tileOf(e.x, e.y);
        const curD = flow[tIdx(ec, er)];
        let bd = curD, bx = null, by = null;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dc && !dr) continue;
          const nc = ec + dc, nr = er + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || moveBlocked(nc, nr)) continue;
          const d = flow[tIdx(nc, nr)] + ((dc && dr) ? 0.4 : 0);
          if (d < bd) { bd = d; const [cx2, cy2] = tileCenter(nc, nr); bx = cx2; by = cy2; }
        }
        const dp = Math.hypot(player.x - e.x, player.y - e.y);
        let tx, ty;
        if (dp < 210 && !losBlocked(e.x, e.y, player.x, player.y)) { tx = player.x + player.vx * 0.22; ty = player.y + player.vy * 0.22; }
        else if (bx !== null) { tx = bx; ty = by; }
        else { tx = player.x; ty = player.y; }
        const aa = Math.atan2(ty - e.y, tx - e.x);
        mx = Math.cos(aa) * sp; my = Math.sin(aa) * sp;
        if (e.type === "cultist" && dp < 205 && dp > 40 && !losBlocked(e.x, e.y, player.x, player.y)) { mx *= 0.08; my *= 0.08; } // hold and chant
        e.atkBlkCd = (e.atkBlkCd || 0) - dt;
        if (bx === null || bd >= curD) {
          let blk = null;
          for (let dr = -1; dr <= 1 && !blk; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nc = ec + dc, nr = er + dr;
            if (charAt(nc, nr) === 'r' || barrierAt(nc, nr)) {
              const [cx2, cy2] = tileCenter(nc, nr);
              if (Math.hypot(cx2 - e.x, cy2 - e.y) < TILE * 1.4) { blk = [nc, nr]; break; }
            }
          }
          if (blk) {
            mx *= 0.12; my *= 0.12;
            if (e.atkBlkCd <= 0) { e.atkBlkCd = 0.8; e.atkPop = 0.22; damageBlocker(blk[0], blk[1], e.dmg * (e.type === "brute" ? 2.5 : 1)); }
          }
        }
      }
      for (const o of enemies) { if (o === e || o.dead) continue; const d = Math.hypot(o.x - e.x, o.y - e.y), rr = e.r + o.r; if (d > 0.01 && d < rr) { mx -= (o.x - e.x) / d * (rr - d) * 3.2; my -= (o.y - e.y) / d * (rr - d) * 3.2; } }
      e.vx = dt > 0 ? mx : 0; e.vy = dt > 0 ? my : 0;
      e.x += mx * dt; e.y += my * dt;
      if (e.type !== "wraith") collideTiles(e, false);
      e.animT += dt * (2.2 + Math.hypot(mx, my) / 26);
      if (e.atkPop > 0) e.atkPop -= dt;
      e.hitCd -= dt;
      if (Math.hypot(player.x - e.x, player.y - e.y) < e.r + player.r && e.hitCd <= 0) { e.hitCd = 0.85; e.atkPop = 0.22; const amb = e.ambushT > 0; hurtPlayer(e.dmg * (1 + 0.03 * deepenStacks) * (amb ? 1.5 : 1), e); if (amb) { e.ambushT = 0; floatText(player.x, player.y - 40, "AMBUSHED FROM THE FOG", "#c9d4e8"); } }
    }
    enemies = enemies.filter(e => !e.dead);
    // --- cultist fire: bolts for the knight, unless the fog hides him ---
    if (waveActive) for (const e of enemies) {
      if (e.type !== "cultist" || e.dead) continue;
      e.fireT = (e.fireT == null ? 1 + Math.random() : e.fireT) - dt;
      const dp = Math.hypot(player.x - e.x, player.y - e.y);
      if (e.fireT <= 0 && dp < 235 && !losBlocked(e.x, e.y, player.x, player.y) && !inFogAt(player.x, player.y)) {
        e.fireT = 2.3;
        const a = Math.atan2(player.y - e.y, player.x - e.x);
        ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 245, vy: Math.sin(a) * 245, r: 6, dmg: e.dmg });
        burst(e.x, e.y - 10, "#b48be0", 3);
      }
    }
    // --- shards (Sanguine Font drinks them) ---
    const fontSyn = hasSyn("font-chalice");
    for (const s of shards) {
      s.t += dt * 3; s.age = (s.age || 0) + dt;
      if (s.age > 25) { s.got = true; parts.push({ x: s.x, y: s.y, vx: 0, vy: -14, life: 0.5, t: 0, color: "#5a5348", size: 2 }); continue; }
      const dP = Math.hypot(player.x - s.x, player.y - s.y);
      let target = null;
      if (fontSyn) for (const f of towers) if (f.type === "font" && Math.hypot(f.x - s.x, f.y - s.y) < G.TOWERS.font.auraRange) { target = f; break; }
      if (target) { const d = Math.hypot(target.x - s.x, target.y - s.y); if (d < 16) { s.got = true; heal(0.35); continue; } s.x += (target.x - s.x) / d * 260 * dt; s.y += (target.y - s.y) / d * 260 * dt; }
      else if (dP < player.collectR) { const pull = 430; s.x += (player.x - s.x) / (dP || 1) * pull * dt; s.y += (player.y - s.y) / (dP || 1) * pull * dt; if (dP < player.r + 8) { s.got = true; ashes++; SFX.ash(); updatePackButton(); } }
    }
    shards = shards.filter(s => !s.got);
    // --- burn zones ---
    if (waveActive) for (const e of enemies) if (!e.dead) for (const z of zones) {
      if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) { const wasChilled = e.chillT > 0; e.burnT = Math.max(e.burnT, 0.35); e.burnDps = Math.max(e.burnDps, z.dps); if (wasChilled) maybeShock(e, z.dps); break; }
    }
    for (const z of zones) z.ttl -= dt; zones = zones.filter(z => z.ttl > 0);
    // pyre embers leave zones on kill handled below via bolt hits:
    for (const b of []) {}
    if (waveActive && !spawnQueue.length && !enemies.length && state === "wave") endWave();
    updateHUD();
  }

  // ---------- rendering ----------
  function drawSprite(img, x, y, s, alpha) { drawSpr(img, x, y, s, { alpha }); }
  function drawSpr(img, x, y, s, o) {
    o = o || {};
    if (!img || !img.complete || !img.naturalWidth) { ctx.fillStyle = "#554"; ctx.fillRect(x - s / 2, y - s / 2, s, s); return; }
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx || 1, o.sy || 1);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
  function shadow(x, y, r) { ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.36, 0, 0, 6.283); ctx.fill(); }
  function loop(ts) {
    requestAnimationFrame(loop);
    const rawDt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
    if (paused || state === "title" || state === "pack" || state === "win" || state === "over") { render(); return; }
    let dt = rawDt;
    if (hitStop > 0) { hitStop -= rawDt; dt = 0; }
    update(dt); render();
  }
  function render() {
    ctx.save();
    if (shake > 0) { ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake); shake *= 0.88; if (shake < 0.4) shake = 0; }
    ctx.drawImage(IMG.arena, 0, 0, W, H);
    // THE FLOOR ITSELF: walls, rubble, grave-fog
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const ch = grid[r] ? grid[r][c] : '.';
      if (ch === '#') { shadow(c * TILE + 18, r * TILE + 32, 20); ctx.drawImage(IMG.wall, c * TILE - 2, r * TILE - 2, TILE + 4, TILE + 4); }
      else if (ch === 'r') { shadow(c * TILE + 18, r * TILE + 30, 19); drawSpr(IMG.rubble, c * TILE + 18, r * TILE + 18, TILE * 1.3, {}); const hpF = (rubbleHp[c + "," + r] || G.TERRAIN.rubbleHp) / G.TERRAIN.rubbleHp; if (hpF < 1) { ctx.fillStyle = `rgba(0,0,0,${(1 - hpF) * 0.45})`; ctx.fillRect(c * TILE + 3, r * TILE + 3, TILE - 6, TILE - 6); } }
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!grid[r] || grid[r][c] !== 'f') continue;
      const x = c * TILE + 18, y = r * TILE + 18, ph = Math.sin(performance.now() / 1400 + c * 1.7 + r * 2.3) * 0.5 + 0.5;
      const gr = ctx.createRadialGradient(x, y, 2, x, y, TILE * 0.85);
      gr.addColorStop(0, `rgba(168,180,198,${0.16 + ph * 0.07})`); gr.addColorStop(1, "rgba(168,180,198,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, TILE * 0.85, 0, 6.283); ctx.fill();
    }
    for (const em of embers) { const tw2 = 0.35 + Math.sin(performance.now() / 300 + em.ph) * 0.2; ctx.fillStyle = `rgba(255,150,60,${tw2})`; ctx.fillRect(em.x - 1.2, em.y - 1.2, 2.4, 2.4); }
    if (state === "wave") for (const bz of WORLD.braziers) {
      const hot = enemies.some(e => Math.hypot(e.x - bz.x, e.y - bz.y) < WORLD.brazierR + 6);
      const gr = ctx.createRadialGradient(bz.x, bz.y, 4, bz.x, bz.y, WORLD.brazierR);
      gr.addColorStop(0, hot ? "rgba(255,120,30,0.34)" : "rgba(255,120,30,0.10)");
      gr.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bz.x, bz.y, WORLD.brazierR, 0, 6.283); ctx.fill();
      if (hot) { ctx.strokeStyle = `rgba(255,150,60,${0.35 + Math.sin(performance.now() / 130) * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bz.x, bz.y, WORLD.brazierR - 3, 0, 6.283); ctx.stroke(); }
    }
    // blood remembers
    for (const d of decals) { ctx.fillStyle = `rgba(120,10,16,${d.a})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.62, 0, 0, 6.283); ctx.fill(); }
    // ritual circle glow (stronger when the knight stands in it)
    const cActive = inCircle(player.x, player.y);
    ctx.strokeStyle = `rgba(255,60,60,${cActive ? 0.5 : 0.22})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(WORLD.circle.x, WORLD.circle.y, WORLD.circle.r, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = `rgba(255,217,74,${cActive ? 0.35 : 0.10})`; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(WORLD.circle.x, WORLD.circle.y, WORLD.circle.r - 8, performance.now() / 2400, performance.now() / 2400 + 4.4); ctx.stroke();
    // braziers flicker
    for (const bz of WORLD.braziers) {
      const f = 0.75 + Math.sin(performance.now() / 90 + bz.x) * 0.25;
      const gr = ctx.createRadialGradient(bz.x, bz.y, 2, bz.x, bz.y, WORLD.brazierR);
      gr.addColorStop(0, `rgba(255,122,38,${0.20 * f})`); gr.addColorStop(1, "rgba(255,122,38,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bz.x, bz.y, WORLD.brazierR, 0, 6.283); ctx.fill();
    }
    // burn zones
    for (const z of zones) {
      const fl = 0.8 + Math.sin(performance.now() / 70 + z.x) * 0.2;
      ctx.fillStyle = `rgba(255,110,30,${0.22 * fl})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = `rgba(255,190,60,${0.16 * fl})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.55, 0, 6.283); ctx.fill();
    }
    // ember storm warning
    if (strikeWarn) {
      ctx.strokeStyle = `rgba(255,122,38,${0.5 + strikeWarn.t})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(strikeWarn.x, strikeWarn.y, 58, 0, 6.283); ctx.stroke();
      ctx.fillStyle = `rgba(255,122,38,${0.12 + (0.85 - strikeWarn.t) * 0.25})`; ctx.beginPath(); ctx.arc(strikeWarn.x, strikeWarn.y, 58, 0, 6.283); ctx.fill();
    }
    // shards
    for (const s of shards) {
      const p = 2.6 + Math.sin(s.t) * 0.8;
      ctx.fillStyle = "#ff7a26"; ctx.shadowColor = "#ff7a26"; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(s.x, s.y, p, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    }
    // towers
    for (const b of barriers) {
      shadow(b.c * TILE + 18, b.r * TILE + 32, 20);
      drawSpr(IMG.barricade, b.c * TILE + 18, b.r * TILE + 18, TILE * 1.35, {});
      const f = b.hp / b.max;
      if (f < 1) {
        ctx.fillStyle = "rgba(6,5,8,0.7)"; ctx.fillRect(b.c * TILE + 4, b.r * TILE + TILE - 7, TILE - 8, 4);
        ctx.fillStyle = f > 0.4 ? "#a98a54" : "#d7263d"; ctx.fillRect(b.c * TILE + 4, b.r * TILE + TILE - 7, (TILE - 8) * f, 4);
      }
    }
    for (const tw of towers) {
      const c = CARDMAP[tw.type], def = G.TOWERS[tw.type];
      if (tw.type === "bell") { ctx.fillStyle = "rgba(160,170,220,0.13)"; ctx.beginPath(); ctx.arc(tw.x, tw.y, def.auraRange, 0, 6.283); ctx.fill(); ctx.strokeStyle = "rgba(160,170,220,0.30)"; ctx.stroke(); }
      if (tw.type === "font") { ctx.fillStyle = "rgba(215,38,61,0.12)"; ctx.beginPath(); ctx.arc(tw.x, tw.y, def.auraRange, 0, 6.283); ctx.fill(); ctx.strokeStyle = "rgba(215,38,61,0.30)"; ctx.stroke(); }
      if (inCircle(tw.x, tw.y)) { ctx.strokeStyle = "rgba(255,217,74,0.55)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tw.x, tw.y, 30, 0, 6.283); ctx.stroke(); }
      if (tw.recoil > 0) tw.recoil = Math.max(0, tw.recoil - 0.09);
      const rec = (tw.recoil || 0) * 3.2, rx = tw.x - Math.cos(tw.faceA || 0) * rec, ry = tw.y - Math.sin(tw.faceA || 0) * rec;
      const swing = tw.type === "bell" ? Math.sin(performance.now() / 340 + tw.x) * 0.05 + (tw.tollAnim > 0 ? Math.sin(tw.tollAnim * 9) * 0.13 * tw.tollAnim : 0) : 0;
      const fl = tw.type === "pyre" ? 1 + Math.sin(performance.now() / 90 + tw.y) * 0.045 : 1;
      shadow(tw.x, tw.y + 17, 24);
      drawSpr(IMG["spr_" + tw.type], rx, ry, 62, { rot: swing, sx: fl, sy: 2 - fl > 0 ? 1 / fl : 1 });
      ctx.fillStyle = "rgba(6,5,8,0.75)"; ctx.fillRect(tw.x - 22, tw.y + 30, 44, 13);
      ctx.fillStyle = "#ffd94a"; ctx.font = "bold 9.5px system-ui"; ctx.textAlign = "center";
      ctx.fillText(tw.level > 1 ? "LV " + tw.level : c.name.split(" ")[0].toUpperCase(), tw.x, tw.y + 40);
      if (tw.tollAnim > 0) { tw.tollAnim -= 0.04; ctx.strokeStyle = `rgba(190,200,240,${tw.tollAnim * 0.5})`; ctx.beginPath(); ctx.arc(tw.x, tw.y, def.auraRange * (1 - tw.tollAnim * 0.4), 0, 6.283); ctx.stroke(); }
    }
    // placement preview
    if (state === "build" && (selectedHand || moveTower) && mouse.inside) {
      const type = selectedHand || moveTower.type, def = G.TOWERS[type], rng = def.range || def.auraRange;
      const blockedSpot = !placementOK(mouse.x, mouse.y);
      ctx.fillStyle = blockedSpot ? "rgba(215,38,61,0.14)" : "rgba(255,255,255,0.10)";
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, rng, 0, 6.283); ctx.fill();
      if (inCircle(mouse.x, mouse.y)) { ctx.fillStyle = "rgba(255,217,74,0.8)"; ctx.font = "bold 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("CONSECRATED +45% DMG", mouse.x, mouse.y + 56); }
      if (losBlocked(mouse.x, mouse.y, W / 2, H / 2)) { ctx.fillStyle = "rgba(255,120,120,0.85)"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("WALLS BLIND THIS SPOT", mouse.x, mouse.y - 48); }
      drawSprite(IMG["spr_" + type], mouse.x, mouse.y, 62, blockedSpot ? 0.35 : 0.65);
    }
    if (state === "build" && placingBarrier && mouse.inside) {
      const [c, r] = tileOf(mouse.x, mouse.y);
      ctx.fillStyle = charAt(c, r) === '#' || charAt(c, r) === 'r' || barrierAt(c, r) ? "rgba(215,38,61,0.35)" : "rgba(169,138,84,0.35)";
      ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
      drawSprite(IMG.barricade, c * TILE + 18, r * TILE + 18, TILE * 1.35, 0.6);
    }
    // the fallen: bodies topple, sink, and become the blood decals below them
    for (const c of corpses) {
      const rot = c.dir * Math.min(1, c.t / 0.45) * 1.45;
      const sink = c.t > 1.6 ? (c.t - 1.6) * 8 : 0;
      const al = c.t < 1.7 ? 0.97 : Math.max(0, 0.97 - (c.t - 1.7) * 1.1);
      shadow(c.x, c.y + c.s * 0.42, c.s * 0.5);
      drawSpr(c.img, c.x, c.y + sink, c.s * 1.5, { rot, alpha: al });
    }
    // enemies
    for (const e of enemies) {
      const ph = e.animT * 2.1;
      const bob = e.type === "wraith" ? Math.sin(ph * 0.9) * 8 : Math.abs(Math.sin(ph)) * -7;
      const squash = 1 + Math.sin(ph) * (e.type === "brute" ? 0.10 : 0.085);
      const tilt = Math.max(-0.26, Math.min(0.26, (e.vx || 0) * 0.0006 + Math.sin(ph) * 0.11));
      let sc = e.r * 3.4, sy = squash, sx = 2 - squash > 0 ? 1 / squash : 1;
      if (e.windT > 0) { sy *= 0.88; sx *= 1.1; }
      if (e.atkPop > 0) { const p = 1 + e.atkPop * 0.9; sx *= p; sy *= p; }
      const flick = e.type === "wraith" && e.flickerT % 2.6 > 1.9;
      if (e.hiddenNow) {
        ctx.fillStyle = "rgba(255,70,50,0.95)";
        ctx.beginPath(); ctx.arc(e.x - 5, e.y - 2, 2.1, 0, 6.283); ctx.arc(e.x + 5, e.y - 2, 2.1, 0, 6.283); ctx.fill();
        continue;
      }
      shadow(e.x, e.y + e.r * 1.15, e.r * 1.05);
      drawSpr(e.img, e.x, e.y + bob, sc, { rot: tilt, sx, sy, alpha: flick ? 0.25 : 0.98 });
      if (e.flash > 0) { ctx.fillStyle = `rgba(255,240,220,${e.flash * 5})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.283); ctx.fill(); }
      if (e.elite) { ctx.strokeStyle = "#ffd94a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5 + Math.sin(performance.now() / 200) * 1.5, 0, 6.283); ctx.stroke(); }
      if (e.enraged) { ctx.strokeStyle = "rgba(255,60,30,0.8)"; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, 6.283); ctx.stroke(); }
      if (e.markT > 0) { ctx.fillStyle = "#ffd94a"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.fillText("✛", e.x, e.y - e.r - 14); }
      if (e.chillT > 0) { ctx.fillStyle = "rgba(160,220,255,0.85)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText("❄", e.x + e.r, e.y - e.r); }
      if (e.burnT > 0) { ctx.fillStyle = "rgba(255,140,40,0.9)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText("🔥", e.x - e.r, e.y - e.r); }
      if (e.hp < e.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 4);
        ctx.fillStyle = e.boss ? "#d7263d" : "#c93b2e"; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    // player
    if (state !== "over") {
      if (player.shieldReady) { ctx.strokeStyle = "rgba(170,200,255,0.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 30 + Math.sin(performance.now() / 300) * 2, 0, 6.283); ctx.stroke(); }
      if (player.dashT > 0) { ctx.strokeStyle = "rgba(215,38,61,0.7)"; ctx.beginPath(); ctx.arc(player.x, player.y, 26, 0, 6.283); ctx.stroke(); }
      const moving = Math.hypot(player.vx, player.vy) > 20;
      const bobY = moving ? Math.abs(Math.sin(player.walkPh)) * -3 : Math.sin(performance.now() / 600) * 0.8;
      const lean = Math.max(-0.12, Math.min(0.12, player.vx * 0.0004));
      let psx = 1, psy = 1;
      if (player.dashT > 0) { const along = Math.abs(player.dashDx) >= Math.abs(player.dashDy); psx = along ? 1.22 : 0.86; psy = along ? 0.86 : 1.22; }
      shadow(player.x, player.y + 19, 22);
      drawSpr(IMG.hero, player.x, player.y + bobY, 62, { rot: lean, sx: psx, sy: psy, alpha: (player.invuln > 0 && state === "wave" ? 0.65 : 1) * (inFogAt(player.x, player.y) ? 0.62 : 1) });
      ctx.fillStyle = "rgba(6,5,8,0.7)"; ctx.fillRect(player.x - 20, player.y + 30, 40, 5);
      ctx.fillStyle = "#7dff9a"; ctx.fillRect(player.x - 20, player.y + 30, 40 * Math.max(0, player.hp / player.maxHp), 5);
    }
    // bolts
    for (const b of bolts) {
      ctx.strokeStyle = b.kind === "frost" ? "#a8dcff" : b.kind === "ember" ? "#ff9a3c" : b.kind === "spike" ? "#e8e2d4" : "#ffd9c9";
      ctx.lineWidth = b.kind === "spike" ? 3 : 2.4; ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, 6.283); ctx.fill();
    }
    for (const b of ebolts) { ctx.fillStyle = "#b9c6ff"; ctx.shadowColor = "#8fa2ff"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; }
    // lightning
    for (const z of zaps) {
      ctx.strokeStyle = `rgba(255,233,168,${1 - z.t / z.ttl})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(z.x1, z.y1);
      const mx = (z.x1 + z.x2) / 2 + (Math.random() * 18 - 9), my = (z.y1 + z.y2) / 2 + (Math.random() * 18 - 9);
      ctx.lineTo(mx, my); ctx.lineTo(z.x2, z.y2); ctx.stroke();
    }
    // particles & texts
    for (const p of parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const t of texts) { ctx.globalAlpha = 1 - t.t / 0.9; ctx.fillStyle = t.color; ctx.font = "bold 12.5px system-ui"; ctx.fillText(t.txt, t.x, t.y); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // full-arena dark vignette + damage flash
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (hitFlash > 0) { ctx.fillStyle = `rgba(215,38,61,${hitFlash * 0.30})`; ctx.fillRect(0, 0, W, H); }
    if (player.hp < player.maxHp * 0.30 && state === "wave") { const pulse = 0.10 + Math.sin(performance.now() / 240) * 0.05; ctx.fillStyle = `rgba(215,38,61,${pulse})`; ctx.fillRect(0, 0, W, H); }
  }
  // ---------- input ----------
  function canvasPos(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height, inside: true }; }
  cv.addEventListener("mousemove", ev => { mouse = canvasPos(ev); });
  cv.addEventListener("mouseleave", () => mouse.inside = false);
  function placementOK(x, y) {
    const [c, r] = tileOf(x, y);
    const ch = charAt(c, r);
    return ch !== '#' && ch !== 'r' && ch !== 'f' && !barrierAt(c, r);
  }
  cv.addEventListener("click", ev => {
    if (state !== "build") return;
    const p = canvasPos(ev);
    if (placingBarrier) {
      const [c, r] = tileOf(p.x, p.y), ch = charAt(c, r);
      if (ch === '#' || ch === 'r' || barrierAt(c, r)) { log("No barricade stands there."); return; }
      if (towers.some(t => { const [tc, tr] = tileOf(t.x, t.y); return tc === c && tr === r; })) { log("A tower holds that ground."); return; }
      if (barriers.length >= G.TERRAIN.barrierMax) { log("The floor holds no more barricades."); placingBarrier = false; updateBarrierButton(); return; }
      if (ashes < G.TERRAIN.barrierCost) { log("Barricades cost 15 ash."); placingBarrier = false; updateBarrierButton(); return; }
      ashes -= G.TERRAIN.barrierCost;
      barriers.push({ c, r, hp: G.TERRAIN.barrierHp, max: G.TERRAIN.barrierHp });
      SFX.place(); burst(c * TILE + 18, r * TILE + 18, "#a98a54", 10); buildFlow();
      log("Barricade raised. The dead must chew through it — or go around.");
      if (ashes < G.TERRAIN.barrierCost) placingBarrier = false;
      updateHUD(); updateBarrierButton(); return;
    }
    if (selectedHand) {
      if (!placementOK(p.x, p.y)) { log("Nothing stands on wall, rubble, fog or barricade. Choose open ground."); return; }
      if (towers.length >= G.PACK.maxFieldTowers) { log(`The floor holds only ${G.PACK.maxFieldTowers} towers.`); return; }
      const h = hand[selectedHand];
      const tw = { type: selectedHand, x: p.x, y: p.y, level: 1, mult: h.bestMult, cd: 0, tollAnim: 0, recoil: 0, faceA: 0 };
      towers.push(tw); placedCount[selectedHand] = placedCount[selectedHand] || []; placedCount[selectedHand].push(tw);
      h.count--; if (h.count <= 0) selectedHand = null;
      SFX.place(); burst(p.x, p.y, "#e8e2d4", 8); renderHand(); return;
    }
    const tw = towers.find(t => Math.hypot(t.x - p.x, t.y - p.y) < 32);
    if (tw) { moveTower = moveTower === tw ? null : tw; log(moveTower ? `${CARDMAP[tw.type].name} lifted — click its new ground (or double-click it to overcharge: 20 ash).` : "Set down."); }
    else if (moveTower) {
      if (!placementOK(p.x, p.y)) { log("Not onto wall, rubble, fog or barricade."); return; }
      moveTower.x = p.x; moveTower.y = p.y; SFX.place(); moveTower = null;
    }
  });
  cv.addEventListener("dblclick", ev => {
    if (state !== "build") return;
    const p = canvasPos(ev);
    const tw = towers.find(t => Math.hypot(t.x - p.x, t.y - p.y) < 32);
    if (!tw) return;
    if (tw.level >= G.PACK.towerLevelCap) { log("That tower is at its peak."); return; }
    if (ashes < 20) { log("Overcharge costs 20 ashes."); return; }
    ashes -= 20; tw.level++; SFX.toll(); burst(tw.x, tw.y, "#ffd94a", 20);
    log(`${CARDMAP[tw.type].name} overcharged to level ${tw.level}.`); updateHUD(); updatePackButton();
  });
  cv.addEventListener("touchstart", ev => { const t = ev.touches[0]; touchTarget = canvasPos(t); }, { passive: true });
  cv.addEventListener("touchmove", ev => { const t = ev.touches[0]; touchTarget = canvasPos(t); }, { passive: true });
  cv.addEventListener("touchend", () => touchTarget = null);
  $("btn-begin").addEventListener("click", () => { if (state === "build") beginWave(); });
  document.addEventListener("click", e => { const b = e.target.closest("button"); if (b) b.blur(); });
  // ---------- title / difficulty / restart ----------
  function selectDiff(key2) {
    diff = G.DIFFS[key2];
    $("diff-vigil").classList.toggle("diff-on", key2 === "vigil");
    $("diff-torment").classList.toggle("diff-on", key2 === "torment");
  }
  $("diff-vigil").addEventListener("click", () => selectDiff("vigil"));
  $("diff-torment").addEventListener("click", () => selectDiff("torment"));
  function showBest() {
    $("best-line").textContent = best.nights ? `Best vigil: ${best.nights} nights · ${best.kills} slain · ${best.wins} dawn(s)` : "No vigil survived yet. The pack provides.";
  }
  $("btn-start").addEventListener("click", () => {
    ac(); reset(); state = "build";
    $("title-screen").classList.add("hidden");
    setMusic(true);
    $("phase-title").textContent = "The Vigil Begins";
    log("Night approaches. Open your free pack, then begin.");
    updatePackButton();
  });
  $("btn-again").addEventListener("click", () => {
    $("end-screen").classList.add("hidden"); reset(); state = "build"; setMusic(true);
    $("phase-title").textContent = "The Vigil Begins";
    $("btn-begin").disabled = false; $("btn-begin").textContent = "Begin Night 1 ☾";
    log("Again. The pack provides."); updatePackButton();
  });
  reset(); showBest(); selectDiff("vigil"); state = "title";
  requestAnimationFrame(loop);
})();
