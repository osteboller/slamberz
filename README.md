# Slamberz

A physics-driven browser game inspired by the classic 90s caps/pogs toy. Throw a slammer at a stack of caps and score points for every cap that lands face-up.

**Play it here:** https://[your-username].github.io/slamberz/

---

## How to play

1. **Aim** — move your mouse (or finger) over the stack to place the reticle
2. **Time the power bar** — it oscillates between 0–100%. Click in the green zone for maximum force
3. **Watch the slammer drop** — it falls onto whatever you aimed at
4. **Score** — caps that land face-up are won. Each round has 3 throws; face-down caps are reshuffled and restacked between throws
5. **Click anywhere** to start the next round when results are shown

**Top-right buttons:** ↺ reset score + round · ⚙ slammer settings · ⛶ fullscreen (Android/desktop)

**Bottom corners:** pile buttons show won caps (left) and remaining caps (right) — click to inspect, click a cap for a detail view

---

## Run locally

1. Open the folder in VS Code
2. Right-click `index.html` → *Open with Live Server*

No build step, no npm install — native ES modules in the browser.

---

## Tech stack

- [Three.js r148](https://threejs.org/) — 3D rendering (UMD global, no import)
- [Cannon-es](https://github.com/pmndrs/cannon-es) — rigid-body physics
- Native browser ES modules — no bundler

---

## Controls

| Input | Action |
|---|---|
| Mouse move / touch | Aim reticle |
| Click / tap | Fire slammer |
| Click / tap (results screen) | Start next round |
| ↺ | Reset score and round |
| ⚙ | Open slammer settings (mass, gravity, blast, caps, slammer skin) |
| ⛶ | Toggle fullscreen (Android/desktop only) |

---

## Structure

```
index.html              — entry point, UI markup
styles.css              — layout and UI styles
three.min.js            — Three.js r148 UMD bundle
assets/
  caps/
    raptor_strike/      — cap face + back textures (256×256 PNG, named NN_color[_b].png)
    legacy_discs/       — second cap series
  slammers/             — slammer face + back textures (256×256 PNG, named name[_b].png)
src/
  config/               — constants.js (CAP_DEFS, SLAMMER_DEFS, tuning values)
  physics/              — PhysicsEngine, CollisionManager, ShapeFactory
  render/               — RenderEngine (scene, cork mat, reticle), CameraController
  entities/             — Cap, Slammer
  input/                — InputManager (pointer + mouse, 3D raycast)
  ui/                   — UIManager (panels, pile overlays, detail view), PowerBar
lib/
  cannon.js             — Cannon-es local build (ES module)
```

---

## Adding caps

Add entries to `CAP_DEFS` in `src/config/constants.js`:

```js
{ color: 0xrrggbb, name: 'Name', mass: 1.0, bounce: 0.3,
  texFront: 'assets/caps/series_name/NN_id.png',
  texBack:  'assets/caps/series_name/NN_id_b.png' }
```

- Textures: 256×256 PNG, circular artwork (corners not visible)
- One subfolder per series under `assets/caps/`
- `color` is used as fallback rim tint if texture is missing

## Adding slammers

Add entries to `SLAMMER_DEFS` in `src/config/constants.js`:

```js
{ name: 'Label', type: 'gold' | 'holo' | null,
  texFront: 'assets/slammers/name.png',
  texBack:  'assets/slammers/name_b.png',
  rimColor: 0xrrggbb }
```

Select active slammer via ‹ › in the ⚙ panel (takes effect next throw).
