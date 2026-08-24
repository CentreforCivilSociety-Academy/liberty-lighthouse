# OG fonts

Static instances cut from the site's variable woff2 with fontTools:

```bash
python3 - <<'PY'
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
for src, wght, out in [
    ('public/fonts/eb-garamond-var.woff2', 400, 'scripts/og/fonts/EBGaramond-400.ttf'),
    ('public/fonts/eb-garamond-var.woff2', 600, 'scripts/og/fonts/EBGaramond-600.ttf'),
    ('public/fonts/jetbrains-mono-var.woff2', 500, 'scripts/og/fonts/JetBrainsMono-500.ttf'),
]:
    f = TTFont(src)
    inst = instancer.instantiateVariableFont(f, {'wght': wght}, inplace=False)
    inst.flavor = None
    inst.save(out)
PY
```

Static, not variable, and TTF, not woff2, for one reason each.

Satori parses fonts with a fork of opentype.js that cannot read a variable
font's `fvar` table — handed the shipped woff2 it throws before rendering
anything. And it needs uncompressed sfnt data, so woff2 has to be decompressed
first; fontTools does both steps at once.

Regenerate these if the site's typefaces change.
