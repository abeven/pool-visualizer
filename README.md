# Billiard Shot Lab

Interactive pool/billiards shot simulator with real physics. Drag balls into position, adjust spin and power, and watch the trajectory play out — complete with cushion bounces, throw, and english effects.

**[Try it live](https://pool-visualizer.surge.sh)**

## Features

- **Real physics** — event-based simulation with Coulomb friction, sliding/rolling/spinning states, and full 3-axis angular velocity. Ported from [pooltool](https://github.com/ekiefl/pooltool).
- **Spin control** — apply top, back, left, and right english via a draggable cue tip pad. See how spin changes the cue ball's path after contact.
- **Angle visualization** — incoming and outgoing cushion angles shown relative to the rail surface. Ball-ball collisions show the deflection angle.
- **Table sizes** — 7ft, 8ft, and 9ft tables with correct proportions.
- **Felt presets** — Pro, Nice, and Dive bar cloth, each mapping to real friction coefficients.
- **Shot animation** — watch both balls roll out in real time with trajectory traces.
- **Installable PWA** — works offline, add to home screen on mobile.

## Getting started

```
npm install
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build to `dist/` |
| `npm run deploy` | Build + deploy to Surge |
| `npm test` | Run physics and rendering tests |

## How it works

The physics engine (`src/physics/`) runs an event-based simulation in SI units. Instead of stepping through fixed time intervals, it analytically solves for the next event — a ball-ball collision, a cushion bounce, a state transition (sliding to rolling), or a pocket. This gives exact results regardless of ball speed.

The renderer (`src/App.jsx`) is pure SVG — no canvas, no WebGL. Balls are drawn with gradients and clip paths, and trajectories are animated using `requestAnimationFrame`.

## Tech stack

React 19, Vite 7, SVG, inline styles. No TypeScript, no CSS files, no state management library.

## License

MIT
