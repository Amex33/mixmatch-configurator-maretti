"""Ozone (13.0440 / glas 80.1275): glazen buis Ø60 x 460 mm volgens Webshop/13.0440.55/13.0440.55_TK1.jpg, er is geen 3D-bestand.
Het craquelé-glas (zie PD3) is nagebootst met groeven langs een vast patroon van onregelmatige cellen. Zwarte fitting bovenin,
lange buislamp erin. Meters, onderkant-midden op de oorsprong.

    python tools/3d/ozone.py public/models
"""
import sys, trimesh, numpy as np
from scipy.spatial import cKDTree

out = sys.argv[1]
R, H = 0.030, 0.460
CELL = 0.022     # gemiddelde celgrootte van het craquelé
GROOVE = 0.0018  # diepte van de groeven tussen de cellen
AROUND, ROWS = 96, 200
rng = np.random.default_rng(440)  # vast patroon: elke keer dezelfde buis

# Celmiddelpunten op de uitgerolde buis (omtrek x hoogte); links en rechts herhaald zodat de naad niet opvalt.
width = 2 * np.pi * R
seeds = rng.uniform([0, 0], [width, H], size=(int(width * H / CELL ** 2), 2))
tree = cKDTree(np.vstack([seeds, seeds + [width, 0], seeds - [width, 0]]))

phi = np.linspace(0, 2 * np.pi, AROUND, endpoint=False)
ys = np.linspace(0, H, ROWS)
P, Y = np.meshgrid(phi, ys)
dist, _ = tree.query(np.stack([P.ravel() * R, Y.ravel()], axis=1), k=2)
d1, d2 = dist.T
# Groef waar een punt bijna even ver van twee cellen ligt (de rand tussen twee cellen).
groove = np.clip(1 - (d2 - d1) / (CELL * 0.18), 0, 1).reshape(P.shape)
r = R - GROOVE * groove
verts = np.stack([r * np.cos(P), Y, r * np.sin(P)], axis=-1).reshape(-1, 3)
faces = []
for i in range(ROWS - 1):
    for j in range(AROUND):
        a, b = i * AROUND + j, i * AROUND + (j + 1) % AROUND
        faces += [[a, b + AROUND, b], [a, a + AROUND, b + AROUND]]
# Dichte onder- en bovenkant.
bottom, top = len(verts), len(verts) + 1
verts = np.vstack([verts, [[0, 0, 0], [0, H, 0]]])
for j in range(AROUND):
    faces += [[bottom, j, (j + 1) % AROUND], [top, (ROWS - 1) * AROUND + (j + 1) % AROUND, (ROWS - 1) * AROUND + j]]
glass = trimesh.Trimesh(verts, faces, process=True)
glass.fix_normals()

UPRIGHT = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
# Fitting bovenin de buis (op de tekening een kort zwart blokje), lamp eronder: ~250 mm lang, Ø20 mm.
holder = trimesh.creation.cylinder(radius=0.011, height=0.035, sections=32)
holder.apply_transform(UPRIGHT)
holder.apply_translation([0, H - 0.0175, 0])
light = trimesh.creation.capsule(height=0.23, radius=0.01, count=[24, 24])
light.apply_transform(UPRIGHT)
light.apply_translation([0, H - 0.035 - 0.125, 0])

scene = trimesh.Scene()
for role, mesh in [('glass', glass), ('holder', holder), ('light', light)]:
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh, node_name=role, geom_name=role)
scene.export(f'{out}/ozone.glb')
lo, hi = scene.bounds
print('ozone', 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000), {n: len(g.faces) for n, g in scene.geometry.items()})
