# Icons

This repo uses generated PNG icons for iOS Home Screen, favicon, and PWA manifest.

Generate all required icons from your source image:

```bash
python scripts/generate_icons.py "/mnt/data/Cute snake and apple icon.png"
```

That command creates:

- `icons/apple-touch-icon.png` (180x180)
- `icons/favicon-32.png` (32x32)
- `icons/icon-192.png` (192x192)
- `icons/icon-512.png` (512x512)
