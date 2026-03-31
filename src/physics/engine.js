import {
  STATIONARY, SPINNING, SLIDING, ROLLING, POCKETED,
  EVENT, BALL_PARAMS, CUSHION_PARAMS, POCKET_R_SI, TABLE_SI,
} from './constants.js';
import { evolveBall, getSlideTime, getRollTime, getSpinTime, hasResidualSpin } from './evolve.js';
import {
  ballBallCollisionTime,
  ballCushionCollisionTime,
  ballPocketCollisionTime,
  resolveBallBall,
  resolveBallCushion,
  applyCueStrike,
} from './collisions.js';
import { vnorm2d } from './utils.js';

// ── Table geometry ───────────────────────────────────────────────────
// Builds cushion segments and pocket positions for a given table size.
export function buildTable(sizeKey) {
  const { width, height } = TABLE_SI[sizeKey];
  const pocketR = POCKET_R_SI;

  // Pocket centers (slightly inset at corners, centered on sides)
  const inset = pocketR * 0.3;
  const pockets = [
    { x: inset, y: inset, r: pocketR },                 // top-left
    { x: width / 2, y: -pocketR * 0.1, r: pocketR },   // top-center
    { x: width - inset, y: inset, r: pocketR },         // top-right
    { x: inset, y: height - inset, r: pocketR },        // bottom-left
    { x: width / 2, y: height + pocketR * 0.1, r: pocketR }, // bottom-center
    { x: width - inset, y: height - inset, r: pocketR },// bottom-right
  ];

  // Cushion segments: each has p1, p2 (endpoints) and normal (inward)
  // We split top and bottom into two segments to leave gaps for pockets.
  const pGap = pocketR * 1.2; // gap at pocket mouths
  const cushions = [
    // Top cushions (normal points down = +y)
    { p1: [pGap, 0], p2: [width / 2 - pGap, 0], normal: [0, 1] },
    { p1: [width / 2 + pGap, 0], p2: [width - pGap, 0], normal: [0, 1] },
    // Bottom cushions (normal points up = -y)
    { p1: [pGap, height], p2: [width / 2 - pGap, height], normal: [0, -1] },
    { p1: [width / 2 + pGap, height], p2: [width - pGap, height], normal: [0, -1] },
    // Left cushion (normal points right = +x)
    { p1: [0, pGap], p2: [0, height - pGap], normal: [1, 0] },
    // Right cushion (normal points left = -x)
    { p1: [width, pGap], p2: [width, height - pGap], normal: [-1, 0] },
  ];

  return { width, height, pockets, cushions };
}

// ── Create a ball object ─────────────────────────────────────────────
export function createBall(id, x, y) {
  return {
    id,
    rvw: [[x, y, 0], [0, 0, 0], [0, 0, 0]],
    state: STATIONARY,
  };
}

