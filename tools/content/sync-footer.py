#!/usr/bin/env python3
"""Keep public sitemap-page footer metadata consistent. Use --check in validation."""
from pathlib import Path
import re,sys,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
template=(ROOT/'tools/content/footer-meta.html').read_text().strip()
failed=[]
for item in ET.parse(ROOT/'sitemap.xml').iter():
 if not item.tag.endswith('loc'):continue
 path=ROOT/(item.text.removeprefix('https://coping.tools/').strip('/')+'/index.html').lstrip('/')
 text=path.read_text();new,n=re.subn(r'<p class="copyright">.*?</p>',lambda _:template,text,flags=re.S)
 if n!=1:raise ValueError(f'Expected one footer in {path}')
 if new!=text:
  if '--check' in sys.argv:failed.append(str(path.relative_to(ROOT)))
  else:path.write_text(new)
if failed:raise SystemExit('Inconsistent footers: '+', '.join(failed))
print('Public footer metadata consistent.')
