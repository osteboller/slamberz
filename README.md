# Slamberz

A physics-driven browser game inspired by the classic caps toy from the 90s.

**Play it here:** https://[your-username].github.io/slamberz/

---

## How to play

- The **power bar** on the left oscillates and accelerates — click when it hits the green zone for maximum force
- The **reticle** shows exactly where on the stack you're aiming
- Caps that land **face-down** count as won
- Adjust slammer settings in the **⚙ Slammer** panel bottom right

## Run locally

1. Open the folder in VS Code
2. Start **Live Server** (right-click `index.html` → *Open with Live Server*)

No build step, no npm install — native ES modules served directly in the browser.

## Tech stack

- [Three.js r148](https://threejs.org/) — 3D rendering
- [Cannon-es](https://github.com/pmndrs/cannon-es) — physics simulation
- Native browser ES modules

## Structure

```
src/
  config/    — constants and cap definitions
  physics/   — PhysicsEngine, CollisionManager, ShapeFactory
  render/    — RenderEngine, CameraController
  entities/  — Cap, Slammer
  input/     — InputManager
  ui/        — UIManager, PowerBar
lib/
  cannon.js  — Cannon-es (local build)
```
