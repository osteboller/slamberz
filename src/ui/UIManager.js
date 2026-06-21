import { DEFAULT_MASS, STACK_COUNT, SLAMMER_DEFS } from '../config/constants.js';

export class UIManager {
    constructor() {
        this._mass        = DEFAULT_MASS;
        this._gravity     = 200;
        this._blastSpread = 0.55;
        this._stackCount  = STACK_COUNT;
        this._panelOpen   = false;
        this._slammerIdx  = 0;
        this._remainingDefs = [];
        this._wonDefs       = [];

        this.onGravityChange = null;

        this._buildTunePanel();
        this._buildPileOverlay();
    }

    // ─── GETTERS ─────────────────────────────────────────────────────────────
    getMass()        { return this._mass; }
    getGravity()     { return -this._gravity; }
    getBlastSpread() { return this._blastSpread; }
    getStackCount()  { return this._stackCount; }

    // ─── STATUS / RESULTS ────────────────────────────────────────────────────
    setStatus(text) {
        document.getElementById('status').textContent = text;
    }

    showResults(won, totalScore, wonCaps) {
        document.getElementById('score').textContent    = totalScore;
        document.getElementById('wonCount').textContent = won;
        document.getElementById('wonList').innerHTML = wonCaps.map(d =>
            `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;
            background:#${d.color.toString(16).padStart(6,'0')};margin:2px;
            border:1px solid rgba(255,255,255,0.3)"></span>`
        ).join('');
        document.getElementById('results').style.display = 'block';
    }

    hideResults() {
        document.getElementById('results').style.display = 'none';
    }

    setScore(n) {
        document.getElementById('score').textContent = n;
    }

    resetScore() {
        document.getElementById('score').textContent = 0;
    }

    // ─── THROW PIPS ──────────────────────────────────────────────────────────
    updateThrowPips(throwsLeft, throwsTotal) {
        const el = document.getElementById('throw-pips');
        if (!el) return;
        el.innerHTML = '';
        for (let i = 0; i < throwsTotal; i++) {
            const pip = document.createElement('span');
            pip.className = 'throw-pip' + (i < throwsLeft ? ' active' : '');
            el.appendChild(pip);
        }
    }

    // ─── PILE BUTTONS ────────────────────────────────────────────────────────
    updatePileButtons(remainingDefs, wonDefs) {
        this._remainingDefs = remainingDefs;
        this._wonDefs       = wonDefs;
        const total = remainingDefs.length + wonDefs.length;
        document.getElementById('pile-rem-count').textContent = `${remainingDefs.length}/${total}`;
        document.getElementById('pile-won-count').textContent = `${wonDefs.length}/${total}`;
    }

    // ─── OVERLAY STATE ───────────────────────────────────────────────────────
    isOverlayOpen() {
        return document.getElementById('cap-overlay')?.style.display === 'block'
            || document.getElementById('cap-detail')?.style.display  === 'block';
    }

    // ─── SLAMMER SELECTION ───────────────────────────────────────────────────
    getSlammerDef() { return SLAMMER_DEFS[this._slammerIdx]; }

    // ─── SLAMMER PANEL ───────────────────────────────────────────────────────
    toggleSlammerPanel() {
        this._panelOpen = !this._panelOpen;
        this._tunePanel.style.display = this._panelOpen ? '' : 'none';
    }

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
        this._tunePanel = panel;
        panel.style.cssText = `
            display:none;position:absolute;top:70px;right:20px;z-index:150;
            background:rgba(0,0,0,0.92);color:#fff;width:210px;
            border-radius:10px;font:13px/1.9 Arial,sans-serif;
            border:1px solid rgba(255,255,255,0.15);user-select:none;overflow:hidden;`;

