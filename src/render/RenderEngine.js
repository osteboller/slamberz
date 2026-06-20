import { CAM_BASE } from '../config/constants.js';

export class RenderEngine {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e2530);

        this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
        this.camera.position.set(CAM_BASE.x, CAM_BASE.y, CAM_BASE.z);
        this.camera.lookAt(0, 1, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this._setupLights();
        this._setupGround();
        this._setupReticle(); // <--- NY: Byg sigtekornet med det samme

        window.addEventListener('resize', () => {
            this.camera.aspect = innerWidth / innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(innerWidth, innerHeight);
        });
    }

    _setupLights() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const sun = new THREE.DirectionalLight(0xfff8e8, 1.2);
        sun.position.set(6, 18, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { near: 1, far: 80, left: -16, right: 16, top: 16, bottom: -16 });
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0xaaccff, 0.3);
        fill.position.set(-5, 6, -8);
        this.scene.add(fill);
    }

    _setupGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(60, 60),
            new THREE.MeshStandardMaterial({ color: 0x2a3840, roughness: 0.95 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.scene.add(new THREE.GridHelper(60, 60, 0x3a4a4e, 0x2e3e44));
    }

    _setupReticle() {
        const geometry = new THREE.RingGeometry(0.5, 0.75, 48);
        const material = new THREE.MeshBasicMaterial({
            color:     0xff3333,
            side:      THREE.DoubleSide,
            depthTest: false,   // tegnes altid øverst — aldrig bag caps
        });
        this.reticleMesh             = new THREE.Mesh(geometry, material);
        this.reticleMesh.rotation.x  = -Math.PI / 2;
        this.reticleMesh.renderOrder = 999;
        this.reticleMesh.visible     = false;
        this.scene.add(this.reticleMesh);
    }

    setReticleVisible(visible) {
        if (this.reticleMesh) this.reticleMesh.visible = visible;
    }

    // y er det faktiske 3D-punkt på overfladen (cap-top, cap-side eller gulv)
    setReticlePosition(x, y, z) {
        if (this.reticleMesh) {
            this.reticleMesh.position.set(x, y + 0.02, z);
        }
    }

    addMesh(mesh)    { this.scene.add(mesh); }
    removeMesh(mesh) { this.scene.remove(mesh); }
    getDomElement()  { return this.renderer.domElement; }

    sync(caps, slammer) {
        caps.forEach(({ mesh, body }) => {
            mesh.position.copy(body.position);
            mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
        });
        if (slammer) {
            slammer.mesh.position.copy(slammer.body.position);
            slammer.mesh.quaternion.set(
                slammer.body.quaternion.x, slammer.body.quaternion.y,
                slammer.body.quaternion.z, slammer.body.quaternion.w
            );
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}