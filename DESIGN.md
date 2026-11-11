# GRIMPACK — design doc

**Name:** GRIMPACK
**Tagline:** *Crack the seal. Raise your towers. Survive the night.*
**Repo:** `mikkel/grimpack` (public)

## The pitch

A dark-gothic arena survival game where your build does not come from a skill
tree — it comes from **booster packs**. You are a lone grave-knight holding a
ruined cathedral floor against ten escalating nights of the dead. Between
waves you tear open wax-sealed packs and pull three cards: towers you place,
weapons that change how your knight auto-fires, relics that bend the rules,
and consumables that keep you alive. Bad pulls happen. The night does not care.

Fusion of three loops:
- **Booster packs** — the reward engine. Every wave cleared = one free pack.
  Kills drop Ashes; extra packs cost Ashes, and the price creeps up.
- **Tower defense** — pulled towers are placed on the arena during the build
  phase and fire on their own: Bone Spire (fast bolts), Grave Bell (slow +
  chip aura), Soul Pyre (burning ground), Frost Obelisk (chilling shots).
- **Survivors-like** — you move with WASD/arrows, your weapon auto-fires at
  the nearest horror, enemies swarm from the dark edges, XP-less: power comes
  from the packs, not from grinding levels.

## Structure of a run

1. **Title screen** — key art, how to play, Begin.
2. **Build phase** — arena visible, towers placeable/movable, pack shop open.
   First pack is free and already waiting. Press *Begin the Night* when ready.
3. **Wave phase** — spawns escalate; survive until the wave is spent and the
   last horror dies.
4. **Pack ceremony** — the pack rips, three cards flip one by one with rarity
   glow and a rising chime. Towers go to your hand (place next build phase),
   weapons/relics apply instantly and stack, consumables fire on pickup.
5. Repeat. **Wave 5: mini-boss (The Abbot). Wave 10: boss (Vesper, Mother of
   Bells).** Clear wave 10 = victory screen with run stats. Death = game over
   screen with run stats. Restart is one click.

## Rarity (loot colours, genre-standard)

| Tier | Colour | Weight | Power budget |
|---|---|---|---|
| Common | bone white | 52% | 1.0× |
| Magic | arcane blue | 30% | 1.5× |
| Rare | gold yellow | 12% | 2.3× |
| Epic | violet | 4.5% | 3.4× |
| Legendary | hellfire orange | 1.5% | 5.0× |

Every card exists at every tier; tier scales its numbers. A Legendary common
weapon can out-pull a Rare tower — packs stay exciting at every wave.

Pity rule: if two consecutive packs contain nothing Rare-or-better, the third
pack guarantees at least one Rare+ card. Nobody quits over dry packs.

## Card pool (18)

**Towers (placeable, max 6 on the field, duplicates upgrade in place +1 level)**
- Bone Spire — fast single-target bolts.
- Grave Bell — aura: slows the damned, tolls for chip damage.
- Soul Pyre — lobs embers that leave burning ground.
- Frost Obelisk — slow, heavy shots that chill.

**Weapons (stack onto the knight's auto-fire)**
- Hellfire Rounds — +damage.
- Twin Seal — +1 projectile (each extra copy adds one, damage per bolt falls slightly).
- Reaper's Cadence — +fire rate.
- Piercing Sigil — bolts pierce +1 enemy.
- Executioner's Mass — +crit chance / crit damage.

**Relics (passive, stack)**
- Gravewind Boots — +move speed.
- Sanguine Chalice — +max HP and a trickle of regen.
- Ashen Magnet — Ashes drift to you from farther away; +Ashes per kill chance.
- Widow's Ward — brief invulnerability shield that re-forms (long cooldown).

**Consumables (fire the moment they're pulled)**
- Blood Vial — heal 35% of max HP.
- Wrath Draught — +25% damage for the next wave only.
- Saint's Candle — revive token: if you would die next wave, instead return at 50% HP (once per candle).

## Enemies

- **Husk** — slow skeleton shambler, the bread and butter.
- **Cultist** — faster, frailer, comes in knots.
- **Wraith** — very fast, low HP, phases (brief flicker, harder to hit feel via speed).
- **Brute** — gargoyle slab of HP, slow, hits hard.
- **The Abbot** (wave 5 mini-boss) — big cultist, spawns husks.
- **Vesper, Mother of Bells** (wave 10 boss) — huge HP, bell tolls: radial bursts + wraith escorts.

Contact damage with a short per-enemy hit cooldown; no enemy projectiles
(keeps the survivors feel and the scope honest).

## Balance targets

- Full run: **12–16 minutes**. Wave durations 45–75 s.
- Wave HP budget grows ×1.32/wave (compounding), count grows +35%/wave,
  contact DPS pressure grows slowly via count, not per-hit damage.
- Player power: pack-per-wave ≈ +28–35% effective DPS per wave at median luck
  (sim-checked), so median luck stays ~5–10% ahead of the curve until wave 8,
  then tension comes from density and the boss, not a wall.
- Death should usually happen waves 6–9 on a first run; victory is earned by
  wave-10 with a decent tower line. Sim + hand-tuned in rounds 2–3.
- Ashes: ~1 per 3 kills base; extra pack price starts 40, ×1.35 per purchase.

## Tech

- `index.html` + `style.css` + `game.js`, HTML5 canvas, zero build step,
  zero dependencies. Generated art in `assets/` (PNG), drawn clipped into
  rings/tokens on canvas; card faces use the art full-bleed.
- Sound: tiny WebAudio synth (shots, tolls, pack rip, flip chime). No audio files.
- Runs from `file://`, any static server, and GitHub Pages.

## Asset plan (Nanoodle → NanoGPT, $5 hard cap)

One multi-branch graph per batch; model `meta/muse-image/text-to-image`
(~$0.011–0.02/image from prior runs; verify per-run from report.json).
Style lock for every prompt: *"dark gothic hand-painted game art, deep blacks,
bone white, dried-blood red and hellfire orange accents, dramatic rim light,
no text"*.

Batch A (actors): hero portrait, husk, cultist, wraith, brute, boss.
Batch B (place & placeables): arena floor (wide), booster pack, card back,
bone spire, grave bell, soul pyre, frost obelisk, title key art (wide).
Reserve ≈ $4.50 for re-rolls of anything unusable and a possible batch C
(relic icons) if A/B come in clean and cheap.

Every run logged in `assets/ASSETS.md` with model + cost; running total
checked against the $5 cap before each new batch.
