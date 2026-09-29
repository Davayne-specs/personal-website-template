"""Tile rendered stills into one contact sheet: sheet.py out.png cols a.png b.png ..."""
import sys
from PIL import Image

out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 8, rows * h + (rows - 1) * 8), 'white')
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h)), ((i % cols) * (w + 8), (i // cols) * (h + 8)))
sheet.save(out)
print(out, sheet.size)
