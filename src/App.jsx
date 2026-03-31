import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { simulateShot } from "./physics/index.js";

const RAIL = 28;
const BALL_R = 8;
const POCKET_R = 18;

const TABLE_SIZES = {
  "7ft": { label: "7′", w: 580, h: 320, desc: "Bar / Coin-op" },
  "8ft": { label: "8′", w: 700, h: 380, desc: "Home Standard" },
  "9ft": { label: "9′", w: 820, h: 440, desc: "Tournament" },
};

function getPockets(tw, th) {
  return [
    { x: RAIL + 2, y: RAIL + 2 },
    { x: tw / 2, y: RAIL - 2 },
    { x: tw - RAIL - 2, y: RAIL + 2 },
    { x: RAIL + 2, y: th - RAIL - 2 },
    { x: tw / 2, y: th - RAIL + 2 },
    { x: tw - RAIL - 2, y: th - RAIL - 2 },
  ];
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export { simulateShot, dist, getPockets, TABLE_SIZES, RAIL, BALL_R, POCKET_R };

const SPIN_DOT_R = 38; // max dot offset from center, in px

function SpinSelector({ spin, onChange, onReset }) {
  const ref = useRef(null);
  const dragging = useRef(false);

  const handleMove = useCallback((e) => {
    if (!dragging.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let x = (clientX - rect.left - cx) / SPIN_DOT_R;
    let y = (clientY - rect.top - cy) / SPIN_DOT_R;
    const m = Math.sqrt(x * x + y * y);
    if (m > 1) { x /= m; y /= m; }
    onChange({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  }, [onChange]);

  const handleUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [handleMove, handleUp]);

  const label = () => {
    const parts = [];
    if (spin.y < -0.2) parts.push("Top");
    if (spin.y > 0.2) parts.push("Bottom");
    if (spin.x < -0.2) parts.push("Left");
    if (spin.x > 0.2) parts.push("Right");
    return parts.length ? parts.join(" ") : "Center";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 11, color: "#b8a88a", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "var(--ff-body)" }}>
          Cue Tip Position
        </span>
        <span onClick={onReset} style={{ fontSize: 10, color: (spin.x !== 0 || spin.y !== 0) ? "#c8a050" : "#4a3a20", cursor: (spin.x !== 0 || spin.y !== 0) ? "pointer" : "default", fontFamily: "var(--ff-body)", textDecoration: "underline", textUnderlineOffset: 2 }}>reset</span>
      </div>
      <div
        ref={ref}
        onMouseDown={(e) => { dragging.current = true; handleMove(e); }}
        onTouchStart={(e) => { dragging.current = true; handleMove(e); }}
        style={{
          width: 100, height: 100, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 35%, #f5f0e8, #d4cbb8 60%, #b8a88a)",
          border: "3px solid #8a7a60",
          position: "relative", cursor: "pointer",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.3)",
          touchAction: "none",
        }}
      >
        {/* Grid lines */}
        <div style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 1, background: "rgba(0,0,0,0.12)" }} />
        <div style={{ position: "absolute", top: "50%", left: 8, right: 8, height: 1, background: "rgba(0,0,0,0.12)" }} />
        {/* Tip dot */}
        <div style={{
          position: "absolute",
          left: `calc(50% + ${spin.x * SPIN_DOT_R}px)`,
          top: `calc(50% + ${spin.y * SPIN_DOT_R}px)`,
          width: 18, height: 18,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #5fa0d4, #2d6ca3)",
          border: "2px solid #1a4a73",
          transform: "translate(-50%, -50%)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
          transition: dragging.current ? "none" : "all 0.15s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, color: "#c8b898", fontFamily: "var(--ff-body)", fontWeight: 600 }}>
        {label()}
      </span>
      <div style={{ minHeight: 28, fontSize: 10, color: "#80c0ff", fontFamily: "var(--ff-body)", textAlign: "center", lineHeight: 1.4 }}>
        {spin.y < -0.2 && <>Top spin: cue follows through<br /></>}
        {spin.y > 0.2 && <>Back spin: cue draws back<br /></>}
        {Math.abs(spin.x) > 0.2 && <>English: cue curves after hit</>}
      </div>
    </div>
  );
}

function PathGlow({ path, color, opacity = 0.7, dashArray = "none", width = 2 }) {
  if (!path || path.length < 2) return null;
  const d = path.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width + 3} strokeOpacity={opacity * 0.25} strokeDasharray={dashArray} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeOpacity={opacity} strokeDasharray={dashArray} strokeLinecap="round" />
    </g>
  );
}

function deflAt(path, i, step) {
  const dx1 = path[i].x - path[i - step].x, dy1 = path[i].y - path[i - step].y;
  const dx2 = path[i + step].x - path[i].x, dy2 = path[i + step].y - path[i].y;
  const l1 = Math.hypot(dx1, dy1), l2 = Math.hypot(dx2, dy2);
  if (l1 < 1 || l2 < 1) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (l1 * l2))));
}

