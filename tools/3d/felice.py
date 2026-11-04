"""Felice (400.0002.06, ook de kappen van 400.0002.07/.08/.09): verfrommeld en gedraaid glas onder een rosé gouden ring,
108 x 160 mm volgens Webshop/400.0002.09/400.0002.09_TK1.jpg, er is geen 3D-bestand. De vorm is nagebootst naar foto 400.0002.06_PJ1:
een open buis die naar onderen toe draait, plooit en naar één kant uitzakt, met een golvende onderrand. Ring, staafje en LED-schijf.
Meters, onderkant-midden op de oorsprong.

    python tools/3d/felice.py public/models
"""
import sys, trimesh, numpy as np

out = sys.argv[1]
R = 0.051            # straal van het glas bovenaan, net binnen de ring (Ø108)
GLASS, RING, ROD = 0.132, 0.016, 0.095  # hoogtes: glas + ring = 160 mm, staafje erboven
AROUND, ROWS = 144, 72

phi = np.linspace(0, 2 * np.pi, AROUND, endpoint=False)
v = np.linspace(0, 1, ROWS)  # 0 bovenaan bij de ring, 1 onderrand
P, V = np.meshgrid(phi, v)
twist = P + 1.2 * V                                                    # naar onderen toe gedraaid
folds = V * (0.22 * np.sin(3 * twist + 3.5 * V) + 0.10 * np.sin(5 * twist - 2 * V + 1))  # plooien die naar onderen dieper worden
r = R * (1 - 0.12 * V) * (1 + folds)
cx = 0.012 * V ** 1.5                                                  # onderkant zakt naar één kant uit
y = GLASS * (1 - V) + V ** 3 * 0.012 * np.sin(2 * P + 1)              # golvende onderrand
verts = np.stack([cx + r * np.cos(P), y, r * np.sin(P)], axis=-1).reshape(-1, 3)
faces = []
for i in range(ROWS - 1):
    for j in range(AROUND):
        a, b = i * AROUND + j, i * AROUND + (j + 1) % AROUND
        faces += [[a, b + AROUND, b], [a, a + AROUND, b + AROUND]]
glass = trimesh.Trimesh(verts, faces, process=True)
glass.fix_normals()
glass.apply_translation([0, -glass.bounds[0][1], 0])
# Plooien niet breder dan de ring (108 mm).
wide = max(glass.extents[0], glass.extents[2])
if wide > 0.106:
    glass.apply_scale([0.106 / wide, 1, 0.106 / wide])
top = glass.bounds[1][1]


def lathe(points, sections=72):
    phi = np.linspace(0, 2 * np.pi, sections, endpoint=False)
    verts = np.array([[r * np.cos(p), y, r * np.sin(p)] for r, y in points for p in phi])
    faces = []
    for i in range(len(points) - 1):
        for j in range(sections):
            a, b = i * sections + j, i * sections + (j + 1) % sections
            faces += [[a, b + sections, b], [a, a + sections, b + sections]]
    mesh = trimesh.Trimesh(verts, faces, process=True)
    mesh.fix_normals()
    return mesh


# Ring Ø108 x 16 mm (dicht aan de bovenkant) met het staafje Ø6 mm erop, zoals op de foto.
holder = lathe([(0.0, top + RING + ROD), (0.003, top + RING + ROD), (0.003, top + RING), (0.054, top + RING), (0.054, top - 0.002),
                (0.05, top - 0.002), (0.05, top + RING - 0.003), (0.0, top + RING - 0.003)])
light = lathe([(0.0, top), (0.045, top), (0.045, top + 0.003), (0.0, top + 0.003)], 48)

scene = trimesh.Scene()
for role, mesh in [('glass', glass), ('holder', holder), ('light', light)]:
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh, node_name=role, geom_name=role)
scene.export(f'{out}/felice.glb')
lo, hi = scene.bounds
print('felice', 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000),
      'zonder staafje', round((top + RING) * 1000), {n: len(g.faces) for n, g in scene.geometry.items()})
