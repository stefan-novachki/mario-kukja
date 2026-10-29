# Bake the light of Kukja Mario with Cycles: into lightmap atlases (walls, floors, furniture,
# garden) and into the vertices of the styling and the trees (models/decor.glb, trees*.glb).
#   blender -b --factory-startup --python tools/blender/bake.py -- [--samples 256] [--atlas arch|none]
#          [--vsamples 1024] [--no-vertex] [--no-denoise]
# Two light layers per atlas:
#   day  = low golden-hour sun from the west + sky, through the real glass
#   lamp = every lamp in the house and garden (no sun, no sky)
# Output: site/lightmaps/<atlas>.png (2048) and <atlas>-1k.png:
#   RGB = sqrt(day / MAX), A = sqrt(lamp luminance / MAX)  — decoded in the website shader.
import bpy, json, math, os, sys, time
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(name, default):
    return type(default)(argv[argv.index(name) + 1]) if name in argv else default

SAMPLES = opt('--samples', 256)
LAMP_SAMPLES = opt('--lamp-samples', SAMPLES * 2)   # many small lights need more samples
ONLY = opt('--atlas', '')
DENOISE = '--no-denoise' not in argv
VSAMPLES = opt('--vsamples', 1024)               # per-vertex bake (no denoiser there)
VERTEX = '--no-vertex' not in argv
VSETS = opt('--vsets', 'decor,trees,light').split(',')   # which per-vertex groups to bake
MAX = 6.0                     # largest light value stored (sunlit wall at golden hour ~5)
SUN_STRENGTH = 4.6            # W/m², warm and low
SUN_ELEV = 13.0               # degrees
SUN_PLAN = Vector((-1.0, -0.12)).normalized()   # towards the sun in plan: west, along the driveway
SKY_STRENGTH = 1.45
LAMP_SCALE = 1.0

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BAKE = os.path.join(ROOT, 'bake')
OUT = os.path.join(ROOT, 'site', 'lightmaps')
os.makedirs(OUT, exist_ok=True)
t0 = time.time()
def log(*a):
    print(f'[{time.time() - t0:6.1f}s]', *a, flush=True)

# ------------------------------------------------------------------ scene
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(BAKE, 'house.glb'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'HIP'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'HIP'
    sc.cycles.device = 'GPU' if any(d.use for d in prefs.devices) else 'CPU'
except Exception as e:
    log('GPU not available, using CPU', e)
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 8
sc.cycles.diffuse_bounces = 5
sc.cycles.glossy_bounces = 2
sc.cycles.transmission_bounces = 4
sc.cycles.transparent_max_bounces = 8
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
sc.render.bake.margin = 4
sc.render.bake.margin_type = 'EXTEND'
log('device', sc.cycles.device, 'samples', SAMPLES)

# ------------------------------------------------------------------ Poly Haven styling and trees
placements = json.load(open(os.path.join(BAKE, 'placements.json')))
palette = json.load(open(os.path.join(BAKE, 'palette.json')))
src_coll = bpy.data.collections.new('SRC')        # not in the scene: the originals stay out of the render
sources = {}

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        src_coll.objects.link(o)
    return [o for o in new if o.type == 'MESH']

def source(model):
    # 'pachira_aquatica_01:d' → that variant; 'island_tree_02[-light]' → its wood and leaves
    fid = model.split(':')[0]
    if fid not in sources:
        sources[fid] = import_glb(os.path.join(BAKE, 'models', f'{fid}.glb'))
    return [o for o in sources[fid] if ':' not in model or o.name.split('.')[0] == model]

def palette_material(name):
    for m in bpy.data.materials:
        if m.name.split('|')[-1] == name:
            return m
    p = palette.get(name, {'color': [0.7, 0.7, 0.7], 'roughness': 0.8})
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*p['color'], 1)
    b.inputs['Roughness'].default_value = p['roughness']
    return m

