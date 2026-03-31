import { STATIONARY, SPINNING, SLIDING, POCKETED, BALL_PARAMS, CUSHION_PARAMS } from './constants.js';
import { getMotionCoeffs } from './evolve.js';
import {
  vadd, vsub, vscale, vdot, vcross, vnorm, vnorm2d, vunit,
  surfaceVelocity, solveQuartic, solveQuadratic, smallestPositiveRoot,
} from './utils.js';

// ── Ball-ball collision time ─────────────────────────────────────────
// Position of each ball is r(t) = a·t² + b·t + c
// Collision when |r_j(t) - r_i(t)| = 2R → quartic in t
export function ballBallCollisionTime(ballI, ballJ, params) {
  if (ballI.state === POCKETED || ballJ.state === POCKETED) return Infinity;
  if (ballI.state === STATIONARY && ballJ.state === STATIONARY) return Infinity;
  if (ballI.state === SPINNING && ballJ.state === SPINNING) return Infinity;
  if (ballI.state === STATIONARY && ballJ.state === SPINNING) return Infinity;
  if (ballI.state === SPINNING && ballJ.state === STATIONARY) return Infinity;

  const mi = getMotionCoeffs(ballI.rvw, ballI.state, params);
  const mj = getMotionCoeffs(ballJ.rvw, ballJ.state, params);

  // D(t) = r_j(t) - r_i(t) = A·t² + B·t + C
  const Ax = mj.a[0] - mi.a[0], Ay = mj.a[1] - mi.a[1];
  const Bx = mj.b[0] - mi.b[0], By = mj.b[1] - mi.b[1];
  const Cx = mj.c[0] - mi.c[0], Cy = mj.c[1] - mi.c[1];

  const twoR = 2 * params.R;

  // If balls are currently touching or nearly touching, check if separating
  const dist0sq = Cx * Cx + Cy * Cy;
  if (dist0sq <= twoR * twoR * 1.001) {
    // Check relative velocity at t=0: are they separating?
    const relApproach = Cx * Bx + Cy * By;
    if (relApproach >= 0) return Infinity; // separating or parallel
  }

  // |D(t)|² = (2R)² → quartic
  const c4 = Ax * Ax + Ay * Ay;
  const c3 = 2 * (Ax * Bx + Ay * By);
  const c2 = Bx * Bx + By * By + 2 * (Ax * Cx + Ay * Cy);
  const c1 = 2 * (Bx * Cx + By * Cy);
  const c0 = Cx * Cx + Cy * Cy - twoR * twoR;

  const roots = solveQuartic(c4, c3, c2, c1, c0);

  // Find smallest positive root where balls are approaching
  let bestT = Infinity;

  function checkRoot(t) {
    if (t < 1e-6 || t >= bestT) return;

    // Verify root: |f(t)| should be small relative to |c0|
    const val = (((c4 * t + c3) * t + c2) * t + c1) * t + c0;
    if (Math.abs(val) > (Math.abs(c0) + 1) * 0.01) return;

    const vi = [2 * mi.a[0] * t + mi.b[0], 2 * mi.a[1] * t + mi.b[1]];
    const vj = [2 * mj.a[0] * t + mj.b[0], 2 * mj.a[1] * t + mj.b[1]];
    const dx = (Ax * t * t + Bx * t + Cx);
    const dy = (Ay * t * t + By * t + Cy);
    const dvx = vi[0] - vj[0], dvy = vi[1] - vj[1];
    const approaching = dx * dvx + dy * dvy;
    if (approaching > 0) bestT = t;
  }

  for (const t of roots) {
    checkRoot(t);
  }

  // Fallback: Ferrari's quartic solver fails for nearly-biquadratic quartics
  // that arise when balls are far apart (c4 ≪ c2). Project onto the line of
  // centers to get a robust starting point, then Newton-refine on the full quartic.
  if (bestT === Infinity) {
    const Cnorm = Math.sqrt(Cx * Cx + Cy * Cy);
    if (Cnorm > 1e-12) {
      const chatX = Cx / Cnorm, chatY = Cy / Cnorm;
      const Aproj = Ax * chatX + Ay * chatY;
      const Bproj = Bx * chatX + By * chatY;
      const projRoots = solveQuadratic(Aproj, Bproj, Cnorm - twoR);

      for (const t0 of projRoots) {
        if (t0 < 1e-6) continue;
        let t = t0;
        for (let iter = 0; iter < 50; iter++) {
          const f = (((c4 * t + c3) * t + c2) * t + c1) * t + c0;
          const df = ((4 * c4 * t + 3 * c3) * t + 2 * c2) * t + c1;
          if (Math.abs(df) < 1e-30) break;
          const step = f / df;
          t -= step;
          if (t < 0) { t = -1; break; }
          if (Math.abs(step) < 1e-12 * (Math.abs(t) + 1e-10)) break;
        }
        if (t > 0) checkRoot(t);
      }
    }
  }

  return bestT;
}

