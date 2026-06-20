import { Body, Vec3, BODY_TYPES } from '../lib/cannon.js';
import { PhysicsEngine }      from './physics/PhysicsEngine.js';
import { CollisionManager }   from './physics/CollisionManager.js';
import { createCapShape, createSlammerShape } from './physics/shapes/ShapeFactory.js';
import { RenderEngine }       from './render/RenderEngine.js';
import { CameraController }   from './render/CameraController.js';
import { InputManager }       from './input/InputManager.js';
import { UIManager }          from './ui/UIManager.js';
import { PowerBar }           from './ui/PowerBar.js';
import { Cap }     from './entities/Cap.js';
import { Slammer } from './entities/Slammer.js';
import { POG_R, POG_H, SLAM_H, CAP_DEFS, SHOT_DELAY,
         POWER_SPEED_MIN, POWER_SPEED_MAX } from './config/constants.js';

// ─── MODULES ─────────────────────────────────────────────────────────────────
const physics    = new PhysicsEngine();
const render     = new RenderEngine();
const cam        = new CameraController(render.camera);
const collisions = new CollisionManager(physics.world);
const input      = new InputManager(render.getDomElement(), render.camera);
const ui         = new UIManager();
const powerBar   = new PowerBar();

// Power bar er altid aktiv — det er kernemekanitten
powerBar.enable();

// ─── STATE ───────────────────────────────────────────────────────────────────
let caps        = [];
let slammer     = null;
// idle → aiming → falling → blasted → settling → done
let phase       = 'idle';
let blastTime   = 0;
let settleStart = 0;
let totalScore  = 0;

// Fanget ved klik — bruges konsistent i spawn og blast
let shotSpeed    = 0;
let shotMass     = 0;
let pendingX     = 0;
let pendingY     = 0;
let pendingZ     = 0;
let aimingStart  = 0;
let fallingStart = 0; // timeout-sikkerhed mod miss

// ─── WIRING ──────────────────────────────────────────────────────────────────

// Gravity opdateres live fra slideren
ui.onGravityChange = (g) => { physics.world.gravity.y = g; };

// InputManager prøver cap-meshes inden gulvplanet
// — retikel viser nu præcis der hvor man peger på stacken
input.getHittableObjects = () => caps.map(c => c.mesh);

// Kollision → blast (zoom ud er allerede startet ved klik)
collisions.onBlast = () => {
    if (phase !== 'falling') return;
    blast();
    blastTime = performance.now();
    phase     = 'blasted';
    ui.setStatus('BOOM!');
};

// Slammer rammer gulvet uden at ramme en cap → runden afsluttes som miss
collisions.onMiss = () => {
    if (phase !== 'falling') return;
    phase = 'done';
    render.setReticleVisible(false);
    ui.showResults(0, totalScore, []);
    ui.setStatus('Miss!');
};

// Mus bevæger sig → flyt retikel til præcis 3D-hitpunkt (cap-overflade eller gulv)
// Retikel dukker op ved første musbevægelse i idle — ikke ved (0,0) ved rundestart
input.onAim = (x, y, z) => {
    if (phase === 'idle') {
        render.setReticlePosition(x, y, z);
        render.setReticleVisible(true);
    }
};

// Klik → frys power, vis retikel på mål, gå til 'aiming'-fase
input.onShot = (x, y, z) => {
    if (phase !== 'idle') return;
    powerBar.freeze();
    shotSpeed = powerBar.getMappedSpeed();
    shotMass  = ui.getMass();
    pendingX  = x;
    pendingY  = y;
    pendingZ  = z;

    render.setReticlePosition(pendingX, pendingY, pendingZ);
    render.setReticleVisible(true);
    cam.zoomOut(); // Begynd zoom under 1-sekunders pausen så kameraet er klar til action

    phase       = 'aiming';
    aimingStart = performance.now();
    ui.setStatus('Sigter...');
};

document.getElementById('resetBtn').addEventListener('click', e => { e.stopPropagation(); buildStack(); });
document.getElementById('nextBtn').addEventListener('click',  e => { e.stopPropagation(); buildStack(); });

// ─── FACTORY ─────────────────────────────────────────────────────────────────
function spawnCap(def, y) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, POG_H, 36),
        [
            new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.22, metalness: 0.05 }),
            new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.88 }),
        ]
    );
    mesh.castShadow = mesh.receiveShadow = true;
    render.addMesh(mesh);

    const body = new Body({
        mass:           def.mass,
        material:       physics.mCap,
        linearDamping:  0.85,
        angularDamping: 0.85,
        allowSleep:     true,
        type:           BODY_TYPES.STATIC,
    });
    body.addShape(createCapShape());
    body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
    body.position.set(0, y, 0);
    body.userData = { kind: 'cap' };
    physics.world.addBody(body);

    caps.push(new Cap(mesh, body, def));
}

function spawnSlammer(x, z, speed, mass) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, SLAM_H, 36),
        [
            new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.05, metalness: 0.7 }),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2,  metalness: 0.4 }),
        ]
    );
    mesh.castShadow = true;
    render.addMesh(mesh);

    const body = new Body({
        mass,
        material:       physics.mSlammer,
        linearDamping:  0,
        angularDamping: 0,
        allowSleep:     false,
    });
    body.addShape(createSlammerShape());
    const stackTop = POG_H * 0.5 + (caps.length - 1) * (POG_H + 0.01) + SLAM_H + 0.5;
    body.position.set(x, stackTop + 2, z);
    body.velocity.set(0, -speed, 0);
    body.ccdSpherRadius     = 0.05;
    body.ccdMotionThreshold = 0.005;
    body.userData = { kind: 'slammer' };
    physics.world.addBody(body);

    slammer = new Slammer(mesh, body);
}

