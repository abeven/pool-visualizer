// Ball motion states
export const STATIONARY = 0;
export const SPINNING = 1;
export const SLIDING = 2;
export const ROLLING = 3;
export const POCKETED = 4;

// Default ball physical parameters (standard pool ball)
export const BALL_PARAMS = {
  m: 0.170097,          // mass (kg) — 6 oz
  R: 0.028575,          // radius (m) — 2.25" diameter
  u_s: 0.2,             // coefficient of sliding friction (ball-cloth)
  u_r: 0.01,            // coefficient of rolling friction
  u_sp: 0.044,           // spinning friction coefficient (cloth-dependent)
  e_b: 0.95,            // ball-ball coefficient of restitution
  g: 9.81,              // gravitational acceleration (m/s²)
};

// Cushion parameters
export const CUSHION_PARAMS = {
  e_c: 0.85,            // coefficient of restitution
  f_c: 0.2,             // friction coefficient
  height: 0.0363,       // nose height above slate (m) — 63.5% of ball diameter
};

// Table playing surface dimensions in SI (meters)
export const TABLE_SI = {
  "7ft": { width: 1.981, height: 0.991 },
  "8ft": { width: 2.235, height: 1.118 },
  "9ft": { width: 2.540, height: 1.270 },
};

// Pocket radius in SI (meters) — simplified, same for all pockets
export const POCKET_R_SI = 0.057;

// Felt quality presets — maps to real physical coefficients
export const FELT_PHYSICS = {
  pro: {
    u_s: 0.15, u_r: 0.008, u_sp: 0.040,
    e_c: 0.88, f_c: 0.14,
  },
  nice: {
    u_s: 0.20, u_r: 0.012, u_sp: 0.044,
    e_c: 0.85, f_c: 0.20,
  },
  dive: {
    u_s: 0.30, u_r: 0.025, u_sp: 0.050,
    e_c: 0.72, f_c: 0.35,
  },
};

// Cue parameters
export const CUE_PARAMS = {
  M: 0.567,             // cue mass (kg) — 20 oz
  tip_radius: 0.007,    // tip radius (m)
};

// Event types
export const EVENT = {
  BALL_BALL: 'ball_ball',
  BALL_CUSHION: 'ball_cushion',
  BALL_POCKET: 'ball_pocket',
  SLIDE_TO_ROLL: 'slide_to_roll',
  ROLL_TO_STATIONARY: 'roll_to_stationary',
  ROLL_TO_SPIN: 'roll_to_spin',
  SPIN_TO_STATIONARY: 'spin_to_stationary',
};
