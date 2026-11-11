#!/usr/bin/env python3
"""Build GRIMPACK asset graphs: multi-branch text->image, one asset per branch."""
import json, pathlib

OUT = pathlib.Path.home() / "workspace/grimpack/graphs"
OUT.mkdir(parents=True, exist_ok=True)

STYLE = ("Dark gothic hand-painted 2D game art, deep black background, bone white, "
         "dried-blood red and hellfire orange accents, dramatic rim lighting, "
         "strong readable silhouette, no text, no letters, no watermark.")

def branch(nodes, links, i, key, prompt):
    nodes.append({"id": f"t{i}", "type": "text", "name": key, "x": 40, "y": i * 300, "w": 320,
                  "fields": {"text": prompt}})
    nodes.append({"id": f"i{i}", "type": "image", "name": key, "x": 420, "y": i * 300, "w": 260,
                  "fields": {"model": "meta/muse-image/text-to-image", "size": "1:1", "variations": "1"}})
    links.append({"id": f"l{i}", "from": {"node": f"t{i}", "port": "text"},
                  "to": {"node": f"i{i}", "port": "prompt"}})

def graph(name, items):
    nodes, links = [], []
    nodes.append({"id": "c1", "type": "comment", "name": name, "x": 40, "y": -260, "w": 700,
                  "fields": {"text": f"{name}: one text->image branch per game asset for GRIMPACK. "
                                     "Style-locked gothic prompts; outputs land as node-iN-image.png."}})
    for i, (key, prompt) in enumerate(items, start=1):
        branch(nodes, links, i, key, prompt)
    g = {"v": 1, "nodes": nodes, "links": links, "nid": len(items) + 2, "lid": len(items) + 2,
         "view": {"panX": 30, "panY": 280, "scale": 0.6}}
    (OUT / f"{name}.noodle-graph.json").write_text(json.dumps(g, indent=2) + "\n")
    print("wrote", name, len(items), "assets")

ACTORS = [
    ("hero", f"Full-body portrait of a lone grave-knight hero, hooded, cracked bone-white helm, "
             f"tattered black cloak, holding a glowing hellfire-orange crossbow, standing ready. {STYLE}"),
    ("husk", f"Full-body shambling skeleton husk enemy, cracked yellowed bones, tattered burial rags, "
             f"empty glowing red eye sockets, clawed hands reaching forward. {STYLE}"),
    ("cultist", f"Full-body hooded cultist enemy in a torn crimson robe, brass bell in one hand, "
                f"iron dagger in the other, face hidden in shadow with two pale eyes. {STYLE}"),
    ("wraith", f"Full-body translucent wraith enemy, tattered grey spectral shroud, long clawed fingers, "
               f"screaming hollow face, faint cold blue glow at its edges. {STYLE}"),
    ("brute", f"Full-body hulking gargoyle brute enemy, massive stone-grey muscles, cracked skin with "
              f"glowing orange fissures, small horned head, enormous fists. {STYLE}"),
    ("boss", f"Full-body terrifying demon matriarch boss, Vesper Mother of Bells: tall horned figure in a "
             f"black ceremonial gown of chains and brass bells, crown of candles, glowing orange eyes, "
             f"arms raised in a tolling gesture. {STYLE}"),
]

SCENES = [
    ("arena", "Top-down view of a ruined cathedral arena floor for a video game: cracked black stone tiles, "
              "a huge faded bone-white ritual circle in the centre, dried blood stains, scattered rubble and "
              "broken pillars at the edges, candles in the corners, moody and dark, no characters. "
              "Dark gothic hand-painted 2D game art, deep blacks, bone white and hellfire orange accents, no text."),
    ("pack", f"A sealed trading-card booster pack product shot, ornate black wax-sealed foil pack with an "
             f"embossed bone-white skull sigil and gold trim, torn slightly at one corner with hellfire-orange "
             f"light leaking out, floating on black. {STYLE}"),
    ("card-back", "The back of a gothic trading card: ornate black and gold filigree border, a bone-white "
                  "pentacle sigil in the centre over deep crimson, worn and ominous, fills the whole frame, "
                  "no text, no letters. Dark gothic hand-painted art."),
    ("tower-bone", f"A gothic defensive tower made of stacked bones and skulls, a bone spire turret with a "
                   f"glowing orange crystal at its tip, on a small round stone base, game asset. {STYLE}"),
    ("tower-bell", f"A gothic defensive tower: a crooked iron frame holding a huge cracked brass grave bell, "
                   f"chains and a small glowing crimson lantern, on a round stone base, game asset. {STYLE}"),
    ("tower-pyre", f"A gothic defensive tower: a black iron brazier pyre with roaring hellfire-orange flames "
                   f"and floating embers, skulls around its base, on a round stone base, game asset. {STYLE}"),
    ("tower-frost", f"A gothic defensive tower: a jagged pale-blue frost obelisk crystal rising from a black "
                    f"stone base, cold mist and small icicles, faint blue glow, game asset. {STYLE}"),
    ("title-art", "Epic wide dark gothic key art: a lone hooded grave-knight stands in a ruined cathedral "
                  "holding a torn-open glowing booster pack, cards flying out of it turning into bone towers "
                  "and hellfire bolts, an army of skeletons and wraiths closing in from the dark edges, a huge "
                  "horned bell demon looming behind. Hand-painted 2D game art, deep blacks, bone white, "
                  "dried-blood red, hellfire orange, no text, no letters."),
]

graph("batch-a-actors", ACTORS)
graph("batch-b-scenes", SCENES)