function findImpacts(path, tableW, tableH) {
  if (path.length < 7) return [];
  const impacts = [];
  const step = 3;
  for (let i = step; i < path.length - step; i++) {
    const defl = deflAt(path, i, step);
    if (defl < 0.15) continue;
    const p = path[i];
    if (impacts.some(imp => Math.hypot(imp.x - p.x, imp.y - p.y) < 15)) continue;

    // Find peak deflection in this cluster instead of using the first threshold hit
    let bestI = i, bestDefl = defl;
    for (let j = i + 1; j < Math.min(i + 10, path.length - step); j++) {
      const d = deflAt(path, j, step);
      if (d < 0.15) break;
      if (d > bestDefl) { bestI = j; bestDefl = d; }
    }

    const bp = path[bestI];
    const dx1 = bp.x - path[bestI - step].x, dy1 = bp.y - path[bestI - step].y;
    const dx2 = path[bestI + step].x - bp.x, dy2 = path[bestI + step].y - bp.y;
    const inA = Math.atan2(dy1, dx1);
    const outA = Math.atan2(dy2, dx2);

    let nx = 0, ny = 0;
    const cushionZone = BALL_R + 4;
    if (bp.y < RAIL + cushionZone) ny = 1;
    else if (bp.y > tableH - RAIL - cushionZone) ny = -1;
    if (bp.x < RAIL + cushionZone) nx = 1;
    else if (bp.x > tableW - RAIL - cushionZone) nx = -1;
    // Near a corner: keep only the rail the ball is closer to
    if (nx && ny) {
      const distX = Math.min(bp.x - RAIL, tableW - RAIL - bp.x);
      const distY = Math.min(bp.y - RAIL, tableH - RAIL - bp.y);
      if (distX < distY) ny = 0; else nx = 0;
    }

    let nA;
    if (nx || ny) {
      nA = Math.atan2(ny, nx);
    } else {
      // Ball-ball: estimate normal as bisector of reversed-incoming and outgoing
      const revInA = inA + Math.PI;
      nA = (revInA + outA) / 2;
      if (Math.abs(normAngle(outA - nA)) > Math.PI / 2) nA += Math.PI;
    }
    impacts.push({
      x: bp.x, y: bp.y, cushion: !!(nx || ny),
      angle: Math.round(bestDefl * 180 / Math.PI),
      inA, outA, nA,
    });
    i = bestI + step;
  }
  return impacts;
}

