import { Body, Vec3, BODY_TYPES } from '../lib/cannon.js';
import { PhysicsEngine }      from './physics/PhysicsEngine.js';
import { CollisionManager }   from './physics/CollisionManager.js';
import { createCapShape, createSlammerShape } from './physics/shapes/ShapeFactory.js';
import { RenderEngine }       from './render/RenderEngine.js';
import { CameraController }   from './render/CameraController.js';
import { loadTextures }       from './render/TextureLoader.js';
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

// ─── TIMER REGISTRY ───────────────────────────────────────────────────────────
// Alle forsinkede kald registreres her, så cancelAllTimers() kan aflive dem alle
// på én gang — uanset hvilken fase spillet er i når reset trykkes.
const _timers = new Set();

function delay(fn, ms) {
    const id = setTimeout(() => { _timers.delete(id); fn(); }, ms);
    _timers.add(id);
    return id;
}

function cancelAllTimers() {
    _timers.forEach(clearTimeout);
    _timers.clear();
}

// ─── STATE ───────────────────────────────────────────────────────────────────
let caps        = [];
let slammer     = null;
// idle → aiming → falling → blasted → settling → done
let phase       = 'idle';
let blastTime   = 0;
let settleStart = 0;
let totalScore  = 0;
let settleMaxR  = 0;
let throwsLeft  = 0;
let wonCapsAll  = []; // akkumuleret på tværs af alle kast i en runde

// Ventende restack-data — udfyldes af endThrow(), bruges af applyRestack() ved klik
let _pendingWon        = [];
let _pendingFaceDown   = [];
let _pendingThrowsDone = 0;


// Fanget ved klik — bruges konsistent i spawn og blast
let shotSpeed    = 0;
let shotMass     = 0;
let pendingX     = 0;
let pendingY     = 0;
let pendingZ     = 0;
let aimingStart   = 0;
let fallingStart  = 0; // timeout-sikkerhed mod miss
let prevSlammerY  = null; // slammernes y-position fra forrige frame — til pass-through detektion

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
    if (phase === 'ready') { suppressNextAim = true; applyRestack(); return; }
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
    ui.setActionPrompt(null);
    ui.setStatus('Sigter...');
};

document.getElementById('slammer-btn').addEventListener('pointerdown', e => { e.stopPropagation(); ui.toggleSlammerPanel(); });
document.getElementById('resetBtn').addEventListener('click', e => {
    e.stopPropagation();
    totalScore = 0;
    ui.resetScore();
    buildStack();
});

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
    // ccdSpherRadius skal dække slammers faktiske bounding sphere — ikke bare et vilkårligt lille tal.
    // For lille radius → CCD misser off-center kollisioner når stakken er lav.
    body.ccdSpherRadius     = Math.sqrt(POG_R * POG_R + (SLAM_H / 2) * (SLAM_H / 2)); // ≈ 1.21
    body.ccdMotionThreshold = 0.1;
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
    // Afliv alle ventende setTimeout-kald øjeblikkeligt — ingen forsinket
    // logik fra den forrige runde kan nå at røre state efter dette punkt.
    cancelAllTimers();
    suppressNextAim = true;    // ← undertrykker det stray aim-event fra klikket

    caps.forEach(({ mesh, body }) => { render.removeMesh(mesh); physics.world.removeBody(body); });
    caps = [];
    if (slammer) {
        render.removeMesh(slammer.mesh);
        physics.world.removeBody(slammer.body);
        slammer = null;
    }

    const count      = ui.getStackCount();
    const activeCaps = [...ui.getActiveCaps()].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
        spawnCap(activeCaps[i % activeCaps.length], POG_H * 0.5 + i * (POG_H + 0.01));
    }

    phase        = 'idle';
    blastTime    = 0;
    settleStart  = 0;
    aimingStart  = 0;
    fallingStart = 0;
    settleMaxR   = 0;
    prevSlammerY = null;
    throwsLeft   = THROWS_PER_ROUND;
    wonCapsAll     = [];
    _pendingWon        = [];
    _pendingFaceDown   = [];
    _pendingThrowsDone = 0;
    collisions.reset();
    powerBar.reset();
    cam.zoomIn();
    render.setReticleVisible(false);

    ui.hideResults();
    ui.updateThrowPips(THROWS_PER_ROUND, THROWS_PER_ROUND);
    ui.updatePileButtons(caps.map(c => c.def), []);
    ui.setStatus('Stacker caps...');
    ui.setActionPrompt(null);
    delay(() => { if (phase === 'idle') ui.setActionPrompt('Klik på banen for at kaste!'); }, 300);
}


function applyRestack() {
    _pendingWon.forEach(({ mesh, body }) => {
        render.removeMesh(mesh);
        physics.world.removeBody(body);
    });
    if (slammer) {
        render.removeMesh(slammer.mesh);
        physics.world.removeBody(slammer.body);
        slammer = null;
    }
    for (let i = _pendingFaceDown.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_pendingFaceDown[i], _pendingFaceDown[j]] = [_pendingFaceDown[j], _pendingFaceDown[i]];
    }
    _pendingFaceDown.forEach(({ body }, i) => {
        physics.world.removeBody(body);
        body.type = BODY_TYPES.STATIC;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
        body.position.set(0, POG_H * 0.5 + i * (POG_H + 0.01), 0);
        body.quaternion.setFromEuler(Math.PI + (Math.random() - 0.5) * 0.04, Math.random() * Math.PI * 2, 0);
        physics.world.addBody(body);
    });
    caps = _pendingFaceDown;
    ui.updatePileButtons(caps.map(c => c.def), wonCapsAll);
    collisions.reset();
    powerBar.reset();
    cam.zoomIn();
    settleMaxR   = 0;
    blastTime    = 0;
    settleStart  = 0;
    aimingStart  = 0;
    fallingStart = 0;
    prevSlammerY = null;
    ui.setStatus(`Kast ${_pendingThrowsDone + 1}/${THROWS_PER_ROUND}`);
    ui.setActionPrompt('Klik for at kaste!');
    phase = 'idle';
}

