# Poly Haven trees → light web trees (bake/models/<id>.glb, <id>-light.glb).
# The originals model every leaf as cut-out geometry (~20 triangles, 30,000 leaves, 1-2 M
# triangles per tree). Here each leaf becomes one card (2 triangles) on the leaf's own plane,
# showing the same leaf picture; the cut-out shape comes back as an alpha mask drawn from
# the original leaf triangles. Branches and trunk are decimated. The light version keeps a
# share of the leaves, scaled up so the crown stays as full.
#   blender -b --factory-startup --python tools/blender/prep-trees.py -- <tree id> [...]
import bpy, bmesh, sys, os, math
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'polyhaven', 'models')
OUT = os.path.join(ROOT, 'bake', 'models')
os.makedirs(OUT, exist_ok=True)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
# keep: share of leaves (desktop, light); wood: triangle budget for trunk + branches
CFG = {
    'tree_small_02': {'keep': (0.55, 0.22), 'wood': (14000, 6000)},
    'island_tree_02': {'keep': (0.55, 0.22), 'wood': (16000, 7000)},
}


def log(*a):
    print('[prep-trees]', *a, flush=True)


def arrays(me):
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    tv = np.empty(n * 3, np.int32); me.loop_triangles.foreach_get('vertices', tv)
    tl = np.empty(n * 3, np.int32); me.loop_triangles.foreach_get('loops', tl)
    tm = np.empty(n, np.int32); me.loop_triangles.foreach_get('material_index', tm)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers[0].data.foreach_get('uv', uv)
    return tv.reshape(-1, 3), tl.reshape(-1, 3), tm, co.reshape(-1, 3), uv.reshape(-1, 2)


def islands(T, nv):
    lab = np.arange(nv)
    for _ in range(400):
        m = lab[T].min(axis=1)
        old = lab.copy()
        for k in range(3):
            np.minimum.at(lab, T[:, k], m)
        lab = lab[lab]
        if (lab == old).all():
            break
    return lab[T[:, 0]]


def leaf_mask(uvtris, size):
    # rasterise the (few hundred) unique leaf triangles in texture space → alpha
    q = np.unique(np.round(uvtris.reshape(-1, 6) * 8192).astype(np.int64), axis=0) / 8192.0
    m = np.zeros((size, size), np.float32)
    ss = 4                                        # 4x4 supersampling for soft edges
    for t in q.reshape(-1, 3, 2):
        p = t * size
        x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int)
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, size), min(y1, size)
        if x1 <= x0 or y1 <= y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0 * ss, x1 * ss) + 0.5, np.arange(y0 * ss, y1 * ss) + 0.5)
        gx /= ss; gy /= ss
        (ax, ay), (bx, by), (cx, cy) = p
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-9:
            continue
        l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
        l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
        inside = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
        cov = inside.reshape(y1 - y0, ss, x1 - x0, ss).mean(axis=(1, 3))
        m[y0:y1, x0:x1] = np.maximum(m[y0:y1, x0:x1], cov)
    return m                                       # rows = v (bottom-up, Blender image order)


