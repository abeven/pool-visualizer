// ── Vector operations (3-component arrays) ──────────────────────────

export function vadd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vsub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vscale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vdot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vcross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vnorm(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vnorm2d(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function vunit(v) {
  const n = vnorm(v);
  return n > 1e-15 ? vscale(v, 1 / n) : [0, 0, 0];
}

export function vunit2d(v) {
  const n = vnorm2d(v);
  return n > 1e-15 ? [v[0] / n, v[1] / n, 0] : [0, 0, 0];
}

// ── Surface velocity at ball-cloth contact point ─────────────────────
// u = v + R * (ẑ × ω)  where ẑ = [0,0,1]
// ẑ × ω = [-ωy, ωx, 0]
export function surfaceVelocity(v, omega, R) {
  return [
    v[0] - R * omega[1],
    v[1] + R * omega[0],
    0,
  ];
}

// ── Coordinate rotation (2D, about z-axis) ───────────────────────────
export function rotateZ(v, phi) {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}

// ── Polynomial solvers ───────────────────────────────────────────────

export function solveQuadratic(a, b, c) {
  const EPS = 1e-12;
  if (Math.abs(a) < EPS) {
    // Linear: bx + c = 0
    if (Math.abs(b) < EPS) return [];
    return [-c / b];
  }
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  const sqrtD = Math.sqrt(Math.max(0, disc));
  return [(-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a)];
}

export function solveCubic(a3, a2, a1, a0) {
  const EPS = 1e-12;
  if (Math.abs(a3) < EPS) return solveQuadratic(a2, a1, a0);

  const a = a2 / a3, b = a1 / a3, c = a0 / a3;
  const p = b - a * a / 3;
  const q = 2 * a * a * a / 27 - a * b / 3 + c;
  const D = q * q / 4 + p * p * p / 27;
  const offset = -a / 3;
  const roots = [];

  if (D > EPS) {
    const sqrtD = Math.sqrt(D);
    const u = Math.cbrt(-q / 2 + sqrtD);
    const v = Math.cbrt(-q / 2 - sqrtD);
    roots.push(u + v + offset);
  } else if (D < -EPS) {
    const r = Math.sqrt(-p * p * p / 27);
    const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    roots.push(m * Math.cos(phi / 3) + offset);
    roots.push(m * Math.cos((phi + 2 * Math.PI) / 3) + offset);
    roots.push(m * Math.cos((phi + 4 * Math.PI) / 3) + offset);
  } else {
    if (Math.abs(q) < EPS) {
      roots.push(offset);
    } else {
      const u = Math.cbrt(-q / 2);
      roots.push(2 * u + offset);
      roots.push(-u + offset);
    }
  }
  return roots;
}

export function solveQuartic(a4, a3, a2, a1, a0) {
  const EPS = 1e-10;
  if (Math.abs(a4) < EPS) return solveCubic(a3, a2, a1, a0);

  const a = a3 / a4, b = a2 / a4, c = a1 / a4, d = a0 / a4;
  const p = b - 3 * a * a / 8;
  const q = a * a * a / 8 - a * b / 2 + c;
  const r = -3 * a * a * a * a / 256 + a * a * b / 16 - a * c / 4 + d;
  const offset = -a / 4;
  const roots = [];

  // Biquadratic case (q ≈ 0)
  if (Math.abs(q) < EPS) {
    const disc = p * p - 4 * r;
    if (disc >= -EPS) {
      const sqrtD = Math.sqrt(Math.max(0, disc));
      const u1 = (-p + sqrtD) / 2;
      const u2 = (-p - sqrtD) / 2;
      if (u1 >= -EPS) {
        const s = Math.sqrt(Math.max(0, u1));
        roots.push(s + offset, -s + offset);
      }
      if (u2 >= -EPS && Math.abs(u2 - u1) > EPS) {
        const s = Math.sqrt(Math.max(0, u2));
        roots.push(s + offset, -s + offset);
      }
    }
    return roots;
  }

  // Ferrari: resolvent cubic 8m³ + 8pm² + (2p²−8r)m − q² = 0
  const cubicRoots = solveCubic(8, 8 * p, 2 * p * p - 8 * r, -q * q);
  if (cubicRoots.length === 0) return roots;

  // Pick the largest root for numerical stability
  let m = -Infinity;
  for (const cr of cubicRoots) {
    if (cr > m) m = cr;
  }

  const sqVal = 2 * m + p;
  if (sqVal < -EPS) return roots;
  const sq = Math.sqrt(Math.max(0, sqVal));

  if (sq < 1e-14) return roots;

  const qOverSq = q / (2 * sq);

  const disc1 = sq * sq - 4 * (m + qOverSq);
  const disc2 = sq * sq - 4 * (m - qOverSq);

  if (disc1 >= -EPS) {
    const sd = Math.sqrt(Math.max(0, disc1));
    roots.push((-sq + sd) / 2 + offset);
    roots.push((-sq - sd) / 2 + offset);
  }
  if (disc2 >= -EPS) {
    const sd = Math.sqrt(Math.max(0, disc2));
    roots.push((sq + sd) / 2 + offset);
    roots.push((sq - sd) / 2 + offset);
  }

  return roots;
}

// Return the smallest positive root, or Infinity if none.
// If polynomial coefficients are provided, verify roots actually satisfy the equation.
export function smallestPositiveRoot(roots, eps = 1e-9, polyCoeffs = null) {
  let best = Infinity;
  for (const r of roots) {
    if (r > eps && r < best) {
      // Verify root if polynomial coefficients provided
      if (polyCoeffs) {
        let val = 0, maxTerm = 0;
        for (let i = 0; i < polyCoeffs.length; i++) {
          const term = polyCoeffs[i] * Math.pow(r, polyCoeffs.length - 1 - i);
          val += term;
          maxTerm = Math.max(maxTerm, Math.abs(term));
        }
        // Scale tolerance by the largest term magnitude at this root
        const scale = maxTerm + 1;
        if (Math.abs(val) > scale * 0.01) continue; // spurious root
      }
      best = r;
    }
  }
  return best;
}
