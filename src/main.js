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
import { POG_R, POG_H, SLAM_H, CAP_DEFS, SLAMMER_DEFS, SHOT_DELAY,
         POWER_SPEED_MIN, POWER_SPEED_MAX, THROWS_PER_ROUND } from './config/constants.js';

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
let roundId     = 0;       
let blastTime   = 0;
let settleStart = 0;
let totalScore  = 0;
let settleMaxR  = 0;
let throwsLeft  = 0;
let wonCapsAll  = []; // akkumuleret på tværs af alle kast i en runde

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

// Slammer rammer gulvet uden at ramme en cap → tæl som spildt kast
collisions.onMiss = () => {
    if (phase !== 'falling') return;
    endThrow(true);
};

// Sættes til true efter done-faseklik for at undertrykke det syntetiske
// mousemove mobilbrowsere fyrer umiddelbart efter pointerdown
let suppressNextAim = false;

input.onAim = (x, y, z) => {
    if (suppressNextAim) { suppressNextAim = false; return; }
    if (phase === 'idle') {
        render.setReticlePosition(x, y, z);
        render.setReticleVisible(true);
    }
};

// Klik → frys power, vis retikel på mål, gå til 'aiming'-fase
// Klik under 'done' starter næste runde direkte (ingen knap nødvendig)
input.onShot = (x, y, z) => {
    if (ui.isOverlayOpen()) { suppressNextAim = true; return; }
    if (phase === 'restacking') return;
    if (phase === 'done') { suppressNextAim = true; buildStack(); return; }
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

document.getElementById('slammer-btn').addEventListener('pointerdown', e => { e.stopPropagation(); ui.toggleSlammerPanel(); });
document.getElementById('resetBtn').addEventListener('click', e => {
    e.stopPropagation();
    totalScore = 0;
    ui.resetScore();
    buildStack();
});

// ─── TEXTURES ────────────────────────────────────────────────────────────────
const texCache = {};

function createKnurlTexture(rimColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const r = (rimColor >> 16) & 0xff, g = (rimColor >> 8) & 0xff, b = rimColor & 0xff;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 512, 64);
    const ridgeCount = 48, rw = 512 / ridgeCount;
    for (let i = 0; i < ridgeCount; i++) {
        const x = i * rw;
        const grad = ctx.createLinearGradient(x, 0, x + rw, 0);
        grad.addColorStop(0,    'rgba(255,255,255,0.28)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.06)');
        grad.addColorStop(0.65, 'rgba(0,0,0,0.12)');
        grad.addColorStop(1,    'rgba(0,0,0,0.32)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, rw, 64);
    }
    return new THREE.CanvasTexture(canvas);
}

async function loadTextures() {
    const loader = new THREE.TextureLoader();
    const load = url => new Promise(res => {
        loader.load(url, tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            res(tex);
        }, undefined, () => { console.warn('Tekstur mangler:', url); res(null); });
    });
    for (const def of CAP_DEFS) {
        if (def.texFront) texCache[def.texFront] = await load(def.texFront);
        if (def.texBack)  texCache[def.texBack]  = await load(def.texBack);
    }
    for (const def of SLAMMER_DEFS) {
        if (def.texFront) texCache[def.texFront] = await load(def.texFront);
        if (def.texBack)  texCache[def.texBack]  = await load(def.texBack);
        def._knurl = createKnurlTexture(def.rimColor);
    }
}

// ─── FACTORY ─────────────────────────────────────────────────────────────────
function spawnCap(def, y) {
    const frontTex = def.texFront ? texCache[def.texFront] : null;
    const backTex  = def.texBack  ? texCache[def.texBack]  : null;
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, POG_H, 36),
        [
            new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.6 }),
            frontTex
                ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.22, metalness: 0.05 })
                : new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.22, metalness: 0.05 }),
            backTex
                ? new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 })
                : new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.88 }),
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
    const sdef     = ui.getSlammerDef();
    const frontTex = sdef?.texFront ? texCache[sdef.texFront] : null;
    const backTex  = sdef?.texBack  ? texCache[sdef.texBack]  : null;
    const knurl    = sdef?._knurl ?? null;
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, SLAM_H, 36),
        [
            knurl
                ? new THREE.MeshStandardMaterial({ map: knurl, roughness: 0.55, metalness: 0.35 })
                : new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.3 }),
            frontTex
                ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.15, metalness: 0.5 })
                : new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.05, metalness: 0.7 }),
            backTex
                ? new THREE.MeshStandardMaterial({ map: backTex,  roughness: 0.3,  metalness: 0.3 })
                : new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.4 }),
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
    body.position.set(x, stackTop + 6, z);
    body.velocity.set(0, -speed, 0);
    body.ccdSpherRadius     = Math.sqrt(POG_R * POG_R + (SLAM_H / 2) * (SLAM_H / 2)); // ≈ 1.21
    body.ccdMotionThreshold = 0.1; // Aktiver CCD når displacement > 0.1 unit/step (ved 65 speed ≈ 0.54/step)
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
    roundId++;                 // ← tilføj som første linje — ugyldiggør alle ventende callbacks
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
    settleMaxR  = 0;
    throwsLeft  = THROWS_PER_ROUND;
    wonCapsAll  = [];
    collisions.reset();
    powerBar.reset();
    cam.zoomIn();
    render.setReticleVisible(false); // skjules ved rundestart — vises ved første musbevægelse

    ui.hideResults();
    ui.updateThrowPips(THROWS_PER_ROUND, THROWS_PER_ROUND);
    ui.updatePileButtons(caps.map(c => c.def), []);
    ui.setStatus('Stacker caps...');
    setTimeout(() => { if (phase === 'idle') ui.setStatus('Klik på banen for at kaste!'); }, 300);
}