def place(p, tag, model=None):
    out = []
    M = Matrix.Translation(Vector(p['at'])) @ Matrix.Rotation(p['yaw'], 4, 'Z') @ Matrix.Rotation(p['tilt'], 4, 'X') @ Matrix.Scale(p['scale'], 4)
    for s0 in source(model or p['model']):
        o = s0.copy()
        o.data = s0.data.copy()
        o.matrix_world = M @ s0.matrix_world
        if p.get('mat'):
            o.data.materials.clear()
            o.data.materials.append(palette_material(p['mat']))
        o.name = f'V|{tag}|{p.get("zoneName", "garden")}|{s0.name}'
        o['desk'] = 1 if p.get('tier') == 'desktop' else 0
        sc.collection.objects.link(o)
        out.append(o)
    return out

decor_objs = [o for p in placements['decor'] for o in place(p, 'decor')]
tree_objs = [o for p in placements['trees'] for o in place(p, 'tree')]
light_tree_objs = [o for p in placements['trees'] for o in place(p, 'treelight', p['model'] + '-light')]
for o in light_tree_objs:
    o.hide_render = True                       # the light trees get their own pass at the end
code_decor = [o for o in sc.objects if o.type == 'MESH' and o.name.startswith('V|decor|') and o not in decor_objs]
import bmesh
for o in code_decor:                               # glTF import keeps 3 vertices per triangle: weld them
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(o.data); bm.free()
decor_objs += code_decor
log('styling objects', len(decor_objs), 'trees', len(tree_objs), '+ light', len(light_tree_objs))

meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes:
    if len(o.data.uv_layers) > 1:
        o.data.uv_layers.active_index = 1        # bake into the lightmap UVs (TEXCOORD_1)

# glowing fixture parts must not light the scene (the lamps do)
for m in bpy.data.materials:
    base = m.name.split('|')[-1]
    if base in ('glow', 'glowOut', 'shade') and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                n.inputs['Emission Strength'].default_value = 0.0

# ------------------------------------------------------------------ sun, sky, lamps
d = Vector((SUN_PLAN.x * math.cos(math.radians(SUN_ELEV)), SUN_PLAN.y * math.cos(math.radians(SUN_ELEV)), math.sin(math.radians(SUN_ELEV))))
sun_data = bpy.data.lights.new('sun', 'SUN')
sun_data.energy = SUN_STRENGTH
sun_data.angle = math.radians(1.2)
sun_data.color = (1.0, 0.72, 0.5)
sun = bpy.data.objects.new('sun', sun_data)
sun.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
sc.collection.objects.link(sun)

world = bpy.data.worlds.new('sky')
sc.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
ramp = nt.nodes.new('ShaderNodeValToRGB')
bg = nt.nodes.new('ShaderNodeBackground')
wo = nt.nodes.new('ShaderNodeOutputWorld')
mr = nt.nodes.new('ShaderNodeMapRange')
mr.inputs['From Min'].default_value = -0.15
mr.inputs['From Max'].default_value = 1.0
nt.links.new(tc.outputs['Generated'], sep.inputs[0])
nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
el = ramp.color_ramp.elements
el[0].position, el[0].color = 0.0, (0.28, 0.26, 0.22, 1)        # ground bounce
el[1].position, el[1].color = 1.0, (0.30, 0.42, 0.70, 1)        # zenith
e = el.new(0.13); e.color = (1.0, 0.8, 0.64, 1)                 # warm horizon
e = el.new(0.40); e.color = (0.58, 0.66, 0.80, 1)
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], wo.inputs['Surface'])
bg.inputs['Strength'].default_value = SKY_STRENGTH

lamps = []
for L in json.load(open(os.path.join(BAKE, 'lamps.json'))):
    ld = bpy.data.lights.new(L['id'], L['type'])
    ld.energy = L['power'] * LAMP_SCALE
    ld.color = L['color']
    if L['type'] in ('POINT', 'SPOT'):
        ld.shadow_soft_size = L.get('radius', 0.05)
    if L['type'] == 'SPOT':
        ld.spot_size = math.radians(L.get('angle', 80))
        ld.spot_blend = 0.6
    if L['type'] == 'AREA':
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = L['size']
    ob = bpy.data.objects.new(L['id'], ld)
    ob.location = L['at']
    aim = L.get('aim', 'down')
    ob.rotation_euler = {'down': (0, 0, 0), 'up': (math.pi, 0, 0), '+x': (0, -math.pi / 2, 0), '-x': (0, math.pi / 2, 0),
                         '+y': (math.pi / 2, 0, 0), '-y': (-math.pi / 2, 0, 0)}[aim]
    if aim in ('+x', '-x', '+y', '-y') and L['type'] == 'AREA':
        ld.size, ld.size_y = (L['size'][1], L['size'][0]) if aim in ('+x', '-x') else (L['size'][0], L['size'][1])
    sc.collection.objects.link(ob)
    lamps.append(ob)

