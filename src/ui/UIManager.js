import { DEFAULT_MASS, STACK_COUNT, SLAMMER_DEFS, CAP_DEFS } from '../config/constants.js';
import { CapViewer } from './CapViewer.js';

export class UIManager {
    constructor() {
        this._mass        = DEFAULT_MASS;
        this._gravity     = 200;
        this._blastSpread = 0.55;
        this._stackCount  = STACK_COUNT;
        this._capSeries   = 'mixed';
        this._panelOpen   = false;
        this._slammerIdx  = 0;
        this._remainingDefs = [];
        this._wonDefs       = [];

        this.onGravityChange = null;

        this._capViewer = new CapViewer(document.getElementById('cap-viewer-container'));
        this._slammerViewer = new CapViewer(document.getElementById('slammer-viewer-container'));
        this._buildTunePanel();
        this._buildPileOverlay();
        this._buildHelp();
    }

    // ─── GETTERS ─────────────────────────────────────────────────────────────
    getMass()        { return this._mass; }
    getGravity()     { return -this._gravity; }
    getBlastSpread() { return this._blastSpread; }
    getStackCount()  { return this._stackCount; }

    getActiveCaps() {
        if (this._capSeries === 'mixed') return CAP_DEFS;
        return CAP_DEFS.filter(d => d.series === this._capSeries);
    }

    // ─── STATUS / RESULTS ────────────────────────────────────────────────────
    setStatus(text) {
        document.getElementById('status').textContent = text;
    }

    popCollectIcon(def) {
        const btn  = document.getElementById('pile-won-btn');
        const rect = btn.getBoundingClientRect();

        const img  = document.createElement('img');
        img.src    = def.texFront ?? '';
        img.className = 'collect-icon';
        img.style.left = (rect.left + rect.width  / 2 - 26) + 'px';
        img.style.top  = (rect.top               - 15) + 'px';
        document.body.appendChild(img);
        img.addEventListener('animationend', () => img.remove());

        // Knap-gløde — restart animation hvis flere caps kommer hurtigt
        btn.classList.remove('collect-flash');
        void btn.offsetWidth;
        btn.classList.add('collect-flash');
        btn.addEventListener('animationend', () => btn.classList.remove('collect-flash'), { once: true });
    }

    setActionPrompt(text) {
        const el = document.getElementById('action-prompt');
        if (text) {
            el.textContent    = text;
            el.style.display  = 'block';
        } else {
            el.style.display  = 'none';
            el.textContent    = '';
        }
    }

    showResults(won, totalScore, wonCaps, allFlipped = false) {
        document.getElementById('score').textContent = totalScore;

        const label = document.getElementById('wonLabel');
        if (allFlipped && won > 0) {
            label.textContent = `Tillykke! Du vendte alle ${won} caps!`;
            label.style.color = '#ffd700';
        } else {
            label.textContent = `Du vendte ${won} caps`;
            label.style.color = '';
        }

        const wonList = document.getElementById('wonList');
        wonList.innerHTML = wonCaps.map((d, i) => {
            if (d.texFront) {
                return `<img src="${d.texFront}" alt="${d.name}" title="${d.name}"
                    data-idx="${i}"
                    style="width:40px;height:40px;border-radius:50%;object-fit:cover;
                    margin:3px;border:2px solid rgba(255,255,255,0.25);
                    cursor:pointer;transition:transform 0.12s;display:inline-block;vertical-align:middle;">`;
            }
            const hex = '#' + d.color.toString(16).padStart(6, '0');
            return `<span title="${d.name}" style="display:inline-block;width:40px;height:40px;
                    border-radius:50%;background:${hex};margin:3px;
                    border:2px solid rgba(255,255,255,0.2)"></span>`;
        }).join('');

        wonList.querySelectorAll('img[data-idx]').forEach(img => {
            img.addEventListener('pointerdown', e => {
                e.stopPropagation();
                this._showCapDetail(wonCaps[+img.dataset.idx], true);
            });
        });

        document.getElementById('results').style.display = 'block';
    }

    hideResults() {
        document.getElementById('results').style.display = 'none';
    }

