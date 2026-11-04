"""Sliced S/M/L uit 'Maretti Sliced.3ds' (mm, Z omhoog): per kap de zwarte buitenkant (metal), de gouden binnenkant (gold)
en het lampje (light), rechtop gezet (Y omhoog), in meters, onderkant-midden op de oorsprong."""
import sys, pickle, numpy as np, trimesh
axes = pickle.load(open(sys.argv[1], 'rb'))
out = sys.argv[2]
want = {'s': (210, 260), 'm': (400, 330), 'l': (450, 270)}
upright = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])  # Z omhoog -> Y omhoog
for key, (d, h) in want.items():
    # De kap van de 7-lichts opstelling (zonder het lange snoer): breedte en hoogte zoals in de catalogus.
    a = min((a for a in axes if any(m == 'Sliced_m' for m, _ in a['parts'])),
            key=lambda a: abs(max(trimesh.util.concatenate([p for _, p in a['parts']]).extents[:2]) - d) + abs(trimesh.util.concatenate([p for _, p in a['parts']]).extents[2] - h))
    axis = np.array([a['x'], a['y']])
    shells = [p for m, p in a['parts'] if m == 'Sliced_m']
    radius = lambda p: np.hypot(*(p.vertices[:, :2] - axis).T).mean()
    roles = {'light': [p for m, p in a['parts'] if m == 'Sliced_T'], 'gold': [p for m, p in a['parts'] if m == 'Sliced01'], 'metal': []}
    if roles['gold']:
        roles['metal'] = shells
    else:
        # Twee schalen met dezelfde (afgekapte) materiaalnaam: de binnenste is goud, de buitenste zwart.
        shells = sorted(shells, key=radius)
        roles['gold'], roles['metal'] = shells[:1], shells[1:]
    allm = trimesh.util.concatenate([p for ps in roles.values() for p in ps])
    lo = allm.bounds[0]
    scene = trimesh.Scene()
    for role, ps in roles.items():
        if not ps: continue
        mm = trimesh.util.concatenate(ps).copy()
        mm.apply_translation([-axis[0], -axis[1], -lo[2]])
        mm.apply_scale(0.001)
        mm.apply_transform(upright)
        mm.merge_vertices()
        mm.visual = trimesh.visual.ColorVisuals(mm)
        scene.add_geometry(mm, node_name=role, geom_name=role)
    scene.export(f'{out}/sliced-{key}.glb')
    b = scene.bounds
    print(key, 'maat mm', np.round((b[1] - b[0]) * 1000).astype(int).tolist(), {r: len(trimesh.util.concatenate(ps).faces) for r, ps in roles.items() if ps})