function endThrow(miss = false) {
    if (phase === 'done' || phase === 'restacking') return;
    render.setReticleVisible(false);

    // Frys alt
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

    // Sorter caps i face-up og face-down
    const wonNow   = [];
    const faceDown = [];
    caps.forEach(cap => {
        const up = new Vec3(0, 1, 0);
        cap.body.quaternion.vmult(up, up);
        (up.y > 0 ? wonNow : faceDown).push(cap);
    });

    wonCapsAll.push(...wonNow.map(c => c.def));
    totalScore += wonNow.length;
    throwsLeft--;
    ui.setScore(totalScore);
    ui.updateThrowPips(throwsLeft, THROWS_PER_ROUND);

    if (throwsLeft > 0 && faceDown.length > 0) {
        phase = 'restacking';
        const throwsDone = THROWS_PER_ROUND - throwsLeft;
        const msg = miss
            ? `Miss! · ${faceDown.length} caps tilbage · kast ${throwsDone}/${THROWS_PER_ROUND}`
            : `${wonNow.length} caps vendt · ${faceDown.length} tilbage · kast ${throwsDone}/${THROWS_PER_ROUND}`;
        ui.setStatus(msg);

        const capturedRound = roundId; // ← fang generation inden timeout
        setTimeout(() => {
            if (roundId !== capturedRound) return; // ← reset blev trykket, bail ud

            // Fjern vundne caps fra scene + physics
            wonNow.forEach(({ mesh, body }) => {
                render.removeMesh(mesh);
                physics.world.removeBody(body);
            });

            // Fjern slammer
            if (slammer) {
                render.removeMesh(slammer.mesh);
                physics.world.removeBody(slammer.body);
                slammer = null;
            }

            // Bland og restack de tilbageværende caps
            for (let i = faceDown.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [faceDown[i], faceDown[j]] = [faceDown[j], faceDown[i]];
            }
            faceDown.forEach(({ body }, i) => {
                physics.world.removeBody(body);
                body.type = BODY_TYPES.STATIC;
                body.velocity.set(0, 0, 0);
                body.angularVelocity.set(0, 0, 0);
                body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
                body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
                physics.world.addBody(body);
            });
            caps = faceDown;
            ui.updatePileButtons(caps.map(c => c.def), wonCapsAll);

            // Reset til næste kast
            collisions.reset();
            powerBar.reset();
            cam.zoomIn();
            settleMaxR   = 0;
            blastTime    = 0;
            settleStart  = 0;
            aimingStart  = 0;
            fallingStart = 0;

            ui.setStatus(`Kast ${throwsDone + 1}/${THROWS_PER_ROUND} · Klik for at kaste!`);
            setTimeout(() => { phase = 'idle'; }, 150);
        }, 1500);

    } else {
        phase = 'done';
        ui.showResults(wonCapsAll.length, totalScore, wonCapsAll);
        ui.setStatus('Runde slut! · Klik for næste runde');
    }
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

    if (phase === 'falling' && now - fallingStart > 5000) {
        collisions.reset();
        endThrow(true);
    }

    physics.step(dt, caps.length);
    collisions.checkPending();
    render.sync(caps, slammer);

    // Dynamisk zoom: kun i settling-fasen, kun når shaken er færdig
    // (shake + zoom på samme tid kæmper mod hinanden visuelt)
    if (phase === 'settling' && !cam.isShaking()) {
        caps.forEach(({ body }) => {
            if (body.velocity.length() < 12) {
                const p = body.position;
                settleMaxR = Math.max(settleMaxR, Math.sqrt(p.x * p.x + p.z * p.z));
            }
        });
        if (settleMaxR > 0) {
            const scale = Math.max(1, Math.min(settleMaxR / 22, 1.5));
            cam.setZoomScale(scale);
        }
    }

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
        if (el > 5000 || (el > 600 && allStill())) endThrow();
    }

    cam.update(dt);
    render.render();
}

await loadTextures();
buildStack();
animate();