// ── Ball-cushion collision time ──────────────────────────────────────
// Cushion defined as a line segment from p1 to p2 with inward normal.
// Collision when distance from ball center to cushion line = R.
// For axis-aligned cushions this simplifies to a quadratic.
export function ballCushionCollisionTime(ball, cushion, params) {
  if (ball.state === POCKETED || ball.state === STATIONARY || ball.state === SPINNING) {
    return Infinity;
  }

  const m = getMotionCoeffs(ball.rvw, ball.state, params);
  const { R } = params;

  // Cushion line: normal · (point - p1) = 0
  // Ball contacts when: normal · (r(t) - p1) = ±R (take the one matching inward normal)
  const { normal, p1, p2 } = cushion;

  // normal · r(t) = normal · (a·t² + b·t + c) = target
  // where target = normal · p1 + R (ball center at distance R from cushion)
  // But the sign depends on which side: for inward normal, target = normal · p1 + R
  const target = normal[0] * p1[0] + normal[1] * p1[1] + R;

  const qa = normal[0] * m.a[0] + normal[1] * m.a[1];
  const qb = normal[0] * m.b[0] + normal[1] * m.b[1];
  const qc = normal[0] * m.c[0] + normal[1] * m.c[1] - target;

  const roots = solveQuadratic(qa, qb, qc);
  let bestT = Infinity;

  for (const t of roots) {
    if (t < 1e-9 || t >= bestT) continue;

    // Verify collision point is within cushion segment
    const rx = m.a[0] * t * t + m.b[0] * t + m.c[0];
    const ry = m.a[1] * t * t + m.b[1] * t + m.c[1];

    // Project onto segment
    const segDx = p2[0] - p1[0], segDy = p2[1] - p1[1];
    const segLen2 = segDx * segDx + segDy * segDy;
    if (segLen2 < 1e-12) continue;

    const projX = rx - R * normal[0], projY = ry - R * normal[1];
    const s = ((projX - p1[0]) * segDx + (projY - p1[1]) * segDy) / segLen2;
    if (s >= -0.01 && s <= 1.01) {
      // Check ball is approaching cushion
      const vx = 2 * m.a[0] * t + m.b[0];
      const vy = 2 * m.a[1] * t + m.b[1];
      const approaching = vx * normal[0] + vy * normal[1];
      if (approaching < 0) { // moving toward cushion (opposite to inward normal)
        bestT = t;
      }
    }
  }

  return bestT;
}

// ── Ball-pocket collision time ───────────────────────────────────────
// Pocket is a circle at (px, py) with radius pr.
// Collision when |r(t) - pocket| < pr
export function ballPocketCollisionTime(ball, pocket, params) {
  if (ball.state === POCKETED || ball.state === STATIONARY || ball.state === SPINNING) {
    return Infinity;
  }

  const m = getMotionCoeffs(ball.rvw, ball.state, params);

  // |r(t) - pocket|² = pr² → quartic
  const Ax = m.a[0], Ay = m.a[1];
  const Bx = m.b[0], By = m.b[1];
  const Cx = m.c[0] - pocket.x, Cy = m.c[1] - pocket.y;

  const c4 = Ax * Ax + Ay * Ay;
  const c3 = 2 * (Ax * Bx + Ay * By);
  const c2 = Bx * Bx + By * By + 2 * (Ax * Cx + Ay * Cy);
  const c1 = 2 * (Bx * Cx + By * Cy);
  const c0 = Cx * Cx + Cy * Cy - pocket.r * pocket.r;

  const roots = solveQuartic(c4, c3, c2, c1, c0);
  return smallestPositiveRoot(roots, 1e-9, [c4, c3, c2, c1, c0]);
}

