#!/usr/bin/env python3
"""Batch C: card icons for weapons / relics / consumables."""
import json, pathlib
OUT = pathlib.Path.home() / "workspace/grimpack/graphs"
STYLE = ("Single centered game icon on a pure black background, dark gothic hand-painted 2D art, "
         "bone white, dried-blood red and hellfire orange accents, dramatic rim light, no text, no letters.")
ITEMS = [
    ("icon-hellfire", f"A single flaming crossbow bolt wreathed in hellfire-orange flame, diagonal. {STYLE}"),
    ("icon-twin", f"Two crossed glowing crossbow bolts forming an X over a small bone seal ring. {STYLE}"),
    ("icon-cadence", f"A war drum made of stretched pale hide and black wood with bone drumsticks, faint orange sound rings. {STYLE}"),
    ("icon-pierce", f"A long iron spike piercing through a cracked bone-white rune tablet, orange glow in the cracks. {STYLE}"),
    ("icon-axe", f"A brutal executioner's axe with a black haft and a chipped steel head, dried blood on the edge. {STYLE}"),
    ("icon-boots", f"A pair of worn grave-digger boots with tattered grey wind wisps swirling around them. {STYLE}"),
    ("icon-chalice", f"An ornate brass chalice filled with glowing crimson liquid, a single drop falling. {STYLE}"),
    ("icon-magnet", f"A dark lodestone horseshoe magnet pulling small glowing orange ash sparks toward it. {STYLE}"),
    ("icon-ward", f"A bone-white shield with a burning white candle in its centre, protective pale glow. {STYLE}"),
    ("icon-vial", f"A small glass vial of glowing crimson blood, corked, with a bone stopper. {STYLE}"),
    ("icon-draught", f"A black iron flask wreathed in orange wrath flames, skull-shaped stopper. {STYLE}"),
    ("icon-candle", f"A tall white saint's candle with a halo of pale light and melted wax over a brass holder. {STYLE}"),
]
nodes, links = [], []
nodes.append({"id": "c1", "type": "comment", "name": "GRIMPACK batch C icons", "x": 40, "y": -260, "w": 700,
              "fields": {"text": "Batch C: 12 card icons for GRIMPACK (weapons, relics, consumables)."}})
for i, (key, prompt) in enumerate(ITEMS, start=1):
    nodes.append({"id": f"t{i}", "type": "text", "name": key, "x": 40, "y": i * 300, "w": 320, "fields": {"text": prompt}})
    nodes.append({"id": f"i{i}", "type": "image", "name": key, "x": 420, "y": i * 300, "w": 260,
                  "fields": {"model": "meta/muse-image/text-to-image", "size": "1:1", "variations": "1"}})
    links.append({"id": f"l{i}", "from": {"node": f"t{i}", "port": "text"}, "to": {"node": f"i{i}", "port": "prompt"}})
g = {"v": 1, "nodes": nodes, "links": links, "nid": 30, "lid": 30, "view": {"panX": 30, "panY": 280, "scale": 0.6}}
(OUT / "batch-c-icons.noodle-graph.json").write_text(json.dumps(g, indent=2) + "\n")
print("wrote batch-c", len(ITEMS))
