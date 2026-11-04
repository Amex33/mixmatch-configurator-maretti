"""Kleine 3DS-lezer: meshes met hun hoekpunten, vlakken en materiaal per vlak (chunks 0x4000/0x4100/0x4110/0x4120/0x4130)."""
import struct, numpy as np

def read(path):
    data = open(path, 'rb').read()
    meshes = []

    def walk(start, end, name=None, mesh=None):
        pos = start
        while pos + 6 <= end:
            cid, length = struct.unpack_from('<HI', data, pos)
            if length < 6 or pos + length > end:
                break
            body, stop = pos + 6, pos + length
            if cid in (0x4D4D, 0x3D3D):                      # hoofdchunk, editor
                walk(body, stop)
            elif cid == 0x4000:                                # object: naam + inhoud
                nul = data.index(b'\0', body)
                walk(nul + 1, stop, data[body:nul].decode('latin-1'))
            elif cid == 0x4100:                                # driehoeksmesh
                m = {'name': name, 'v': None, 'f': None, 'mat': {}}
                meshes.append(m)
                walk(body, stop, name, m)
            elif cid == 0x4110 and mesh is not None:           # hoekpunten
                n = struct.unpack_from('<H', data, body)[0]
                mesh['v'] = np.frombuffer(data, '<f4', n * 3, body + 2).reshape(n, 3).copy()
            elif cid == 0x4120 and mesh is not None:           # vlakken (+ subchunks met materialen)
                n = struct.unpack_from('<H', data, body)[0]
                mesh['f'] = np.frombuffer(data, '<u2', n * 4, body + 2).reshape(n, 4)[:, :3].astype(np.int64)
                walk(body + 2 + n * 8, stop, name, mesh)
            elif cid == 0x4130 and mesh is not None:           # materiaal -> vlaknummers
                nul = data.index(b'\0', body)
                mat = data[body:nul].decode('latin-1')
                n = struct.unpack_from('<H', data, nul + 1)[0]
                mesh['mat'][mat] = np.frombuffer(data, '<u2', n, nul + 3).astype(np.int64)
            pos = stop

    walk(0, len(data))
    return [m for m in meshes if m['v'] is not None and m['f'] is not None]

if __name__ == '__main__':
    import sys, collections
    ms = read(sys.argv[1])
    print('meshes', len(ms))
    allv = np.vstack([m['v'] for m in ms]); print('min', allv.min(0).round(1), 'max', allv.max(0).round(1))
    mats = collections.Counter()
    for m in ms:
        for k, idx in m['mat'].items(): mats[k] += len(idx)
    print('materialen', mats.most_common())
