"""Zen stoffen lampion in drie vormen (400.0009.05, 400.0010.05, 400.0011.05), er zijn geen 3D-bestanden.
Profielen overgenomen uit de maattekeningen Webshop/<sku>/<sku>_TK1.jpg; 400.0011.05 heeft geen tekening, die komt uit de productfoto (PD1).
Stof gespannen tussen 16 baleinen: tussen twee baleinen bolt de stof iets naar buiten. Open boven- en onderkant, E27-lampje erin.
Meters, onderkant-midden op de oorsprong.

    python tools/3d/zen.py public/models
"""
import sys, trimesh, numpy as np
from scipy.interpolate import PchipInterpolator

out = sys.argv[1]
RIBS = 16
SAG = 0.03  # stof ligt bij een balein 3% lager dan midden tussen twee baleinen

# (straal, hoogte) als deel van de grootste straal en de hoogte, van boven naar onder.
SHAPES = {
    'zen-350': (350, 280, [(0.25, 1.0), (0.59, 0.95), (0.84, 0.83), (0.97, 0.71), (1.0, 0.62), (0.97, 0.44), (0.84, 0.25), (0.65, 0.09), (0.40, 0.01), (0.28, 0.0)]),
    'zen-440': (440, 490, [(0.29, 1.0), (0.51, 0.907), (0.71, 0.76), (0.85, 0.613), (0.96, 0.48), (1.0, 0.373), (0.98, 0.253), (0.88, 0.147), (0.71, 0.053), (0.51, 0.013), (0.28, 0.0)]),
    'zen-480': (480, 240, [(0.20, 1.0), (0.55, 0.95), (0.80, 0.85), (0.95, 0.70), (1.0, 0.50), (0.95, 0.30), (0.80, 0.15), (0.55, 0.05), (0.30, 0.0)]),
}


def lantern(diameter, height, profile, rows=48, sections=RIBS * 8):
    pts = np.array(profile)
    t = np.linspace(0, 1, len(pts))
    fine = np.linspace(0, 1, rows)
    r = PchipInterpolator(t, pts[:, 0])(fine) * diameter / 2000
    y = PchipInterpolator(t, pts[:, 1])(fine) * height / 1000
    phi = np.linspace(0, 2 * np.pi, sections, endpoint=False)
    panel = 1 - SAG + SAG * np.abs(np.sin(RIBS * phi / 2))  # 1 midden in een vak, 1 - SAG op een balein
    verts = np.array([[ri * k * np.cos(p), yi, ri * k * np.sin(p)] for ri, yi in zip(r, y) for p, k in zip(phi, panel)])
    faces = []
    for i in range(rows - 1):
        for j in range(sections):
            a, b = i * sections + j, i * sections + (j + 1) % sections
            faces += [[a, b + sections, b], [a, a + sections, b + sections]]
    mesh = trimesh.Trimesh(verts, faces, process=True)
    mesh.fix_normals()
    return mesh


for name, (diameter, height, profile) in SHAPES.items():
    shade = lantern(diameter, height, profile)
    bulb = trimesh.creation.capsule(height=0.06, radius=0.03, count=[24, 24])
    bulb.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    bulb.apply_translation([0, height / 1000 * 0.55, 0])

    scene = trimesh.Scene()
    for role, mesh in [('glass', shade), ('light', bulb)]:
        mesh.visual = trimesh.visual.ColorVisuals(mesh)
        scene.add_geometry(mesh, node_name=role, geom_name=role)
    scene.export(f'{out}/{name}.glb')
    lo, hi = scene.bounds
    print(name, 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000), {n: len(g.faces) for n, g in scene.geometry.items()})
