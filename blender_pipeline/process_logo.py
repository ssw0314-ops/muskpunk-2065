"""Convert the MUSKPUNK 2065 logo (opaque black bg) into a transparent WebP data URI module."""
import base64, io
import numpy as np
from PIL import Image, ImageFilter

SRC = '/home/antigravity/화성_뒤에_선_머스크펑크_2065.png'

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
H, W, _ = a.shape

# Luminance-key: alpha from max channel (black -> transparent), un-premultiply colors.
mx = a.max(axis=2)
alpha = np.clip((mx - 0.035) / 0.30, 0.0, 1.0)

# Keep Mars sphere solid: fit disc from bright orange-ish pixels on the right half.
r, g, b = a[..., 0], a[..., 1], a[..., 2]
yy, xx = np.mgrid[0:H, 0:W]
# Circle measured from the north-pole tip (y=53) and the chord at y=120 (x 581..842).
cx, cy, rad = 711.5, 213.6, 159.8
d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
disc = np.clip((rad - d) / 2.5, 0.0, 1.0)
print(f'planet disc c=({cx:.1f},{cy:.1f}) r={rad:.1f}')
alpha = np.maximum(alpha, disc)

safe = np.maximum(alpha, 1e-4)[..., None]
rgb = np.clip(a / safe, 0.0, 1.0)
rgb = np.where(disc[..., None] > 0, a, rgb)  # planet keeps original shading
rgba = np.dstack([rgb, alpha])
img = Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA')

bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
pad = 10
bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(W, bbox[2] + pad), min(H, bbox[3] + pad))
img = img.crop(bbox)
print('crop', bbox, img.size)
img.save('/home/antigravity/arcadia-3d/blender_pipeline/logo_alpha_preview.png')

buf = io.BytesIO()
img.save(buf, 'WEBP', quality=90, method=6)
b64 = base64.b64encode(buf.getvalue()).decode()
print('webp bytes', len(buf.getvalue()))
open('/home/antigravity/arcadia-3d/blender_pipeline/muskpunk_logo.webp','wb').write(buf.getvalue())
