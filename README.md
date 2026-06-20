# Slammerne Simulator

En browserbaseret simulator af det klassiske Slammerne-spil bygget med Three.js (r148) og Cannon-es fysik.

## Kør lokalt

1. Åbn mappen i VS Code
2. Start **Live Server** (højreklik på `index.html` → *Open with Live Server*)
3. Spillet kører på `http://127.0.0.1:5500`

Ingen build-step, ingen npm install — native ES-moduler direkte i browseren.

## Spil

- Klik på banen for at kaste slammeren
- Caps der lander med bagsiden opad tæller som vundne
- Justér hastighed og vægt via panelet nede til højre (virker fra næste kast)

## Status

Modulær refaktorering gennemført. Kollisionsdetektion bruger Cannon-es' `beginContact`-event i stedet for Y-positions-polling.

## Struktur

```
src/
  config/       — konstanter og cap-definitioner
  physics/      — PhysicsEngine, CollisionManager, ShapeFactory
  render/       — RenderEngine, CameraShake
  entities/     — Cap, Slammer (data-wrappere)
  input/        — InputManager
  ui/           — UIManager
lib/
  cannon.js     — lokal Cannon-es build
```
