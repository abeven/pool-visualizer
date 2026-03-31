# Billiard Shot Lab

Interactive pool/billiards shot simulator and trajectory visualizer.

## Stack

- React 19 + Vite 7 (no TypeScript, no CSS files)
- UI/rendering in `src/App.jsx` (~980 lines), physics engine in `src/physics/` (~1285 lines)
- All styling is inline (no CSS framework, no styled-components)
- SVG-based rendering (not Canvas)
- PWA via `vite-plugin-pwa` with auto-update (PNG icons required for mobile install)
- Deployed to Surge: `pool-visualizer.surge.sh`

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build to `dist/`
- `npm run deploy` — build + deploy to Surge
- `npx vitest run` — run physics + rendering tests

## Architecture

Rendering lives in `src/App.jsx`. Physics lives in `src/physics/`. No routing, no state management library.

### App.jsx (top to bottom)

1. **Constants** — `TABLE_SIZES`, `RAIL`, `BALL_R`, `POCKET_R` (pixel-space layout constants)
2. **`SpinSelector`** — draggable circular pad component for cue tip position
3. **`PathGlow`** — SVG path renderer with glow effect
4. **`deflAt` / `findImpacts`** — detect direction changes in trajectory paths, identify cushion vs ball-ball impacts by proximity to rails, find the peak deflection point in each cluster
5. **`svgArc` / `normAngle` / `ImpactAngles`** — angle visualization at impact points. Cushion hits show two angles measured from the rail surface (incoming and outgoing). Ball-ball hits show a single deflection angle.
6. **`FELT_QUALITY`** — config object for Pro/Nice/Dive felt presets (colors for rendering; physics friction is in `src/physics/constants.js`)
7. **`PoolVisualizer`** — main component with all state, event handlers, animation loop, and render

`simulateShot()` is imported from `src/physics/index.js`. It returns `{ cuePath, targetPath, hitPoint, cuePocketed, targetPocketed }` in pixel coordinates, same interface the renderer expects.

### Physics engine (`src/physics/`)

Event-based simulation ported from [pooltool](https://github.com/ekiefl/pooltool) (MIT). Runs in SI units internally, converts to/from pixel coords at the boundary.

| File | Purpose |
|------|---------|
| `constants.js` | Motion states (stationary/spinning/sliding/rolling/pocketed), physical params, felt presets with real friction coefficients, event types |
| `utils.js` | 3D vector math, surface velocity, quadratic/cubic/quartic polynomial solvers |
| `evolve.js` | Analytical equations of motion per state (Coulomb friction), transition time calculations, motion coefficients for event detection |
| `collisions.js` | Ball-ball (quartic detection, impulse+throw resolution), ball-cushion (quadratic detection, simplified Han 2005), ball-pocket (quartic), cue strike model |
| `engine.js` | Event-based loop: predict next event analytically → evolve all balls → resolve → repeat. Also builds table geometry (cushion segments, pockets). Includes fallback pocket detection after each evolution step. |
| `index.js` | Public API: `simulateShot()` with pixel↔SI conversion, trajectory sampling from event snapshots |

Key physics concepts:
- **5 ball states**: stationary, spinning, sliding, rolling, pocketed — each with different equations of motion
- **Sliding→rolling transition**: friction brings relative surface velocity to zero; this is what makes draw/follow/english work
- **Full 3-axis angular velocity** (ωx, ωy, ωz) — not just a normalized spin input
- **Event-based**: no fixed timestep; analytically solves for next collision/transition time via polynomial root-finding
- **Felt presets** map to real physical coefficients (μ_s, μ_r, e_c, f_c) in `FELT_PHYSICS`

Known limitations:
- Quartic solver (Ferrari's method) can produce spurious roots — mitigated by polynomial evaluation verification in `smallestPositiveRoot()`. Missed pocket collisions are caught by a fallback position check in the event loop.
- Only 2 balls (cue + target); multi-ball requires extending `engine.js` loop (already N-ball capable) and rendering
- Cushion model is simplified Han 2005 (reflection + friction), not full compression/restitution
- No masse/jump shots (no airborne state)

### Rendering

- SVG with `viewBox` matching table dimensions (e.g. 700×380 for 8ft)
- Table scales responsively via `width: 100%` on the SVG
- Balls rendered with gradients, clip paths, and rotation animation
- Trajectory shown as dashed paths (blue for cue, orange for target)
- Frame-based animation using `requestAnimationFrame` at 8ms per path sample
- Impact angles shown at cushion and ball-ball collision points

### Controls

- **Table Size** — 7ft/8ft/9ft (resets ball positions on change)
- **Felt Quality** — Pro/Nice/Dive (affects physics + table appearance)
- **Spin Selector** — circular drag pad, normalized x/y coordinates
- **Shot Power** — slider 0.5–10 (default 5)
- **Aim Adjust** — slider -45° to +45° relative to auto-aim angle
- Each control has an always-visible "reset" link (dimmed when at default)
- "Reset Controls" button resets everything including ball positions

## Style guide

- Dark theme with gold/amber accents (#c8a050, #e8d5a8)
- Fonts: Playfair Display (headings), DM Sans (body) — loaded via Google Fonts link in JSX
- CSS custom properties: `--ff-display`, `--ff-body`
- All styles are inline objects — keep it that way, don't introduce CSS files
