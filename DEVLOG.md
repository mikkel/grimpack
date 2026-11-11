# GRIMPACK — devlog

Built in one sitting by Nova (Muse) for Mikkel: design → Nanoodle asset
generation → v1 → simulator-driven balance rounds → polish.

## Round 0 — Design (DESIGN.md)

Fusion picked: **booster packs × tower defense × arena survivors**. The pack
is the reward engine, not a menu: every build decision arrives as a pull.
Rarity uses the genre-standard loot colours and scales card numbers
(×1 / 1.5 / 2.3 / 3.4 / 5). A pity rule (third dry pack guarantees Rare+)
was designed in from the start — dry-pack frustration is the genre's #1
quit point. Name: GRIMPACK. Tagline: *Crack the seal. Raise your towers.
Survive the night.*

## Round 1 — Assets (Nanoodle → NanoGPT, $0.286 of $5)

Three multi-branch graphs (one text→image branch per asset, style-locked
prompts), model `meta/muse-image/text-to-image` at $0.011/image:
batch A actors (6), batch B scenes/objects (8), batch C card icons (12).
**26/26 generations usable, zero re-rolls** — the style lock (deep blacks,
bone white, dried-blood red, hellfire orange, no text) held across every
batch. Originals were 1600²; shipped as resized JPEGs (1.7 MB total).
Manifest: `assets/ASSETS.md`.

## Round 2 — v1 build + simulator

First playable: full loop (title → build → pack ceremony → wave → … →
Abbot at 5, Vesper at 10, win/lose screens), tower placement/move, ash
economy, WebAudio synth SFX.

`tools/sim.js` Monte-Carlos the pack economy (rarity + kind rolls, card
effects, tower DPS with placement uptime, 0.62 targeting/kite inefficiency)
against each wave's total HP. **First sim run exposed a broken curve:**
waves 1–4 at 6–8× margin (sleepy), wave 9 a wall (0.83 median margin),
wave 10 impossible (0.24) — boss HP used the compounding wave scale
(×25 by night 10). Fixes:

- Bosses got their own gentle scale (×(1 + 0.10·(w−1))) and hand-set HP
  (Abbot 2,400, Vesper 8,500): a DPS check, not a sponge wall.
- Wave HP growth was compounding count ×1.30 **and** HP ×1.33 = ×1.73/wave —
  no pack economy outruns that. Retuned to count ×1.22, HP ×1.22 (≈×1.49/wave
  total), matched against measured pack-driven DPS growth (≈×1.25–1.35/wave
  once the ash economy's extra packs are counted — the sim originally didn't
  model extra-pack purchases, which are the intended late-game catch-up).

Final sim (600 runs): no walls anywhere; Night 5 Abbot is the first real
check (p25 margin 2.10 in the model's generous units — aura/pierce uptime
assumptions flatter the player); Night 10 is the tightest (p25 1.24, median
1.61) — winnable on median luck, with consumables and candles as slack.
Early nights sit at high margins by design: they're the power fantasy that
teaches movement while the build assembles.

## Round 3 — Feel & polish

- Spawning reworked from a metronome queue to **burst knots** (2–5 enemies
  at one edge point): swarms read as pressure, stragglers don't.
- Enemy separation steering so knots don't collapse into one sprite.
- Pack ceremony: cards auto-flip on a stagger if you just watch (no dead
  air), flip chime rises in pitch with rarity.
- Grave Bell aura ring + toll ripple, Widow's Ward ring on the player,
  burn-ground glow, hit flash, screen shake on boss death and player hurt,
  damage numbers (crits in gold), boss health bar, wave banners.
- A real-browser smoke test of the full loop (title → pack → place → wave)
  before shipping. *(result folded in here after the test)*

## Known limits (honest list)

- The simulator models the power curve, not contact pressure; fine difficulty
  still rests on enemy speed/density choices playtested by hand.
- No touch controls; keyboard + mouse required.
- Towers can't be sold or demolished — placement is a commitment, on purpose.
- Twin Seal's per-bolt penalty in-game (×0.92/pull) is slightly kinder than
  the sim's (0.88^(proj−1)); kept, it feels better and the finale stays tight.
