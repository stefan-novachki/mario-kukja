# Print size (real-world scale check), triangle count and materials of each Poly Haven model.
#   blender -b --factory-startup --python tools/blender/inspect-models.py -- <models dir>
import bpy, sys, os
from mathutils import Vector
root = sys.argv[sys.argv.index('--') + 1]
for mid in sorted(os.listdir(root)):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    f = [x for x in os.listdir(os.path.join(root, mid)) if x.endswith('.gltf')][0]
    bpy.ops.import_scene.gltf(filepath=os.path.join(root, mid, f))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    tris = 0
    mats = {}
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
        me = o.data
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        for s in o.material_slots:
            if s.material:
                m = s.material
                alpha = m.blend_method if hasattr(m, 'blend_method') else ''
                imgs = [n.image.name for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image] if m.node_tree else []
                mats[m.name] = (alpha, getattr(m, 'surface_render_method', ''), imgs)
    d = hi - lo
    print(f'MODEL {mid}: objects {len(objs)} [{", ".join(o.name for o in objs[:6])}{"..." if len(objs) > 6 else ""}] size {d.x:.3f} x {d.y:.3f} x {d.z:.3f} m (z up), min z {lo.z:.3f}, tris {tris}')
    for k, v in mats.items():
        print(f'   mat {k}: {v}')
