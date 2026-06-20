import { POWER_SPEED_MIN, POWER_SPEED_MAX } from '../config/constants.js';

// Hastighed i rad/s — én fuld svingning = 2π / OSC_SPEED sekunder
const OSC_SPEED = 7.; // ~3.5 sek per svingning
const CURVE_EXP = 3;   // 2 = kvadratisk: høj → 3–4 giver endnu kortere grønt vindue

export class PowerBar {
    constructor() {
        this._enabled  = false;
        this._frozen   = false;
        this._phase    = 0;
        this._level    = 0; // 0–1

        this._container = document.getElementById('power-container');
        this._mask      = document.getElementById('power-mask');
    }

    isEnabled() { return this._enabled; }

    getMappedSpeed() {
        return POWER_SPEED_MIN + this._level * (POWER_SPEED_MAX - POWER_SPEED_MIN);
    }

    enable() {
        this._enabled = true;
        this._container.style.display = 'block';
        this.reset();
    }

    disable() {
        this._enabled = false;
        this._container.style.display = 'none';
        this.reset();
    }

    freeze() { this._frozen = true; }

    reset() {
        this._phase  = 0;
        this._level  = 0;
        this._frozen = false;
        this._updateDOM();
    }

    update(dt) {
        if (!this._enabled || this._frozen) return;
        this._phase = (this._phase + OSC_SPEED * dt) % (Math.PI * 2);

        // t: 0→1 position i cyklus
        const t = this._phase / (Math.PI * 2);

        if (t < 0.5) {
            // Første halvdel: stiger fra 0 til 1 med ease-in
            // — bar starter langsomt og accelererer mod toppen
            this._level = Math.pow(t * 2, CURVE_EXP);
        } else {
            // Anden halvdel: falder fra 1 til 0 med ease-out
            // — bar starter hurtigt fra toppen og bremser mod bunden
            this._level = Math.pow((1 - t) * 2, CURVE_EXP);
        }

        this._updateDOM();
    }

    _updateDOM() {
        if (this._mask) this._mask.style.height = `${(1 - this._level) * 100}%`;
    }
}
