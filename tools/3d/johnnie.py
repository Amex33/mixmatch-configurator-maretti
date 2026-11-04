"""Johnnie (13.0480, glas 80.1420): glazen kap Ø90 x 120 mm volgens Webshop/13.0480.45/13.0480.45_TK1.jpg, er is geen 3D-bestand.
Het geslepen ruitpatroon is nagebootst met groeven langs twee schuine lijnen rondom; zwart kegelkapje en tule erboven, lampje erin.
Meters, onderkant-midden op de oorsprong.

    python tools/3d/johnnie.py public/models
"""
import sys, trimesh, numpy as np
from scipy.interpolate import PchipInterpolator

out = sys.argv[1]
R, H = 0.045, 0.120
# Profiel uit de tekening (straal, hoogte) als deel van R en H: rechte wand, afgeronde schouder, opening onder het kapje.
PROFILE = [(1.0, 0.0), (1.0, 0.4), (1.0, 0.75), (0.97, 0.85), (0.88, 0.93), (0.7, 0.98), (0.45, 1.0)]
AROUND, ROWS = 192, 96
DIAMONDS = 12, 6   # ruiten rondom en in de hoogte
GROOVE, WIDTH = 0.0012, 0.12  # diepte van een groef en breedte als deel van een ruit

pts = np.array(PROFILE)
t = np.linspace(0, 1, len(pts))
fine = np.linspace(0, 1, ROWS)
radius = PchipInterpolator(t, pts[:, 0])(fine) * R
height = PchipInterpolator(t, pts[:, 1])(fine) * H
phi = np.linspace(0, 2 * np.pi, AROUND, endpoint=False)
P, _ = np.meshgrid(phi, fine)
u = P / (2 * np.pi) * DIAMONDS[0]
v = height[:, None] / (H * 0.85) * DIAMONDS[1]


def line(x):
    """1 op een groeflijn (geheel getal), 0 buiten de groef."""
    return np.clip(1 - np.abs(x - np.round(x)) / WIDTH, 0, 1)


# Ruiten alleen op de rechte wand; de schouder is glad.
fade = np.clip((0.88 - fine) / 0.08, 0, 1)[:, None]
r = radius[:, None] - GROOVE * np.maximum(line(u + v), line(u - v)) * fade
verts = np.stack([r * np.cos(P), np.repeat(height[:, None], AROUND, axis=1), r * np.sin(P)], axis=-1).reshape(-1, 3)
faces = []
for i in range(ROWS - 1):
    for j in range(AROUND):
        a, b = i * AROUND + j, i * AROUND + (j + 1) % AROUND
        faces += [[a, b + AROUND, b], [a, a + AROUND, b + AROUND]]
glass = trimesh.Trimesh(verts, faces, process=True)
glass.fix_normals()


def lathe(points, sections=48):
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


# Kegelkapje (onder Ø66 mm, ~26 mm hoog) en tule (Ø10 x 18 mm), zoals op de tekening en foto PJ1.
holder = lathe([(0.0, H + 0.044), (0.005, H + 0.044), (0.005, H + 0.026), (0.007, H + 0.026), (0.02, H + 0.014), (0.033, H + 0.002), (0.033, H - 0.003), (0.0, H - 0.003)])
bulb = trimesh.creation.icosphere(subdivisions=3, radius=0.025)
bulb.apply_translation([0, H * 0.5, 0])

scene = trimesh.Scene()
for role, mesh in [('glass', glass), ('holder', holder), ('light', bulb)]:
    mesh.visual = trimesh.visual.ColorVisuals(mesh)
    scene.add_geometry(mesh, node_name=role, geom_name=role)
scene.export(f'{out}/johnnie.glb')
lo, hi = scene.bounds
print('johnnie', 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000), {n: len(g.faces) for n, g in scene.geometry.items()})
