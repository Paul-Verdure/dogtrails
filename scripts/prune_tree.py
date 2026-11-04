"""Prune Parker 2017 individual-level tree (Data File S2) to one leaf per breed for a sample.

usage: python3 -I prune_tree.py tree.txt breeds.txt out_dir
"""
import json, re, sys
from collections import defaultdict

tree_txt, breeds_txt, out_dir = sys.argv[1:4]

SAMPLE = ["AKIT", "CHOW", "SHIH", "PUG", "BRUS", "POM", "ICES", "MSNZ", "MPIN", "PULI",
          "SPOO", "CHIH", "CRES", "RATT", "IRIT", "GSD", "XOLO", "SALU", "BASS", "BEAG",
          "ACKR", "GOLD", "NSDT", "GSHP", "BRIA", "SSHP", "BORD", "ROTT", "STBD", "MAST"]

# --- breed table: abbrev -> (name, clade)
table = {}
for line in open(breeds_txt, encoding="utf-8"):
    parts = line.rstrip("\n").split("|")
    if len(parts) == 3 and parts[1] not in ("Abrev.", "None"):
        table[parts[1]] = (parts[0], parts[2].replace("*", "").strip())

# --- newick string from the NEXUS text
raw = open(tree_txt, encoding="utf-8").read()
nwk = raw.split("[&R]", 1)[1].split(";", 1)[0]
nwk = re.sub(r"\s+", "", nwk)

# --- tiny newick parser -> nested dicts {name, children, support}
pos = 0
def parse():
    global pos
    node = {"children": [], "name": None, "support": None}
    if nwk[pos] == "(":
        pos += 1
        while True:
            node["children"].append(parse())
            if nwk[pos] == ",":
                pos += 1
                continue
            assert nwk[pos] == ")"
            pos += 1
            break
    m = re.match(r"([^:,()]*)(?::([0-9.]+))?", nwk[pos:])
    label, val = m.group(1), m.group(2)
    pos += m.end()
    if node["children"]:
        node["support"] = float(val) if val else None  # branch value = bootstrap support
    else:
        node["name"] = label
    return node

root = parse()

def breed_of(leaf):
    return leaf.split("_", 1)[0]

# --- keep the first individual found for each sampled breed
kept = {}
def collect(n):
    if not n["children"]:
        b = breed_of(n["name"])
        if b in SAMPLE and b not in kept:
            kept[b] = n["name"]
    for c in n["children"]:
        collect(c)
collect(root)
missing = [b for b in SAMPLE if b not in kept]
keep_ids = set(kept.values())

def prune(n):
    if not n["children"]:
        return {"name": breed_of(n["name"])} if n["name"] in keep_ids else None
    kids = [k for k in (prune(c) for c in n["children"]) if k]
    if not kids:
        return None
    if len(kids) == 1:
        return kids[0]  # collapse unary nodes
    return {"children": kids, "support": n["support"]}

small = prune(root)

def to_newick(n):
    if "name" in n:
        return n["name"]
    s = "(" + ",".join(to_newick(c) for c in n["children"]) + ")"
    return s + (f"{n['support']:g}" if n["support"] is not None else "")

def to_json(n):
    if "name" in n:
        name, clade = table.get(n["name"], (n["name"], None))
        return {"id": n["name"], "name": name, "clade": clade}
    return {"support": n["support"], "children": [to_json(c) for c in n["children"]]}

open(f"{out_dir}/tree-30.nwk", "w").write(to_newick(small) + ";\n")
json.dump(to_json(small), open(f"{out_dir}/tree-30.json", "w"), indent=2, ensure_ascii=False)

rows = [{"abbrev": b, "name": table[b][0], "clade": table[b][1], "leaf_used": kept.get(b)} for b in SAMPLE]
json.dump(rows, open(f"{out_dir}/sample-30.json", "w"), indent=2, ensure_ascii=False)

leaves_total = sum(1 for _ in re.finditer(r"[A-Z0-9]+_[A-Za-z0-9]+(?=:)", nwk))
print("leaves in full tree:", leaves_total)
print("missing:", missing)
for r in rows:
    print(f"{r['abbrev']:5} {r['name']:36} {r['clade']}")
print(to_newick(small))