def set_layer(layer):
    sun.hide_render = layer != 'day'
    bg.inputs['Strength'].default_value = SKY_STRENGTH if layer == 'day' else 0.0
    for ob in lamps:
        ob.hide_render = layer != 'lamp'

# ------------------------------------------------------------------ baking
atlases = json.load(open(os.path.join(BAKE, 'atlases.json')))
charts = json.load(open(os.path.join(BAKE, 'charts.json')))

def bake(atlas, size, layer):
    img = bpy.data.images.new(f'lm_{atlas}_{layer}', size, size, alpha=False, float_buffer=True)
    objs = [o for o in meshes if o.name.startswith(f'B|{atlas}|')]
    for o in objs:
        for slot in o.material_slots:
            nt = slot.material.node_tree
            n = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
            n.name = 'BAKE'
            n.image = img
            nt.nodes.active = n
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    set_layer(layer)
    sc.cycles.samples = LAMP_SAMPLES if layer == 'lamp' else SAMPLES
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=4, use_clear=True, target='IMAGE_TEXTURES')
    return img

def pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)

def chart_guide(atlas, size):
    # one flat random colour per lightmap patch: tells the denoiser where patches end
    rng = np.random.default_rng(3)
    g = np.zeros((size, size, 4), dtype=np.float32)
    g[..., 3] = 1
    for x, y, w, h in charts[atlas]:
        r0 = size - (y + h)                    # Blender rows run bottom-up
        g[max(0, r0 - 2):size - y + 2, max(0, x - 2):x + w + 2, :3] = rng.uniform(0.05, 0.95, 3)
    img = bpy.data.images.new(f'guide_{atlas}', size, size, alpha=False, float_buffer=True)
    img.pixels.foreach_set(g.ravel())
    return img

