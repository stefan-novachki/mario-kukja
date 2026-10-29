# A clipped-hedge texture made from the approved Poly Haven tree's own leaves (island_tree_02):
# leaves scattered in layers over a dark interior, rendered straight down (seamless 1 m tile),
# plus a small sprite of a few leaves for the loose fringe along the hedge edges.
# Writes bake/hedge/{albedo,normal}.npy and bake/hedge/sprite.png (prep-textures.py turns
# them into site/textures/hedge and site/textures/hedgeLeaf).
#   blender -b --factory-startup --python tools/blender/make-hedge.py
import bpy, math, os, random
import numpy as np
import OpenImageIO as oiio

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'bake', 'hedge')
os.makedirs(OUT, exist_ok=True)
LEAF_PNG = os.path.join(ROOT, 'bake', 'models', 'island_tree_02_leaves.png')
rng = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
img = bpy.data.images.load(LEAF_PNG)
W, H = img.size
px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)

# ---- leaf rectangles in the atlas: connected parts of the alpha mask (on a 128 px grid)
g = 128
m = px[:, :, 3].reshape(g, H // g, g, W // g).max(axis=(1, 3)) > 0.5
lab = -np.ones((g, g), int); rects = []
for y in range(g):
    for x in range(g):
        if m[y, x] and lab[y, x] < 0:
            stack, pts = [(y, x)], []
            lab[y, x] = len(rects)
            while stack:
                cy, cx = stack.pop(); pts.append((cy, cx))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < g and 0 <= nx < g and m[ny, nx] and lab[ny, nx] < 0:
                        lab[ny, nx] = len(rects); stack.append((ny, nx))
            ys, xs = zip(*pts)
            if len(pts) > 30:
                rects.append(((min(xs)) / g, (min(ys)) / g, (max(xs) + 1) / g, (max(ys) + 1) / g))
print('[hedge] leaves in the atlas:', len(rects))

leaf_mat = bpy.data.materials.new('leaf'); leaf_mat.use_nodes = True
nt = leaf_mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
hue = nt.nodes.new('ShaderNodeHueSaturation'); hue.inputs['Saturation'].default_value = 0.85; hue.inputs['Value'].default_value = 0.9
nt.links.new(tex.outputs['Color'], hue.inputs['Color']); nt.links.new(hue.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha']); bsdf.inputs['Roughness'].default_value = 0.45


def card(verts, faces, uvs, c, size, yaw, tilt_axis, tilt, rect):
    u0, v0, u1, v1 = rect
    asp = (v1 - v0) / max(1e-4, (u1 - u0))
    w, h = size, size * asp
    loc = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    cy, sy = math.cos(yaw), math.sin(yaw)
    ax, ay = tilt_axis
    b = len(verts)
    for (x, y) in loc:
        x, y = x * cy - y * sy, x * sy + y * cy                       # turn about the normal
        z = (x * -ay + y * ax) * math.sin(tilt)                       # lean about a horizontal axis
        verts.append((c[0] + x, c[1] + y, c[2] + z))
    faces.append((b, b + 1, b + 2, b + 3))
    uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])


def leaves(n, area, z0, z1, size, wrap=False):
    verts, faces, uvs = [], [], []
    for _ in range(n):
        c = (rng.uniform(*area[0]), rng.uniform(*area[1]), rng.uniform(z0, z1))
        a = rng.uniform(0, math.tau)
        args = (size * rng.uniform(0.8, 1.25), rng.uniform(0, math.tau), (math.cos(a), math.sin(a)), rng.uniform(-0.9, 0.9), rng.choice(rects))
        offs = [(0, 0)]
        if wrap:                                                     # seamless: copies across the tile edges
            offs += [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy)]
        for dx, dy in offs:
            if (dx and not (-0.12 < c[0] + dx < 1.12)) or (dy and not (-0.12 < c[1] + dy < 1.12)):
                continue
            card(verts, faces, uvs, (c[0] + dx, c[1] + dy, c[2]), *args)
    me = bpy.data.meshes.new('leaves'); me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(); uvl.data.foreach_set('uv', np.array([uvs[i] for f in faces for i in f], np.float32).ravel())
    me.materials.append(leaf_mat)
    o = bpy.data.objects.new('leaves', me); sc.collection.objects.link(o)
    return o


