"""Cristallo (400.0001.80) uit het silhouet van de productfoto, op de maten van de tekening DATA/400.0001.80/TEK (90 x 137 mm, er is geen 3D-bestand).
Het kristal is onregelmatig geslepen, dus niet rondom te draaien: per hoogte punten rond het silhouet met een vaste toevalsverdeling,
daar een convex omhulsel omheen geeft de facetten. Metalen buisje erboven, LED erin. Meters, onderkant-midden op de oorsprong.

    python tools/3d/cristallo.py public/models
"""
import sys, trimesh, numpy as np
from PIL import Image

out = sys.argv[1]
PHOTO = '//192.168.206.240/Producten/DATA/400.0001.80/FOTO/400.0001.80.png'
WIDTH, HEIGHT = 0.090, 0.137
DEPTH = 0.8   # diepte ten opzichte van de breedte (alleen vooraanzicht bekend; op de foto oogt het kristal iets platter dan breed)
ROWS, AROUND = 8, 6
rng = np.random.default_rng(1870)  # vaste verdeling: elke keer hetzelfde kristal

# Silhouet: rijen van de foto waar het kristal breder is dan het snoer en het buisje. De bovenkant is plat (zie tekening),
# de schuine rand erboven op de foto is perspectief: daarom pas vanaf de helft van de breedte.
alpha = np.array(Image.open(PHOTO))[:, :, 3] > 60
rows = [(y, np.flatnonzero(alpha[y])) for y in range(alpha.shape[0])]
rows = [(y, xs.min(), xs.max()) for y, xs in rows if len(xs) and xs.max() - xs.min() > 250]
top, bottom = rows[0][0], rows[-1][0]
widest = max(r - l for _, l, r in rows)
axis = np.mean([(l + r) / 2 for _, l, r in rows])
sx, sy = WIDTH / widest, HEIGHT / (bottom - top)

pts = []
for i, f in enumerate(np.linspace(0, 1, ROWS)):
    y, l, r = min(rows, key=lambda row: abs(row[0] - (top + f * (bottom - top))))
    cx, half = ((l + r) / 2 - axis) * sx, (r - l) / 2 * sx
    # Onderkant iets ingesnoerd, zodat er schuine facetten ontstaan in plaats van een plat vlak.
    if i == ROWS - 1:
        half *= 0.6
    for a in np.linspace(0, 2 * np.pi, AROUND, endpoint=False) + rng.uniform(0, 2 * np.pi):
        k = rng.uniform(0.72, 1.0)
        h = (bottom - y) * sy + rng.uniform(-0.01, 0.01) * (0 < i < ROWS - 1)
        pts.append((cx + half * k * np.cos(a), h, half * DEPTH * k * np.sin(a)))
glass = trimesh.convex.convex_hull(np.array(pts))
glass.apply_translation([-glass.bounds.mean(axis=0)[0], -glass.bounds[0][1], -glass.bounds.mean(axis=0)[2]])
glass.apply_scale([WIDTH / glass.extents[0], HEIGHT / glass.extents[1], WIDTH / glass.extents[0]])

# Buisje zoals op de tekening: Ø14 x 16 mm, half in het kristal.
UPRIGHT = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
holder = trimesh.creation.cylinder(radius=0.007, height=0.016, sections=32)
holder.apply_transform(UPRIGHT)
holder.apply_translation([0, HEIGHT + 0.004, 0])
light = trimesh.creation.cylinder(radius=0.006, height=0.02, sections=24)
light.apply_transform(UPRIGHT)
light.apply_translation([0, HEIGHT - 0.02, 0])

scene = trimesh.Scene()
for role, mesh in [('glass', glass), ('holder', holder), ('light', light)]:
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh, node_name=role, geom_name=role)
scene.export(f'{out}/cristallo.glb')
lo, hi = scene.bounds
print('cristallo', 'breedte', round((hi[0] - lo[0]) * 1000), 'diepte', round((hi[2] - lo[2]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000),
      {name: len(g.faces) for name, g in scene.geometry.items()})