// ─── BLAST ───────────────────────────────────────────────────────────────────
function blast() {
    const spread     = ui.getBlastSpread();
    const force      = Math.sqrt(shotMass) * shotSpeed * spread;
    // Ryst kun når man rammer de øverste 10% af power bar
    const powerRatio = (shotSpeed - POWER_SPEED_MIN) / (POWER_SPEED_MAX - POWER_SPEED_MIN);
    const shakeFloor = 0.90;
    if (powerRatio >= shakeFloor) {
        const t = (powerRatio - shakeFloor) / (1 - shakeFloor); // 0→1 inden for top-10%
        cam.triggerShake(0.5 + t * 2.0, 250 + t * 400);
    }

    caps.forEach(({ body }, i) => {
        body.type           = BODY_TYPES.DYNAMIC;
        body.linearDamping  = 0.04;
        body.angularDamping = 0.04;
        body.wakeUp();

        const angle = (i / caps.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.5;
        const r     = 0.6 + Math.random() * 0.9;

        body.velocity.x = Math.cos(angle) * force * r;
        body.velocity.z = Math.sin(angle) * force * r;
        body.velocity.y = force * (0.3 + Math.random() * 0.5);

        body.angularVelocity.x = (Math.random() - 0.5) * force * 1.8;
        body.angularVelocity.z = (Math.random() - 0.5) * force * 1.8;
        body.angularVelocity.y = (Math.random() - 0.5) * force * 0.4;
    });
}

// ─── ROUND MANAGEMENT ────────────────────────────────────────────────────────
function buildStack() {
    caps.forEach(({ mesh, body }) => { render.removeMesh(mesh); physics.world.removeBody(body); });
    caps = [];
    if (slammer) {
        render.removeMesh(slammer.mesh);
        physics.world.removeBody(slammer.body);
        slammer = null;
    }

    const count = ui.getStackCount();
    for (let i = 0; i < count; i++) {
        spawnCap(CAP_DEFS[i % CAP_DEFS.length], POG_H * 0.5 + i * (POG_H + 0.01));
    }

    phase       = 'idle';
    blastTime   = 0;
    settleStart = 0;
    aimingStart = 0;
    collisions.reset();
    powerBar.reset();
    cam.zoomIn();
    render.setReticleVisible(false); // skjules ved rundestart — vises ved første musbevægelse

    ui.hideResults();
    ui.setStatus('Stacker caps...');
    setTimeout(() => { if (phase === 'idle') ui.setStatus('Klik på banen for at kaste!'); }, 300);
}

function finishRound() {
    if (phase === 'done') return;
    phase = 'done';
    render.setReticleVisible(false);

    caps.forEach(({ body }) => {
        body.type = BODY_TYPES.STATIC;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
    });
    if (slammer) {
        slammer.body.type = BODY_TYPES.STATIC;
        slammer.body.velocity.set(0, 0, 0);
        slammer.body.angularVelocity.set(0, 0, 0);
    }

    let won = 0;
    const wonCaps = [];
    caps.forEach(({ body, def }) => {
        const up = new Vec3(0, 1, 0);
        body.quaternion.vmult(up, up);
        if (up.y > 0) { won++; wonCaps.push(def); }
    });

    totalScore += won;
    ui.showResults(won, totalScore, wonCaps);
    ui.setStatus('Runde slut!');
}

function allStill() {
    return caps.every(({ body }) =>
        body.sleepState === 2 ||
        (body.velocity.length() < 0.5 && body.angularVelocity.length() < 0.5)
    );
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
let last = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt  = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (phase === 'idle') powerBar.update(dt);

    if (phase === 'aiming' && now - aimingStart >= SHOT_DELAY) {
        render.setReticleVisible(false);
        spawnSlammer(pendingX, pendingZ, shotSpeed, shotMass);
        collisions.activate();
        phase        = 'falling';
        fallingStart = now;
        ui.setStatus('Slammer falder...');
    }

    // Fallback: slammer er faldet igennem alting — afslut runden
    if (phase === 'falling' && now - fallingStart > 5000) {
        collisions.reset();
        phase = 'done';
        ui.showResults(0, totalScore, []);
        ui.setStatus('Miss!');
    }

    physics.step(dt);
    collisions.checkPending();
    render.sync(caps, slammer);

    if (phase === 'blasted' && slammer && now - blastTime > 400) {
        slammer.body.linearDamping  = 0.95;
        slammer.body.angularDamping = 0.95;
        phase       = 'settling';
        settleStart = now;
        ui.setStatus('Caps lander...');
    }

    if (phase === 'settling') {
        const el = now - settleStart;
        if (el > 400) {
            const t    = Math.min((el - 400) / 1500, 1);
            const damp = 0.04 + t * 0.92;
            caps.forEach(({ body }) => {
                body.linearDamping  = damp;
                body.angularDamping = damp;
            });
        }
        if (el > 5000 || (el > 600 && allStill())) finishRound();
    }

    cam.update(dt);
    render.render();
}

buildStack();
animate();