# ---- the 1 m tile: dark inside, three layers of leaves
inside = bpy.data.materials.new('inside'); inside.use_nodes = True
inside.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.035, 0.045, 0.02, 1)
pl = bpy.data.meshes.new('plane'); pl.from_pydata([(-0.5, -0.5, 0), (1.5, -0.5, 0), (1.5, 1.5, 0), (-0.5, 1.5, 0)], [], [(0, 1, 2, 3)]); pl.materials.append(inside)
sc.collection.objects.link(bpy.data.objects.new('inside', pl))
tile = leaves(5200, ((0, 1), (0, 1)), 0.0, 0.08, 0.06, wrap=True)

sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = False
try:
    p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'HIP'; p.get_devices()
    for d in p.devices: d.use = d.type == 'HIP'
    sc.cycles.device = 'GPU'
except Exception:
    pass
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0; cam.location = (0.5, 0.5, 2.0)
sc.render.resolution_x = sc.render.resolution_y = 1024
vl = sc.view_layers[0]
vl.use_pass_diffuse_color = True; vl.use_pass_normal = True; vl.use_pass_ambient_occlusion = True
sc.world.light_settings.distance = 0.06
try:
    sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'      # Blender 5: multilayer is a media type
except Exception:
    pass
sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
sc.render.filepath = os.path.join(OUT, 'tile.exr')
bpy.ops.render.render(write_still=True)

inp = oiio.ImageInput.open(os.path.join(OUT, 'tile.exr'))
names, parts = [], []
sub = 0
while inp.seek_subimage(sub, 0):                                    # each pass is a part of the EXR
    spec = inp.spec()
    names += list(spec.channelnames)
    parts.append(inp.read_image(format=oiio.FLOAT).reshape(spec.height, spec.width, -1))
    sub += 1
inp.close()
data = np.concatenate(parts, axis=2)
print('[hedge] channels', names[:24])
def ch(name):                                                        # 'ViewLayer.<pass>.<channel>'
    idx = [i for i, n in enumerate(names) if n.split('.')[1:2] == [name]]
    return data[:, :, idx[:3]]
alb, nor, ao = ch('Diffuse Color'), ch('Normal'), ch('Ambient Occlusion')[:, :, :1]
# raw arrays (rows top-down, linear colour); tools/prep-textures.py turns them into the web maps
np.save(os.path.join(OUT, 'albedo.npy'), np.clip(alb * (0.45 + 0.55 * ao), 0, 1).astype(np.float32))   # darker between leaves
np.save(os.path.join(OUT, 'normal.npy'), np.clip(nor * 0.5 + 0.5, 0, 1).astype(np.float32))
print('[hedge] tile written', alb.mean(axis=(0, 1)))

# ---- sprite: a small loose cluster of leaves on transparent background
for o in list(sc.objects):
    if o.type == 'MESH':
        bpy.data.objects.remove(o)
# the sprite carries plain leaf colour (the website adds the baked light): render it unlit
emit = nt.nodes.new('ShaderNodeEmission'); mix = nt.nodes.new('ShaderNodeMixShader'); tr = nt.nodes.new('ShaderNodeBsdfTransparent')
nt.links.new(hue.outputs['Color'], emit.inputs['Color'])
nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac']); nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(emit.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
sc.view_settings.view_transform = 'Standard'
leaves(14, ((0.3, 0.7), (0.3, 0.7)), 0.0, 0.05, 0.07)
sc.render.film_transparent = True
vl.use_pass_diffuse_color = False; vl.use_pass_normal = False; vl.use_pass_ambient_occlusion = False
sc.render.resolution_x = sc.render.resolution_y = 256
try:
    sc.render.image_settings.media_type = 'IMAGE'
except Exception:
    pass
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = os.path.join(OUT, 'sprite.png')
bpy.ops.render.render(write_still=True)
print('[hedge] sprite written')