    setScore(n)  { document.getElementById('score').textContent = n; }
    resetScore() { document.getElementById('score').textContent = 0; }

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
            || document.getElementById('cap-detail')?.style.display  === 'block'
            || document.getElementById('slammer-detail')?.style.display === 'block';
    }

    // ─── SLAMMER SELECTION ───────────────────────────────────────────────────
    getSlammerDef() { return SLAMMER_DEFS[this._slammerIdx]; }

    // ─── SLAMMER PANEL ───────────────────────────────────────────────────────
    toggleSlammerPanel() {
        this._panelOpen = !this._panelOpen;
        this._tunePanel.style.display = this._panelOpen ? '' : 'none';
    }

    // ─── PANEL BUILDER ───────────────────────────────────────────────────────
    _buildTunePanel() {
        const panel = document.createElement('div');
        this._tunePanel = panel;
        panel.style.cssText = `
            display:none;position:absolute;top:70px;right:20px;z-index:150;
            background:rgba(0,0,0,0.92);color:#fff;width:220px;
            border-radius:10px;font:13px/1.9 Arial,sans-serif;
            border:1px solid rgba(255,255,255,0.15);user-select:none;overflow:hidden;`;

        // ── Fysik sektion (lukket som default) ──────────────────────────────
        const { wrap: physWrap, body: physBody } = this._buildSection('Fysik', false);
        physBody.innerHTML = `
            ${this._sliderRow('Mass',    'sl-mss',  'tv-mss',  0.5, 20,   0.5,  this._mass)}
            ${this._sliderRow('Gravity', 'sl-grav', 'tv-grav',  50, 400,  10,   this._gravity)}
            ${this._sliderRow('Blast',   'sl-bls',  'tv-bls',  0.1, 1.5,  0.05, this._blastSpread)}`;
        panel.appendChild(physWrap);

        // ── Slammers sektion ────────────────────────────────────────────────
        const { wrap: slammersWrap, body: slammersBody } = this._buildSection('Slammers', false);
        slammersBody.innerHTML = '';
        
        // Slammer selector med < og >
        const slamRow = document.createElement('div');
        slamRow.style.cssText = 'padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px';
        const slamPrev = document.createElement('button');
        slamPrev.textContent = '‹';
        slamPrev.style.cssText = 'background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;flex:0 0 auto';
        slamPrev.id = 'slam-prev';
        const slamName = document.createElement('button');
        slamName.textContent = SLAMMER_DEFS[0].name;
        slamName.id = 'slam-name';
        slamName.style.cssText = 'background:none;border:none;color:#fff;font-size:12px;font-weight:bold;text-align:center;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;padding:0;font-family:inherit;line-height:inherit';
        const slamNext = document.createElement('button');
        slamNext.textContent = '›';
        slamNext.style.cssText = 'background:none;border:none;color:#aaa;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;flex:0 0 auto';
        slamNext.id = 'slam-next';
        slamRow.appendChild(slamPrev);
        slamRow.appendChild(slamName);
        slamRow.appendChild(slamNext);
        slammersBody.appendChild(slamRow);
        panel.appendChild(slammersWrap);

        // ── Caps sektion (lukket som default) ────────────────────────────────
        const { wrap: capsWrap, body: capsBody } = this._buildSection('Caps', false);

        // Series-picker knapper
        const seriesPicker = document.createElement('div');
        seriesPicker.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap';
        const seriesOptions = [
            { key: 'raptor_strike', label: 'Raptor Strike' },
            { key: 'scary_skullz',  label: 'Scary Skullz'  },
            { key: 'mixed',         label: 'Mixed'          },
        ];
        this._seriesBtns = {};
        seriesOptions.forEach(({ key, label }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.series = key;
            btn.style.cssText = `flex:1;min-width:0;padding:3px 6px;border-radius:6px;cursor:pointer;
                font-size:11px;font-weight:bold;border:1px solid rgba(255,255,255,0.2);
                background:${key === this._capSeries ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.05)'};
                color:${key === this._capSeries ? '#ffcc00' : '#aaa'};`;
            btn.addEventListener('click', () => this._selectSeries(key));
            seriesPicker.appendChild(btn);
            this._seriesBtns[key] = btn;
        });
        capsBody.appendChild(seriesPicker);

        // Stack count slider
        const stackMax = this.getActiveCaps().length;
        const stackDiv = document.createElement('div');
        stackDiv.innerHTML = this._sliderRow('Antal', 'sl-cnt', 'tv-cnt', 4, CAP_DEFS.length, 1, this._stackCount);
        capsBody.appendChild(stackDiv.firstElementChild);
        
        const noteEl = document.createElement('p');
        noteEl.style.cssText = 'margin-top:4px;font-size:11px;color:#555;line-height:1.3';
        noteEl.id = 'caps-note';
        noteEl.textContent = `Max uden dubletter: ${stackMax}`;
        capsBody.appendChild(noteEl);

        panel.appendChild(capsWrap);
        document.body.appendChild(panel);

        // ── Luk ved klik udenfor ─────────────────────────────────────────────
        document.addEventListener('pointerdown', (e) => {
            if (this._panelOpen &&
                !panel.contains(e.target) &&
                e.target.id !== 'slammer-btn') {
                this._panelOpen = false;
                panel.style.display = 'none';
            }
        });

        // ── Event handlers ───────────────────────────────────────────────────
        document.getElementById('slam-prev').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx - 1 + SLAMMER_DEFS.length) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
        });
        document.getElementById('slam-next').addEventListener('click', () => {
            this._slammerIdx = (this._slammerIdx + 1) % SLAMMER_DEFS.length;
            document.getElementById('slam-name').textContent = SLAMMER_DEFS[this._slammerIdx].name;
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
        });
        document.getElementById('slam-name').addEventListener('click', e => {
            e.stopPropagation();
            this._showSlammerDetail(SLAMMER_DEFS[this._slammerIdx]);
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

    _buildSection(title, openByDefault = false) {
        const wrap = document.createElement('div');
        wrap.style.borderTop = '1px solid rgba(255,255,255,0.08)';

        const header = document.createElement('div');
        header.style.cssText = 'padding:7px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;';

        const label = document.createElement('span');
        label.style.cssText = 'font-size:11px;font-weight:bold;color:#888;letter-spacing:0.06em;text-transform:uppercase;';
        label.textContent = title;

        const arrow = document.createElement('span');
        arrow.style.cssText = 'color:#555;font-size:10px;';
        arrow.textContent = openByDefault ? '▴' : '▾';

        header.appendChild(label);
        header.appendChild(arrow);

        const body = document.createElement('div');
        body.style.cssText = `padding:0 16px 10px;${openByDefault ? '' : 'display:none;'}`;

        header.addEventListener('click', () => {
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : '';
            arrow.textContent = isOpen ? '▾' : '▴';
        });

        wrap.appendChild(header);
        wrap.appendChild(body);
        return { wrap, body };
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

    _selectSeries(key) {
        this._capSeries = key;
        Object.entries(this._seriesBtns).forEach(([k, btn]) => {
            const active = k === key;
            btn.style.background = active ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.05)';
            btn.style.color      = active ? '#ffcc00' : '#aaa';
        });
        const uniqueCount = this.getActiveCaps().length;
        const note = key === 'mixed'
            ? `${uniqueCount} unikke caps`
            : `${uniqueCount} unikke · dubletter tilladt`;
        document.getElementById('caps-note').textContent = note;
    }

    // ─── PILE OVERLAY ────────────────────────────────────────────────────────
    _buildPileOverlay() {
        const overlay = document.getElementById('cap-overlay');
        const detail  = document.getElementById('cap-detail');
        const slamDetail = document.getElementById('slammer-detail');

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
        slamDetail.addEventListener('pointerdown', e => e.stopPropagation());

        document.addEventListener('pointerdown', () => {
            overlay.style.display = 'none';
            detail.style.display  = 'none';
            slamDetail.style.display = 'none';
            this._capViewer.hide();
            this._slammerViewer.hide();
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

    // ─── HJÆLP-MODAL ─────────────────────────────────────────────────────────
    _buildHelp() {
        const modal  = document.getElementById('help-modal');
        const btnOpen  = document.getElementById('help-btn');
        const btnClose = document.getElementById('help-close');

        const open  = () => modal.classList.add('open');
        const close = () => modal.classList.remove('open');

        btnOpen.addEventListener('pointerdown',  e => { e.stopPropagation(); open(); });
        btnClose.addEventListener('pointerdown', e => { e.stopPropagation(); close(); });

        // Klik på baggrunden (selve overlay-laget) lukker
        modal.addEventListener('pointerdown', e => {
            if (e.target === modal) close();
        });

        // Escape-tast lukker
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
        });
    }

    // ─── CAP DETAIL POPUP ────────────────────────────────────────────────────
    _showCapDetail(def, lit) {
        const detail = document.getElementById('cap-detail');
        const nameEl = document.getElementById('cap-detail-name');
        const subEl  = document.getElementById('cap-detail-sub');

        nameEl.textContent = def.name;
        subEl.textContent  = def.series ? def.series.replace(/_/g, ' ') : '';

        // Apply visual state based on whether cap is lit (won)
        if (lit) {
            detail.style.borderColor = 'rgba(255, 204, 0, 0.4)';
            detail.style.backgroundColor = 'rgba(0, 0, 0, 0.97)';
        } else {
            detail.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            detail.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        }

        this._capViewer.show(def, 'cap');
        detail.style.display = 'block';
    }

    // ─── SLAMMER DETAIL POPUP ────────────────────────────────────────────────
    _showSlammerDetail(def) {
        const detail = document.getElementById('slammer-detail');
        const nameEl = document.getElementById('slammer-detail-name');

        nameEl.textContent = def.name;

        this._slammerViewer.show(def, 'slammer');
        detail.style.display = 'block';
    }
}
