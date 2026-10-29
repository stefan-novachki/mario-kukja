# Leaf structure of a tree model: triangles per material, leaf islands and their size.
#   blender -b --factory-startup --python tools/blender/inspect-tree.py -- <gltf>
import bpy, sys
import numpy as np
path = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
o = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
me = o.data
me.calc_loop_triangles()
n = len(me.loop_triangles)
tv = np.empty(n * 3, np.int32); me.loop_triangles.foreach_get('vertices', tv); tv = tv.reshape(-1, 3)
tm = np.empty(n, np.int32); me.loop_triangles.foreach_get('material_index', tm)
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
for i, s in enumerate(o.material_slots):
    print('MAT', i, s.material.name, 'tris', int((tm == i).sum()))
li = [i for i, s in enumerate(o.material_slots) if 'leaves' in s.material.name][0]
T = tv[tm == li]
# islands by label propagation
lab = np.arange(len(co))
for it in range(200):
    m = lab[T].min(axis=1)
    old = lab.copy()
    np.minimum.at(lab, T[:, 0], m); np.minimum.at(lab, T[:, 1], m); np.minimum.at(lab, T[:, 2], m)
    lab = lab[lab]
    if (lab == old).all(): break
isl = lab[T[:, 0]]
u, cnt = np.unique(isl, return_counts=True)
print('LEAF islands', len(u), 'tris/island median', int(np.median(cnt)), 'p10', int(np.percentile(cnt, 10)), 'p90', int(np.percentile(cnt, 90)), 'max', int(cnt.max()))
# island extent
ext = []
for k in u[:: max(1, len(u) // 400)]:
    vs = np.unique(T[isl == k])
    p = co[vs]
    ext.append(np.linalg.norm(p.max(0) - p.min(0)))
print('LEAF island size m median %.3f p90 %.3f' % (np.median(ext), np.percentile(ext, 90)))
lo, hi = co.min(0), co.max(0)
print('BOUNDS', lo, hi)