function svgArc(cx, cy, r, a1, a2) {
  return Array.from({ length: 17 }, (_, i) => {
    const a = a1 + (a2 - a1) * i / 16;
    return `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join("");
}

function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

function ImpactAngles({ cuePath, targetPath, tableW, tableH }) {
  const cueImps = findImpacts(cuePath, tableW, tableH);
  const tgtImps = findImpacts(targetPath, tableW, tableH);
  const render = (imp, color, key) => {
    const revInA = imp.inA + Math.PI;

    if (!imp.cushion) {
      // Ball-ball: show single deflection angle
      const dDefl = normAngle(imp.outA - revInA);
      const deflAngle = Math.round(Math.abs(dDefl) * 180 / Math.PI);
      const midA = revInA + dDefl / 2;
      return (
        <g key={key} opacity={0.7}>
          <path d={`M${imp.x},${imp.y} ${svgArc(imp.x, imp.y, 14, revInA, revInA + dDefl).replace("M", "L")} Z`}
            fill={`${color}15`} stroke="none" />
          <path d={svgArc(imp.x, imp.y, 14, revInA, revInA + dDefl)}
            fill="none" stroke={color} strokeWidth={0.8} />
          <text x={imp.x + 24 * Math.cos(midA)} y={imp.y + 24 * Math.sin(midA)}
            fill={color} fontSize={10} textAnchor="middle" dominantBaseline="central"
            fontFamily="var(--ff-body)" fontWeight="600">{deflAngle}°</text>
        </g>
      );
    }

    // Cushion: show incoming and outgoing angles from rail surface
    const inSide = normAngle(revInA - imp.nA) >= 0 ? 1 : -1;
    const surfaceInA = imp.nA + inSide * Math.PI / 2;
    const surfaceOutA = imp.nA - inSide * Math.PI / 2;
    const dInArc = normAngle(revInA - surfaceInA);
    const dOutArc = normAngle(imp.outA - surfaceOutA);
    const angleIn = Math.round(Math.abs(dInArc) * 180 / Math.PI);
    const angleOut = Math.round(Math.abs(dOutArc) * 180 / Math.PI);
    const inMidA = surfaceInA + dInArc / 2;
    const outMidA = surfaceOutA + dOutArc / 2;

    return (
      <g key={key} opacity={0.7}>
        {/* Incoming angle from rail */}
        <path d={`M${imp.x},${imp.y} ${svgArc(imp.x, imp.y, 12, surfaceInA, surfaceInA + dInArc).replace("M", "L")} Z`}
          fill={`${color}15`} stroke="none" />
        <path d={svgArc(imp.x, imp.y, 12, surfaceInA, surfaceInA + dInArc)}
          fill="none" stroke={color} strokeWidth={0.8} />
        <text x={imp.x + 22 * Math.cos(inMidA)} y={imp.y + 22 * Math.sin(inMidA)}
          fill={color} fontSize={10} textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--ff-body)" fontWeight="600">{angleIn}°</text>

        {/* Outgoing angle from rail */}
        <path d={`M${imp.x},${imp.y} ${svgArc(imp.x, imp.y, 12, surfaceOutA, surfaceOutA + dOutArc).replace("M", "L")} Z`}
          fill={`${color}15`} stroke="none" />
        <path d={svgArc(imp.x, imp.y, 12, surfaceOutA, surfaceOutA + dOutArc)}
          fill="none" stroke={color} strokeWidth={0.8} />
        <text x={imp.x + 22 * Math.cos(outMidA)} y={imp.y + 22 * Math.sin(outMidA)}
          fill={color} fontSize={10} textAnchor="middle" dominantBaseline="central"
          fontFamily="var(--ff-body)" fontWeight="600">{angleOut}°</text>
      </g>
    );
  };

  return (
    <g>
      {cueImps.map((imp, i) => render(imp, "#60b8ff", `c${i}`))}
      {tgtImps.map((imp, i) => render(imp, "#ffb060", `t${i}`))}
    </g>
  );
}

const FELT_QUALITY = {
  pro: {
    label: "Pro", friction: 0.995, cushionBounce: 0.88,
    feltColor1: "#1e6830", feltColor2: "#164d22",
    cushionColor: "#1f8038",
    desc: "Tournament Simonis 860 — fast, low friction",
  },
  nice: {
    label: "Nice", friction: 0.992, cushionBounce: 0.85,
    feltColor1: "#2d7a3a", feltColor2: "#1e5a28",
    cushionColor: "#28903a",
    desc: "Standard woolen felt — balanced play",
  },
  dive: {
    label: "Dive", friction: 0.985, cushionBounce: 0.78,
    feltColor1: "#3a7840", feltColor2: "#2a6030",
    cushionColor: "#358540",
    desc: "Worn bar cloth — high friction, dead cushions",
  },
};

export default function PoolVisualizer() {
  const [tableSize, setTableSize] = useState("8ft");
  const TABLE_W = TABLE_SIZES[tableSize].w;
  const TABLE_H = TABLE_SIZES[tableSize].h;
  const POCKETS = getPockets(TABLE_W, TABLE_H);

  const [cueBall, setCueBall] = useState({ x: TABLE_SIZES["8ft"].w * 0.31, y: TABLE_SIZES["8ft"].h / 2 });
  const [targetBall, setTargetBall] = useState({ x: TABLE_SIZES["8ft"].w * 0.67, y: TABLE_SIZES["8ft"].h / 2 });
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState(5);
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const [feltQuality, setFeltQuality] = useState("nice");
  const [dragging, setDragging] = useState(null);
  const [aimDragging, setAimDragging] = useState(false);
  const [animProgress, setAnimProgress] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const svgRef = useRef(null);
  const animRef = useRef(null);
  const felt = FELT_QUALITY[feltQuality];

  const mobileQuery = '(max-width: 599px), (max-height: 500px) and (pointer: coarse)';
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  useEffect(() => {
    const mql = window.matchMedia(mobileQuery);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const [isLandscape, setIsLandscape] = useState(() => window.matchMedia('(orientation: landscape)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handler = (e) => setIsLandscape(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const mobileLandscape = isMobile && isLandscape;

  useEffect(() => {
    if (mobileLandscape && window.matchMedia('(pointer: coarse)').matches) {
      const enter = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
      };
      document.addEventListener('touchstart', enter, { once: true });
      return () => document.removeEventListener('touchstart', enter);
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [mobileLandscape]);

  const ballR = BALL_R;

  const handleTableSizeChange = useCallback((size) => {
    setTableSize(size);
    const s = TABLE_SIZES[size];
    setCueBall({ x: s.w * 0.31, y: s.h / 2 });
    setTargetBall({ x: s.w * 0.67, y: s.h / 2 });
  }, []);

  // Compute shot direction from cue to target
  const autoAngle = Math.atan2(targetBall.y - cueBall.y, targetBall.x - cueBall.x) * 180 / Math.PI;
  const shotAngle = autoAngle + angle;

  const [perfStats, setPerfStats] = useState({ simMs: 0, fps: 0, frameMs: 0 });
  const perfRef = useRef({ frameTimes: [], lastFrame: 0 });

  const sim = useMemo(() => {
    const t0 = performance.now();
    const result = simulateShot(cueBall, targetBall, shotAngle, power, spin, felt.friction, felt.cushionBounce, TABLE_W, TABLE_H, ballR, feltQuality);
    const simMs = performance.now() - t0;
    setPerfStats(prev => ({ ...prev, simMs }));
    return result;
  }, [cueBall.x, cueBall.y, targetBall.x, targetBall.y, shotAngle, power, spin.x, spin.y, felt.friction, felt.cushionBounce, TABLE_W, TABLE_H, ballR, feltQuality]);

  const getSvgPoint = useCallback((e) => {
    if (!svgRef.current) return null;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }, []);

  const clamp = (val, mn, mx) => Math.max(mn, Math.min(mx, val));

  const handlePointerDown = useCallback((e, ball) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(ball);
  }, []);

  const handleAimDown = useCallback((e) => {
    e.preventDefault();
    setAimDragging(true);
  }, []);

  const rafRef = useRef(0);
  const handlePointerMove = useCallback((e) => {
    if (rafRef.current) return;
    const pt = getSvgPoint(e);
    if (!pt) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (dragging === "cue") {
        setCueBall({
          x: clamp(pt.x, RAIL + ballR, TABLE_W - RAIL - ballR),
          y: clamp(pt.y, RAIL + ballR, TABLE_H - RAIL - ballR),
        });
      } else if (dragging === "target") {
        setTargetBall({
          x: clamp(pt.x, RAIL + ballR, TABLE_W - RAIL - ballR),
          y: clamp(pt.y, RAIL + ballR, TABLE_H - RAIL - ballR),
        });
      } else if (aimDragging) {
        const a = Math.atan2(pt.y - cueBall.y, pt.x - cueBall.x) * 180 / Math.PI;
        setAngle(a - autoAngle);
      }
    });
  }, [dragging, aimDragging, getSvgPoint, cueBall, autoAngle, TABLE_W, TABLE_H, ballR]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setAimDragging(false);
  }, []);

  // Precompute cumulative distances for rotation
  const cueCumDist = useRef([]);
  const targetCumDist = useRef([]);
  useEffect(() => {
    const calcCum = (path) => {
      const d = [0];
      for (let i = 1; i < path.length; i++) {
        d.push(d[i - 1] + dist(path[i], path[i - 1]));
      }
      return d;
    };
    cueCumDist.current = calcCum(sim.cuePath);
    targetCumDist.current = calcCum(sim.targetPath);
  }, [sim.cuePath, sim.targetPath]);

  // Frame-based animation: each sim step = constant real time
  const MS_PER_FRAME = 8; // ms per simulation step — tune for speed feel
  const maxFrames = Math.max(sim.cuePath.length, sim.targetPath.length);

  const animate = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setAnimProgress(0);
    const start = performance.now();
    const totalFrames = Math.max(sim.cuePath.length, sim.targetPath.length);
    perfRef.current.frameTimes = [];
    perfRef.current.lastFrame = 0;
    const tick = (now) => {
      const elapsed = now - start;
      const frame = Math.min(Math.floor(elapsed / MS_PER_FRAME), totalFrames - 1);
      // Track frame timing
      if (perfRef.current.lastFrame) {
        const dt = now - perfRef.current.lastFrame;
        perfRef.current.frameTimes.push(dt);
        if (perfRef.current.frameTimes.length > 30) perfRef.current.frameTimes.shift();
        const avg = perfRef.current.frameTimes.reduce((a, b) => a + b, 0) / perfRef.current.frameTimes.length;
        setPerfStats(prev => ({ ...prev, fps: Math.round(1000 / avg), frameMs: +avg.toFixed(1) }));
      }
      perfRef.current.lastFrame = now;
      setAnimProgress(frame);
      if (frame < totalFrames - 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
        perfRef.current.lastFrame = 0;
      }
    };
    animRef.current = requestAnimationFrame(tick);
  }, [isAnimating, sim.cuePath.length, sim.targetPath.length]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  const getAnimatedPath = (path, frame) => {
    if (!path || path.length < 2) return [];
    const idx = Math.min(frame, path.length - 1);
    return path.slice(0, idx + 1);
  };

  const getAnimatedBallPos = (path, frame) => {
    if (!path || path.length === 0) return { x: 0, y: 0 };
    const idx = Math.min(Math.max(0, frame || 0), path.length - 1);
    return path[idx] || path[0] || { x: 0, y: 0 };
  };

  const getRotation = (cumDist, frame) => {
    if (!cumDist || cumDist.length === 0) return 0;
    const idx = Math.min(frame, cumDist.length - 1);
    const traveled = cumDist[idx] || 0;
    // rotation in degrees = distance / circumference * 360
    return (traveled / (2 * Math.PI * ballR)) * 360;
  };

  const cueAnimPos = isAnimating ? getAnimatedBallPos(sim.cuePath, animProgress) : null;
  const targetAnimPos = isAnimating ? getAnimatedBallPos(sim.targetPath, animProgress) : null;
  const cueRotation = isAnimating ? getRotation(cueCumDist.current, animProgress) : 0;
  const targetRotation = isAnimating ? getRotation(targetCumDist.current, animProgress) : 0;

  return (
    <div style={{
      "--ff-display": "'Playfair Display', Georgia, serif",
      "--ff-body": "'DM Sans', 'Segoe UI', sans-serif",
      height: "100dvh",
      background: "linear-gradient(170deg, #1a1510 0%, #0f0d0a 40%, #141210 100%)",
      color: "#e8dcc8",
      fontFamily: "var(--ff-body)",
      display: "flex",
      flexDirection: mobileLandscape ? "row" : "column",
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`*, *::before, *::after { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }`}</style>
      {mobileLandscape && <style>{`
        .mobile-sidebar { scrollbar-width: thin; scrollbar-color: rgba(200,160,80,0.3) rgba(255,255,255,0.04); }
        .mobile-sidebar::-webkit-scrollbar { width: 5px; }
        .mobile-sidebar::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 3px; margin: 6px 0; }
        .mobile-sidebar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, rgba(200,160,80,0.35), rgba(200,160,80,0.15)); border-radius: 3px; min-height: 30px; }
        .mobile-sidebar::-webkit-scrollbar-thumb:hover { background: rgba(200,160,80,0.5); }
      `}</style>}

      {isMobile && !isLandscape && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "linear-gradient(170deg, #1a1510 0%, #0f0d0a 40%, #141210 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          fontFamily: "var(--ff-body)",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c8a050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(90deg)" }}>
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          <p style={{ fontFamily: "var(--ff-display)", fontSize: 20, color: "#e8d5a8", margin: 0 }}>
            Rotate Your Device
          </p>
          <p style={{ fontSize: 13, color: "#8a7a60", margin: 0, textAlign: "center", padding: "0 40px", lineHeight: 1.5 }}>
            Billiard Shot Lab works best in landscape orientation
          </p>
        </div>
      )}
      <div style={{ textAlign: "center", padding: "8px 12px 2px", flexShrink: 0, display: mobileLandscape ? "none" : undefined }}>
        <h1 style={{
          fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700,
          margin: 0, letterSpacing: 1,
          background: "linear-gradient(135deg, #e8d5a8, #c8a862)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Billiard Shot Lab
        </h1>
        <p style={{ fontSize: 10, color: "#8a7a60", margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>
          Trajectory Predictor & Spin Visualizer
        </p>
      </div>

      {/* Table — fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 12px" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${TABLE_W} ${TABLE_H}`}
          style={{ maxWidth: "100%", maxHeight: "100%", display: "block", touchAction: "none" }}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          <defs>
            <radialGradient id="felt">
              <stop offset="0%" stopColor={felt.feltColor1} />
              <stop offset="100%" stopColor={felt.feltColor2} />
            </radialGradient>
            <radialGradient id="pocketGrad">
              <stop offset="0%" stopColor="#1a1008" />
              <stop offset="100%" stopColor="#0a0804" />
            </radialGradient>
            <filter id="ballShadow">
              <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.5" />
            </filter>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <pattern id="feltTexture" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <circle cx="1" cy="1" r="0.3" fill="rgba(0,0,0,0.06)" />
              <circle cx="3" cy="3" r="0.3" fill="rgba(255,255,255,0.03)" />
            </pattern>
          </defs>

          {/* Rails */}
          <rect x="0" y="0" width={TABLE_W} height={TABLE_H} rx="10" fill="#5a3d1e" />
          <rect x="4" y="4" width={TABLE_W - 8} height={TABLE_H - 8} rx="8" fill="#6b4a28" />

          {/* Felt */}
          <rect x={RAIL} y={RAIL} width={TABLE_W - RAIL * 2} height={TABLE_H - RAIL * 2} fill="url(#felt)" rx="2" />
          <rect x={RAIL} y={RAIL} width={TABLE_W - RAIL * 2} height={TABLE_H - RAIL * 2} fill="url(#feltTexture)" rx="2" />

          {/* Dive bar wear marks */}
          {feltQuality === "dive" && (
            <g opacity="0.3">
              <ellipse cx={TABLE_W * 0.29} cy={TABLE_H * 0.42} rx="35" ry="20" fill="#4a8848" transform={`rotate(-15,${TABLE_W * 0.29},${TABLE_H * 0.42})`} />
              <ellipse cx={TABLE_W * 0.6} cy={TABLE_H * 0.55} rx="28" ry="15" fill="#4a8848" transform={`rotate(8,${TABLE_W * 0.6},${TABLE_H * 0.55})`} />
              <ellipse cx={TABLE_W * 0.79} cy={TABLE_H * 0.34} rx="20" ry="25" fill="#4a8848" transform={`rotate(-5,${TABLE_W * 0.79},${TABLE_H * 0.34})`} />
              <ellipse cx={TABLE_W * 0.21} cy={TABLE_H * 0.71} rx="18" ry="12" fill="#3d7538" />
              <circle cx={TABLE_W * 0.49} cy={TABLE_H * 0.26} r="8" fill="#4a8848" />
              <circle cx={TABLE_W * 0.71} cy={TABLE_H * 0.74} r="6" fill="#3d7538" />
              <circle cx={TABLE_W * 0.54} cy={TABLE_H * 0.5} r="10" fill="rgba(100,140,200,0.12)" />
              <circle cx={TABLE_W * 0.36} cy={TABLE_H * 0.6} r="7" fill="rgba(100,140,200,0.08)" />
            </g>
          )}

          {/* Rail cushions */}
          {/* Top */}
          <polygon points={`${RAIL + 20},${RAIL} ${TABLE_W / 2 - 16},${RAIL} ${TABLE_W / 2 - 20},${RAIL + 6} ${RAIL + 24},${RAIL + 6}`} fill={felt.cushionColor} />
          <polygon points={`${TABLE_W / 2 + 16},${RAIL} ${TABLE_W - RAIL - 20},${RAIL} ${TABLE_W - RAIL - 24},${RAIL + 6} ${TABLE_W / 2 + 20},${RAIL + 6}`} fill={felt.cushionColor} />
          {/* Bottom */}
          <polygon points={`${RAIL + 20},${TABLE_H - RAIL} ${TABLE_W / 2 - 16},${TABLE_H - RAIL} ${TABLE_W / 2 - 20},${TABLE_H - RAIL - 6} ${RAIL + 24},${TABLE_H - RAIL - 6}`} fill={felt.cushionColor} />
          <polygon points={`${TABLE_W / 2 + 16},${TABLE_H - RAIL} ${TABLE_W - RAIL - 20},${TABLE_H - RAIL} ${TABLE_W - RAIL - 24},${TABLE_H - RAIL - 6} ${TABLE_W / 2 + 20},${TABLE_H - RAIL - 6}`} fill={felt.cushionColor} />
          {/* Left */}
          <polygon points={`${RAIL},${RAIL + 20} ${RAIL},${TABLE_H - RAIL - 20} ${RAIL + 6},${TABLE_H - RAIL - 24} ${RAIL + 6},${RAIL + 24}`} fill={felt.cushionColor} />
          {/* Right */}
          <polygon points={`${TABLE_W - RAIL},${RAIL + 20} ${TABLE_W - RAIL},${TABLE_H - RAIL - 20} ${TABLE_W - RAIL - 6},${TABLE_H - RAIL - 24} ${TABLE_W - RAIL - 6},${RAIL + 24}`} fill={felt.cushionColor} />

          {/* Diamonds / sights */}
          {[1, 2, 3].map(i => (
            <g key={`d-${i}`}>
              <circle cx={RAIL + (TABLE_W - RAIL * 2) * i / 4} cy={RAIL / 2} r="2.5" fill="#d4b870" opacity="0.7" />
              <circle cx={RAIL + (TABLE_W - RAIL * 2) * i / 4} cy={TABLE_H - RAIL / 2} r="2.5" fill="#d4b870" opacity="0.7" />
            </g>
          ))}
          {[1, 2, 3].map(i => (
            <g key={`ds-${i}`}>
              <circle cx={RAIL / 2} cy={RAIL + (TABLE_H - RAIL * 2) * i / 4} r="2.5" fill="#d4b870" opacity="0.7" />
              <circle cx={TABLE_W - RAIL / 2} cy={RAIL + (TABLE_H - RAIL * 2) * i / 4} r="2.5" fill="#d4b870" opacity="0.7" />
            </g>
          ))}

          {/* Pockets */}
          {POCKETS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={POCKET_R} fill="url(#pocketGrad)" stroke="#1a1008" strokeWidth="1.5" />
          ))}

          {/* Head string */}
          <line x1={RAIL + (TABLE_W - RAIL * 2) / 4} y1={RAIL + 1} x2={RAIL + (TABLE_W - RAIL * 2) / 4} y2={TABLE_H - RAIL - 1} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4,4" />
          {/* Foot spot */}
          <circle cx={RAIL + (TABLE_W - RAIL * 2) * 3 / 4} cy={TABLE_H / 2} r="2.5" fill="rgba(255,255,255,0.15)" />

          {/* Trajectory paths */}
          {isAnimating ? (
            <>
              <PathGlow path={getAnimatedPath(sim.cuePath, animProgress)} color="#60b8ff" opacity={0.8} width={2} />
              <PathGlow path={getAnimatedPath(sim.targetPath, animProgress)} color="#ffb060" opacity={0.8} width={2} />
            </>
          ) : (
            <>
              <PathGlow path={sim.cuePath} color="#60b8ff" opacity={0.35} dashArray="6,4" width={1.5} />
              <PathGlow path={sim.targetPath} color="#ffb060" opacity={0.35} dashArray="6,4" width={1.5} />
            </>
          )}

          {/* Hit point marker */}
          {sim.hitPoint && (
            <g filter="url(#glow)">
              <circle cx={sim.hitPoint.x} cy={sim.hitPoint.y} r="4" fill="none" stroke="#ff6060" strokeWidth="1.5" opacity="0.6" />
              <circle cx={sim.hitPoint.x} cy={sim.hitPoint.y} r="1.5" fill="#ff6060" opacity="0.6" />
            </g>
          )}

          {/* Impact angles */}
          {!isAnimating && (
            <ImpactAngles cuePath={sim.cuePath} targetPath={sim.targetPath} tableW={TABLE_W} tableH={TABLE_H} />
          )}

          {/* Ghost balls (final resting positions) */}
          {!isAnimating && sim.cuePath.length > 1 && (
            <circle cx={sim.cuePath[sim.cuePath.length - 1].x} cy={sim.cuePath[sim.cuePath.length - 1].y}
              r={ballR} fill="none" stroke="#a0d4ff" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          )}
          {!isAnimating && sim.targetPath.length > 1 && (
            <circle cx={sim.targetPath[sim.targetPath.length - 1].x} cy={sim.targetPath[sim.targetPath.length - 1].y}
              r={ballR} fill="none" stroke="#ffd080" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          )}

          {/* Aim line from cue ball */}
          {!isAnimating && (
            <line
              x1={cueBall.x} y1={cueBall.y}
              x2={cueBall.x + Math.cos(shotAngle * Math.PI / 180) * 600}
              y2={cueBall.y + Math.sin(shotAngle * Math.PI / 180) * 600}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,6"
            />
          )}

          {/* Cue stick */}
          {!isAnimating && (() => {
            const rad = (shotAngle * Math.PI) / 180;
            const startDist = ballR + 6 + (10 - power) * 2;
            const sx = cueBall.x - Math.cos(rad) * startDist;
            const sy = cueBall.y - Math.sin(rad) * startDist;
            const ex = cueBall.x - Math.cos(rad) * (startDist + 120);
            const ey = cueBall.y - Math.sin(rad) * (startDist + 120);
            return (
              <g>
                <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#c8a050" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
                <line x1={sx} y1={sy} x2={sx - Math.cos(rad) * 14} y2={sy - Math.sin(rad) * 14} stroke="#f0e8d8" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
              </g>
            );
          })()}

          {/* Target ball */}
          {(() => {
            const bx = isAnimating && targetAnimPos ? targetAnimPos.x : targetBall.x;
            const by = isAnimating && targetAnimPos ? targetAnimPos.y : targetBall.y;
            const rot = isAnimating ? targetRotation : 0;
            return (
              <g
                style={{ cursor: isAnimating ? "default" : "grab" }}
                onMouseDown={(e) => !isAnimating && handlePointerDown(e, "target")}
                onTouchStart={(e) => !isAnimating && handlePointerDown(e, "target")}
              >
                <circle cx={bx} cy={by} r={ballR} filter="url(#ballShadow)" fill="#b89818" />
                <clipPath id="targetClip">
                  <circle cx={bx} cy={by} r={ballR - 0.3} />
                </clipPath>
                <g clipPath="url(#targetClip)">
                  {/* Base yellow */}
                  <circle cx={bx} cy={by} r={ballR} fill="#e8c020" />
                  {/* Rotating stripe group */}
                  <g transform={`rotate(${rot}, ${bx}, ${by})`}>
                    <rect x={bx - ballR - 1} y={by - ballR * 0.35} width={ballR * 2 + 2} height={ballR * 0.7} fill="white" />
                    <circle cx={bx} cy={by} r={ballR * 0.5} fill="white" />
                    <text x={bx} y={by + ballR * 0.12} textAnchor="middle" fontSize={ballR * 0.7} fontWeight="bold" fill="#1a1a1a"
                      style={{ userSelect: "none" }}>9</text>
                  </g>
                  {/* Highlight */}
                  <circle cx={bx - ballR * 0.25} cy={by - ballR * 0.25} r={ballR * 0.35} fill="rgba(255,255,255,0.3)" />
                </g>
                <circle cx={bx} cy={by} r={ballR} fill="none" stroke="#b89818" strokeWidth="0.5" />
              </g>
            );
          })()}

          {/* Cue ball */}
          {(() => {
            const bx = isAnimating && cueAnimPos ? cueAnimPos.x : cueBall.x;
            const by = isAnimating && cueAnimPos ? cueAnimPos.y : cueBall.y;
            const rot = isAnimating ? cueRotation : 0;
            return (
              <g
                style={{ cursor: isAnimating ? "default" : "grab" }}
                onMouseDown={(e) => !isAnimating && handlePointerDown(e, "cue")}
                onTouchStart={(e) => !isAnimating && handlePointerDown(e, "cue")}
              >
                <circle cx={bx} cy={by} r={ballR} filter="url(#ballShadow)" fill="#d8d0c4" />
                <clipPath id="cueClip">
                  <circle cx={bx} cy={by} r={ballR - 0.3} />
                </clipPath>
                <g clipPath="url(#cueClip)">
                  <circle cx={bx} cy={by} r={ballR} fill="url(#cueBallGrad)" />
                  {/* Rolling indicator — subtle dot that rotates */}
                  <g transform={`rotate(${rot}, ${bx}, ${by})`}>
                    <circle cx={bx} cy={by - ballR * 0.5} r={ballR * 0.15} fill="rgba(180,170,155,0.35)" />
                    <circle cx={bx + ballR * 0.4} cy={by + ballR * 0.3} r={ballR * 0.1} fill="rgba(180,170,155,0.2)" />
                  </g>
                  {/* Highlight */}
                  <circle cx={bx - ballR * 0.25} cy={by - ballR * 0.25} r={ballR * 0.35} fill="rgba(255,255,255,0.45)" />
                </g>
                <circle cx={bx} cy={by} r={ballR} fill="none" stroke="#ccc" strokeWidth="0.3" />
              </g>
            );
          })()}
          <defs>
            <radialGradient id="cueBallGrad" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f0ece4" />
              <stop offset="100%" stopColor="#d8d0c4" />
            </radialGradient>
          </defs>

          {/* Aim handle */}
          {!isAnimating && (() => {
            const rad = (shotAngle * Math.PI) / 180;
            const hx = cueBall.x + Math.cos(rad) * 50;
            const hy = cueBall.y + Math.sin(rad) * 50;
            return (
              <g
                style={{ cursor: "crosshair" }}
                onMouseDown={handleAimDown}
                onTouchStart={handleAimDown}
              >
                <circle cx={hx} cy={hy} r="8" fill="rgba(96,184,255,0.15)" stroke="#60b8ff" strokeWidth="1" />
                <circle cx={hx} cy={hy} r="2" fill="#60b8ff" />
              </g>
            );
          })()}

          {/* Pocket indicators */}
          {sim.cuePocketed && (
            <text x={TABLE_W / 2} y={TABLE_H / 2 - 20} textAnchor="middle" fill="#ff6060" fontSize="13" fontWeight="bold" opacity="0.8" style={{ fontFamily: "var(--ff-body)" }}>SCRATCH!</text>
          )}
          {sim.targetPocketed && (
            <text x={TABLE_W / 2} y={TABLE_H / 2 + 5} textAnchor="middle" fill="#60ff80" fontSize="13" fontWeight="bold" opacity="0.8" style={{ fontFamily: "var(--ff-body)" }}>POCKETED!</text>
          )}
        </svg>
      </div>

      {/* Controls — pinned to bottom */}
      <div className={mobileLandscape ? "mobile-sidebar" : undefined} style={{
        display: "flex",
        flexDirection: mobileLandscape ? "column" : "row",
        flexWrap: mobileLandscape ? "nowrap" : "wrap",
        gap: mobileLandscape ? 10 : 16,
        justifyContent: mobileLandscape ? "flex-start" : "center",
        alignItems: mobileLandscape ? "center" : undefined,
        padding: mobileLandscape ? "8px" : "10px 16px 12px",
        flexShrink: 0,
        width: mobileLandscape ? 170 : undefined,
        order: mobileLandscape ? -1 : undefined,
        overflowY: mobileLandscape ? "auto" : undefined,
        borderTop: mobileLandscape ? "none" : "1px solid rgba(255,255,255,0.06)",
        borderRight: mobileLandscape ? "1px solid rgba(255,255,255,0.06)" : "none",
        background: mobileLandscape
          ? "linear-gradient(to right, rgba(20,18,16,0.95), rgba(15,13,10,0.98))"
          : "linear-gradient(to bottom, rgba(20,18,16,0.95), rgba(15,13,10,0.98))",
      }}>
        {/* Spin control */}
        <SpinSelector spin={spin} onChange={setSpin} onReset={() => setSpin({ x: 0, y: 0 })} />

        {/* Felt quality selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, order: mobileLandscape ? 3 : undefined }}>
          <span style={{ fontSize: 11, color: "#b8a88a", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "var(--ff-body)" }}>
            Table Felt
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.entries(FELT_QUALITY).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFeltQuality(key)}
                style={{
                  background: feltQuality === key
                    ? `linear-gradient(135deg, ${cfg.feltColor1}, ${cfg.feltColor2})`
                    : "rgba(255,255,255,0.04)",
                  color: feltQuality === key ? "#e8f0e8" : "#6a5a40",
                  border: feltQuality === key ? `2px solid ${cfg.cushionColor}` : "1px solid #3a3020",
                  borderRadius: 8, padding: "8px 14px",
                  fontFamily: "var(--ff-body)", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", letterSpacing: 0.5,
                  transition: "all 0.2s",
                  boxShadow: feltQuality === key ? `0 2px 10px ${cfg.feltColor2}60` : "none",
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
          {!mobileLandscape && <span style={{ fontSize: 10, color: "#6a5a40", fontFamily: "var(--ff-body)", textAlign: "center", maxWidth: 150, lineHeight: 1.4 }}>
            {felt.desc}
          </span>}
        </div>

        {/* Table size selector */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, order: mobileLandscape ? 4 : undefined }}>
          <span style={{ fontSize: 11, color: "#b8a88a", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "var(--ff-body)" }}>
            Table Size
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.entries(TABLE_SIZES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => handleTableSizeChange(key)}
                style={{
                  background: tableSize === key ? "linear-gradient(135deg, #c8a050, #a08030)" : "rgba(255,255,255,0.04)",
                  color: tableSize === key ? "#1a1510" : "#6a5a40",
                  border: tableSize === key ? "2px solid #c8a050" : "1px solid #3a3020",
                  borderRadius: 8, padding: "8px 14px",
                  fontFamily: "var(--ff-body)", fontWeight: 600, fontSize: 13,
                  cursor: "pointer", letterSpacing: 0.5,
                  transition: "all 0.2s",
                  boxShadow: tableSize === key ? "0 2px 10px rgba(200,160,80,0.25)" : "none",
                }}
              >
                {cfg.label}
              </button>
            ))}
          </div>
          {!mobileLandscape && <span style={{ fontSize: 10, color: "#6a5a40", fontFamily: "var(--ff-body)", textAlign: "center", maxWidth: 150, lineHeight: 1.4 }}>
            {TABLE_SIZES[tableSize].desc}
          </span>}
        </div>

        {/* Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: mobileLandscape ? 8 : 14, flex: mobileLandscape ? "none" : "1 1 200px", minWidth: mobileLandscape ? 0 : 180, width: mobileLandscape ? "100%" : undefined, order: mobileLandscape ? 2 : undefined }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <label style={{ fontSize: 11, color: "#b8a88a", letterSpacing: 1.5, textTransform: "uppercase" }}>Shot Power</label>
                <span onClick={() => setPower(5)} style={{ fontSize: 10, color: power !== 5 ? "#c8a050" : "#4a3a20", cursor: power !== 5 ? "pointer" : "default", textDecoration: "underline", textUnderlineOffset: 2 }}>reset</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e8d5a8" }}>{power.toFixed(1)}</span>
            </div>
            <input
              type="range" min="0.5" max="10" step="0.1" value={power}
              onChange={(e) => setPower(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#c8a050" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6a5a40", marginTop: 2 }}>
              <span>Soft</span><span>Hard</span>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <label style={{ fontSize: 11, color: "#b8a88a", letterSpacing: 1.5, textTransform: "uppercase" }}>Aim Adjust</label>
                <span onClick={() => setAngle(0)} style={{ fontSize: 10, color: angle !== 0 ? "#c8a050" : "#4a3a20", cursor: angle !== 0 ? "pointer" : "default", textDecoration: "underline", textUnderlineOffset: 2 }}>reset</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#e8d5a8" }}>{angle > 0 ? "+" : ""}{angle.toFixed(1)}°</span>
            </div>
            <input
              type="range" min="-180" max="180" step="0.5" value={Math.max(-180, Math.min(180, angle))}
              onChange={(e) => setAngle(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "#c8a050" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6a5a40", marginTop: 2 }}>
              <span>-180°</span><span>Direct</span><span>+180°</span>
            </div>
          </div>
        </div>

        {/* Actions & info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", order: mobileLandscape ? 1 : undefined }}>
          <button
            onClick={animate}
            disabled={isAnimating}
            style={{
              background: isAnimating ? "#3a3020" : "linear-gradient(135deg, #c8a050, #a08030)",
              color: isAnimating ? "#6a5a40" : "#1a1510",
              border: "none", borderRadius: 10, padding: "12px 28px",
              fontFamily: "var(--ff-body)", fontWeight: 600, fontSize: 14,
              cursor: isAnimating ? "not-allowed" : "pointer",
              letterSpacing: 1, textTransform: "uppercase",
              boxShadow: isAnimating ? "none" : "0 4px 16px rgba(200,160,80,0.3)",
              transition: "all 0.2s",
            }}
          >
            {isAnimating ? "Shooting..." : "Shoot"}
          </button>
          <button
            onClick={() => { setAngle(0); setSpin({ x: 0, y: 0 }); setPower(5); setCueBall({ x: TABLE_W * 0.31, y: TABLE_H / 2 }); setTargetBall({ x: TABLE_W * 0.67, y: TABLE_H / 2 }); }}
            style={{
              background: "transparent", color: "#8a7a60",
              border: "1px solid #3a3020", borderRadius: 8, padding: "6px 16px",
              fontFamily: "var(--ff-body)", fontSize: 11, cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase",
            }}
          >
            Reset Controls
          </button>
          {!mobileLandscape && <div style={{ fontSize: 10, color: "#6a5a40", textAlign: "center", lineHeight: 1.5, marginTop: 4 }}>
            Drag balls to reposition<br />
            Drag blue aim handle to adjust angle
          </div>}
        </div>
      </div>
      {/* Performance overlay */}
      <div style={{
        position: "fixed", bottom: 8, right: 8,
        background: "rgba(0,0,0,0.75)", borderRadius: 6,
        padding: "6px 10px", fontSize: 11, fontFamily: "monospace",
        color: "#8f8", lineHeight: 1.6, pointerEvents: "none", zIndex: 9999,
      }}>
        <div>sim: {perfStats.simMs.toFixed(1)}ms</div>
        {isAnimating && <div>fps: {perfStats.fps} ({perfStats.frameMs}ms)</div>}
      </div>
    </div>
  );
}