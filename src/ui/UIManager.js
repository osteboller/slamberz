import { DEFAULT_MASS, STACK_COUNT } from '../config/constants.js';

export class UIManager {
    constructor() {
        this._mass        = DEFAULT_MASS;
        this._gravity     = 200;   // stored positive, returned negative
        this._blastSpread = 0.55;
        this._stackCount  = STACK_COUNT;
        this._panelOpen   = true;

        this.onGravityChange = null;

        this._buildTunePanel();
    }

    // ─── GETTERS ─────────────────────────────────────────────────────────────
    getMass()        { return this._mass; }
    getGravity()     { return -this._gravity; }
    getBlastSpread() { return this._blastSpread; }
    getStackCount()  { return this._stackCount; }

    // ─── STATUS / RESULTS ─────────────────────────────────────────────────────
    setStatus(text) {
        document.getElementById('status').textContent = text;
    }

    showResults(won, totalScore, wonCaps) {
        document.getElementById('score').textContent    = totalScore;
        document.getElementById('wonCount').textContent = won;
        const list = document.getElementById('wonList');
        list.innerHTML = wonCaps.map(d =>
            `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;
            background:#${d.color.toString(16).padStart(6, '0')};margin:2px;
            border:1px solid rgba(255,255,255,0.3)"></span>`
        ).join('');
        document.getElementById('results').style.display = 'block';
    }

    hideResults() {
        document.getElementById('results').style.display = 'none';
    }

    // ─── PANEL ───────────────────────────────────────────────────────────────
    _sliderRow(label, sliderId, valueId, min, max, step, val) {
        return `
            <div style="margin-top:8px">
                <div style="display:flex;justify-content:space-between">
                    <span style="color:#ccc">${label}</span><b id="${valueId}">${val}</b>
                </div>
                <input id="${sliderId}" type="range"
                    min="${min}" max="${max}" step="${step}" value="${val}"
                    style="width:100%;accent-color:#ffcc00;cursor:pointer;margin:0">
            </div>`;
    }

    _buildTunePanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position:absolute;bottom:20px;right:20px;
            background:rgba(0,0,0,0.82);color:#fff;
            border-radius:10px;font:13px/1.9 Arial,sans-serif;width:210px;
            border:1px solid rgba(255,255,255,0.12);user-select:none;overflow:hidden;`;

        panel.innerHTML = `
            <div id="tune-header" style="
                padding:12px 16px;cursor:pointer;
                display:flex;justify-content:space-between;align-items:center;
                border-bottom:1px solid rgba(255,255,255,0.08)">
                <b style="color:#ffcc00;font-size:14px">⚙ Slammer</b>
                <span id="tune-arrow" style="color:#888;font-size:11px">▼</span>
            </div>
            <div id="tune-body" style="padding:12px 16px">
                ${this._sliderRow('Mass',    'sl-mss', 'tv-mss', 0.5,  20,   0.5,  this._mass)}
                ${this._sliderRow('Gravity', 'sl-grav','tv-grav',  50, 400,   10,   this._gravity)}
                ${this._sliderRow('Blast',   'sl-bls', 'tv-bls',  0.1,  1.5,  0.05, this._blastSpread)}
                ${this._sliderRow('Caps',    'sl-cnt', 'tv-cnt',    4,  16,    1,   this._stackCount)}
                <p style="margin-top:6px;font-size:11px;color:#555;line-height:1.3">
                    Cap count applies next round</p>
            </div>`;

        document.body.appendChild(panel);

        document.getElementById('tune-header').addEventListener('click', () => {
            this._panelOpen = !this._panelOpen;
            document.getElementById('tune-body').style.display = this._panelOpen ? '' : 'none';
            document.getElementById('tune-arrow').textContent  = this._panelOpen ? '▼' : '►';
        });

        document.getElementById('sl-mss').addEventListener('input', e => {
            this._mass = +e.target.value;
            document.getElementById('tv-mss').textContent = this._mass;
        });
        document.getElementById('sl-grav').addEventListener('input', e => {
            this._gravity = +e.target.value;
            document.getElementById('tv-grav').textContent = this._gravity;
            if (this.onGravityChange) this.onGravityChange(-this._gravity);
        });
        document.getElementById('sl-bls').addEventListener('input', e => {
            this._blastSpread = +e.target.value;
            document.getElementById('tv-bls').textContent = this._blastSpread;
        });
        document.getElementById('sl-cnt').addEventListener('input', e => {
            this._stackCount = +e.target.value;
            document.getElementById('tv-cnt').textContent = this._stackCount;
        });
    }
}
