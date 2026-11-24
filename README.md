# Bathroom Remodel: 3D tour, walkthrough video and design concepts

A static website (no build step) for the primary-bathroom remodel:

- **`/`**: overview with before/after sliders, the walkthrough video, four design concepts, and a tile spec sheet.
- **`/tour`**: interactive 3D tour (three.js). Drag to look, tap the floor to walk, pinch to zoom.
  - **Walk / Dollhouse** views (the dollhouse shows estimated dimensions)
  - **Before / After** toggle
  - **4 concept styles**: Warm Minimal · Soft Spa · Japandi Warmth · Terrazzo & Sage
  - **5 floors**: warm greige 24×48, ivory limestone 24×24, oak-look herringbone, terrazzo, graphite
  - Fixture finishes (black / nickel / brass / chrome), vanity LED
  - **Photo-quality mode**: when you stop moving, the view is progressively path-traced (global illumination, soft shadows, real reflections) via `three-gpu-pathtracer`. Turn it off under *More* on slow devices.
- Deep links: `tour?style=spa`, `tour?floor=herringbone`, `tour?phase=before`, `tour?spot=shower`, `tour?mode=doll`

## Deploy on Vercel

1. In Vercel, click **Add New → Project** and import this GitHub repo.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Click **Deploy**. Every push to the branch redeploys automatically.

Local preview: run any static server from the repo root, e.g. `npx serve .`, then open http://localhost:3000.

## Project layout

| Path | What |
| --- | --- |
| `index.html`, `tour.html`, `css/site.css` | Pages and styles (mobile-first) |
| `js/tour.js` | The 3D model, materials, styles, controls and renderer |
| `textures/` | Tileable PBR textures (colour + `_n` normal maps), baked at true physical scale |
| `media/before`, `media/after`, `media/concepts` | Original photos and AI renders made from them |
| `media/walkthrough.mp4` | Walkthrough video |
| `tools/make_textures.py`, `tools/make_normals.py` | Re-bake the textures (`python3 tools/make_textures.py && python3 tools/make_normals.py`) |
| `IMG_*.jpg` | Original photos of the bathroom |

## Dimensions

The room was **estimated from the photos**: about 11′-0″ × 8′-6″ with a 9′ ceiling, an 8′ double vanity and a 36″ doorway. Tape-measure before ordering anything. To update the 3D model, edit the `DIM` block at the top of `js/tour.js`; everything else is positioned from it.

## Credits

- Photoreal renders and the walkthrough video were generated with Higgsfield (GPT Image 2.6 and FLUX 3 Video) from photos of the actual room. They are a design preview, not construction documents.
- 3D: [three.js](https://threejs.org) r170, [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer), loaded from jsDelivr.
