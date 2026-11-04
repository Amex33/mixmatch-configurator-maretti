"""Inciso (13.1870) opgebouwd uit de productfoto's in DATA/80.1255 (er is geen 3D-bestand): bol Ø150 mm met gedraaide ribbels
en een opening van Ø30 mm bovenaan, zwarte fitting (kapje en buisje) en een G9-lampje. Meters, onderkant-midden op de oorsprong.

    python tools/3d/inciso.py public/models
"""
import sys, trimesh, numpy as np

out = sys.argv[1]
R = 0.075          # straal van de bol
OPENING = 0.015    # straal van de opening bovenaan
LIP = 0.002        # randje rond de opening
RIBS = 14          # aantal ribbels rondom
DEPTH = 0.025      # diepte van de ribbels, deel van de straal (~2 mm)
TWIST = np.pi / 2  # ribbels draaien een kwartslag van onder naar boven
ROWS, COLS = 56, 112

top_angle = np.arcsin(OPENING / R)  # hoek vanaf de bovenkant waar de opening begint
theta = np.linspace(np.pi, top_angle, ROWS)  # van onderkant naar de opening
phi = np.linspace(0, 2 * np.pi, COLS, endpoint=False)
T, P = np.meshgrid(theta, phi, indexing='ij')
v = 1 - (T - top_angle) / (np.pi - top_angle)  # 0 onder, 1 boven
# Ribbels lopen weg naar de onderkant en de opening, zoals bij mondgeblazen glas.
r = R * (1 + DEPTH * np.sin(T) * np.cos(RIBS * (P + TWIST * v)))
centre = R  # middelpunt van de bol op hoogte R
verts = np.stack([r * np.sin(T) * np.cos(P), centre - r * np.cos(T), r * np.sin(T) * np.sin(P)], axis=-1).reshape(-1, 3)

faces = []
for i in range(ROWS - 1):
    for j in range(COLS):
        a, b = i * COLS + j, i * COLS + (j + 1) % COLS
        c, d = a + COLS, b + COLS
        faces += [[a, c, b], [b, c, d]]
# Randje rond de opening: rij recht omhoog.
rim = verts[-COLS:].copy()
rim[:, 1] += LIP
base = len(verts)
verts = np.vstack([verts, rim])
for j in range(COLS):
    a, b = (ROWS - 1) * COLS + j, (ROWS - 1) * COLS + (j + 1) % COLS
    faces += [[a, base + j, b], [b, base + j, base + (j + 1) % COLS]]
glass = trimesh.Trimesh(verts, faces, process=True)
glass.fix_normals()

glass_top = glass.bounds[1][1]
# trimesh maakt cilinders langs z; de lamp staat langs y.
UPRIGHT = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
# Fitting zoals op de foto van 13.1870.04: plat zwart kapje Ø40 mm op de opening, buisje Ø12 x 50 mm erboven.
cap = trimesh.creation.cylinder(radius=0.02, height=0.006, sections=48)
cap.apply_transform(UPRIGHT)
cap.apply_translation([0, glass_top - 0.001 + 0.003, 0])
tube = trimesh.creation.cylinder(radius=0.006, height=0.05, sections=32)
tube.apply_transform(UPRIGHT)
tube.apply_translation([0, glass_top + 0.005 + 0.025, 0])
holder = trimesh.util.concatenate([cap, tube])
# G9-lampje hangt vanuit de fitting in de bol.
bulb = trimesh.creation.capsule(height=0.03, radius=0.008, count=[16, 16])
bulb.apply_transform(UPRIGHT)
bulb.apply_translation([0, glass_top - 0.04, 0])

scene = trimesh.Scene()
for role, mesh in [('glass', glass), ('holder', holder), ('light', bulb)]:
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh, node_name=role, geom_name=role)
scene.export(f'{out}/inciso.glb')
lo, hi = scene.bounds
print('inciso', 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000),
      {name: len(g.faces) for name, g in scene.geometry.items()})
