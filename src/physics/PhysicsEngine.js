import { World, Body, Plane, Vec3, Material, ContactMaterial } from '../../lib/cannon.js';

export class PhysicsEngine {
    constructor() {
        this.world = new World({ gravity: new Vec3(0, -200, 0) });
        this.world.allowSleep      = true;
        this.world.sleepSpeedLimit = 2.0;
        this.world.sleepTimeLimit  = 0.2;

        this.mCap     = new Material('cap');
        this.mGround  = new Material('ground');
        this.mSlammer = new Material('slammer');

        this.world.addContactMaterial(new ContactMaterial(this.mCap,     this.mGround,  { friction: 0.65, restitution: 0.28 }));
        this.world.addContactMaterial(new ContactMaterial(this.mCap,     this.mCap,     { friction: 0.8,  restitution: 0.05 }));
        this.world.addContactMaterial(new ContactMaterial(this.mSlammer, this.mCap,     { friction: 0.0,  restitution: 0.0  }));
        this.world.addContactMaterial(new ContactMaterial(this.mSlammer, this.mGround,  { friction: 0.5,  restitution: 0.05 }));

        this.groundBody = new Body({ mass: 0, material: this.mGround });
        this.groundBody.addShape(new Plane());
        this.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.groundBody.userData = { kind: 'ground' };
        this.world.addBody(this.groundBody);
    }

    step(dt) {
        this.world.step(1 / 120, dt, 10);
    }
}
