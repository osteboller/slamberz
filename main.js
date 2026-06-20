import { World, Body, Cylinder, Plane, Vec3, Material, ContactMaterial, BODY_TYPES } from './cannon.js';

// ─── KONSTANTER ───────────────────────────────────────────────────────────────
const POG_R       = 1.2;
const POG_H       = 0.13;
const SLAM_H      = 0.28;
const STACK_COUNT = 8;

// Per-cap properties — klar til fremtidigt spil-system
const CAP_DEFS = [
    { color: 0x7755ee, name: 'Lilla',   mass: 1.0, bounce: 0.3 },
    { color: 0xe05522, name: 'Orange',  mass: 1.0, bounce: 0.3 },
    { color: 0x22aa77, name: 'Grøn',    mass: 1.0, bounce: 0.3 },
    { color: 0xcc3377, name: 'Pink',    mass: 1.0, bounce: 0.3 },
    { color: 0xdd9911, name: 'Gul',     mass: 1.0, bounce: 0.3 },
    { color: 0x2277cc, name: 'Blå',     mass: 1.0, bounce: 0.3 },
    { color: 0x44aa22, name: 'Lime',    mass: 1.0, bounce: 0.3 },
    { color: 0xdd3344, name: 'Rød',     mass: 1.0, bounce: 0.3 },
];

// ─── CANNON ───────────────────────────────────────────────────────────────────
// Gravity 200: caps er ~1.2 enheder = ~4cm i virkeligheden → 200 ≈ real g i denne skala
const world = new World({ gravity: new Vec3(0, -200, 0) });
world.allowSleep      = true;
world.sleepSpeedLimit = 2.0;   // sov hvis hastighed under 2 — stopper dirren
world.sleepTimeLimit  = 0.2;

const mCap     = new Material('cap');
const mGround  = new Material('ground');
const mSlammer = new Material('slammer');

world.addContactMaterial(new ContactMaterial(mCap,     mGround,  { friction: 0.65, restitution: 0.28 }));
world.addContactMaterial(new ContactMaterial(mCap,     mCap,     { friction: 0.8,  restitution: 0.05 })); // høj friktion: holder stakken stille
world.addContactMaterial(new ContactMaterial(mSlammer, mCap,     { friction: 0.0,  restitution: 0.0  }));
world.addContactMaterial(new ContactMaterial(mSlammer, mGround,  { friction: 0.5,  restitution: 0.05 }));

const groundBody = new Body({ mass: 0, material: mGround });
groundBody.addShape(new Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ─── THREE ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e2530);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 16, 22);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xfff8e8, 1.2);
sun.position.set(6, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near:1, far:80, left:-16, right:16, top:16, bottom:-16 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
fill.position.set(-5, 6, -8);
scene.add(fill);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x2a3840, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(60, 60, 0x3a4a4e, 0x2e3e44));

// ─── STATE ────────────────────────────────────────────────────────────────────
let caps       = [];   // { mesh, body, def }
let slammerObj = null;
let phase      = 'idle'; // idle | falling | blasted | settling | done
let blastTime  = 0;
let settleStart = 0;
let shotFired  = false;
let totalScore = 0;

// Slider state
let sliderSpeed = 65;
let sliderMass  = 3.5;

// ─── CAP ──────────────────────────────────────────────────────────────────────
function makeCap(def, y) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, POG_H, 36),
        [
            new THREE.MeshStandardMaterial({ color: 0xe0dbd2, roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.22, metalness: 0.05 }),
            new THREE.MeshStandardMaterial({ color: 0xb0a89a, roughness: 0.88 }),
        ]
    );
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);

    const body = new Body({
        mass: def.mass,
        material: mCap,
        linearDamping:  0.85,
        angularDamping: 0.85,
        allowSleep: true,
        type: BODY_TYPES.STATIC,  // frosset indtil blast — kan ikke glide
    });
    body.addShape(new Cylinder(POG_R, POG_R, POG_H, 16));
    body.quaternion.setFromEuler(Math.PI + (Math.random()-0.5)*0.04, Math.random()*Math.PI*2, 0);
    body.position.set(0, y, 0);
    world.addBody(body);

    caps.push({ mesh, body, def });
}

// ─── SLAMMER ──────────────────────────────────────────────────────────────────
function makeSlammer(x, z) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(POG_R, POG_R, SLAM_H, 36),
        [
            new THREE.MeshStandardMaterial({ color: 0xccccbb, roughness: 0.3 }),
            new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.05, metalness: 0.7 }),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2,  metalness: 0.4 }),
        ]
    );
    mesh.castShadow = true;
    scene.add(mesh);

    const body = new Body({
        mass: sliderMass,
        material: mSlammer,
        linearDamping: 0,
        angularDamping: 0,
        allowSleep: false,
    });
    body.addShape(new Cylinder(POG_R, POG_R, SLAM_H, 16));
    // Start lige over stakken — ingen lang ventetid
    const stackTop = POG_H * 0.5 + (STACK_COUNT - 1) * (POG_H + 0.01) + SLAM_H + 0.5;
    body.position.set(x, stackTop + 2, z);
    body.velocity.set(0, -sliderSpeed, 0);
    body.ccdSpherRadius     = 0.05;
    body.ccdMotionThreshold = 0.005;
    world.addBody(body);

    slammerObj = { mesh, body };
}

