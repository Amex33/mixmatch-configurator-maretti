"""Salontafel 'Coffee Table Round 01' (Ulan Cabanilla, Poly Haven, CC0: vrij te gebruiken zonder naamsvermelding)
van glTF met losse texturen naar één GLB voor de configurator: op ware grootte, midden op de oorsprong, onderkant op de vloer."""
import bpy, sys
from mathutils import Vector
src, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector([min(c[i] for c in corners) for i in range(3)]); hi = Vector([max(c[i] for c in corners) for i in range(3)])
root = bpy.data.objects.new('coffee-table', None); bpy.context.scene.collection.objects.link(root)
for o in [o for o in bpy.data.objects if o.parent is None and o is not root]:
    o.parent = root; o.matrix_parent_inverse = root.matrix_world.inverted()
root.location = (-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_image_format='JPEG')
print('KLAAR', [round(v, 2) for v in hi - lo])
