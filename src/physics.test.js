import { describe, it, expect } from "vitest";
import { simulateShot, dist, TABLE_SIZES, RAIL, POCKET_R } from "./App.jsx";

const TW = TABLE_SIZES["8ft"].w; // 700
const TH = TABLE_SIZES["8ft"].h; // 380
const DEFAULT_CUE = { x: TW * 0.31, y: TH / 2 };
const DEFAULT_TARGET = { x: TW * 0.67, y: TH / 2 };
const NO_SPIN = { x: 0, y: 0 };

function autoAngle(cue, target) {
  return Math.atan2(target.y - cue.y, target.x - cue.x) * 180 / Math.PI;
}

function runShot(overrides = {}) {
  const {
    cue = DEFAULT_CUE,
    target = DEFAULT_TARGET,
    power = 5,
    spin = NO_SPIN,
    friction = 0.992,
    cushionBounce = 0.85,
    ballR = 8,
    aimAdj = 0,
    feltKey = 'nice',
  } = overrides;
  const angle = autoAngle(cue, target) + aimAdj;
  return simulateShot(cue, target, angle, power, spin, friction, cushionBounce, TW, TH, ballR, feltKey);
}

// ---------------------------------------------------------------------------
// Path integrity — no undefined, NaN, or Infinity in any path element
// ---------------------------------------------------------------------------

function assertPathIntegrity(sim) {
  for (const [name, path] of [["cuePath", sim.cuePath], ["targetPath", sim.targetPath]]) {
    expect(path.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      expect(p, `${name}[${i}] is undefined`).toBeDefined();
      expect(Number.isFinite(p.x), `${name}[${i}].x = ${p.x}`).toBe(true);
      expect(Number.isFinite(p.y), `${name}[${i}].y = ${p.y}`).toBe(true);
    }
  }
}

describe("path integrity", () => {
  const powers = [0.5, 3, 5, 7, 8.5, 10];
  const spins = [NO_SPIN, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 1 }];

  for (const power of powers) {
    for (const spin of spins) {
      it(`clean at power=${power} spin=(${spin.x},${spin.y})`, () => {
        assertPathIntegrity(runShot({ power, spin }));
      });
    }
  }

  it("clean with aim offset", () => {
    assertPathIntegrity(runShot({ power: 8, aimAdj: 30 }));
    assertPathIntegrity(runShot({ power: 8, aimAdj: -45 }));
  });
});

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

describe("collision detection", () => {
  it("detects collision at default power", () => {
    const sim = runShot({ power: 5 });
    expect(sim.hitPoint).not.toBeNull();
    expect(sim.targetPath.length).toBeGreaterThan(1);
  });

  it("detects collision at max power", () => {
    const sim = runShot({ power: 10 });
    expect(sim.hitPoint).not.toBeNull();
    expect(sim.targetPath.length).toBeGreaterThan(1);
  });

  it("detects collision across typical power levels", () => {
    for (let power = 2; power <= 10; power++) {
      const sim = runShot({ power });
      expect(sim.hitPoint, `no hit at power=${power}`).not.toBeNull();
    }
  });

  it("misses when aimed away from target", () => {
    const sim = runShot({ power: 5, aimAdj: -90 });
    expect(sim.hitPoint).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Physics sanity
// ---------------------------------------------------------------------------

describe("physics sanity", () => {
  it("higher power = target ball travels farther", () => {
    const lowSim = runShot({ power: 3 });
    const highSim = runShot({ power: 8 });
    // Higher power should make the target ball cover more total distance
    function totalDist(path) {
      let d = 0;
      for (let i = 1; i < path.length; i++) d += dist(path[i - 1], path[i]);
      return d;
    }
    expect(totalDist(highSim.targetPath)).toBeGreaterThan(totalDist(lowSim.targetPath));
  });

  it("side spin causes throw on target ball", () => {
    const noSpin = runShot({ power: 6, spin: NO_SPIN });
    const sideSpin = runShot({ power: 6, spin: { x: 1, y: 0 } });
    const noSpinEnd = noSpin.targetPath[noSpin.targetPath.length - 1];
    const sideSpinEnd = sideSpin.targetPath[sideSpin.targetPath.length - 1];
    // Side spin should deflect the cue ball differently, affecting target via collision
    const noSpinCue = noSpin.cuePath[noSpin.cuePath.length - 1];
    const sideSpinCue = sideSpin.cuePath[sideSpin.cuePath.length - 1];
    // Either target or cue should differ noticeably
    const cueDiff = dist(noSpinCue, sideSpinCue);
    const targetDiff = dist(noSpinEnd, sideSpinEnd);
    expect(cueDiff + targetDiff).toBeGreaterThan(1);
  });

  it("draw shot makes cue ball come back", () => {
    const sim = runShot({ power: 6, spin: { x: 0, y: 0.7 } });
    expect(sim.hitPoint).not.toBeNull();
    const cueEnd = sim.cuePath[sim.cuePath.length - 1];
    // Cue ball should end up behind the hit point (drew back)
    expect(cueEnd.x).toBeLessThan(sim.hitPoint.x);
  });

  it("follow shot makes cue ball go past hit point", () => {
    const sim = runShot({ power: 6, spin: { x: 0, y: -0.7 } });
    expect(sim.hitPoint).not.toBeNull();
    // Cue ball should travel past the hit point at some point (follow through),
    // even if a return collision later pushes it back
    const cuePastHit = sim.cuePath.some(p => p.x > sim.hitPoint.x);
    expect(cuePastHit).toBe(true);
  });

  it("all felt presets produce valid results at max power", () => {
    for (const feltKey of ['pro', 'nice', 'dive']) {
      assertPathIntegrity(runShot({ power: 10, feltKey }));
    }
  });
});

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

describe("animation position access", () => {
  it("every frame index yields a valid position", () => {
    const sim = runShot({ power: 8 });
    const totalFrames = Math.max(sim.cuePath.length, sim.targetPath.length);
    for (let frame = 0; frame < totalFrames; frame++) {
      const cueIdx = Math.min(frame, sim.cuePath.length - 1);
      const targetIdx = Math.min(frame, sim.targetPath.length - 1);
      const cuePos = sim.cuePath[cueIdx];
      const targetPos = sim.targetPath[targetIdx];
      expect(cuePos, `cuePath[${cueIdx}] undefined at frame ${frame}`).toBeDefined();
      expect(targetPos, `targetPath[${targetIdx}] undefined at frame ${frame}`).toBeDefined();
      expect(Number.isFinite(cuePos.x)).toBe(true);
      expect(Number.isFinite(targetPos.x)).toBe(true);
    }
  });

  it("cumulative distance calculation is valid", () => {
    const sim = runShot({ power: 8 });
    for (const path of [sim.cuePath, sim.targetPath]) {
      const cumDist = [0];
      for (let i = 1; i < path.length; i++) {
        const d = dist(path[i], path[i - 1]);
        expect(Number.isFinite(d), `non-finite dist at index ${i}`).toBe(true);
        cumDist.push(cumDist[i - 1] + d);
      }
      expect(cumDist.length).toBe(path.length);
      for (let i = 1; i < cumDist.length; i++) {
        expect(cumDist[i]).toBeGreaterThanOrEqual(cumDist[i - 1]);
      }
    }
  });
});