// ── Main event-based simulation ──────────────────────────────────────
// Returns an array of snapshots: [{ time, balls: [{id, x, y, state}...] }]
export function simulate(balls, table, params, maxTime = 30, maxEvents = 5000) {
  let t = 0;
  const snapshots = [];

  // Record initial state
  snapshots.push(snapshotState(t, balls));

  for (let eventCount = 0; eventCount < maxEvents; eventCount++) {
    // ── Find next event ──
    let nextEvent = { dt: Infinity, type: null };

    // State transition events
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      if (ball.state === POCKETED) continue;

      if (ball.state === SLIDING) {
        const dt = getSlideTime(ball.rvw, params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          nextEvent = { dt, type: EVENT.SLIDE_TO_ROLL, ballIdx: i };
        }
      }

      if (ball.state === ROLLING) {
        const dt = getRollTime(ball.rvw, params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          const type = hasResidualSpin(ball.rvw, params)
            ? EVENT.ROLL_TO_SPIN : EVENT.ROLL_TO_STATIONARY;
          nextEvent = { dt, type, ballIdx: i };
        }
      }

      if (ball.state === SPINNING) {
        const dt = getSpinTime(ball.rvw, params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          nextEvent = { dt, type: EVENT.SPIN_TO_STATIONARY, ballIdx: i };
        }
      }
    }

    // Ball-ball collision events
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const dt = ballBallCollisionTime(balls[i], balls[j], params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          nextEvent = { dt, type: EVENT.BALL_BALL, ballIdx: i, ballIdx2: j };
        }
      }
    }

    // Ball-cushion collision events
    for (let i = 0; i < balls.length; i++) {
      for (const cushion of table.cushions) {
        const dt = ballCushionCollisionTime(balls[i], cushion, params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          nextEvent = { dt, type: EVENT.BALL_CUSHION, ballIdx: i, cushion };
        }
      }
    }

    // Ball-pocket events
    for (let i = 0; i < balls.length; i++) {
      for (const pocket of table.pockets) {
        const dt = ballPocketCollisionTime(balls[i], pocket, params);
        if (dt > 1e-10 && dt < nextEvent.dt) {
          nextEvent = { dt, type: EVENT.BALL_POCKET, ballIdx: i, pocket };
        }
      }
    }

    // No more events — all balls at rest
    if (nextEvent.dt === Infinity || nextEvent.dt > maxTime - t) break;

    // ── Evolve all balls to event time ──
    const dt = nextEvent.dt;
    for (const ball of balls) {
      if (ball.state !== POCKETED && ball.state !== STATIONARY) {
        ball.rvw = evolveBall(ball.rvw, ball.state, params, dt);
      }
    }
    t += dt;

    // Fallback pocket check: catch balls the quartic solver missed
    for (let i = 0; i < balls.length; i++) {
      if (balls[i].state === POCKETED) continue;
      for (const pocket of table.pockets) {
        const dx = balls[i].rvw[0][0] - pocket.x;
        const dy = balls[i].rvw[0][1] - pocket.y;
        if (dx * dx + dy * dy < pocket.r * pocket.r) {
          balls[i].state = POCKETED;
          balls[i].rvw[1] = [0, 0, 0];
          balls[i].rvw[2] = [0, 0, 0];
          balls[i].rvw[0] = [pocket.x, pocket.y, 0];
        }
      }
    }

    // ── Resolve the event ──
    switch (nextEvent.type) {
      case EVENT.SLIDE_TO_ROLL:
        balls[nextEvent.ballIdx].state = ROLLING;
        // Enforce rolling condition: vx = R·ωy, vy = -R·ωx
        enforceRolling(balls[nextEvent.ballIdx], params.R);
        break;

      case EVENT.ROLL_TO_STATIONARY:
        balls[nextEvent.ballIdx].state = STATIONARY;
        balls[nextEvent.ballIdx].rvw[1] = [0, 0, 0];
        balls[nextEvent.ballIdx].rvw[2] = [0, 0, 0];
        break;

      case EVENT.ROLL_TO_SPIN:
        balls[nextEvent.ballIdx].state = SPINNING;
        balls[nextEvent.ballIdx].rvw[1] = [0, 0, 0];
        balls[nextEvent.ballIdx].rvw[2][0] = 0;
        balls[nextEvent.ballIdx].rvw[2][1] = 0;
        break;

      case EVENT.SPIN_TO_STATIONARY:
        balls[nextEvent.ballIdx].state = STATIONARY;
        balls[nextEvent.ballIdx].rvw[1] = [0, 0, 0];
        balls[nextEvent.ballIdx].rvw[2] = [0, 0, 0];
        break;

      case EVENT.BALL_BALL:
        resolveBallBall(
          balls[nextEvent.ballIdx],
          balls[nextEvent.ballIdx2],
          params,
        );
        // Both balls enter sliding state after collision
        if (vnorm2d(balls[nextEvent.ballIdx].rvw[1]) > 1e-10) {
          balls[nextEvent.ballIdx].state = SLIDING;
        }
        if (vnorm2d(balls[nextEvent.ballIdx2].rvw[1]) > 1e-10) {
          balls[nextEvent.ballIdx2].state = SLIDING;
        }
        break;

      case EVENT.BALL_CUSHION:
        resolveBallCushion(balls[nextEvent.ballIdx], nextEvent.cushion, params);
        balls[nextEvent.ballIdx].state = SLIDING;
        break;

      case EVENT.BALL_POCKET:
        balls[nextEvent.ballIdx].state = POCKETED;
        balls[nextEvent.ballIdx].rvw[1] = [0, 0, 0];
        balls[nextEvent.ballIdx].rvw[2] = [0, 0, 0];
        // Move ball to pocket center
        balls[nextEvent.ballIdx].rvw[0] = [
          nextEvent.pocket.x, nextEvent.pocket.y, 0,
        ];
        break;
    }

    snapshots.push(snapshotState(t, balls));
  }

  // Final state
  if (snapshots.length === 0 || snapshots[snapshots.length - 1].time < t) {
    snapshots.push(snapshotState(t, balls));
  }

  return snapshots;
}

// ── Helpers ──────────────────────────────────────────────────────────

function enforceRolling(ball, R) {
  const v = ball.rvw[1];
  const w = ball.rvw[2];
  // Rolling: vx = R·ωy, vy = -R·ωx
  w[0] = -v[1] / R;
  w[1] = v[0] / R;
}

function snapshotState(time, balls) {
  return {
    time,
    balls: balls.map(b => ({
      id: b.id,
      x: b.rvw[0][0],
      y: b.rvw[0][1],
      vx: b.rvw[1][0],
      vy: b.rvw[1][1],
      wx: b.rvw[2][0],
      wy: b.rvw[2][1],
      wz: b.rvw[2][2],
      state: b.state,
    })),
  };
}