// ─── BLAST ────────────────────────────────────────────────────────────────────
// Camera shake state
let shakeIntensity  = 0;
let shakeDuration   = 0;
let shakeStartDur   = 0; // gemmer original varighed til easing
const CAM_BASE = { x: 0, y: 16, z: 22 };

function blast() {
    const force    = Math.sqrt(sliderMass) * sliderSpeed * 0.55;
    const maxForce = Math.sqrt(20) * 100 * 0.55;
    const ratio    = Math.min(force / maxForce, 1);   // 0=svag, 1=max kraft

    // Shake skalerer med kraft
    shakeIntensity = 0.08 + ratio * 0.5;
    shakeDuration  = 150  + ratio * 300;
    shakeStartDur  = shakeDuration;

    caps.forEach(({ body }, i) => {
        body.type           = BODY_TYPES.DYNAMIC;
        body.linearDamping  = 0.04;
        body.angularDamping = 0.04;
        body.wakeUp();

        const angle = (i / caps.length) * Math.PI * 2 + (Math.random()-0.5) * 1.5;
        const r     = 0.6 + Math.random() * 0.9;

        body.velocity.x = Math.cos(angle) * force * r;
        body.velocity.z = Math.sin(angle) * force * r;
        body.velocity.y = force * (0.3 + Math.random() * 0.5);

        body.angularVelocity.x = (Math.random()-0.5) * force * 1.8;
        body.angularVelocity.z = (Math.random()-0.5) * force * 1.8;
        body.angularVelocity.y = (Math.random()-0.5) * force * 0.4;
    });
}

// ─── BUILD/CLEAR ──────────────────────────────────────────────────────────────
function buildStack() {
    caps.forEach(({ mesh, body }) => { scene.remove(mesh); world.removeBody(body); });
    caps = [];
    if (slammerObj) {
        scene.remove(slammerObj.mesh);
        world.removeBody(slammerObj.body);
        slammerObj = null;
    }

    for (let i = 0; i < STACK_COUNT; i++) {
        const def = CAP_DEFS[i % CAP_DEFS.length];
        makeCap(def, POG_H * 0.5 + i * (POG_H + 0.01));
    }

    phase       = 'idle';
    shotFired   = false;
    blastTime   = 0;
    settleStart = 0;

    document.getElementById('results').style.display = 'none';
    setTimeout(() => { if (phase === 'idle') setStatus('Klik på banen for at kaste!'); }, 300);
    setStatus('Stacker caps...');
}

// ─── RESULTAT ─────────────────────────────────────────────────────────────────
function finishRound() {
    if (phase === 'done') return;
    phase = 'done';

    // Frys alle caps øjeblikkeligt — ingen mere glidning eller dirren
    caps.forEach(({ body }) => {
        body.type = BODY_TYPES.STATIC;
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
    });
    if (slammerObj) {
        slammerObj.body.type = BODY_TYPES.STATIC;
        slammerObj.body.velocity.set(0, 0, 0);
        slammerObj.body.angularVelocity.set(0, 0, 0);
    }

    let won = 0;
    const wonCaps = [];
    caps.forEach(({ body, def }) => {
        const up = new Vec3(0, 1, 0);
        body.quaternion.vmult(up, up);
        if (up.y > 0) { won++; wonCaps.push(def); }
    });

    totalScore += won;
    document.getElementById('score').textContent    = totalScore;
    document.getElementById('wonCount').textContent = won;

    // Vis hvilke caps der er vundet med farver
    const list = document.getElementById('wonList');
    list.innerHTML = wonCaps.map(d =>
        `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;
        background:#${d.color.toString(16).padStart(6,'0')};margin:2px;
        border:1px solid rgba(255,255,255,0.3)"></span>`
    ).join('');

    document.getElementById('results').style.display = 'block';
    setStatus('Runde slut!');
}

function allStill() {
    return caps.every(({ body }) =>
        body.sleepState === 2 ||
        (body.velocity.length() < 0.5 && body.angularVelocity.length() < 0.5)
    );
}

function setStatus(t) { document.getElementById('status').textContent = t; }

// ─── INPUT ────────────────────────────────────────────────────────────────────
const ray   = new THREE.Raycaster();
const mVec  = new THREE.Vector2();
const floor = new THREE.Plane(new THREE.Vector3(0,1,0), 0);

