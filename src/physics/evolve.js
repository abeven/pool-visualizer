import { STATIONARY, SPINNING, SLIDING, ROLLING } from './constants.js';
import { surfaceVelocity, vnorm2d, vunit2d } from './utils.js';

// ── Evolve ball state forward by dt seconds ──────────────────────────
// rvw = [[rx,ry,0], [vx,vy,0], [wx,wy,wz]]

export function evolveBall(rvw, state, params, dt) {
  switch (state) {
    case SLIDING: return evolveSlide(rvw, params, dt);
    case ROLLING: return evolveRoll(rvw, params, dt);
    case SPINNING: return evolveSpin(rvw, params, dt);
    case STATIONARY: return [rvw[0].slice(), [0, 0, 0], [0, 0, 0]];
    default: return [rvw[0].slice(), rvw[1].slice(), rvw[2].slice()];
  }
}

// ── Sliding state ────────────────────────────────────────────────────
// Friction force opposes relative velocity u at contact point.
// u decays linearly: u(t) = (|u₀| - 7/2·μs·g·t)·û₀
// Transition to rolling when u = 0.
function evolveSlide(rvw, params, dt) {
  const { R, u_s, u_sp, g } = params;
  const [r0, v0, w0] = rvw;

  const u0 = surfaceVelocity(v0, w0, R);
  const uSpeed = vnorm2d(u0);
  if (uSpeed < 1e-12) {
    // Already at rolling condition
    return [r0.slice(), v0.slice(), w0.slice()];
  }
  const uhat = [u0[0] / uSpeed, u0[1] / uSpeed, 0];

  // r(t) = r₀ + v₀·t − ½·μs·g·û₀·t²
  const r = [
    r0[0] + v0[0] * dt - 0.5 * u_s * g * uhat[0] * dt * dt,
    r0[1] + v0[1] * dt - 0.5 * u_s * g * uhat[1] * dt * dt,
    0,
  ];

  // v(t) = v₀ − μs·g·û₀·t
  const v = [
    v0[0] - u_s * g * uhat[0] * dt,
    v0[1] - u_s * g * uhat[1] * dt,
    0,
  ];

  // ω_xy: dω/dt = (5·μs·g)/(2R) · (ẑ × û₀)  where ẑ×û = [-ûy, ûx, 0]
  const spinCoeff = (5 * u_s * g) / (2 * R);
  const w = [
    w0[0] - spinCoeff * uhat[1] * dt,
    w0[1] + spinCoeff * uhat[0] * dt,
    evolveOmegaZ(w0[2], u_sp, g, R, dt),
  ];

  return [r, v, w];
}

// ── Rolling state ────────────────────────────────────────────────────
// Ball rolls without slipping. Friction opposes velocity direction.
// v(t) = v₀ − μr·g·v̂₀·t (decelerates to zero)
// ω satisfies rolling: vx = R·ωy, vy = −R·ωx
function evolveRoll(rvw, params, dt) {
  const { R, u_r, u_sp, g } = params;
  const [r0, v0, w0] = rvw;

  const speed0 = vnorm2d(v0);
  if (speed0 < 1e-12) {
    return [r0.slice(), [0, 0, 0], [0, 0, evolveOmegaZ(w0[2], u_sp, g, R, dt)]];
  }
  const vhat = [v0[0] / speed0, v0[1] / speed0, 0];

  // r(t) = r₀ + v₀·t − ½·μr·g·v̂₀·t²
  const r = [
    r0[0] + v0[0] * dt - 0.5 * u_r * g * vhat[0] * dt * dt,
    r0[1] + v0[1] * dt - 0.5 * u_r * g * vhat[1] * dt * dt,
    0,
  ];

  // v(t) = v₀ − μr·g·v̂₀·t
  const newSpeed = Math.max(0, speed0 - u_r * g * dt);
  const v = [vhat[0] * newSpeed, vhat[1] * newSpeed, 0];

  // Rolling condition: vx = R·ωy, vy = −R·ωx
  const w = [
    -v[1] / R,
    v[0] / R,
    evolveOmegaZ(w0[2], u_sp, g, R, dt),
  ];

  return [r, v, w];
}

// ── Spinning state ───────────────────────────────────────────────────
// Ball is stationary but spinning about z-axis.
function evolveSpin(rvw, params, dt) {
  const { R, u_sp, g } = params;
  const [r0, , w0] = rvw;
  return [
    r0.slice(),
    [0, 0, 0],
    [0, 0, evolveOmegaZ(w0[2], u_sp, g, R, dt)],
  ];
}

// ── ωz decay from spinning friction ─────────────────────────────────
function evolveOmegaZ(wz, u_sp, g, R, dt) {
  if (Math.abs(wz) < 1e-12) return 0;
  const decay = (5 * u_sp * g) / (2 * R) * dt;
  if (decay >= Math.abs(wz)) return 0;
  return wz > 0 ? wz - decay : wz + decay;
}

// ── Transition time calculations ─────────────────────────────────────

// Time for sliding ball to transition to rolling (u → 0)
export function getSlideTime(rvw, params) {
  const { R, u_s, g } = params;
  const u0 = surfaceVelocity(rvw[1], rvw[2], R);
  const uSpeed = vnorm2d(u0);
  if (uSpeed < 1e-12) return 0;
  return (2 * uSpeed) / (7 * u_s * g);
}

// Time for rolling ball to stop (v → 0)
export function getRollTime(rvw, params) {
  const { u_r, g } = params;
  const speed = vnorm2d(rvw[1]);
  if (speed < 1e-12) return 0;
  return speed / (u_r * g);
}

// Time for spinning ball to stop (ωz → 0)
export function getSpinTime(rvw, params) {
  const { R, u_sp, g } = params;
  const wz = Math.abs(rvw[2][2]);
  if (wz < 1e-12) return 0;
  return (2 * R * wz) / (5 * u_sp * g);
}

// After rolling stops, does the ball still have z-spin?
export function hasResidualSpin(rvw, params) {
  const rollTime = getRollTime(rvw, params);
  const rvwAtStop = evolveRoll(rvw, params, rollTime);
  return Math.abs(rvwAtStop[2][2]) > 1e-9;
}

// ── Motion coefficients for event detection ──────────────────────────
// Returns {a, b, c} where r(t) = a·t² + b·t + c (2D only)
export function getMotionCoeffs(rvw, state, params) {
  const [r, v, w] = rvw;
  const { R, u_s, u_r, g } = params;

  if (state === STATIONARY || state === SPINNING) {
    return { a: [0, 0], b: [0, 0], c: [r[0], r[1]] };
  }

  if (state === ROLLING) {
    const speed = vnorm2d(v);
    if (speed < 1e-12) return { a: [0, 0], b: [0, 0], c: [r[0], r[1]] };
    const vhat = [v[0] / speed, v[1] / speed];
    return {
      a: [-0.5 * u_r * g * vhat[0], -0.5 * u_r * g * vhat[1]],
      b: [v[0], v[1]],
      c: [r[0], r[1]],
    };
  }

  if (state === SLIDING) {
    const u0 = surfaceVelocity(v, w, R);
    const uSpeed = vnorm2d(u0);
    if (uSpeed < 1e-12) return { a: [0, 0], b: [0, 0], c: [r[0], r[1]] };
    const uhat = [u0[0] / uSpeed, u0[1] / uSpeed];
    return {
      a: [-0.5 * u_s * g * uhat[0], -0.5 * u_s * g * uhat[1]],
      b: [v[0], v[1]],
      c: [r[0], r[1]],
    };
  }

  return { a: [0, 0], b: [0, 0], c: [r[0], r[1]] };
}
