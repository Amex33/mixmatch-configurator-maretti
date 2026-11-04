import sys, trimesh, numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

def clusters(mesh, gap=5.0, min_faces=50):
    v, f = mesh.vertices, mesh.faces
    pairs = cKDTree(v).query_pairs(gap, output_type='ndarray')
    e = np.vstack([pairs, f[:, [0, 1]], f[:, [1, 2]]])
    _, lab = connected_components(coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v))), directed=False)
    fl = lab[f[:, 0]]
    out = []
    for l in np.unique(fl):
        idx = np.where(fl == l)[0]
        if len(idx) >= min_faces: out.append(idx)
    return out

if __name__ == '__main__':
    path, mats = sys.argv[1], sys.argv[2].split(',')
    scene = trimesh.load(path, force='scene', group_material=True)
    for mat in mats:
        g = scene.geometry[mat]
        cs = clusters(g)
        summary = {}
        for idx in cs:
            sub = g.submesh([idx], append=True); s = tuple(np.round(sub.bounds[1] - sub.bounds[0]).astype(int))
            summary.setdefault(s, 0); summary[s] += 1
        print(mat, len(cs), 'objecten')
        for s, n in sorted(summary.items(), key=lambda kv: -max(kv[0]))[:10]: print('   ', s, 'x', n)
