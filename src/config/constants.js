export const POG_R       = 1.2;
export const POG_H       = 0.13;
export const SLAM_H      = 0.28;
export const STACK_COUNT = 8;

export const DEFAULT_SPEED = 65;
export const DEFAULT_MASS  = 3.5;

// Power bar: speed-range når power bar er aktiv (erstatter slideren)
export const POWER_SPEED_MIN = 20;
export const POWER_SPEED_MAX = 100;

// Pause i ms mellem klik og slammer-spawn (giver visuel feedback + mobil-venlig timing)
export const SHOT_DELAY = 1000;
export const THROWS_PER_ROUND = 3;

export const CAM_BASE  = { x: 0, y: 16, z: 22 }; // zoomed ud (post-blast) — original vinkel
export const CAM_CLOSE = { x: 0, y: 12, z: 8  }; // zoomed ind (idle/aiming) — mere ovenfra

export const SLAMMER_DEFS = [
    { name: 'Gold Raptor', type: 'gold', texFront: 'assets/slammers/gold_raptor.png', texBack: 'assets/slammers/gold_raptor_b.png', rimColor: 0x7a5410 },
    { name: 'Yin Yang',    type: 'holo', texFront: 'assets/slammers/ying_yang.png',   texBack: 'assets/slammers/ying_yang_b.png',   rimColor: 0x111111 },
];

export const CAP_DEFS = [
    { color: 0xdd3344, name: 'Red Raptor',   mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/01_red.png',    texBack: 'assets/caps/raptor_strike/01_red_b.png'    },
    { color: 0x2277cc, name: 'Blue Raptor',  mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/02_blue.png',   texBack: 'assets/caps/raptor_strike/02_blue_b.png'   },
    { color: 0xdd9911, name: 'Gold Raptor',  mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/03_yellow.png', texBack: 'assets/caps/raptor_strike/03_yellow_b.png' },
    { color: 0x7755ee, name: 'Silver',       mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/12_silver.png', texBack: 'assets/caps/raptor_strike/12_silver_b.png' },
    { color: 0xe05522, name: 'Mech',         mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/16_mech.png',   texBack: 'assets/caps/raptor_strike/16_mech_b.png'   },
    { color: 0x22aa77, name: 'Mecha',        mass: 1.0, bounce: 0.3, texFront: 'assets/caps/raptor_strike/18_mecha.png',  texBack: 'assets/caps/raptor_strike/18_mecha_b.png'  },
    { color: 0xcc3377, name: 'Alien',        mass: 1.0, bounce: 0.3, texFront: 'assets/caps/legacy_discs/18_alien.png',   texBack: 'assets/caps/legacy_discs/18_alien_b.png'   },
    { color: 0x44aa22, name: '8-Ball',       mass: 1.0, bounce: 0.3, texFront: 'assets/caps/legacy_discs/24_8ball.png',   texBack: 'assets/caps/legacy_discs/24_8ball_b.png'   },
];
