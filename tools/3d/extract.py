"""Eén lamp per maat uit de Maretti SketchUp-scènes halen en als GLB (meters, onderkant-midden = oorsprong) opslaan.
Elke GLB heeft meshes per rol: glass, metal, holder, gold, light; de configurator geeft elke rol zijn eigen materiaal."""
import sys, json, trimesh, numpy as np
sys.path.insert(0, sys.argv[3])
from clusters import clusters

D, OUT = sys.argv[1], sys.argv[2]
CFG = {
    'Maretti Tulip.obj': [
        ('tulip-s', 'Tulip_Glass_Orange_1', 'glass', (200, 150), [('fitting__1', 'metal', 45, 0, 110), ('Black_metal_1', 'metal', 45, 0, 110)]),
        ('tulip-m', 'Tulip_Glass_Orange_1', 'glass', (300, 250), [('fitting__1', 'metal', 45, 0, 110), ('Black_metal_1', 'metal', 45, 0, 110)]),
        ('tulip-l', 'Tulip_Glass_Orange_1', 'glass', (400, 345), [('fitting__1', 'metal', 45, 0, 110), ('Black_metal_1', 'metal', 45, 0, 110)]),
    ],
    'Maretti Icon.obj': [
        ('icon', 'ICON_glass_clear', 'glass', (50, 400), [('LED_3000k', 'light', 25, 0, 0), ('Black_metal_1', 'metal', 30, 0, 80)]),
    ],
    'Maretti Glass Jewel.obj': [
        ('jewel-s', 'Glass_Icon_bronze_1', 'holder', (130, 157), [('Glass_Jewel_glass_2', 'glass', None, 0, 0), ('Glass_Jewels_light_1', 'light', None, 0, 0)]),
        ('jewel-l', 'Glass_Icon_bronze_1', 'holder', (130, 200), [('Glass_Jewel_glass_2', 'glass', None, 0, 0), ('Glass_Jewels_light_1', 'light', None, 0, 0)]),
    ],
    'Maretti Paradiso.obj': [
        ('paradiso-170', 'Paradiso_Opal_glass_1', 'glass', (170, 105), [('Paradiso_brass_1', 'holder', 45, 20, 130), ('Bulb_light1', 'light', None, 0, 0)]),
        ('paradiso-250', 'Paradiso_Opal_glass_1', 'glass', (250, 150), [('Paradiso_brass_1', 'holder', 45, 20, 130), ('Bulb_light1', 'light', None, 0, 0)]),
    ],
    'Maretti Soffio pendant.obj': [
        ('soffio', 'Clear', 'glass', (148, 92), [('Maretti_Gun_metal', 'holder', 40, 10, 170), ('Sliced_Tommy_Bulb_light1', 'light', None, 0, 0)]),
    ],
    'Maretti Tommy.obj': [
        (f'tommy-{n}', 'Sliced_Tommy__metal_black_1', 'metal', (d, h), [('Sliced_metal_Gold_24k', 'gold', None, 0, 0), ('Sliced_Tommy_Bulb_light1', 'light', None, 0, 0),
                                                                     ('Sliced_Tommy__metal_black_1', 'metal', 60, 0, 90)])
        for n, d, h in [(27, 270, 170), (32, 320, 170), (45, 450, 170), (60, 600, 230)]
    ],
    'Maretti Bo.obj': [
        ('bo', 'Maretti_BO_bronze_1', 'holder', (47, 800), [('Light_emissive_BO_downlight', 'light', 30, 0, 0)]),
    ],
}
import glob, os
info = {}
for fname, models in CFG.items():
    path = next(p for p in glob.glob(f'{D}/**/{fname}', recursive=True) if '__MACOSX' not in p and '13.1382' not in p)
    scene = trimesh.load(path, force='scene', group_material=True)
    cache = {}
    for name, seed_mat, seed_role, (tw, th), includes in models:
        g = scene.geometry[seed_mat]
        if seed_mat not in cache:
            cache[seed_mat] = [(idx, g.submesh([idx], append=True)) for idx in clusters(g)]
        # Het object waarvan breedte en hoogte het dichtst bij de doelmaat liggen.
        idx, seed = min(cache[seed_mat], key=lambda c: abs(max(c[1].extents[0], c[1].extents[2]) - tw) + abs(c[1].extents[1] - th))
        lo, hi = seed.bounds
        axis = (lo + hi) / 2
        half = max(seed.extents[0], seed.extents[2]) / 2
        parts = {seed_role: [seed]}
        for mat, role, radius, below, above in includes:
            m = scene.geometry[mat]
            c = m.triangles_center
            r = (radius or half + 5)
            sel = (np.hypot(c[:, 0] - axis[0], c[:, 2] - axis[2]) <= r) & (c[:, 1] >= lo[1] - below - (0 if above else 5)) & (c[:, 1] <= hi[1] + (above or 5))
            if mat == seed_mat:
                sel &= ~np.isin(np.arange(len(m.faces)), idx)  # de kap zelf niet dubbel
                sel &= c[:, 1] > hi[1] - 5                      # alleen wat erboven zit (kapje)
            if sel.any():
                parts.setdefault(role, []).append(m.submesh([np.where(sel)[0]], append=True))
        meshes = {role: trimesh.util.concatenate(ms) for role, ms in parts.items()}
        all_lo = np.min([mm.bounds[0] for mm in meshes.values()], axis=0); all_hi = np.max([mm.bounds[1] for mm in meshes.values()], axis=0)
        out = trimesh.Scene()
        for role, mm in meshes.items():
            mm = mm.copy(); mm.apply_translation([-axis[0], -all_lo[1], -axis[2]]); mm.apply_scale(0.001); mm.merge_vertices()
            mm.visual = trimesh.visual.ColorVisuals(mm)
            out.add_geometry(mm, node_name=role, geom_name=role)
        out.export(f'{OUT}/{name}.glb')
        size = np.round((all_hi - all_lo)).astype(int)
        info[name] = {'width': int(max(size[0], size[2])), 'height': int(size[1]), 'faces': {r: len(m.faces) for r, m in meshes.items()}}
        print(name, 'kap', np.round(seed.extents).astype(int).tolist(), 'geheel', size.tolist(), {r: len(m.faces) for r, m in meshes.items()})
json.dump(info, open(f'{OUT}/models.json', 'w'), indent=1)
