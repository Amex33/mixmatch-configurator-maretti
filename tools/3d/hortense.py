"""Hortense uit de SketchUp-export (meters, zonder materialen): onderdelen herkennen aan grootte, snoer en plafondkap weglaten,
bloemen vereenvoudigen en 1-, 3-, 5- en 7-lichts versies opbouwen uit de tak met drie bloemen."""
import sys, json, pickle, trimesh, numpy as np, fast_simplification

m, cs = pickle.load(open(sys.argv[1], 'rb'))
out = sys.argv[2]
parts = []
for idx in cs:
    sub = m.submesh([idx], append=True)
    size = sub.extents
    n = len(idx)
    if size[1] > 1.0 or sub.bounds[0][1] > 2.5 or n <= 2:
        continue  # snoer, plafondkap, losse vlakjes
    role = 'flower' if n > 50000 else 'inner' if n > 10000 else 'bulb' if n == 140 else 'branch'
    parts.append((role, sub))

def simplify(mesh, ratio):
    v, f = fast_simplification.simplify(mesh.vertices.astype(np.float32), mesh.faces.astype(np.int32), target_reduction=ratio)
    return trimesh.Trimesh(v, f, process=True)

flowers = [p for r, p in parts if r == 'flower']
inners = [p for r, p in parts if r == 'inner']
bulbs = [p for r, p in parts if r == 'bulb']
branch = trimesh.util.concatenate([p for r, p in parts if r == 'branch'])
# Elke bloem met zijn binnenkant en lampje als één bloesem.
blossoms = []
for fl in flowers:
    c = fl.centroid
    inner = min(inners, key=lambda p: np.linalg.norm(p.centroid - c))
    bulb = min(bulbs, key=lambda p: np.linalg.norm(p.centroid - c))
    blossoms.append({'holder': simplify(fl, 0.9), 'gold': simplify(inner, 0.8), 'light': bulb})

stem = [p for r, p in parts if r == 'branch' and p.extents[1] > 0.2][0]
axis = stem.bounds.mean(axis=0)
top = stem.bounds[1][1]

def export(name, groups):
    scene = trimesh.Scene()
    merged = {}
    for role, mesh in groups:
        merged.setdefault(role, []).append(mesh)
    lo = min(mm.bounds[0][1] for ms in merged.values() for mm in ms)
    for role, ms in merged.items():
        mm = trimesh.util.concatenate(ms)
        mm.apply_translation([-axis[0], -lo, -axis[2]])
        mm.visual = trimesh.visual.ColorVisuals(mm)
        scene.add_geometry(mm, node_name=role, geom_name=role)
    scene.export(f'{out}/{name}.glb')
    h = top - lo
    print(name, 'hoogte', round(h, 3), 'vlakken', sum(len(g.faces) for g in scene.geometry.values()))

def rotated(mesh, degrees, drop=0.0):
    c = mesh.copy()
    c.apply_transform(trimesh.transformations.rotation_matrix(np.radians(degrees), [0, 1, 0], [axis[0], 0, axis[2]]))
    c.apply_translation([0, -drop, 0])
    return c

def branch_with(blooms, degrees=0, drop=0.0, with_stem=True):
    groups = [('holder', rotated(branch if with_stem else branch_without_stem, degrees, drop))]
    for b in blooms:
        groups += [(role, rotated(mesh, degrees, drop)) for role, mesh in b.items()]
    return groups

branch_without_stem = trimesh.util.concatenate([p for r, p in parts if r == 'branch' and p.extents[1] <= 0.2])

# 3-lichts: het model zoals het is.
export('hortense-3', branch_with(blossoms))
# 5-lichts: een tweede tak, 60° gedraaid en 7 cm lager, met twee bloemen.
export('hortense-5', branch_with(blossoms) + branch_with(blossoms[:2], 60, 0.07, with_stem=False))
# 7-lichts: twee extra takken (40° en 80° gedraaid, 6 en 12 cm lager) met elk twee bloemen.
export('hortense-7', branch_with(blossoms) + branch_with(blossoms[:2], 40, 0.06, with_stem=False) + branch_with(blossoms[:2], 80, 0.12, with_stem=False))
# 1-lichts: steel met één bloem recht eronder.
one = blossoms[0]
hub = [p for r, p in parts if r == 'branch' and p.extents[1] < 0.02]
# Bloem recht onder de steel, met de bovenkant tegen het naafje.
shift = np.array([axis[0] - one['holder'].centroid[0], hub[0].bounds[0][1] - one['holder'].bounds[1][1] + 0.005, axis[2] - one['holder'].centroid[2]])
groups = [('holder', stem)] + [('holder', h) for h in hub]
for role, mesh in one.items():
    c = mesh.copy(); c.apply_translation(shift); groups.append((role, c))
export('hortense-1', groups)
