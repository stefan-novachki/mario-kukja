# Quick look at models in golden-hour light: original Poly Haven glTF vs prepared web version.
#   blender -b --factory-startup --python tools/blender/preview-model.py -- out.png file1 [file2 ...]
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
out, files = a[0], a[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
x = 0.0
for f in files:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    lo = min((o.matrix_world @ Vector(c)).x for o in new for c in o.bound_box)
    hi = max((o.matrix_world @ Vector(c)).x for o in new for c in o.bound_box)
    for o in new:
        if o.parent is None:
            o.location.x += x - lo
    x += (hi - lo) + 0.6
sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
try:
    p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'HIP'; p.get_devices()
    for d in p.devices: d.use = d.type == 'HIP'
    sc.cycles.device = 'GPU'
except Exception: pass
sc.cycles.use_denoising = True
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4; sun.data.color = (1, 0.75, 0.55)
sun.rotation_euler = (math.radians(70), 0, math.radians(-120)); sc.collection.objects.link(sun)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.6, 0.75, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
g = bpy.data.objects.new('ground', bpy.data.meshes.new('g')); g.data.from_pydata([(-50, -50, 0), (50, -50, 0), (50, 50, 0), (-50, 50, 0)], [], [(0, 1, 2, 3)]); sc.collection.objects.link(g)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cx = x / 2
cam.location = (cx, -max(3, x * 0.75), 1.6); cam.rotation_euler = (math.radians(78), 0, 0); cam.data.lens = 35
sc.render.resolution_x, sc.render.resolution_y = 1400, 700
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
