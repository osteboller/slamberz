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

export const CAM_BASE  = { x: 0, y: 16, z: 22 }; // zoomed ud (post-blast) — original vinkel
export const CAM_CLOSE = { x: 0, y: 12, z: 8  }; // zoomed ind (idle/aiming) — mere ovenfra

export const CAP_DEFS = [
    { color: 0x7755ee, name: 'Lilla',  mass: 1.0, bounce: 0.3 },
    { color: 0xe05522, name: 'Orange', mass: 1.0, bounce: 0.3 },
    { color: 0x22aa77, name: 'Grøn',   mass: 1.0, bounce: 0.3 },
    { color: 0xcc3377, name: 'Pink',   mass: 1.0, bounce: 0.3 },
    { color: 0xdd9911, name: 'Gul',    mass: 1.0, bounce: 0.3 },
    { color: 0x2277cc, name: 'Blå',    mass: 1.0, bounce: 0.3 },
    { color: 0x44aa22, name: 'Lime',   mass: 1.0, bounce: 0.3 },
    { color: 0xdd3344, name: 'Rød',    mass: 1.0, bounce: 0.3 },
];
