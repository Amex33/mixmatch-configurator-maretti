"""Icosa S, M en L (13.0600, 13.0603, 13.0606) gedraaid uit de lijnen van de maattekeningen in DATA/<sku>/TEK (er zijn geen 3D-bestanden):
glazen kap met open onderkant, zwarte E27-fitting met snoertule erboven en een lampje. Meters, onderkant-midden op de oorsprong.

    pip install pymupdf
    python tools/3d/icosa.py public/models
"""
import sys, trimesh, numpy as np, pymupdf

out = sys.argv[1]
DATA = '//192.168.206.240/Producten/DATA'
SIZES = {'s': ('13.0600', 165, 280), 'm': ('13.0603', 225, 215), 'l': ('13.0606', 340, 225)}
# Volgorde van de lijnen in elke tekening: kap, onderrand, fitting, (snoer), tule.
GLASS, RIM, CUP, GROMMET = 1, 2, 3, 5


def points(drawing, steps=24):
    """Alle punten van een pad, bochten (bezier) opgedeeld in korte stukjes."""
    pts = []
    for item in drawing['items']:
        if item[0] == 'l':
            pts += [item[1], item[2]]
        elif item[0] == 'c':
            p0, p1, p2, p3 = item[1:5]
            for t in np.linspace(0, 1, steps):
                pts.append(p0 * (1 - t) ** 3 + p1 * 3 * t * (1 - t) ** 2 + p2 * 3 * t ** 2 * (1 - t) + p3 * t ** 3)
    return np.array([(p.x, p.y) for p in pts])


def half(drawing, axis, bottom, sx, sy):
    """Rechterhelft van een omtrek als profiel (straal, hoogte) in meters, van boven naar beneden, één straal per hoogte."""
    pts = points(drawing)
    pts = pts[pts[:, 0] >= axis - 1e-3]
    pts = pts[np.argsort(pts[:, 1])]
    profile = []
    for y in np.unique(np.round(pts[:, 1], 2)):
        r = pts[np.abs(pts[:, 1] - y) < 0.006][:, 0].max() - axis
        profile.append((r * sx, (bottom - y) * sy))
    return profile


def lathe(profile, sections=96):
    """Profiel (straal, hoogte) rond de y-as draaien."""
    phi = np.linspace(0, 2 * np.pi, sections, endpoint=False)
    verts = np.array([[r * np.cos(p), y, r * np.sin(p)] for r, y in profile for p in phi])
    faces = []
    for i in range(len(profile) - 1):
        for j in range(sections):
            a, b = i * sections + j, i * sections + (j + 1) % sections
            faces += [[a, b + sections, b], [a, a + sections, b + sections]]
    mesh = trimesh.Trimesh(verts, faces, process=True)
    mesh.fix_normals()
    return mesh


for size, (sku, diameter, height) in SIZES.items():
    page = pymupdf.open(f'{DATA}/{sku}/TEK/{sku}_tek.ai')[0]
    paths = page.get_drawings()
    rim, outline = paths[RIM]['rect'], paths[GLASS]['rect']
    axis, bottom = (rim.x0 + rim.x1) / 2, outline.y1
    # De tekeningen zijn niet overal precies op schaal (S: ~3%), daarom breedte en hoogte apart op de opgegeven maten.
    widest = max(r for r, _ in half(paths[GLASS], axis, bottom, 1, 1))
    sx, sy = diameter / 2000 / widest, height / 1000 / outline.height

    glass = half(paths[GLASS], axis, bottom, sx, sy)
    # Uitdunnen tot ~80 ringen: genoeg voor de bochten, licht genoeg voor de website.
    glass = [glass[i] for i in np.unique(np.linspace(0, len(glass) - 1, 80).astype(int))]
    holder = trimesh.util.concatenate([lathe([(0, (bottom - paths[p]['rect'].y0) * sy)] + half(paths[p], axis, bottom, sx, sy), 48) for p in (CUP, GROMMET)])
    glass_top = glass[0][1]
    bulb = trimesh.creation.capsule(height=min(0.05, glass_top * 0.25), radius=0.022 if size != 's' else 0.017, count=[24, 24])
    bulb.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
    bulb.apply_translation([0, glass_top - 0.06, 0])

    scene = trimesh.Scene()
    for role, mesh in [('glass', lathe(glass)), ('holder', holder), ('light', bulb)]:
        mesh.visual = trimesh.visual.ColorVisuals(mesh)
        scene.add_geometry(mesh, node_name=role, geom_name=role)
    scene.export(f'{out}/icosa-{size}.glb')
    lo, hi = scene.bounds
    print(f'icosa-{size}', 'breedte', round((hi[0] - lo[0]) * 1000), 'hoogte', round((hi[1] - lo[1]) * 1000),
          'glas', round(glass_top * 1000), {name: len(g.faces) for name, g in scene.geometry.items()})