function endThrow(miss = false) {
    if (phase === 'done' || phase === 'restacking' || phase === 'ready') return;
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
        // Cannon-es tillader lidt kontakt-penetration ved høj hastighed — snap slammeren
        // op til overfladen hvis den er endt under det visuelle gulv (mat er ved y≈0.04)
        if (slammer.body.position.y < SLAM_H / 2 + 0.05) {
            slammer.body.position.y = SLAM_H / 2 + 0.05;
        }
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

    // Pop-animation: caps forsvinder fra måtten, ikon svæver ud af Flipped-knap
    const popDelay = Math.max(80, 500 / Math.max(wonNow.length, 1));
    wonNow.forEach((cap, i) => {
        delay(() => {
            popCapMesh(cap.mesh);
            ui.popCollectIcon(cap.def);
        }, i * popDelay);
    });

    ui.updatePileButtons(faceDown.map(c => c.def), wonCapsAll);
    ui.setScore(totalScore);
    ui.updateThrowPips(throwsLeft, THROWS_PER_ROUND);

    if (throwsLeft > 0 && faceDown.length > 0) {
        // Gem data til applyRestack() — ingen timer, venter på klik
        _pendingWon        = wonNow;
        _pendingFaceDown   = faceDown;
        _pendingThrowsDone = THROWS_PER_ROUND - throwsLeft;

        const info = miss
            ? `Miss! · ${faceDown.length} caps tilbage`
            : `${wonNow.length} caps vendt · ${faceDown.length} tilbage`;
        ui.setStatus(info);
        ui.setActionPrompt('Klik for at fortsætte');
        phase = 'ready'; // venter på klik → applyRestack()

    } else {
        // Ingen kast tilbage eller ingen caps — runde slut
        phase = 'done';
        ui.showResults(wonCapsAll.length, totalScore, wonCapsAll);
        ui.setStatus('Runde slut!');
        ui.setActionPrompt('Klik for næste runde');
    }
}

function popCapMesh(mesh) {
    const start = performance.now();
    const dur   = 220;
    (function tick() {
        const t = Math.min((performance.now() - start) / dur, 1);
        const s = t < 0.45
            ? 1 + (t / 0.45) * 0.3          // 1 → 1.3
            : 1.3 * (1 - (t - 0.45) / 0.55); // 1.3 → 0
        mesh.scale.set(s, s, s);
        if (t < 1) requestAnimationFrame(tick);
    })();
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

    // Cap tunnel safety net: positionelt cylinder-overlap-tjek hver frame.
    // Cannon-es CCD kræver at broadphase allerede har fundet parret — ved tynde
    // Cap tunnel safety net — uafhængig af cannon-es CCD.
    // Bruger slammernes position FRA FORRIGE FRAME (prevSlammerY) til at detektere
    // pass-throughs: hvis slammeren var OVER cap-zonen sidst og er UNDER toppen nu,
    // krydsede den zonen i dette step — selv hvis broadphase missede kollisionen.
    if (phase === 'falling' && slammer) {
        const sp   = slammer.body.position;
        const prev = prevSlammerY ?? sp.y;
        const halfSum = (SLAM_H + POG_H) / 2; // 0.205 — summen af halvdele
        for (const { body } of caps) {
            const cp  = body.position;
            const dxz = Math.sqrt((sp.x - cp.x) ** 2 + (sp.z - cp.z) ** 2);
            // Horisontalt overlap + slammernes bane krydsede cap-zonens y-interval denne frame
            if (dxz < POG_R * 2 && sp.y < cp.y + halfSum && prev > cp.y - halfSum) {
                collisions.forceBlast();
                break;
            }
        }
        prevSlammerY = sp.y;
    } else {
        prevSlammerY = null;
    }

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
            const t       = Math.min((el - 400) / 1500, 1);
            const tAngular = Math.min((el - 400) / 600, 1); // angular dæmpes 2.5x hurtigere
            caps.forEach(({ body }) => {
                body.linearDamping  = 0.04 + t        * 0.92;
                body.angularDamping = 0.15 + tAngular * 0.81; // starter lidt højere, når 0.96 på ~600ms
            });
        }
        if (el > 5000 || (el > 600 && allStill())) endThrow();
    }

    cam.update(dt);
    render.render();
}

const loadingFill   = document.getElementById('loading-fill');
const loadingScreen = document.getElementById('loading-screen');

const texCache = await loadTextures(p => {
    if (loadingFill) loadingFill.style.width = (p * 100) + '%';
});

loadingScreen.style.opacity = '0';
setTimeout(() => { loadingScreen.style.display = 'none'; }, 400);

buildStack();
animate();