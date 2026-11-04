"""Eettafel uit 'dining table.blend' (Blend Swap #87524, CC BY 3.0) naar GLB voor de configurator:
alleen meshes, op ware grootte (tafelblad op 75 cm), midden van de tafel op de oorsprong, wijnglazen vereenvoudigd."""
import bpy, sys
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
for o in list(bpy.data.objects):
    # Lampen, camera's en de enorme achtergrondvlakken van de studio-opstelling (16 x 16) weglaten.
    if o.type != 'MESH' or max(o.dimensions) > 8:
        bpy.data.objects.remove(o, do_unlink=True)
# Geen texturen meenemen: het zijn stockfoto's van derden (o.a. 123RF) die niet onder de CC BY-licentie van het model vallen.
# De configurator geeft de onderdelen eigen materialen op basis van de materiaalnaam.
meshes = [o for o in bpy.data.objects]
corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
floor = min(c.z for c in corners)
top = max(c.z for o in meshes if o.name == 'Cube.007' for c in [o.matrix_world @ Vector(cc) for cc in o.bound_box])
scale = 0.75 / (top - floor)
cx = (min(c.x for c in corners) + max(c.x for c in corners)) / 2
cy = (min(c.y for c in corners) + max(c.y for c in corners)) / 2
# Afronding (subdivision) van tafel en stoelen op 1 niveau: ziet er hetzelfde uit, maar veel minder vlakken.
for o in meshes:
    for m in o.modifiers:
        if m.type == 'SUBSURF':
            m.levels = m.render_levels = min(m.render_levels, 1)
# Gevlochten zittingen zijn een blokje dat 13 x 12 keer herhaald wordt, elk met afgeronde randen: de afronding weglaten.
for o in meshes:
    if any(m.type == 'ARRAY' for m in o.modifiers):
        for m in [m for m in o.modifiers if m.type == 'BEVEL']:
            o.modifiers.remove(m)
# Zware onderdelen (wijnglazen, eten) vereenvoudigen en de modifiers echt toepassen.
for o in meshes:
    if len(o.data.polygons) > 3000:
        d = o.modifiers.new('vereenvoudigen', 'DECIMATE'); d.ratio = 0.12
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
for o in meshes:
    if o.modifiers:
        mesh = bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph))
        o.modifiers.clear(); o.data = mesh
# Alles onder één lege ouder schalen en verschuiven, dan pas exporteren.
root = bpy.data.objects.new('dining-table', None); bpy.context.scene.collection.objects.link(root)
for o in meshes:
    o.parent = root; o.matrix_parent_inverse = root.matrix_world.inverted()
root.scale = (scale, scale, scale)
root.location = (-cx * scale, -cy * scale, -floor * scale)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_image_format='NONE')
print('SCHAAL', round(scale, 3), 'TAFELHOOGTE', round((top - floor) * scale, 3), 'KLAAR')
