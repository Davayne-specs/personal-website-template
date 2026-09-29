# Tile PNG frames into a labelled contact sheet.  usage: python3 scripts/contact.py out.jpg cols f1.png f2.png ...
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W, H = 360, 640
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 28)), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 28)
    sheet.paste(im, (x, y + 28))
    d.text((x + 6, y + 6), f.split('/')[-1], fill='black')
sheet.save(out, quality=82)
