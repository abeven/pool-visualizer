import {
  BALL_PARAMS, FELT_PHYSICS, TABLE_SI, POCKETED, SLIDING,
} from './constants.js';
import { buildTable, createBall, simulate } from './engine.js';
import { applyCueStrike } from './collisions.js';
import { evolveBall } from './evolve.js';

// Pixel-space constants matching App.jsx
const RAIL = 28;
const BALL_R_PX = 8;

// ── Coordinate conversion ────────────────────────────────────────────
// Pixel playing surface starts at (RAIL, RAIL).
// SI playing surface starts at (0, 0).

function pixelToSI(px, py, tableW, tableH, tableSI) {
  const scaleX = tableSI.width / (tableW - 2 * RAIL);
  const scaleY = tableSI.height / (tableH - 2 * RAIL);
  return [(px - RAIL) * scaleX, (py - RAIL) * scaleY];
}

function siToPixel(sx, sy, tableW, tableH, tableSI) {
  const scaleX = (tableW - 2 * RAIL) / tableSI.width;
  const scaleY = (tableH - 2 * RAIL) / tableSI.height;
  return { x: sx * scaleX + RAIL, y: sy * scaleY + RAIL };
}

// ── Sample continuous trajectory from event snapshots ────────────────
// The physics engine produces discrete events. We need to interpolate
// between events to produce smooth path arrays for the renderer.
function sampleTrajectories(snapshots, balls, params, sampleInterval) {
  if (snapshots.length < 2) {
    return balls.map(b => [{ x: b.rvw[0][0], y: b.rvw[0][1] }]);
  }

  const totalTime = snapshots[snapshots.length - 1].time;
  const numSamples = Math.max(2, Math.ceil(totalTime / sampleInterval) + 1);
  const paths = balls.map(() => []);

  // For each sample time, find the bracketing snapshots and interpolate
  // using the analytical equations of motion.
  for (let s = 0; s < numSamples; s++) {
    const sampleTime = (s / (numSamples - 1)) * totalTime;

    // Find the last snapshot before this sample time
    let snapIdx = 0;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].time <= sampleTime + 1e-10) {
        snapIdx = i;
        break;
      }
    }

    const snap = snapshots[snapIdx];
    const dt = sampleTime - snap.time;

    for (let b = 0; b < balls.length; b++) {
      const ballSnap = snap.balls[b];
      if (ballSnap.state === POCKETED) {
        paths[b].push({ x: ballSnap.x, y: ballSnap.y });
        continue;
      }

      // Reconstruct rvw from snapshot (full state including angular velocity)
      const rvw = [
        [ballSnap.x, ballSnap.y, 0],
        [ballSnap.vx, ballSnap.vy, 0],
        [ballSnap.wx || 0, ballSnap.wy || 0, ballSnap.wz || 0],
      ];

      if (dt > 1e-10 && ballSnap.state !== 0) {
        const evolved = evolveBall(rvw, ballSnap.state, params, dt);
        paths[b].push({ x: evolved[0][0], y: evolved[0][1] });
      } else {
        paths[b].push({ x: ballSnap.x, y: ballSnap.y });
      }
    }
  }

  return paths;
}

// ── Public API: drop-in replacement for the old simulateShot ─────────
// Returns { cuePath, targetPath, hitPoint, cuePocketed, targetPocketed }
// in pixel coordinates, compatible with App.jsx rendering.
export function simulateShot(
  cueBallPx, targetBallPx, angleDeg, power, spin,
  friction, cushionBounce, tableW, tableH, ballR,
  feltKey,
) {
  // Determine table size key from pixel dimensions
  let sizeKey = '8ft';
  if (tableW <= 600) sizeKey = '7ft';
  else if (tableW >= 800) sizeKey = '9ft';

  const tableSI = TABLE_SI[sizeKey];
  const table = buildTable(sizeKey);

  // Build physics params from felt preset or defaults
  const felt = feltKey ? FELT_PHYSICS[feltKey] : null;
  const params = {
    ...BALL_PARAMS,
    ...(felt || {}),
    e_c: felt ? felt.e_c : cushionBounce,
    f_c: felt ? felt.f_c : 0.2,
  };

  // Convert ball positions to SI
  const [cueX, cueY] = pixelToSI(cueBallPx.x, cueBallPx.y, tableW, tableH, tableSI);
  const [targetX, targetY] = pixelToSI(targetBallPx.x, targetBallPx.y, tableW, tableH, tableSI);

  // Create balls
  const cueBall = createBall('cue', cueX, cueY);
  const targetBall = createBall('target', targetX, targetY);
  const balls = [cueBall, targetBall];

  // Apply cue strike
  const phi = (angleDeg * Math.PI) / 180;
  // Map power (0.5-10) to ball speed in m/s
  // Calibrated so medium power (5) gives ~2.5 m/s
  const V0 = power * 0.5;
  applyCueStrike(cueBall, V0, phi, spin, params);

  // Run simulation
  const snapshots = simulate(balls, table, params);

  // Find first ball-ball collision for hitPoint
  let hitPoint = null;
  let hitTime = null;
  for (const snap of snapshots) {
    if (snap.balls.length >= 2) {
      const tb = snap.balls[1];
      if ((tb.vx !== 0 || tb.vy !== 0) && hitTime === null) {
        hitTime = snap.time;
        const hitPx = siToPixel(snap.balls[0].x, snap.balls[0].y, tableW, tableH, tableSI);
        hitPoint = hitPx;
      }
    }
  }

  // Check pocketed status
  const lastSnap = snapshots[snapshots.length - 1];
  const cuePocketed = lastSnap.balls[0].state === POCKETED;
  const targetPocketed = lastSnap.balls[1].state === POCKETED;

  // Sample trajectories
  const sampleInterval = 0.005; // 5ms intervals for smooth paths
  const siPaths = sampleTrajectories(snapshots, balls, params, sampleInterval);

  // Convert paths to pixel coordinates
  const cuePath = siPaths[0].map(p => siToPixel(p.x, p.y, tableW, tableH, tableSI));
  const targetPath = siPaths[1].map(p => siToPixel(p.x, p.y, tableW, tableH, tableSI));

  // Trim stationary tail from paths (matching original behavior)
  trimStationaryTail(cuePath);
  trimStationaryTail(targetPath);

  // Ensure paths have at least 2 points
  if (cuePath.length < 2) cuePath.push({ ...cuePath[0] });
  if (targetPath.length < 2) targetPath.push({ ...targetPath[0] });

  return { cuePath, targetPath, hitPoint, cuePocketed, targetPocketed };
}

function trimStationaryTail(path) {
  if (path.length < 3) return;
  // Remove trailing duplicate points (ball at rest)
  let lastX = path[path.length - 1].x, lastY = path[path.length - 1].y;
  let trimFrom = path.length;
  for (let i = path.length - 2; i >= 1; i--) {
    if (Math.abs(path[i].x - lastX) < 0.01 && Math.abs(path[i].y - lastY) < 0.01) {
      trimFrom = i + 1;
    } else {
      break;
    }
  }
  if (trimFrom < path.length) {
    path.length = trimFrom;
  }
}
