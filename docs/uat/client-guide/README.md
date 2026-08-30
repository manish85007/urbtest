# Client Access Visual Guide

Live UAT screenshots + PDF for client testers.

## Deliverable

**[Urb-TecTrack-Client-Access-Visual-Guide.pdf](./Urb-TecTrack-Client-Access-Visual-Guide.pdf)** — 16 pages (cover, contents, 14 steps).

Captured from https://uat.urbeno.in as `ramesh@techcorp.in`.

## Regenerate

```bash
# 1) Capture screenshots from live UAT
node docs/uat/client-guide/capture-client-guide.mjs

# 2) Compress PNG → JPG and rebuild PDF
.venv-pdf/bin/python - <<'PY'
from pathlib import Path
from PIL import Image
import json
shots = Path('docs/uat/client-guide/screenshots')
for p in sorted(shots.glob('*.png')):
    im = Image.open(p).convert('RGB')
    w, h = im.size
    if w > 1400:
        im = im.resize((1400, int(h * 1400 / w)), Image.Resampling.LANCZOS)
    im.save(p.with_suffix('.jpg'), 'JPEG', quality=82, optimize=True)
m = shots / 'manifest.json'
data = json.loads(m.read_text())
for s in data['steps']:
    s['file'] = s['file'].replace('.png', '.jpg')
m.write_text(json.dumps(data, indent=2))
PY
.venv-pdf/bin/python docs/uat/client-guide/build-client-guide-pdf.py
```

Attach this PDF with [CLIENT-UAT-EMAIL.md](../CLIENT-UAT-EMAIL.md) and [CLIENT-UAT-PACK.md](../CLIENT-UAT-PACK.md).