// ── Ball-ball collision resolution ───────────────────────────────────
// Elastic collision between equal-mass balls with coefficient of restitution.
// Includes throw effect from tangential friction at contact.
export function resolveBallBall(ballI, ballJ, params) {
  const ri = ballI.rvw[0], rj = ballJ.rvw[0];
  const vi = ballI.rvw[1], vj = ballJ.rvw[1];
  const wi = ballI.rvw[2], wj = ballJ.rvw[2];

  const { R, e_b, u_s } = params;

  // Normal vector: from i to j
  const n = vunit(vsub(rj, ri));

  // Relative velocity of i w.r.t. j along normal
  const relV = vsub(vi, vj);
  const vn = vdot(relV, n);

  // Only resolve if approaching
  if (vn <= 0) return;

  // Normal impulse (equal mass collision)
  const jn = (1 + e_b) * vn / 2;

  // Update linear velocities (normal component)
  const newVi = vsub(vi, vscale(n, jn));
  const newVj = vadd(vj, vscale(n, jn));

  // Tangential friction at contact → throw effect
  // Surface velocity at contact point includes spin contribution.
  // The z-component of surface velocity (from rolling spin) creates throw:
  // it deflects the object ball's direction in the x-y plane.
  const surfI = vadd(vi, vcross(wi, vscale(n, R)));
  const surfJ = vadd(vj, vcross(wj, vscale(n, -R)));
  const relSurf = vsub(surfI, surfJ);

  // Tangential component (remove normal part)
  const relSurfN = vscale(n, vdot(relSurf, n));
  const tangential = vsub(relSurf, relSurfN);

  // Project tangential onto the table plane (x-y only) for throw calculation
  // The z-component of tangential velocity creates throw in the x-y plane
  // by rotating the object ball direction. We model this as a deflection.
  const tangXY = [tangential[0], tangential[1], 0];
  const tangZ = tangential[2]; // spin-induced vertical surface velocity
  const tangSpeedXY = Math.sqrt(tangXY[0] * tangXY[0] + tangXY[1] * tangXY[1]);

  // Compute effective tangential speed including z-contribution as throw
  const tangSpeed = Math.sqrt(tangSpeedXY * tangSpeedXY + tangZ * tangZ);

  if (tangSpeed > 1e-10) {
    // Friction-limited tangential impulse (Alciatore model)
    // Limit: (2/7)*m*tangSpeed is the impulse that eliminates all sliding
    // for equal-mass spheres (accounting for translational + rotational inertia)
    const u_bb = 0.05 + 0.108 * Math.exp(-1.088 * tangSpeed);
    const jt = Math.min(u_bb * jn, (2 / 7) * params.m * tangSpeed);

    // Convert z-component of tangential velocity into x-y throw deflection
    // Throw rotates the object ball direction by an angle proportional to
    // the z-tangential speed relative to the normal impulse.
    const throwFraction = jt / tangSpeed;

    // Apply x-y tangential impulse
    if (tangSpeedXY > 1e-10) {
      const tXY = [tangXY[0] / tangSpeedXY, tangXY[1] / tangSpeedXY];
      const jtXY = throwFraction * tangSpeedXY;
      newVi[0] -= jtXY * tXY[0];
      newVi[1] -= jtXY * tXY[1];
      newVj[0] += jtXY * tXY[0];
      newVj[1] += jtXY * tXY[1];
    }

    // Apply z-tangential as throw: deflects object ball perpendicular to n in x-y plane
    if (Math.abs(tangZ) > 1e-10) {
      const perpN = [-n[1], n[0], 0]; // perpendicular to n in x-y plane
      const throwImpulse = throwFraction * tangZ;
      // Throw deflects the object ball, cue ball gets opposite
      newVj[0] += throwImpulse * perpN[0] * 0.5;
      newVj[1] += throwImpulse * perpN[1] * 0.5;
      newVi[0] -= throwImpulse * perpN[0] * 0.5;
      newVi[1] -= throwImpulse * perpN[1] * 0.5;
    }

    // Apply tangential impulse to angular velocity
    const I = (2 / 5) * params.m * R * R;
    const rn = vscale(n, R);
    const tangUnit = vscale(tangential, 1 / tangSpeed);
    const torqueI = vcross(rn, vscale(tangUnit, -jt));
    const torqueJ = vcross(vscale(n, -R), vscale(tangUnit, jt));

    wi[0] += torqueI[0] / I;
    wi[1] += torqueI[1] / I;
    wi[2] += torqueI[2] / I;
    wj[0] += torqueJ[0] / I;
    wj[1] += torqueJ[1] / I;
    wj[2] += torqueJ[2] / I;
  }

  // Keep velocities in the table plane
  newVi[2] = 0;
  newVj[2] = 0;

  ballI.rvw[1] = newVi;
  ballJ.rvw[1] = newVj;
  ballI.rvw[2] = wi;
  ballJ.rvw[2] = wj;

  // Ensure separation
  const d = vnorm(vsub(rj, ri));
  const overlap = 2 * R - d;
  if (overlap > 0) {
    ballI.rvw[0] = vsub(ri, vscale(n, overlap / 2));
    ballJ.rvw[0] = vadd(rj, vscale(n, overlap / 2));
  }
}