renderer.domElement.addEventListener('click', e => {
    if (phase !== 'idle') return;
    mVec.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
    ray.setFromCamera(mVec, camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(floor, hit);
    phase     = 'falling';
    shotFired = true;
    makeSlammer(hit.x, hit.z);
    setStatus('Slammer falder...');
});

document.getElementById('resetBtn').addEventListener('click', e => { e.stopPropagation(); buildStack(); });
document.getElementById('nextBtn').addEventListener('click',  e => { e.stopPropagation(); buildStack(); });

// ─── SYNC ─────────────────────────────────────────────────────────────────────
function sync() {
    caps.forEach(({ mesh, body }) => {
        mesh.position.copy(body.position);
        mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    });
    if (slammerObj) {
        slammerObj.mesh.position.copy(slammerObj.body.position);
        slammerObj.mesh.quaternion.set(
            slammerObj.body.quaternion.x, slammerObj.body.quaternion.y,
            slammerObj.body.quaternion.z, slammerObj.body.quaternion.w);
    }
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
let last = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt  = Math.min((now - last) / 1000, 1/30);
    last = now;

    world.step(1/120, dt, 10);
    sync();

    // Detekter slammer når den når toppen af stakken
    if (phase === 'falling' && slammerObj) {
        const topY = POG_H * 0.5 + (STACK_COUNT-1) * (POG_H + 0.01) + SLAM_H * 0.5;
        if (slammerObj.body.position.y <= topY + 0.4) {
            blast();
            blastTime = now;
            phase     = 'blasted';
            setStatus('BOOM!');
        }
    }

    // Slammer bliver LIGGENDE på gulvet — fjernes ikke
    // Vi stopper bare med at tracke den aktivt
    if (phase === 'blasted' && slammerObj && now - blastTime > 400) {
        // Giv slammeren høj damping så den stopper hurtigt
        slammerObj.body.linearDamping  = 0.95;
        slammerObj.body.angularDamping = 0.95;
        phase       = 'settling';
        settleStart = now;
        setStatus('Caps lander...');
    }

    // Settling: øg damping gradvist så caps stopper hurtigt efter landing
    if (phase === 'settling') {
        const el = now - settleStart;

        // Efter 0.4s begynder vi at bremse caps der stadig bevæger sig langsomt
        // Ramper op fra 0.04 → 0.96 over 1.5 sekunder
        if (el > 400) {
            const t = Math.min((el - 400) / 1500, 1);
            const damp = 0.04 + t * 0.92;
            caps.forEach(({ body }) => {
                body.linearDamping  = damp;
                body.angularDamping = damp;
            });
        }

        if (el > 5000 || (el > 600 && allStill())) finishRound();
    }

    // Camera shake — easer ud over varighed baseret på kraft
    if (shakeIntensity > 0) {
        shakeDuration -= dt * 1000;
        const t = Math.max(0, shakeDuration / shakeStartDur); // 1→0
        const s = shakeIntensity * t * t;                     // ease-out
        camera.position.set(
            CAM_BASE.x + (Math.random() - 0.5) * s * 2,
            CAM_BASE.y + (Math.random() - 0.5) * s,
            CAM_BASE.z + (Math.random() - 0.5) * s
        );
        if (shakeDuration <= 0) {
            shakeIntensity = 0;
            camera.position.set(CAM_BASE.x, CAM_BASE.y, CAM_BASE.z);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

buildStack();
animate();

// ─── TUNE PANEL ───────────────────────────────────────────────────────────────
(function() {
    const panel = document.createElement('div');
    panel.style.cssText = `
        position:absolute;bottom:20px;right:20px;
        background:rgba(0,0,0,0.82);color:#fff;padding:16px 20px;
        border-radius:10px;font:13px/1.9 Arial,sans-serif;width:210px;
        border:1px solid rgba(255,255,255,0.12);user-select:none;`;
    panel.innerHTML = `
        <b style="color:#ffcc00;font-size:14px">⚙ Slammer</b>
        <div style="margin-top:10px">
            <div style="display:flex;justify-content:space-between">
                <span style="color:#ccc">Hastighed</span><b id="tv-spd">${sliderSpeed}</b>
            </div>
            <input id="sl-spd" type="range" min="10" max="100" step="1" value="65"
                style="width:100%;accent-color:#ffcc00;cursor:pointer;margin:0">
        </div>
        <div style="margin-top:8px">
            <div style="display:flex;justify-content:space-between">
                <span style="color:#ccc">Vægt</span><b id="tv-mss">3.5</b>
            </div>
            <input id="sl-mss" type="range" min="0.5" max="20" step="0.5" value="3.5"
                style="width:100%;accent-color:#ffcc00;cursor:pointer;margin:0">
        </div>
        <p style="margin-top:8px;font-size:11px;color:#777;line-height:1.3">
            Virker fra næste kast</p>`;
    document.body.appendChild(panel);

    document.getElementById('sl-spd').addEventListener('input', e => {
        sliderSpeed = +e.target.value;
        document.getElementById('tv-spd').textContent = sliderSpeed;
    });
    document.getElementById('sl-mss').addEventListener('input', e => {
        sliderMass = +e.target.value;
        document.getElementById('tv-mss').textContent = sliderMass;
    });
})();