def bleed(rgb, alpha, passes=24):
    # spread leaf colour into the empty background so mipmaps don't show dark fringes
    rgb = rgb.copy(); filled = alpha > 0.5
    for _ in range(passes):
        acc = np.zeros_like(rgb); cnt = np.zeros(alpha.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(filled, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * sh[..., None]; cnt += sh
        grow = (~filled) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        filled = filled | grow
    return rgb


def leaf_texture(mat, uvtris, name):
    img = [n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and 'diff' in n.image.name][0]
    w, h = img.size
    px = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    a = leaf_mask(uvtris, w)
    rgb = bleed(px[..., :3], a)
    out = bpy.data.images.new(name, w, h, alpha=True)
    out.pixels.foreach_set(np.dstack([rgb, a]).ravel())
    out.filepath_raw = os.path.join(OUT, name + '.png'); out.file_format = 'PNG'; out.save()
    return out, float(a.mean())


def build(tid, keep, wood_budget, leaf_png, light):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, tid, f'{tid}_1k.gltf'))
    src = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = src
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = src.data
    T, TL, TM, CO, UV = arrays(me)
    names = [s.material.name for s in src.material_slots]
    li = [i for i, n in enumerate(names) if 'leaves' in n][0]
    leaf_mat = src.material_slots[li].material

    # ---- leaves → cards
    LT, LL = T[TM == li], TL[TM == li]
    isl = islands(LT, len(CO))
    ids, inv = np.unique(isl, return_inverse=True)
    rng = np.random.default_rng(5)
    keep_ids = rng.random(len(ids)) < keep
    grow = 1.0 / math.sqrt(keep)
    if leaf_png is None:
        img, cover = leaf_texture(leaf_mat, UV[LL], f'{tid}_leaves')
    else:
        img = bpy.data.images.load(leaf_png)
    order = np.argsort(inv, kind='stable')
    bounds = np.searchsorted(inv[order], np.arange(len(ids) + 1))
    verts, faces, uvs = [], [], []
    for k in range(len(ids)):
        if not keep_ids[k]:
            continue
        tri = order[bounds[k]:bounds[k + 1]]
        vi = LT[tri].ravel(); lo = LL[tri].ravel()
        P = CO[vi].astype(np.float64); U = UV[lo].astype(np.float64)
        A = np.c_[U, np.ones(len(U))]
        M, *_ = np.linalg.lstsq(A, P, rcond=None)          # texture space → 3D, affine
        u0, v0 = U.min(0); u1, v1 = U.max(0)
        if u1 - u0 < 1e-5 or v1 - v0 < 1e-5:
            continue
        corners = np.array([[u0, v0, 1], [u1, v0, 1], [u1, v1, 1], [u0, v1, 1]]) @ M
        c = corners.mean(0)
        corners = c + (corners - c) * grow
        b = len(verts)
        verts.extend(corners.tolist()); faces.append((b, b + 1, b + 2, b + 3))
        uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    leaves = bpy.data.meshes.new(f'{tid}_leaves')
    leaves.from_pydata(verts, [], faces)
    uvl = leaves.uv_layers.new(name='UVMap')
    uvl.data.foreach_set('uv', np.array([uvs[i] for f in faces for i in f], np.float32).ravel())
    # leaf material: picture + cut-out mask, both sides
    m = bpy.data.materials.new(f'{tid}_leaves')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.6
    try:
        m.blend_method = 'CLIP'
    except Exception:
        pass
    m.use_backface_culling = False
    leaves.materials.append(m)
    lo_obj = bpy.data.objects.new(f'{tid}_leaves', leaves)
    bpy.context.scene.collection.objects.link(lo_obj)

    # ---- trunk + branches: remove leaves, decimate to the budget
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == li], context='FACES')
    bm.to_mesh(me); bm.free()
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    mod = src.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, wood_budget / max(n, 1))
    bpy.ops.object.select_all(action='DESELECT'); src.select_set(True); bpy.context.view_layer.objects.active = src
    bpy.ops.object.modifier_apply(modifier='dec')
    # drop the now-unused leaf slot
    src.active_material_index = li
    bpy.ops.object.material_slot_remove()
    src.name = f'{tid}_wood'
    for o in (src, lo_obj):
        o.data.calc_loop_triangles()
    wt, lt = len(src.data.loop_triangles), len(lo_obj.data.loop_triangles)
    lo, hi = np.min(np.array(verts), 0), np.max(np.array(verts), 0)
    log(tid, 'light' if light else 'full', f'leaves {len(faces)} cards ({lt} tris), wood {wt} tris, crown {hi - lo}')
    path = os.path.join(OUT, f'{tid}{"-light" if light else ""}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='AUTO', export_yup=True)
    log('wrote', path, round(os.path.getsize(path) / 1e6, 2), 'MB')
    return img


for tid in argv or CFG.keys():
    c = CFG[tid]
    img = build(tid, c['keep'][0], c['wood'][0], None, False)
    # light version: fewer, larger cards, same picture
    build(tid, c['keep'][1], c['wood'][1], os.path.join(OUT, f'{tid}_leaves.png'), True)
