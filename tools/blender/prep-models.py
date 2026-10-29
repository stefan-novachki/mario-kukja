# Poly Haven props → bake/models/<id>.glb, one object per variant ("<id>:<variant>"), each
# standing on its own origin (base centre at 0,0,0), real-world size kept, heavy meshes
# decimated. Prints every variant's size: the real-world scale check.
#   blender -b --factory-startup --python tools/blender/prep-models.py
import bpy, os, re, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'polyhaven', 'models')
OUT = os.path.join(ROOT, 'bake', 'models')
os.makedirs(OUT, exist_ok=True)

# id: (how objects group into variants, triangle budget per variant)
MODELS = {
    'pachira_aquatica_01': (lambda n: n.split('_')[-1], 20000),
    'potted_plant_01': (lambda n: 'a', 20000),
    'potted_plant_04': (lambda n: 'a', 9000),
    'calathea_orbifolia_01': (lambda n: n.split('_')[-1], 4000),
    'ceramic_vase_01': (lambda n: 'a', 4000),
    'ceramic_vase_03': (lambda n: 'a', 4000),
    'book_encyclopedia_set_01': (lambda n: 'a', 6000),
    'throw_pillows_01': (lambda n: re.sub(r'.*pillow0?', '', n), 3500),
    'wooden_bowl_01': (lambda n: 'a', 4000),
    # garden: each file holds several plants in a row; split them where the row has gaps
    'shrub_01': ('split', 3000),
    'shrub_04': ('split', 2500),
}


def split_row(objs, gap=0.06):
    # separate loose parts, then group parts whose x ranges touch (one plant each)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    span = []
    for o in parts:
        xs = [(o.matrix_world @ Vector(c)).x for c in o.bound_box]
        span.append((min(xs), max(xs), o))
    span.sort(key=lambda t: t[0])
    groups, cur, end = {}, [], -1e9
    for x0, x1, o in span:
        if cur and x0 > end + gap:
            groups[chr(97 + len(groups))] = cur; cur = []
        cur.append(o); end = max(end, x1) if cur[:-1] else x1
    if cur:
        groups[chr(97 + len(groups))] = cur
    return groups


def tris(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


report = []
only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for mid, (variant_of, budget) in MODELS.items():
    if only and mid not in only:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, mid, f'{mid}_1k.gltf'))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in objs:                                  # bake parents' transforms into the meshes
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if variant_of == 'split':
        groups = split_row(objs)
    else:
        groups = {}
        for o in objs:
            groups.setdefault(variant_of(o.name), []).append(o)
    keep = []
    for v, members in sorted(groups.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for o in members:
            o.select_set(True)
        bpy.context.view_layer.objects.active = members[0]
        if len(members) > 1:
            bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active
        n = tris(o)
        if n > budget:
            mod = o.modifiers.new('dec', 'DECIMATE'); mod.ratio = budget / n
            bpy.ops.object.modifier_apply(modifier='dec')
        lo = Vector([min((o.matrix_world @ Vector(c))[k] for c in o.bound_box) for k in range(3)])
        hi = Vector([max((o.matrix_world @ Vector(c))[k] for c in o.bound_box) for k in range(3)])
        off = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        o.data.transform(__import__('mathutils').Matrix.Translation(-off))
        o.location = (0, 0, 0)
        o.name = f'{mid}:{v}'
        d = hi - lo
        if variant_of == 'split' and d.z < 0.1:          # loose petals and twigs: not a plant
            bpy.data.objects.remove(o)
            continue
        report.append(f'{o.name:34s} {d.x:6.3f} x {d.y:6.3f} x {d.z:6.3f} m  {n:7d} → {tris(o):6d} tris')
        keep.append(o)
    for o in [x for x in bpy.context.scene.objects if x not in keep]:
        bpy.data.objects.remove(o)
    path = os.path.join(OUT, f'{mid}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='AUTO', export_yup=True)
print('\n'.join(['SCALE CHECK (width x depth x height, as modelled by Poly Haven)'] + report))
