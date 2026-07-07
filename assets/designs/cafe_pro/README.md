# Professional Cafe Interior Asset Pack

This folder is reserved for professional interior design deliverables used by the NOVA Professional Design Viewer.

## Asset Placement

- Export AutoCAD drawings as `floor_plan.png`, `ceiling_plan.png`, and `elevation_bar_wall.png`, then place them in `plans/`.
- Export the SketchUp model as GLB, name it `cafe_showroom.glb`, and place it in `models/`.
- Place V-Ray, Enscape, or D5 Render outputs in `renders/` using these names: `hero.jpg`, `interior_bar.jpg`, `exterior.jpg`, and `detail_lighting.jpg`.
- Place 360 orbit frames in `orbit/`, named `frame_0001.jpg` through `frame_0036.jpg`.
- Do not commit DWG, SKP, or other original commercial source files unless licensing and file size are confirmed.
- GitHub Pages should primarily serve PNG, JPG, GLB, and JSON files from this asset pack.

## Expected Structure

```text
assets/designs/cafe_pro/
  manifest.json
  README.md
  plans/
    floor_plan.png
    ceiling_plan.png
    elevation_bar_wall.png
  models/
    cafe_showroom.glb
  renders/
    hero.jpg
    interior_bar.jpg
    exterior.jpg
    detail_lighting.jpg
  orbit/
    frame_0001.jpg
    ...
    frame_0036.jpg
```