        panel.innerHTML = `
            <div style="padding:8px 16px 6px;display:flex;align-items:center;
                justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.08)">
                <button id="slam-prev" style="background:none;border:none;color:#aaa;
                    font-size:18px;cursor:pointer;padding:0 4px;line-height:1">‹</button>
                <span id="slam-name" style="font-size:12px;font-weight:bold;color:#fff;
                    text-align:center;flex:1">${SLAMMER_DEFS[0].name}</span>
                <button id="slam-next" style="background:none;border:none;color:#aaa;
                    font-size:18px;cursor:pointer;padding:0 4px;line-height:1">›</button>
            </div>
            <div id="tune-body" style="padding:6px 16px 14px">
                ${this._sliderRow('Mass',    'sl-mss', 'tv-mss', 0.5,  20,   0.5,  this._mass)}
                ${this._sliderRow('Gravity', 'sl-grav','tv-grav',  50, 400,   10,   this._gravity)}
                ${this._sliderRow('Blast',   'sl-bls', 'tv-bls',  0.1,  1.5,  0.05, this._blastSpread)}
                ${this._sliderRow('Caps',    'sl-cnt', 'tv-cnt',    4,  16,    1,   this._stackCount)}
                <p style="margin-top:6px;font-size:11px;color:#555;line-height:1.3">
                    Cap count applies next round</p>
            </div>`;

        document.body.appendChild(panel);

        // Luk panel ved klik udenfor
        document.addEventListener('pointerdown', (e) => {
            if (this._panelOpen &&
                !panel.contains(e.target) &&
                e.target.id !== 'slammer-btn') {
                this._panelOpen = false;
                panel.style.display = 'none';
            }
        });

        document.getElementById('slam-prev').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx - 1 + SLAMMER_DEFS.length) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
        });
        document.getElementById('slam-next').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx + 1) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
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

    // ─── PILE OVERLAY ────────────────────────────────────────────────────────
    _buildPileOverlay() {
        const overlay = document.getElementById('cap-overlay');
        const detail  = document.getElementById('cap-detail');

        document.getElementById('pile-won-btn').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this._toggleOverlay('Vundne caps', this._wonDefs, true, e.currentTarget, overlay);
        });
        document.getElementById('pile-rem-btn').addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this._toggleOverlay('Caps i stakken', this._remainingDefs, false, e.currentTarget, overlay);
        });

        overlay.addEventListener('pointerdown', e => e.stopPropagation());
        detail.addEventListener('pointerdown',  e => e.stopPropagation());

        document.addEventListener('pointerdown', () => {
            overlay.style.display = 'none';
            detail.style.display  = 'none';
        });
    }

    _toggleOverlay(title, defs, lit, anchorEl, overlay) {
        if (overlay.style.display === 'block' &&
            overlay.dataset.anchor === anchorEl.id) {
            overlay.style.display = 'none';
            return;
        }
        overlay.dataset.anchor = anchorEl.id;

        document.getElementById('cap-overlay-title').textContent =
            title + (defs.length === 0 ? ' — ingen endnu' : ` (${defs.length})`);

        const dotsEl = document.getElementById('cap-overlay-dots');
        dotsEl.innerHTML = defs.map((d, i) => {
            if (d.texFront) {
                return `<img class="cap-thumb${lit ? '' : ' dimmed'}"
                    src="${d.texFront}" alt="${d.name}" title="${d.name}"
                    data-idx="${i}" data-lit="${lit}">`;
            }
            const hex = '#' + d.color.toString(16).padStart(6, '0');
            return `<span style="display:inline-block;width:40px;height:40px;border-radius:50%;
                    background:${hex};opacity:${lit ? 1 : 0.55};
                    border:2px solid rgba(255,255,255,0.15)"></span>`;
        }).join('');

        dotsEl.querySelectorAll('.cap-thumb').forEach(img => {
            img.addEventListener('pointerdown', e => {
                e.stopPropagation();
                const def = defs[+img.dataset.idx];
                this._showCapDetail(def, img.dataset.lit === 'true');
            });
        });

        const rect = anchorEl.getBoundingClientRect();
        overlay.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
        overlay.style.top    = 'auto';
        if (rect.left < window.innerWidth / 2) {
            overlay.style.left  = Math.max(4, rect.left) + 'px';
            overlay.style.right = 'auto';
        } else {
            overlay.style.right = Math.max(4, window.innerWidth - rect.right) + 'px';
            overlay.style.left  = 'auto';
        }
        overlay.style.display = 'block';
    }

    _showCapDetail(def, won) {
        const detail = document.getElementById('cap-detail');
        document.getElementById('cap-detail-img').src  = def.texFront ?? '';
        document.getElementById('cap-detail-img').style.display = def.texFront ? '' : 'none';
        document.getElementById('cap-detail-name').textContent  = def.name;
        document.getElementById('cap-detail-sub').textContent   = won ? '✓ Vundet' : 'I stakken';
        detail.style.display = 'block';
    }
}
