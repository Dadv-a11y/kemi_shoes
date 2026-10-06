"""Génère des images de TEST dans backend/images_demo/ (placeholders, pas de vraies photos).

Les noms de fichiers suivent les clés de backend/scripts/seed-demo.data.js : 25 produits
(10 avec une 2e vue « _1 ») + 4 visuels de marque = 39 images, comme attendu par
`npm run db:seed`.

    python3 backend/scripts/generate-demo-images.py   # nécessite Pillow et Node
"""
import hashlib, json, os, subprocess, textwrap
from PIL import Image, ImageDraw, ImageFont

backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(backend, "images_demo")
keys, brand = json.loads(subprocess.check_output(
    ["node", "-e", "import('./scripts/seed-demo.data.js').then(m => process.stdout.write(JSON.stringify([Object.keys(m.PRODUCTS), m.BRAND_MEDIA])))"],
    cwd=backend,
))
os.makedirs(out, exist_ok=True)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
except Exception:
    font = small = ImageFont.load_default()
PAL = ["#92502F","#D2A477","#D2531E","#14120F","#E3B23C","#2F4E7A","#4A6A8C","#E0712C","#C9A54B"]
def make(stem, label, view, kind):
    h = int(hashlib.md5(stem.encode()).hexdigest(), 16)
    bg = (244 - h % 20, 238 - h % 15, 228 - h % 25)
    c = PAL[h % len(PAL)]; c2 = PAL[(h // 7) % len(PAL)]
    W, H = 1200, 1200
    im = Image.new("RGB", (W, H), bg); d = ImageDraw.Draw(im)
    if kind == "product":
        off = view * 60
        # semelle
        d.rounded_rectangle((200+off, 720, 1000-off//2, 800), 40, fill="#3a2a20")
        # dessus / brides
        d.pieslice((220+off, 420, 980-off//2, 900), 180, 360, fill=c)
        d.rounded_rectangle((380, 520+view*20, 820, 590+view*20), 30, fill=c2)
        d.ellipse((560, 500, 640, 580), outline="#C9A54B", width=10)
    else:
        for i in range(8):
            d.rectangle((i*150, 0, i*150+120, H), fill=PAL[(h+i) % len(PAL)])
        d.rectangle((100, 380, 1100, 820), fill=bg)
    lines = textwrap.wrap(label, 30)
    y = 120
    for line in lines:
        w = d.textlength(line, font=font); d.text(((W-w)/2, y), line, font=font, fill="#14120F"); y += 46
    tag = f"IMAGE DE TEST — {'vue ' + str(view+1) if kind=='product' else 'visuel de marque'}"
    w = d.textlength(tag, font=small); d.text(((W-w)/2, 1060), tag, font=small, fill="#6b5a4a")
    im.save(os.path.join(out, stem + ".jpg"), "JPEG", quality=82)
n = 0
for i, k in enumerate(keys):
    views = 2 if i % 5 in (0, 2) else 1   # 10 produits avec 2 vues -> 35 photos produit
    for v in range(views):
        stem = k if v == 0 else f"{k}_{v}"
        make(stem, k.replace("_", " "), v, "product"); n += 1
for stem, m in brand.items():
    make(stem, m["altFr"], 0, "brand"); n += 1
print(n, "images")
