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
- Verified with two real-browser smoke-test passes on the live GitHub Pages
  build: title → vigil → pack (cards flipped, rarities correct, pity/stats
  text right) → collect → Grimmoire/Chronicle updated → tower chip →
  placement with range preview → Night 1 with movement, ash vacuum
  (0 → 5 ashes), 22/22 slain, "Night 1 Survived", next pack awarded.
  Zero console errors. The one soft spot — the Grave Bell's aura was hard
  to *see* working in still frames — got a visibility buff (brighter aura
  disc + toll ripple) in the final commit.

## Known limits (honest list)

- The simulator models the power curve, not contact pressure; fine difficulty
  still rests on enemy speed/density choices playtested by hand.
- No touch controls; keyboard + mouse required.
- Towers can't be sold or demolished — placement is a commitment, on purpose.
- Twin Seal's per-bolt penalty in-game (×0.92/pull) is slightly kinder than
  the sim's (0.88^(proj−1)); kept, it feels better and the finale stays tight.

## v2 — IMPACT pass (2026-11-10, expanded budget)
Mikkel: "nothing should feel lame, everything should have impact... backgrounds
and graphics should impact gameplay... high depth, unexpected interactions."
- The arena art is gameplay now: 8 pillars block bolts (placement preview warns
  "PILLARS BLIND THIS SPOT"), the ritual circle consecrates towers (+30% dmg)
  and quickens the knight (+15% fire rate inside), 4 corner braziers burn the
  dead, blood decals persist where things died.
- Night Omens (6): Blood Moon, Silent Night, Ember Storm, Thin Veil, Pack
  Rats, Still Air — rolled a night ahead so builds can plan around them.
- 6 synergies: Thermal Shock, Kindled Bolts, Resonance, Storm Twins, The
  Widow's Thorns, Sanguine Font — shown in the Grimmoire when live.
- Pack depth: per-card trade (25 ash reroll), 3rd pack in a vigil is FOIL
  (+1 rarity on everything), Gilded Seal fattens the next pack.
- Enemies scheme back: plague bearers explode (both directions — chain them),
  brutes wind up and CHARGE, wraiths flicker untargetable and LUNGE, cultists
  drum nearby dead faster, elites ("Anointed") spawn at 4% and die rich.
- Pressure systems: THE NIGHT DEEPENS every 20s (+4% speed/+3% bite per stack)
  kills the kite-forever exploit; from Night 4 the dead sometimes rise in a
  RING around you. Spawn windows compressed (×0.55, ×0.45 late), count growth
  1.22→1.27, sustain trimmed (font 1.6→1.3, chalice regen 0.35→0.25).
- New content: Gallows Tree + Blood Font towers, Plague Bearer, Abbot gets his
  own portrait, 5 new cards (Gravechill, Storm Sigil, Thornmail, Martyr's
  Brand, Gilded Seal) — 23 cards total. Dash (Space/Shift), Torment difficulty,
  best-vigil records, touch movement, hit-stop, kill-streak Rampage bonuses,
  and a generated dirge loop (Stable Audio 3, $0.024).
- Fixed a v2-rewrite bug found by the playsim: spawn pacing read a
  non-existent spec.interval (waves would have stalled after one knot) —
  now derived from waveSpec.duration. Level scaling unified on the canonical
  compounding ×1.45/level from sim.js; tower cap reads PACK.maxFieldTowers.
- Balance method v2: tools/playsim.js — a bot plays full spatial runs
  (kiting, dashing, real LoS placement, omens, synergies) vs the aggregate
  sim.js (kept as the pessimistic bound). Final: bot/mastered Vigil 100% wins
  but ~93 HP taken per run (max 683 — some runs are wars); bot Torment 86%,
  deaths clustered exactly at the Abbot (N5) and Vesper (N10) gates, winners
  ending at 86% HP. Human-first-run Vigil is the real difficulty; Torment is
  the sweat mode. Nanoodle total for the game: $0.420 of the $5 budget.

