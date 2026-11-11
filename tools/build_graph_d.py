#!/usr/bin/env python3
"""Batch D (v2 expansion): abbot, plague bearer, 2 towers, 5 icons, dawn art + music."""
import json, pathlib
OUT = pathlib.Path.home() / "workspace/grimpack/graphs"
STYLE = ("Dark gothic hand-painted 2D game art, deep black background, bone white, "
         "dried-blood red and hellfire orange accents, dramatic rim lighting, "
         "strong readable silhouette, no text, no letters, no watermark.")
ICON = ("Single centered game icon on a pure black background, dark gothic hand-painted 2D art, "
        "bone white, dried-blood red and hellfire orange accents, dramatic rim light, no text, no letters.")
ITEMS = [
    ("abbot", f"Full-body portrait of a gaunt abbot mini-boss: tall skeletal cleric in black and gold vestments, "
              f"a tall mitre crowned with a brass bell, holding a heavy processional bell-staff, hollow glowing eyes. {STYLE}"),
    ("plague", f"Full-body bloated plague bearer enemy: swollen corpse in a rotting plague-doctor robe, leaking "
               f"sickly green-orange pustules, carrying a bursting sack of corruption, flies around its head. {STYLE}"),
    ("tower-gallows", f"A gothic defensive tower: a crooked gallows tree of black wood with hanging chains and a "
                      f"long iron sniper rifle of bone mounted in its branches, crow on top, round stone base, game asset. {STYLE}"),
    ("tower-font", f"A gothic defensive tower: a black stone blood font basin filled with glowing crimson liquid, "
                   f"four small candles and a bone chalice on its rim, round stone base, game asset. {STYLE}"),
    ("icon-chill", f"Crossbow bolts tipped with pale blue frost crystals, cold mist curling off them. {ICON}"),
    ("icon-storm", f"A bone-white rune sigil crackling with orange lightning arcs in a circle. {ICON}"),
    ("icon-thorns", f"A mantle of black iron thorns and chains draped like a cloak, blood on the spikes. {ICON}"),
    ("icon-brand", f"A glowing orange martyr's brand: a circle of flame around a bone cross on a dark iron disc. {ICON}"),
    ("icon-seal", f"An ornate golden wax seal stamp with a skull emblem, ribbon of crimson wax. {ICON}"),
    ("dawn-art", "A ruined cathedral floor at a cold grey dawn: the ritual circle empty, broken towers of bone "
                 "standing silent, skeletons lying still in heaps, pale light through shattered stained glass, "
                 "embers dying. Somber, peaceful, hand-painted 2D game art, no characters standing, no text."),
]
nodes, links = [], []
nodes.append({"id": "c1", "type": "comment", "name": "GRIMPACK batch D (v2)", "x": 40, "y": -260, "w": 700,
              "fields": {"text": "Batch D: v2 expansion art for GRIMPACK."}})
for i, (key, prompt) in enumerate(ITEMS, start=1):
    nodes.append({"id": f"t{i}", "type": "text", "name": key, "x": 40, "y": i * 300, "w": 320, "fields": {"text": prompt}})
    nodes.append({"id": f"i{i}", "type": "image", "name": key, "x": 420, "y": i * 300, "w": 260,
                  "fields": {"model": "meta/muse-image/text-to-image", "size": "1:1", "variations": "1"}})
    links.append({"id": f"l{i}", "from": {"node": f"t{i}", "port": "text"}, "to": {"node": f"i{i}", "port": "prompt"}})
g = {"v": 1, "nodes": nodes, "links": links, "nid": 30, "lid": 30, "view": {"panX": 30, "panY": 280, "scale": 0.6}}
(OUT / "batch-d-v2.noodle-graph.json").write_text(json.dumps(g, indent=2) + "\n")

# music graph: one prompt -> minimax/music-3 instrumental
mn = [
    {"id": "c1", "type": "comment", "name": "GRIMPACK soundtrack", "x": 40, "y": -200, "w": 640,
     "fields": {"text": "One instrumental dark-ambient track for GRIMPACK: loops under gameplay."}},
    {"id": "t1", "type": "text", "name": "direction", "x": 40, "y": 40, "w": 340,
     "fields": {"text": "Instrumental dark ambient dungeon synth, slow and ominous: deep detuned drones, a distant "
                        "tolling cathedral bell every eight bars, sparse bowed strings, faint choir pad, subtle "
                        "heartbeat-like low pulse at 70 BPM, minor key, seamless loop feel, no vocals, no drums kit, "
                        "no melody that demands attention. Music for surviving the night in a ruined cathedral."}},
    {"id": "m1", "type": "music", "name": "Grimpack dirge", "x": 440, "y": 40, "w": 300,
     "fields": {"model": "minimax/music-3", "instrumental": True, "response_format": "mp3"}},
]
ml = [{"id": "l1", "from": {"node": "t1", "port": "text"}, "to": {"node": "m1", "port": "prompt"}}]
mg = {"v": 1, "nodes": mn, "links": ml, "nid": 5, "lid": 5, "view": {"panX": 30, "panY": 240, "scale": 0.7}}
(OUT / "batch-d-music.noodle-graph.json").write_text(json.dumps(mg, indent=2) + "\n")
print("wrote batch-d images", len(ITEMS), "+ music graph")