def denoise(img, guide):
    dn = bpy.data.scenes.get('DN') or bpy.data.scenes.new('DN')
    dn.render.engine = 'BLENDER_WORKBENCH'
    dn.render.resolution_x, dn.render.resolution_y = img.size
    dn.render.resolution_percentage = 100
    dn.render.use_compositing = True
    dn.render.image_settings.file_format = 'OPEN_EXR'
    dn.render.image_settings.color_depth = '32'
    dn.view_settings.view_transform = 'Standard'
    ng = bpy.data.node_groups.new('dn', 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    a = ng.nodes.new('CompositorNodeImage'); a.image = img
    g = ng.nodes.new('CompositorNodeImage'); g.image = guide
    n = ng.nodes.new('CompositorNodeDenoise')
    n.inputs['HDR'].default_value = True
    try:
        n.inputs['Prefilter'].default_value = 'None'
    except Exception:
        pass
    out = ng.nodes.new('NodeGroupOutput')
    ng.links.new(a.outputs['Image'], n.inputs['Image'])
    ng.links.new(g.outputs['Image'], n.inputs['Albedo'])
    ng.links.new(n.outputs['Image'], out.inputs[0])
    dn.compositing_node_group = ng
    path = os.path.join(BAKE, f'_dn_{img.name}.exr')
    dn.render.filepath = path
    bpy.ops.render.render(write_still=True, scene='DN')
    res = bpy.data.images.load(path)
    res.colorspace_settings.name = 'Linear Rec.709'
    out_px = pixels(res)
    bpy.data.node_groups.remove(ng)
    return out_px

for atlas, info in atlases.items():
    if ONLY and atlas != ONLY:
        continue
    size = info['size']
    guide = chart_guide(atlas, size) if DENOISE else None
    layers = {}
    for layer in ('day', 'lamp'):
        log('baking', atlas, layer, size)
        img = bake(atlas, size, layer)
        px = denoise(img, guide) if DENOISE else pixels(img)
        layers[layer] = px[..., :3]
        log('  done', atlas, layer, 'max', float(layers[layer].max()), 'mean', float(layers[layer].mean()))
    day, lamp = layers['day'], layers['lamp']
    lum = lamp[..., 0] * 0.2126 + lamp[..., 1] * 0.7152 + lamp[..., 2] * 0.0722
    out = np.zeros((size, size, 4), dtype=np.float32)
    out[..., :3] = np.sqrt(np.clip(day / MAX, 0, 1))
    out[..., 3] = np.sqrt(np.clip(lum / MAX, 0, 1))
    for suffix, s in (('', size), ('-1k', size // 2)):
        im = bpy.data.images.new(f'out_{atlas}{suffix}', size, size, alpha=True)
        im.colorspace_settings.name = 'Non-Color'
        im.alpha_mode = 'STRAIGHT'
        im.pixels.foreach_set(out.ravel())
        if s != size:
            im.scale(s, s)
        im.filepath_raw = os.path.join(OUT, f'{atlas}{suffix}.png')
        im.file_format = 'PNG'
        im.save()
    log('saved', atlas)
# ------------------------------------------------------------------ light per vertex: styling and trees
def principled(m):
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m and m.node_tree else None

def has_alpha(o):
    b = principled(o.data.materials[0]) if o.data.materials else None
    return bool(b and b.inputs['Alpha'].is_linked)

def split_by_material(o):
    if len(o.data.materials) <= 1:
        return [o]
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    return list(bpy.context.selected_objects)

probe_mat = bpy.data.materials.new('probe')
probe_mat.use_nodes = True

def make_probe(o, toward=None):
    # one tiny opaque triangle in front of every face of a cut-out (alpha) mesh: the corners of a
    # leaf card lie in its transparent part, so the light is measured here and copied back.
    # Probes are invisible to light, shadow and reflection rays, so they change nothing in the bake
    # (camera visibility stays on: with every ray type off Cycles skips the object entirely).
    me = o.data
    n = len(me.polygons)
    c = np.empty(n * 3, np.float32); me.polygons.foreach_get('center', c)
    nr = np.empty(n * 3, np.float32); me.polygons.foreach_get('normal', nr)
    M = np.array(o.matrix_world)
    c = c.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
    nr = nr.reshape(-1, 3) @ np.linalg.inv(M[:3, :3])
    nr /= np.linalg.norm(nr, axis=1, keepdims=True) + 1e-9
    if toward is not None:                      # leaves: measure the side the low sun reaches
        nr[(nr @ np.array(toward)) < 0] *= -1
    a = np.cross(nr, np.where(np.abs(nr[:, 2:3]) < 0.9, [[0, 0, 1]], [[1, 0, 0]]))
    a /= np.linalg.norm(a, axis=1, keepdims=True)
    b = np.cross(nr, a)
    s, cc = 0.004, c + nr * 0.002
    v = np.stack([cc + a * s, cc + (-0.5 * a + 0.866 * b) * s, cc + (-0.5 * a - 0.866 * b) * s], 1).reshape(-1, 3)
    pm = bpy.data.meshes.new('probe')
    pm.vertices.add(len(v)); pm.vertices.foreach_set('co', v.ravel().astype(np.float32))
    pm.loops.add(len(v)); pm.loops.foreach_set('vertex_index', np.arange(len(v), dtype=np.int32))
    pm.polygons.add(n); pm.polygons.foreach_set('loop_start', np.arange(0, len(v), 3, dtype=np.int32))
    pm.update()
    pm.materials.append(probe_mat)
    po = bpy.data.objects.new('P|' + o.name, pm)
    for k in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(po, k, False)
    sc.collection.objects.link(po)
    return po

def color_attr(o, name):
    me = o.data
    a = me.color_attributes.get(name) or me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = a
    return a

def read_attr(o, name):
    a = o.data.color_attributes[name]
    x = np.empty(len(a.data) * 4, np.float32); a.data.foreach_get('color', x)
    return x.reshape(-1, 4)

def join(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    return bpy.context.view_layer.objects.active

ZONE_IDS = {}
DESK_MATS = {'hedgeLeafFill'}          # code-built styling left out of the phone files
def tag_zone(o):
    # room and tier as vertex attributes: they survive joining, so the export can split by room
    parts = o.name.split('|')
    zn = parts[2] if len(parts) > 3 else 'garden'
    zid = ZONE_IDS.setdefault(zn, len(ZONE_IDS))
    me = o.data
    desk = int(o.get('desk', 0)) or int(parts[-1].split('.')[0] in DESK_MATS)
    for nm, val in (('zone_id', zid), ('desk', desk)):
        a = me.attributes.get(nm) or me.attributes.new(nm, 'INT', 'POINT')
        a.data.foreach_set('value', np.full(len(me.vertices), val, np.int32))

def vertex_bake(objs, label, sun_side=False):
    for o in objs:
        tag_zone(o)
    # Cycles pays a fixed cost per baked object, so bake two big objects: everything solid, and
    # every cut-out (leaves) measured through its probe triangles.
    work = [w for o in objs for w in split_by_material(o)]
    solid = [o for o in work if not has_alpha(o)]
    cut = [o for o in work if has_alpha(o)]
    work = ([join(solid)] if solid else []) + ([join(cut)] if cut else [])
    # leaves are measured on the side the light comes from: the low sun for daylight, from below
    # for the lamps (the garden uplights shine up into the crowns)
    cutobj = work[-1] if cut else None
    probe = {}
    if cutobj:
        probe['day'] = make_probe(cutobj, tuple(d) if sun_side else None)
        probe['lamp'] = make_probe(cutobj, (0.0, 0.0, -1.0)) if sun_side else probe['day']
    for layer in ('day', 'lamp'):
        targets = [probe[layer] if o is cutobj else o for o in work]
        for t in targets:
            color_attr(t, f'LM_{layer}')
        bpy.ops.object.select_all(action='DESELECT')
        for t in targets:
            t.select_set(True)
        bpy.context.view_layer.objects.active = targets[0]
        set_layer(layer)
        sc.cycles.samples = VSAMPLES * (2 if layer == 'lamp' and not sun_side else 1)
        tb = time.time()
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS', use_clear=True)
        log('vertex bake', label, layer, len(targets), 'objects', sum(len(t.data.vertices) for t in targets), 'vertices', sc.cycles.samples, 'samples', round(time.time() - tb, 1), 's')
    for o in work:
        dsrc = probe['day'] if o is cutobj else o
        lsrc = probe['lamp'] if o is cutobj else o
        day, lamp = read_attr(dsrc, 'LM_day')[:, :3], read_attr(lsrc, 'LM_lamp')[:, :3]
        lum = lamp @ np.array([0.2126, 0.7152, 0.0722])
        enc = np.c_[np.sqrt(np.clip(day / MAX, 0, 1)), np.sqrt(np.clip(lum / MAX, 0, 1))].astype(np.float32)
        if o is cutobj:                           # probe i belongs to face i: give every vertex its faces' mean
            me = o.data
            fi = np.repeat(np.arange(len(me.polygons)), [len(p.vertices) for p in me.polygons])
            vi = np.empty(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', vi)
            per_face = enc[::3]
            acc = np.zeros((len(me.vertices), 4), np.float32); cnt = np.zeros(len(me.vertices), np.float32)
            np.add.at(acc, vi, per_face[fi]); np.add.at(cnt, vi, 1)
            enc = acc / np.maximum(cnt, 1)[:, None]
        a = color_attr(o, 'LIGHT')
        a.data.foreach_set('color', enc.ravel())
        for nm in ('LM_day', 'LM_lamp'):
            if nm in o.data.color_attributes:
                o.data.color_attributes.remove(o.data.color_attributes[nm])
        o.data.color_attributes.active_color = o.data.color_attributes['LIGHT']
    probes = {id(v): v for v in probe.values()}
    for po in probes.values():
        bpy.data.objects.remove(po)
    return work

def slim_textures(objs):
    # web models: colour and relief only (the light is baked), small props at 512 px
    seen = set()
    for o in objs:
        for m in o.data.materials:
            if not m or not m.node_tree or m.name in seen:
                continue
            seen.add(m.name)
            nt = m.node_tree
            for n in list(nt.nodes):
                if n.type != 'TEX_IMAGE' or not n.image:
                    continue
                name = n.image.name.lower()
                if any(k in name for k in ('arm', 'rough', 'metal', 'spec')):
                    nt.nodes.remove(n)
                    b = principled(m)
                    if b:                                  # constant values instead of the removed map
                        b.inputs['Metallic'].default_value = 0.0
                        b.inputs['Roughness'].default_value = 0.55
                    continue
                big = any(k in name for k in ('leaves', 'leaf', 'calathea', 'pachira'))
                cap = (1024 if big else 512) if 'nor' not in name else (512 if big else 256)
                w, h = n.image.size
                if max(w, h) > cap:
                    n.image.scale(int(w * cap / max(w, h)), int(h * cap / max(w, h)))

def export(objs, path):
    slim_textures(objs)
    for o in objs:
        me = o.data
        while len(me.uv_layers) > 1:
            me.uv_layers.remove(me.uv_layers[-1])
        if me.uv_layers:
            me.uv_layers[0].name = 'UVMap'
        for m in me.materials:
            if m and '|' in m.name:
                m.name = m.name.split('|')[-1]       # palette name: the website uses its own material
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = split_by_material(bpy.context.view_layer.objects.active)
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_materials='EXPORT',
                              export_vertex_color='NAME', export_vertex_color_name='LIGHT', export_all_vertex_colors=False,
                              export_draco_mesh_compression_enable=True, export_draco_position_quantization=16,
                              export_draco_texcoord_quantization=16, export_draco_normal_quantization=10, export_draco_color_quantization=10,
                              export_image_format='AUTO', export_image_quality=88)   # JPEG/PNG: re-encoded to KTX2 by tools/compress.mjs
    tris = 0
    for o in joined:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    log('wrote', path, round(os.path.getsize(path) / 1e6, 2), 'MB,', len(joined), 'meshes,', tris, 'triangles')
    return joined

if VERTEX:
    MODELS_OUT = os.path.join(ROOT, 'site', 'models')
    os.makedirs(MODELS_OUT, exist_ok=True)
    if 'decor' in VSETS:
        baked = vertex_bake(decor_objs, 'styling')
        manifest = {}
        for zn, zid in sorted(ZONE_IDS.items(), key=lambda t: t[1]):
            for light in (False, True):
                parts = []
                for o in baked:
                    c = o.copy(); c.data = o.data.copy(); sc.collection.objects.link(c)
                    bm = bmesh.new(); bm.from_mesh(c.data)
                    zl, dl = bm.verts.layers.int.get('zone_id'), bm.verts.layers.int.get('desk')
                    drop = [f for f in bm.faces if f.verts[0][zl] != zid or (light and f.verts[0][dl] == 1)]
                    bmesh.ops.delete(bm, geom=drop, context='FACES')
                    bm.to_mesh(c.data); bm.free()
                    if len(c.data.polygons):
                        parts.append(c)
                    else:
                        bpy.data.objects.remove(c)
                if not parts:
                    continue
                tris = sum(len(p.data.polygons) for p in parts)
                if light and tris == manifest.get(zn, {}).get('tris'):
                    for p in parts:
                        bpy.data.objects.remove(p)
                    continue                         # nothing desktop-only in this room
                name = f'decor-{zn}{"-light" if light else ""}.glb'
                export(parts, os.path.join(MODELS_OUT, name))
                manifest.setdefault(zn, {})['light' if light else 'file'] = name
                if not light:
                    manifest[zn]['tris'] = tris
        for v in manifest.values():
            v.setdefault('light', v['file'])
        json.dump(manifest, open(os.path.join(MODELS_OUT, 'decor.json'), 'w'), indent=1)
        log('styling per room:', ', '.join(f'{k} {v["tris"]}' for k, v in manifest.items()))
    if 'trees' in VSETS:
        tree_objs = export(vertex_bake(tree_objs, 'trees', sun_side=True), os.path.join(MODELS_OUT, 'trees.glb'))
    if 'light' in VSETS:
        for o in tree_objs:
            o.hide_render = True                # light trees: the same garden, fewer leaves
        for o in light_tree_objs:
            o.hide_render = False
        export(vertex_bake(light_tree_objs, 'light trees', sun_side=True), os.path.join(MODELS_OUT, 'trees-light.glb'))
log('all done')
