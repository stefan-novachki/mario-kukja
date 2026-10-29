# Texture sets for the website: Poly Haven maps resized and re-encoded for the two
# versions (desktop / light), plus the white marble, generated here (no white marble
# among the approved Poly Haven textures). Writes site/textures/<set>/<map>[-light].jpg and
# site/textures/textures.json (real size of one repeat, mean colour, mean roughness), so
# the palette stays in charge of colour and the texture adds grain, veins and relief.
#   python -I tools/prep-textures.py
import json, os, sys
import numpy as np
from PIL import Image, ImageFile
ImageFile.MAXBLOCK = 1 << 25   # room for optimised JPEG output

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'assets-src', 'polyhaven', 'textures')
OUT = os.path.join(ROOT, 'site', 'textures')

# key: (Poly Haven id, metres per repeat on the website, desktop px, maps, options)
# Real Poly Haven repeat sizes: oak planks 1.2 m, limestone tiles 1.5 m — both shown 1.6x
# larger, so boards are ~21 cm wide and the stone slabs 60-90 cm, like a villa floor.
SETS = {
    'oakFloor':   ('oak_wood_planks', 1.92, 2048, ['diff', 'nor', 'rough'], {}),
    'travertine': ('marble_01', 2.4, 2048, ['diff', 'nor', 'rough'], {}),
    'oak':        ('oak_veneer_01', 1.83, 1024, ['diff', 'nor', 'rough'], {}),
    'walnut':     ('smoked_walnut_veneer', 1.0, 1024, ['diff', 'nor', 'rough'], {'rotate': True}),   # grain along v, like the oak
    'plaster':    ('white_plaster_02', 2.0, 1024, ['diff', 'nor'], {'contrast': 0.22}),
    'render':     ('white_stucco', 2.0, 1024, ['diff', 'nor'], {'contrast': 0.6}),
    'linen':      ('rough_linen', 0.27, 512, ['nor', 'rough'], {}),
    'wool':       ('poly_wool_herringbone', 0.4, 512, ['diff', 'nor', 'rough'], {}),
    'concrete':   ('brushed_concrete', 2.5, 1024, ['diff', 'nor', 'rough'], {}),
    'gravel':     ('gravel', 2.0, 1024, ['diff', 'nor', 'rough'], {}),
    'grass':      ('leafy_grass', 2.0, 1024, ['diff', 'nor', 'rough'], {'contrast': 0.5}),
    'tiles':      ('interior_tiles', 1.9, 1024, ['diff', 'nor', 'rough'], {}),
}
FILE = {'diff': 'diff', 'nor': 'nor_gl', 'rough': 'rough'}
QUALITY = {'diff': 85, 'nor': 92, 'rough': 80}


def to_lin(a):
    a = a / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def save(img, path, kind):
    if img.mode == 'RGBA':               # cut-out leaves keep their alpha
        img.save(path.replace('.jpg', '.png'), 'PNG', optimize=True)
        return
    sub = 0 if kind == 'nor' else 2      # keep full colour resolution in normal maps
    img.save(path, 'JPEG', quality=QUALITY[kind], subsampling=sub, optimize=True)