## v3 — the "it feels dead" pass (2026-11-10, Mikkel's playtest notes)
His five charges: no animation; black boxes on sprites; no choices; no
consequences; sit-in-center-and-win. Answers:
- Sprites alpha-keyed properly (edge flood-fill from the border, baked warm
  rim outline, slight lift) → assets/spr/*.webp; no more black tiles, and
  canvas contact shadows ground everything.
- Procedural animation everywhere: enemies bob/squash/tilt by gait, wraiths
  hover, brutes crouch before charging, attackers pop on hit, THE DEAD FALL
  (corpse topple → sink → blood decal), towers recoil and the bell swings,
  the knight bobs, leans, and stretches mid-dash; ambient embers drift.
- THE TITHE: every morning after Night 1 the cathedral demands a choice of
  three offerings (of 8) — every one a boon with a price (Bar the Doors trades
  tomorrow's free pack for a slower night; Blood the Circle pays 15 HP for a
  doubled consecration; Open the Crypts pays in elites…). Begin is gated:
  first click arms, so the choice is never skipped by accident. Skipping is
  allowed and is itself the neutral choice.
- Anti-camping: stand still 3.5s in a wave and grief ROOTS you (-45% fire
  rate, +25% damage taken) until you've moved 130px. Ash shards gutter out
  after 25s and the dawn vacuum now only recovers half — collection is a
  mid-wave verb again.
- Balance re-verified with playsim (bot takes no tithes, never roots): 96%
  bot wins, deaths at N10 — the new pressure is aimed at passive human play,
  which the bot never does.

## v3 verification notes (2026-11-10 late)
- The v3.1 verification round was polluted by the test browser's HTTP cache
  (it ran v3.0 code and reported v3.1 features missing). Fix shipped: core
  assets are cache-busted in index.html (?v=NN, bump per release).
- Corpse mystery, resolved by instrumentation: pushes == kills exactly and
  the corpse array aged correctly, yet screenshot review saw no bodies. A
  magenta-marker build proved positions/timing right; a 2.6x test build
  proved the rotated bodies render beautifully — at 1x (54px, dark on dark)
  they were simply below screenshot legibility. Shipped at 1.5x / 2.6s.
- Lesson: screenshot agents have limited acuity for small dark motion;
  verify mechanics with counters, verify look with scale, let the human
  judge motion in motion.

## v4 — Mikkel's second playtest (2026-11-10 late)
Five more notes, five answers:
- "Rooted is weird" — REMOVED entirely. Anti-camping is now diegetic: ring
  spawns rise around the player from Night 2 (was Night 4), and the deepening
  clock never stops. The map and the dead punish stillness, not a debuff.
- "The main character is transparent" — the v1 hero art was literally a
  watercolor ghost. New hero generated (+$0.011): a solid plate-armored
  knight, crimson cloak, glowing crossbow. Keying lesson: luminance flood-
  fill eats dark COLORED cloth (crimson shadow reads as black); the fix was
  keying on max-channel (true background is neutral AND near-zero).
- "Up/down scroll the page" — arrow keys + space now preventDefault.
- "Enemies aren't hard at first" — Night 1: 30 enemies (was 22) arriving in
  ~14s (was ~21s), cultists shooting from the first night, husks faster.
  Playsim: Vigil bot 98% → 90%, median damage taken 54 → 91 HP.
- "The map does nothing" — braziers: dps 11 → 16, radius 74 → 84, and they
  now visibly flare when the dead enter their light. The circle feeds the
  knight too (+20% damage inside it) and consecration rose 1.30 → 1.45 —
  placement and positioning are real decisions with visible numbers.
Total Nanoodle spend: $0.431 of $5.

## v5 — THE FLOOR IS THE GAME (2026-11-10 late)
Mikkel: "the map should really matter… impassible things, places enemies can
hide, pathfinding, placeable barriers… everything interconnects… and the
audio — use nano-gpt and make it good."
- The cathedral is now a 25x21 tile floor (balance.js MAP): 38 wall tiles
  (impassable, block bolts and sight), 6 rubble piles (impassable until
  smashed — bolts fly over), 32 grave-fog tiles.
- Enemies navigate by a BFS flow-field toward the knight, refreshed ~3x/s;
  when their way is blocked they chew through rubble and barricades (brutes
  are siege engines, 2.5x blocker damage). Wraiths ignore the floor entirely.
- GRAVE-FOG hides: towers and the knight's auto-fire cannot target anything
  inside it; cultists cannot see a knight standing in it; brazier light burns
  fog off nearby; anything bursting OUT of fog gets an ambush (speed +35%,
  first bite +50%). All you see of the hidden is two red eyes in the mist.
- BARRICADES: 15 ash, bought in build phase, placed on the floor (max 8).
  They block movement, bolts and sight; enemies path around or chew through
  (130 HP); the knight vaults his own at 55% speed. Plague-bearer explosions
  crack them (and clear rubble) — every system touches every other.
- Cultists finally shoot (they never actually did before v5 — the v4 release
  note claiming otherwise was wrong): they hold at range and fire bolts,
  unless the fog hides their target.
- AUDIO: all 14 sound effects are now real NanoGPT/Stable Audio generations
  (trimmed from 22s renders to their event windows), plus a new richer dirge.
  The WebAudio synth remains as a fallback understudy. v5 gen spend: $0.391.
Total Nanoodle spend: $0.822 of $5.

## v6 — PHYSICS (2026-11-10 late)
Mikkel: "physics should matter and be real… interactions, graphics, all tied
to behaviour." GRIMPACK now runs on momentum:
- Every body has mass (husk 1, brute 3.4, bosses 7-9). Steering proposes a
  desired velocity; velocity relaxes toward it at a mass-dependent grip —
  light things dart, heavy things lumber and cannot be turned.
- Bolts carry momentum: knockback scales with damage/mass; pierce shots lose
  velocity inside heavy bodies (a bolt stops in a brute). Gallows rounds
  launch husks. Fling anything into a wall at speed: SLAM damage + stagger.
  Bodies shove bodies — hard collisions stagger both (bowling).
- Brutes that charge into stone CRASH: stagger, self-damage, the blocker
  (rubble/barricade) takes 45. The knight is shoved by hits — a charging
  brute knocks him 470px/s — but consecrated ground anchors him (half
  knockback in the circle). Dashing shoulder-checks the dead aside.
- Corpses are bodies: they inherit the killing blow's momentum, slide with
  friction, spin, and smear blood along their slide. Plague explosions fling
  the living AND the dead — chain a bearer into a pack and the blast bowls it.
- Fixes from the v5 verification: fog is now properly visible (denser heart,
  drifting wisps, an upper veil); spawns can no longer land inside walls;
  embedded bodies eject cleanly; a stuck-failsafe unwedges stragglers;
  cultist bolts are unmistakably violet and their first shot comes sooner.

## v6.2 — the phantom-wall bug (found by verification, fixed same night)
Three verification runs reported "invisible stragglers": waves stalling for
minutes with enemies alive but nowhere on screen. Root cause: tile collision
treated out-of-grid tiles as walls (charAt returns '#' off-grid), so enemies
spawning 30px outside the arena were embedded in phantom wall tiles and the
new embedded-ejection kept pushing them OUT — hovering off-screen, immortal
and unreachable. Fix: collision skips off-grid tiles entirely, plus a hard
position clamp. Verified after the fix: Night 1 completes standing still in
19 seconds, spawns streaming from all four edges; Night 2 in 25 seconds.
Lesson: every "it stalls" report was real. The testers were right all along.

## v7 — THE CATHEDRAL PRESENTS ITSELF (presentation overhaul)
Mikkel: menu needs help; HUD key hints that appear then dissolve, wrong and
strange; point at open packs obviously; show what items DO and where they
land; music is a short loop. Also found while in there: the v5 tile grid
(36px, 900x756) never matched the actual 960x640 stage — the bottom three
rows lived below the canvas. The floor is rebuilt at 40px tiles, 24x16:
32 walls, 8 rubble, 28 fog, symmetric, fully connected, centered on the
real ritual circle (480,312).
- MENU: full-screen title — candle-flickering GRIMPACK wordmark over slow-
  zooming key art, floating pack, three plain how-to rows, rite cards.
- KEY HINTS: at Night 1 the arrow caps SLAM into the bottom-right with a
  dust burst, breathe, twitch wrong, grow a black drip — then fracture into
  sliding slices and ash. SPACE-DASH cap beneath. Gone by ~4.7s.
- PACK HAND: a skeletal hand (new art) creeps in from the panel edge and
  jabs at the pack button whenever a pack is openable; the button breathes;
  a label whispers "a pack waits. the dead insist."
- BOONS MADE VISIBLE: "The Knight, As Modified" — a live stats bar (DMG /
  RATE / BOLTS / CRIT / SPEED / MEND); on Collect, each card physically
  flies to where it applies (buffs -> stats bar, towers -> hand) and lands
  with the stat chip pulsing blood-red; in-arena, a beam of light hits the
  knight with floating text naming the exact effect ("Hellfire Rounds:
  +12 bolt damage").
- MUSIC: three generated tracks rotate by moment with crossfades — sparse
  bell-and-cello dread for title/build, the dirge for battle, drums-and-
  choir for boss nights. No more single 22s loop.
v7 spend $0.0587 (hand $0.011 + two music tracks $0.0477); cumulative
$0.881 of $5.

## v8 — THE RITUAL (Mikkel's playtest notes, screenshot in hand)
1. CIRCLE: the two rim-shrine walls inside the ritual circle are GONE —
   nothing impassable stands in the circle. And the circle now explains
   itself: step in and the rim flares gold, a halo rings the knight, a
   callout names it ("CONSECRATED — +45% DAMAGE · THE GROUND HOLDS YOU"),
   and the stats bar's ⛪ chip lights. (The omen preview also said +30%
   for a +45% effect — a stale lie, fixed.)
2. PANEL: THE TITHE IS DEAD. In its place, a DAWN REWARD: survive a
   night and the cathedral pays its debts — pick 1 of 3, all upside, no
   prices (heal, ash, a free pack, cheaper packs, blood liturgy...). The
   begin-blocking "offering" gate is gone; the panel reads top-down as a
   checklist now.
3. PACKS ARE A RITUAL, AND A THEFT: the sealed pack is huge and it
   BREATHES ("it breathes. tear the seal."). Tearing it shakes the foil
   apart; three cards rise in a fan and flip one by one; then the demand
   appears — CHOOSE ONE. THE REST BURN. Whispers start under the modal.
   Click your card: it flares gold and flies to where it applies; the
   other two ignite, char black, and crumble to embers. You walk away
   stronger and slightly worse. Packs grant ONE card now (the choice is
   the power: best of three, aimed at your build). The old 25-ash trade
   buttons are gone — choosing replaced them.

## v9 — ONE PANEL, NOTHING MOVES (Mikkel: "whats with the css. and it
keeps moving where things are up and down.")
He was right on both counts. The sidebar was eight versions of CSS in a
trenchcoat: the base theme (warm brown/gold) fighting a purple theme left
over from v3 (tithe options, stat chips), boxes inside boxes, and the
barricade button wearing NO styles at all — a raw white browser button.
And the jumping had a specific cause: the pack hand's whisper label sat
in normal flow with a 30px margin, so every time your ashes crossed the
pack price the whole panel breathed up and down by ~48px; stat chips
re-wrapped as their text changed; the reward box landed mid-panel at
dawn and shoved the Begin button away.
- ONE system: the aside is a single panel; sections are hairline-divided
  rows, no nested boxes; one button family (dark stone, gold hover);
  the purple is purged; the barricade button is dressed like the rest.
- NOTHING MOVES: the dawn reward is now a dock over the arena's lower
  edge (a presentation moment, not a landslide in the panel); the pack
  whisper is absolutely positioned in reserved space under the button;
  the stats are a fixed 3x2 grid with the consecration chip on its own
  permanent row; the tower shelf and phase text hold reserved heights.
  Values change. Layout doesn't.

## v9.1 — the pack itself was still wearing its black box (Mikkel's
screenshot). The booster-pack art is a product shot on pure black; it
showed as a black square in the button, the title, and the ritual modal.
Keyed like everything else — spr-pack.webp, transparent, flame intact.
And the skeletal hand: my v9 aside had overflow:hidden, which guillotined
the hand at the panel edge, and it hung too high (over the phase text).
Overflow released; the hand now sits at the button's mid-height with its
fingertip landing on the button's left edge, jabbing into it.
v9.2: the title-screen pack still showed a black slab — box-shadow paints
the element's rectangle, not the art's silhouette. On keyed art the
shadow must be filter: drop-shadow, which follows the alpha shape.
Applied to the title pack and the ritual modal's sealed pack.
v9.3: still a slab — the real culprit was in the IMAGE: the photo's glow
halo (dark pixels just above the keying threshold) survived as an opaque
dark ring hugging the pack; invisible on the dark button, obvious on the
title's mottled backdrop. Re-keyed with a soft alpha ramp: anything
edge-connected and dark fades out by darkness (0 at near-black, full at
the trim line), so the glow now melts into whatever is behind it.

## v10 — THE RIP (Mikkel: "turn it into an animated svg using a nanoodle
workflow... you should be able to actually rip open the pack and it
should feel hefty. like a weird foil that is unnerving in how it opens.")
Built through a Nanoodle graph (graphs/batch-g-packrip.noodle-graph.json,
$0.0587): a long close-mic foil tear, a short crinkle, and a photograph of
a torn silver foil sheet — keyed and used as the pack's inner lining.
The sealed pack is now an inline SVG: the keyed pack art is clipped into
a flap and a body along a jagged tear line that starts at the art's own
torn corner. You grab the corner (pulsing marker) and PULL. The tear has
stick-slip physics: five catches where the foil refuses, strains (the
flap bends, creak-ticks sound), then snaps through with a crinkle, a
shake, and flying foil flecks. The opening widens over a dark cavity and
the torn-foil lining, ember glow leaking out, the flap's torn edge
whitening — until the final give: the flap rips clean off and spins
away, the full tear sound lands, and the cards rise. A plain click still
works (an auto-rip through the same catches) for the clickers.
Spend: $0.940 of $5 cumulative.