// ── Ball-cushion collision resolution (Han 2005 simplified) ──────────
// Reflects the velocity off the cushion normal with restitution,
// and applies friction + spin effects at the cushion contact.
// English (ωz) alters the rebound angle via surface velocity at contact.
export function resolveBallCushion(ball, cushion, params) {
  const v = ball.rvw[1];
  const w = ball.rvw[2];
  const { R, m } = params;
  const e_c = params.e_c ?? CUSHION_PARAMS.e_c;
  const f_c = params.f_c ?? CUSHION_PARAMS.f_c;
  const I = (2 / 5) * m * R * R;

  const n = cushion.normal; // inward normal [nx, ny]

  // Velocity component along inward normal (negative = approaching cushion)
  const vn = v[0] * n[0] + v[1] * n[1];

  // Should be approaching (vn < 0); if not, skip
  if (vn >= 0) return;

  // Linear tangential velocity (along cushion surface)
  const vt = [v[0] - vn * n[0], v[1] - vn * n[1], 0];

  // Spin-induced surface velocity at cushion contact from english (ωz).
  // Contact point is at R * (-n) from ball center.
  // ω × R_contact = [ωz·R·ny, -ωz·R·nx, ...] (tangential component only)
  const spinVt = [w[2] * R * n[1], -w[2] * R * n[0], 0];

  // Relative tangential surface velocity at contact (what friction acts on)
  const relVt = [vt[0] + spinVt[0], vt[1] + spinVt[1], 0];
  const relVtSpeed = vnorm2d(relVt);

  // Cushion height above ball center
  const h = CUSHION_PARAMS.height;
  const sinTheta = Math.max(-1, Math.min(1, (h - R) / R));
  const cosTheta = Math.sqrt(1 - sinTheta * sinTheta);

  // Reflect normal component with restitution (accounting for cushion height)
  const reflectedVn = -e_c * vn * cosTheta;

  // Normal impulse magnitude
  const normalImpulse = m * Math.abs(vn) * (1 + e_c);

  // Friction opposes relative tangential motion at contact.
  // Effective mass for ball-cushion contact: 1/m_eff = 1/m + R²/I = 7/(2m)
  const relVtDir = relVtSpeed > 1e-10
    ? [relVt[0] / relVtSpeed, relVt[1] / relVtSpeed, 0]
    : [0, 0, 0];
  const maxFriction = f_c * normalImpulse;
  const stopFriction = (2 * m / 7) * relVtSpeed;
  const frictionImpulse = Math.min(maxFriction, stopFriction);

  // Apply friction to linear velocity
  ball.rvw[1] = [
    reflectedVn * n[0] + vt[0] - (frictionImpulse / m) * relVtDir[0],
    reflectedVn * n[1] + vt[1] - (frictionImpulse / m) * relVtDir[1],
    0,
  ];

  // Apply friction to sidespin (ωz).
  // Torque z = (R_contact × F_friction)·ẑ = R · (n × relVtDir)_z · J_f
  const nCrossT = n[0] * relVtDir[1] - n[1] * relVtDir[0];
  w[2] += R * frictionImpulse * nCrossT / I;

  // Cushion height imparts additional sidespin
  const spinFromHeight = (normalImpulse * sinTheta * R) / I;
  w[2] += spinFromHeight * nCrossT * 0.3;

  // Rolling spin adapts toward new velocity direction
  const newV = ball.rvw[1];
  const newSpeed = vnorm2d(newV);
  if (newSpeed > 1e-10) {
    // Partially align rolling spin with new velocity
    const targetWx = -newV[1] / R;
    const targetWy = newV[0] / R;
    w[0] = w[0] * 0.5 + targetWx * 0.5;
    w[1] = w[1] * 0.5 + targetWy * 0.5;
  }
}

// ── Cue strike resolution ────────────────────────────────────────────
// Applies an instantaneous impulse to the cue ball from cue contact.
// Returns the post-strike rvw (ball starts in SLIDING state).
export function applyCueStrike(ball, V0, phi, spin, params) {
  const { R, m } = params;

  // Tip offset from center (in ball frame, perpendicular to cue direction)
  // spin.x: side english, spin.y: top/back (positive y = below center in UI)
  const a = spin.x * R * 0.5;  // horizontal offset (right = positive)
  const b = -spin.y * R * 0.5; // vertical offset (top = positive)

  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  // Linear velocity: ball moves in cue direction
  const v = [V0 * cosPhi, V0 * sinPhi, 0];

  // Angular velocity from off-center contact:
  // τ = Q × F, where Q = contact offset, F = impulse direction
  // Q × d_hat gives: (-b·sin(φ), b·cos(φ), -a)
  // ω = (5·V)/(2·R²) · Q × d_hat
  const coeff = (5 * V0) / (2 * R * R);
  const w = [
    coeff * (-b * sinPhi),
    coeff * (b * cosPhi),
    coeff * (-a),
  ];

  ball.rvw = [[...ball.rvw[0]], v, w];
  ball.state = SLIDING;
}