def write_set(key, imgs, size_m, px, extra=None):
    d = os.path.join(OUT, key)
    os.makedirs(d, exist_ok=True)
    info = {'size': size_m, 'maps': sorted(imgs.keys()), 'px': px}
    for kind, img in imgs.items():
        kp = px if kind == 'diff' or px <= 1024 else px // 2      # relief and roughness are softer: 1K is enough
        if img.mode == 'RGBA':
            info.setdefault('png', []).append(kind)
        full = img.resize((kp, kp), Image.LANCZOS) if img.size[0] != kp else img
        save(full, os.path.join(d, f'{kind}.jpg'), kind)
        save(img.resize((kp // 2, kp // 2), Image.LANCZOS), os.path.join(d, f'{kind}-light.jpg'), kind)
        small = np.asarray(img.convert('RGB').resize((256, 256), Image.BILINEAR)).astype(np.float64)
        if img.mode == 'RGBA':           # mean over the leaf only
            al = np.asarray(img.resize((256, 256), Image.BILINEAR))[..., 3] > 128
            small = small[al][None]
        if kind == 'diff':
            info['mean'] = [round(float(v), 5) for v in to_lin(small).reshape(-1, 3).mean(0)]
        if kind == 'rough':
            info['rough'] = round(float(small[..., 1].mean() / 255.0), 4)
    if extra:
        info.update(extra)
    return info


# ---------------------------------------------------------------- generated white marble
def periodic_noise(n, period, rng):
    g = rng.random((period, period))
    x = np.arange(n) * period / n
    i0 = np.floor(x).astype(int)
    f = x - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % period
    a = g[np.ix_(i0, i0)]; b = g[np.ix_(i0, i1)]; c = g[np.ix_(i1, i0)]; e = g[np.ix_(i1, i1)]
    fy, fx = f[:, None], f[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy


def fbm(n, period, octaves, rng, gain=0.5):
    s, amp, tot = np.zeros((n, n)), 1.0, 0.0
    for o in range(octaves):
        s += amp * periodic_noise(n, period * 2 ** o, rng)
        tot += amp
        amp *= gain
    return s / tot


def marble(n=2048, seed=11):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    # long wavy veins: a mostly straight diagonal phase, warped by less than a cycle (no loops)
    w1 = fbm(n, 2, 7, rng, gain=0.55) - 0.5
    w2 = fbm(n, 4, 6, rng, gain=0.6) - 0.5
    ph1 = 2 * np.pi * (1 * x + 2 * y) + 3.2 * w1
    ph2 = 2 * np.pi * (3 * x - 1 * y) + 2.6 * w2 + 1.2 * w1
    s1 = np.clip((fbm(n, 3, 4, rng) - 0.3) * 2.6, 0, 1)                # veins fade in and out
    s2 = np.clip((fbm(n, 4, 4, rng) - 0.45) * 3.5, 0, 1)
    a1, a2 = np.abs(np.sin(ph1 / 2)), np.abs(np.sin(ph2 / 2))         # one vein per period
    v1 = np.exp(-(a1 / 0.012) ** 2) * (0.35 + 0.65 * s1) + 0.22 * np.exp(-(a1 / 0.06) ** 2) * s1
    v2 = 0.5 * np.exp(-(a2 / 0.007) ** 2) * s2
    cloud = fbm(n, 5, 6, rng) - 0.5
    base = np.array([243, 240, 235], float)
    vein = np.array([128, 124, 120], float)
    t = np.clip(v1 * 0.8 + v2, 0, 0.85)[..., None]
    col = base * (1 + 0.035 * cloud[..., None]) * (1 - t) + vein * t
    diff = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
    rough = Image.fromarray(np.clip((0.16 + 0.05 * t[..., 0] + 0.03 * cloud) * 255, 0, 255).astype(np.uint8)).convert('RGB')
    return diff, rough


def swatches():
    # room-card swatches: ~35 cm of each textured palette material, coloured like on the site
    import re
    src = open(os.path.join(ROOT, 'site', 'js', 'three', 'palette.js'), encoding='utf8').read()
    manifest = json.load(open(os.path.join(OUT, 'textures.json')))
    d = os.path.join(OUT, 'swatches')
    os.makedirs(d, exist_ok=True)
    n = 0
    for name, body in re.findall(r"(\w+): \{([^}]*)\}", src):
        col, tex = re.search(r"color: '(#[0-9a-fA-F]{6})'", body), re.search(r"tex: '(\w+)'", body)
        if not col or not tex or tex.group(1) not in manifest:
            continue
        info = manifest[tex.group(1)]
        size = float(re.search(r"size: ([\d.]+)", body).group(1)) if 'size:' in body else info['size']
        pal = to_lin(np.array([int(col.group(1)[i:i + 2], 16) for i in (1, 3, 5)], float))
        kind = 'diff' if 'diff' in info['maps'] else 'nor'
        img = Image.open(os.path.join(OUT, tex.group(1), f'{kind}.jpg')).convert('RGB')
        crop = max(32, int(img.size[0] * min(1.0, 0.35 / size)))
        a = to_lin(np.asarray(img.crop((0, 0, crop, int(crop / 2.6)))).astype(np.float64))
        if kind == 'diff':
            out = a * (pal / np.array(info['mean']))
        else:                                       # weave only (linen): shading from the relief
            g = a[..., 1:2]
            out = pal * (1 + (g - g.mean()) * 1.6)
        srgb = np.where(out <= 0.0031308, out * 12.92, 1.055 * np.clip(out, 0, None) ** (1 / 2.4) - 0.055)
        Image.fromarray(np.clip(srgb * 255, 0, 255).astype(np.uint8)).resize((240, 92), Image.LANCZOS).save(os.path.join(d, f'{name}.jpg'), 'JPEG', quality=86)
        n += 1
    print('swatches', n)


def cladding(manifest, n=2048, boards=12, seed=5):
    # horizontal timber cladding (the facade boards of the renders): rows of oak veneer with the
    # grain turned along the board, each board a little lighter or darker, a shadow gap between
    # boards and a slight shiplap tilt in the relief. One repeat = 12 boards.
    rng = np.random.default_rng(seed)
    src = Image.open(os.path.join(SRC, 'oak_veneer_01', 'oak_veneer_01_diff_2k.jpg')).convert('RGB').transpose(Image.ROTATE_90)
    a = np.asarray(src.resize((n, n), Image.LANCZOS)).astype(np.float64)
    bh = n // boards
    diff = np.zeros((n, n, 3)); hgt = np.zeros((n, n))
    t = np.arange(bh) / bh
    for b in range(boards):
        off, shift = int(rng.integers(0, n - bh)), int(rng.integers(0, n))
        band = np.roll(a[off:off + bh], shift, axis=1) * rng.uniform(0.9, 1.08)
        gap = np.clip(1 - np.exp(-((t - 0.0) / 0.035) ** 2) * 0.75, 0.2, 1)[:, None, None]      # shadow under the board above
        diff[b * bh:(b + 1) * bh] = band * gap
        hgt[b * bh:(b + 1) * bh] = (1 - t)[:, None] * 0.6 - np.exp(-(t / 0.02) ** 2)[:, None] * 2.0
    gy = (np.roll(hgt, 1, 0) - np.roll(hgt, -1, 0)) * 0.5
    nz = 1 / np.sqrt(1 + gy * gy)
    nrm = np.dstack([np.zeros_like(gy), -gy * nz, nz]) * 0.5 + 0.5
    rough = Image.fromarray(np.full((n // 2, n // 2), 170, np.uint8)).convert('RGB')
    imgs = {'diff': Image.fromarray(np.clip(diff, 0, 255).astype(np.uint8)), 'nor': Image.fromarray((nrm * 255).astype(np.uint8)), 'rough': rough}
    manifest['cedar'] = write_set('cedar', imgs, 1.62, n, {'source': 'generated from oak_veneer_01 (tools/prep-textures.py)'})
    print('cedar', manifest['cedar'])


def generated(manifest):
    # hedge: rendered in Blender from the approved tree leaves (tools/blender/make-hedge.py)
    hd = os.path.join(ROOT, 'bake', 'hedge')
    if os.path.exists(os.path.join(hd, 'albedo.npy')):
        alb = np.load(os.path.join(hd, 'albedo.npy')); nor = np.load(os.path.join(hd, 'normal.npy'))
        srgb = np.where(alb <= 0.0031308, alb * 12.92, 1.055 * alb ** (1 / 2.4) - 0.055)
        imgs = {'diff': Image.fromarray((np.clip(srgb, 0, 1) * 255).astype(np.uint8)), 'nor': Image.fromarray((nor * 255).astype(np.uint8))}
        manifest['hedge'] = write_set('hedge', imgs, 0.9, 1024, {'source': 'generated from island_tree_02 leaves (tools/blender/make-hedge.py)'})
        sp = Image.open(os.path.join(hd, 'sprite.png')).convert('RGBA')
        manifest['hedgeLeaf'] = write_set('hedgeLeaf', {'diff': sp}, 1.0, 256, {'source': 'generated from island_tree_02 leaves (tools/blender/make-hedge.py)'})
        print('hedge', manifest['hedge'], 'hedgeLeaf', manifest['hedgeLeaf'])
    # pool water: gentle seamless ripples (sum of periodic waves), as a normal map
    n = 512
    y, x = np.mgrid[0:n, 0:n] / n
    rng = np.random.default_rng(3)
    h = np.zeros((n, n))
    for _ in range(14):
        kx, ky = rng.integers(-6, 7, 2)
        if kx == 0 and ky == 0:
            continue
        a = 1.0 / np.hypot(kx, ky) ** 1.3
        h += a * np.sin(2 * np.pi * (kx * x + ky * y) + rng.uniform(0, 6.28))
    h += 0.35 * (fbm(n, 8, 4, rng) - 0.5)
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * n / 2 / 60.0
    gy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * n / 2 / 60.0
    nz = 1 / np.sqrt(1 + gx * gx + gy * gy)
    nrm = np.dstack([-gx * nz, -gy * nz, nz]) * 0.5 + 0.5
    manifest['water'] = write_set('water', {'nor': Image.fromarray((nrm * 255).astype(np.uint8))}, 1.6, 512, {'source': 'generated (tools/prep-textures.py)'})
    print('water', manifest['water'])


def main():
    only = sys.argv[1:]
    manifest_path = os.path.join(OUT, 'textures.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for key, (ph, size_m, px, maps, opt) in SETS.items():
        if only and key not in only:
            continue
        imgs = {}
        for kind in maps:
            img = Image.open(os.path.join(SRC, ph, f'{ph}_{FILE[kind]}_2k.jpg')).convert('RGB')
            if kind == 'diff' and 'contrast' in opt:
                a = np.asarray(img).astype(np.float64)
                m = a.reshape(-1, 3).mean(0)
                img = Image.fromarray(np.clip(m + (a - m) * opt['contrast'], 0, 255).astype(np.uint8))
            if opt.get('rotate'):
                img = img.transpose(Image.ROTATE_90)          # counter-clockwise
                if kind == 'nor':                             # turn the tangent-space normals with the picture
                    a = np.asarray(img)
                    img = Image.fromarray(np.dstack([255 - a[..., 1], a[..., 0], a[..., 2]]).astype(np.uint8))
            imgs[kind] = img
        manifest[key] = write_set(key, imgs, size_m, px, {'source': ph})
        print(key, manifest[key])
    if not only or 'generated' in only:
        generated(manifest)
    if not only or 'cladding' in only:
        cladding(manifest)
    if not only or 'marble' in only:
        diff, rough = marble()
        manifest['marble'] = write_set('marble', {'diff': diff, 'rough': rough}, 2.0, 2048, {'source': 'generated (tools/prep-textures.py)'})
        print('marble', manifest['marble'])
    json.dump(manifest, open(manifest_path, 'w'), indent=1)
    swatches()
    total = {'desktop': 0, 'light': 0}
    for dp, _, fs in os.walk(OUT):
        for f in fs:
            if f.endswith('.jpg'):
                total['light' if '-light' in f else 'desktop'] += os.path.getsize(os.path.join(dp, f))
    print('TOTAL MB', {k: round(v / 1e6, 2) for k, v in total.items()})


main()
