# Asset manifest — all art generated with Nanoodle → NanoGPT

Every image in this folder was generated live through Nanoodle workflow graphs
(`graphs/` in this repo) calling NanoGPT's `meta/muse-image/text-to-image`
model, then resized/recompressed locally (no other editing). Prompts are in
`tools/build_graphs.py`.

| File | Subject | Model | Cost |
|---|---|---|---|
| hero.jpg | The grave-knight (player) | meta/muse-image/text-to-image | $0.011 |
| husk.jpg | Husk (skeleton) | meta/muse-image/text-to-image | $0.011 |
| cultist.jpg | Cultist | meta/muse-image/text-to-image | $0.011 |
| wraith.jpg | Wraith | meta/muse-image/text-to-image | $0.011 |
| brute.jpg | Brute (gargoyle) | meta/muse-image/text-to-image | $0.011 |
| boss.jpg | Vesper, Mother of Bells (boss) | meta/muse-image/text-to-image | $0.011 |
| arena.jpg | Cathedral arena floor (top-down) | meta/muse-image/text-to-image | $0.011 |
| pack.jpg | Sealed booster pack | meta/muse-image/text-to-image | $0.011 |
| card-back.jpg | Card back | meta/muse-image/text-to-image | $0.011 |
| tower-bone.jpg | Bone Spire tower | meta/muse-image/text-to-image | $0.011 |
| tower-bell.jpg | Grave Bell tower | meta/muse-image/text-to-image | $0.011 |
| tower-pyre.jpg | Soul Pyre tower | meta/muse-image/text-to-image | $0.011 |
| tower-frost.jpg | Frost Obelisk tower | meta/muse-image/text-to-image | $0.011 |
| title-art.jpg | Title key art | meta/muse-image/text-to-image | $0.011 |

Plus 12 card icons (batch C, `icon-*.jpg`: flaming bolt, twin bolts, war drum,
piercing spike, executioner's axe, boots, chalice, lodestone, ward shield,
blood vial, wrath flask, saint's candle) at $0.011 each = $0.132.

**Runs:** batch A (actors, 6 images) $0.066; batch B (scenes/objects,
8 images) $0.088; batch C (icons, 12 images) $0.132.
**Total Nanoodle spend: $0.286 of the $5.00 budget.** All 26 generations were
usable — no re-rolls needed. Per-node costs are the API-reported figures from
each run's `report.json` (cost_exact: true).

Sound is synthesized in-browser with WebAudio (no audio files, no spend).

## Batch D (v2 expansion, 2026-11-10)
| file | subject | source |
|---|---|---|
| abbot.jpg | The Abbot (proper portrait, replaces cultist reuse) | graph batch-d, node i1 |
| plague.jpg | Plague Bearer | batch-d i2 |
| tower-gallows.jpg | Gallows Tree tower (card art) | batch-d i3 |
| tower-font.jpg | Blood Font tower (card art) | batch-d i4 |
| icon-chill.jpg | Gravechill Rounds | batch-d i5 |
| icon-storm.jpg | Storm Sigil | batch-d i6 |
| icon-thorns.jpg | Thornmail Mantle | batch-d i7 |
| icon-brand.jpg | Martyr's Brand | batch-d i8 |
| icon-seal.jpg | Gilded Seal | batch-d i9 |
| dawn-art.jpg | victory / dawn art | batch-d i10 |
| dirge.mp3 | looping dirge (stable-audio-3/small/music, ~23s, 192kbps) | batch-d-music graph, node m1 — $0.0239 |
Batch D images: 10 × $0.011 = $0.110. Music: $0.024 (MiniMax Music 3 attempt
failed free — it demands lyrics despite the instrumental flag; Stable Audio
took the job). Running Nanoodle total for GRIMPACK: **$0.420** ($0.286 + $0.110
+ $0.024) of the $5 budget.
