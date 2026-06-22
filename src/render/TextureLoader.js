import { CAP_DEFS, SLAMMER_DEFS } from '../config/constants.js';

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

export async function loadTextures() {
    const cache  = {};
    const loader = new THREE.TextureLoader();
    const load   = url => new Promise(res => {
        loader.load(url, tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            res(tex);
        }, undefined, () => { console.warn('Tekstur mangler:', url); res(null); });
    });

    for (const def of CAP_DEFS) {
        if (def.texFront) cache[def.texFront] = await load(def.texFront);
        if (def.texBack)  cache[def.texBack]  = await load(def.texBack);
    }
    for (const def of SLAMMER_DEFS) {
        if (def.texFront) cache[def.texFront] = await load(def.texFront);
        if (def.texBack)  cache[def.texBack]  = await load(def.texBack);
        def._knurl = createKnurlTexture(def.rimColor);
    }

    return cache;
}
