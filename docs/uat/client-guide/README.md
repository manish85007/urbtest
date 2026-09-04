# Client portal overview (visual)

Live UAT screenshots + PDF for clients deciding **who needs access**.

## Attach to the user-list email

**[Urb-TecTrack-Client-Portal-Overview.pdf](./Urb-TecTrack-Client-Portal-Overview.pdf)** — cover, who needs access, then 12 screens (login through logout).

Same file is also saved as `Urb-TecTrack-Client-Access-Visual-Guide.pdf` for UAT invitations.

Captured from https://uat.urbeno.in as the TechCorp demo client. Credentials are **not** shown in the PDF.

## Regenerate

```bash
node docs/uat/client-guide/capture-client-guide.mjs

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
    im.save(p.with_suffix('.jpg'), 'JPEG', quality=78, optimize=True)
m = shots / 'manifest.json'
data = json.loads(m.read_text())
for s in data['steps']:
    s['file'] = s['file'].replace('.png', '.jpg')
m.write_text(json.dumps(data, indent=2) + '\n')
PY
.venv-pdf/bin/python docs/uat/client-guide/build-client-guide-pdf.py
cp docs/uat/client-guide/Urb-TecTrack-Client-Access-Visual-Guide.pdf \
   docs/uat/client-guide/Urb-TecTrack-Client-Portal-Overview.pdf
```
