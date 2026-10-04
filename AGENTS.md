# AGENTS.md — Lilis Game Engine

## Overview

Lilis is a modern, modular game engine for the web. It fuses web development and game development by treating **entities as observable objects** and **systems as plugins**. Physics, rendering, and game logic are all plugins that communicate exclusively through entity properties — none of them import each other.

The engine is built on **Jabr** (its own framework-agnostic signals & stores library), leans **functional rather than object-oriented**, and uses a **scene-graph entity model** (not strict ECS — entities are real objects with identity and lifecycle; logic is external).

Key facts:
- **Package:** `lilis-engine` (npm)
- **Source entry:** `src/index.js`
- **License:** ESMIT (environmentally-friendly MIT variant)
- **CLI:** `lilis-engine` binary → `cli/index.js`
- **Docs:** https://engine.webslc.com/docs
- **Demos:** https://engine.webslc.com/demos

---

## Project Map

```
lilis-engine/
├── src/                    # Engine source
│   ├── index.js            # Main entry point
│   ├── createEntity.js     # Entity factory (Jabr Store)
│   ├── createEntityList.js # EntityList factory (Jabr Signal)
│   ├── createGameCore.js   # Plugin orchestrator
│   ├── createGameLoop.js   # Game loop plugin
│   ├── createCamera.js     # Camera system
│   ├── createLevelLoader.js
│   ├── canvasManager.js
│   ├── formats/            # Data format definitions (Entity format, etc.)
│   ├── plugins/            # Official plugins
│   │   ├── matter.js       # Matter.js physics integration
│   │   ├── p5.js           # p5.js renderer
│   │   ├── pixi.js         # PixiJS renderer
│   │   ├── solid.js        # SolidJS DOM renderer
│   │   ├── pixi-tiled.js   # Tiled map loader for Pixi
│   │   ├── pixi-tiled-to-matter.js
│   │   ├── music-player.js
│   │   └── resize-observer.js
│   └── utility/            # Utility functions
│       ├── detectKeys.js
│       ├── screenToWorldPosition.js
│       ├── worldToScreenPosition.js
│       ├── createCountdown.js
│       └── ...
├── cli/                    # CLI tool
│   └── index.js            # Scaffolding, demo listing, project creation
├── demos/                  # Example projects
│   ├── vite-minimalist/    # Minimal Vite demo (no Astro/Solid)
│   ├── astro-solid-basic/
│   ├── level-loader-demo/
│   ├── pong/               # p5 + Matter
│   ├── sidescroller/       # Pixi + Matter + Solid
│   ├── topdown/            # Tiled + Matter + Solid
│   ├── solid-physics/      # DOM elements as physics bodies
│   ├── orbital-shapes/
│   └── ...
├── tests/                  # Mocha tests
│   ├── createEntity.js
│   ├── createEntityList.js
│   └── import-test.js
├── site/                   # Astro documentation website
└── package.json
```

---

## Build & Test Commands

| Command | What it does |
|---|---|
| `npm test` | Run all Mocha tests (`mocha "tests/**/*.js"`) |
| `npm run prepublishOnly` | Runs tests before publishing (automatic) |
| `npm install -g lilis-engine` | Install the CLI globally |
| `lilis-engine create` | List available demos |
| `lilis-engine info <demo>` | Show demo details |
| `lilis-engine create <demo> <project-name>` | Scaffold a demo into a new project |

**Demos use Vite or Astro.** Each demo has its own `package.json` with a `build` script and a `demoOutputDir` field (defaults to `dist`). The deploy workflow discovers demos automatically.

---

## Architecture Rules (Critical)

### 1. Entities are Jabr Stores

```js
Entity({ x: 0, y: 0, width: 5, height: 5, imageURL: '/player.png' })
```

An Entity is a `Store` — you can read/write properties directly, attach listeners, and receive changes. **Any property you put on an entity is fair game for plugins to read and write.**

### 2. EntityLists are Jabr Signals

```js
const entities = EntityList([])          // Create
entities.addChild(Entity({ x: 0, y: 0 })) // Add
entities.get()                            // Read current array
entities.set([...])                       // Replace array
```

`EntityList` also has `.addChild`, `.removeChild`, `.hasChild`. Nested entities are supported via `.children`.

### 3. Plugins are the ONLY way to add behavior

A plugin is a plain object with optional `tick`, `render`, `mount`, and `unmount` methods:

```js
const myPlugin = {
  tick: ({ delta }) => { /* runs every frame */ },
  render: () => { /* runs after tick */ },
  tickPriority: 100,   // Higher = later execution (default 0)
  renderPriority: 0,
  mount: async () => { /* called when gameCore.mount() runs */ },
  unmount: async () => { /* called when gameCore.unmount() runs */ },
}
```

Plugins are passed to `createGameCore({ plugins: [...] })`. **They are sorted by priority and executed in order.** Plugins never import each other.

### 4. The Game Loop is itself a plugin

`createGameLoop()` must be in the plugin list. It calls every plugin's `tick` and `render` each frame in priority order.

### 5. Entity properties drive everything

- Physics plugin reads `entity.matter` and writes `entity.x`, `entity.y`, `entity.rotation`
- P5 renderer reads `entity.shape`, `entity.fill`, `entity.render` and draws
- Solid renderer reads `entity.solid` and renders a DOM component
- Custom plugins read/write whatever properties they need

**The shared contract is the entity's property schema — not imports between plugins.**

---

## Virtual Coordinate Space

- **Origin (0,0)** is always center-screen.
- **Negative** = top (y) and left (x); **positive** = down and right.
- Typical range: **−50 to +50** on each axis.
- Entity coordinates represent the entity's **center**.
- Never position things in screen pixels — use the virtual space.

---

## Plugin Development Conventions

### Follow the existing pattern

Look at `src/plugins/matter.js` and `src/plugins/p5.js` for reference.

- **Reactive, not polling.** Use Jabr listeners (`entity.on('x', handler)`) rather than reading entity properties every frame. The engine is designed to run code *only when values change*.
- **Respect re-entrancy.** When writing back to entities from a physics step, guard against feedback loops (see `isDoingPhysicsUpdate` in `matter.js`).
- **Queue events.** Collision events are queued and flushed after the physics step to avoid mutating during iteration.
- **Lifecycle matters.** `mount` and `unmount` must be symmetric — clean up listeners, remove bodies, null references.

### Adding a new plugin

1. Create `src/plugins/your-plugin.js`
2. Export a factory function (e.g., `createYourPlugin(entities, settings)`)
3. Return an object with at least a `tick` method
4. Add the export to `package.json` under `"exports"` (e.g., `"./your-plugin": "./src/plugins/your-plugin.js"`)

---

## Code Style

- **ES modules** (`import`/`export`), `"type": "module"` in package.json
- **Functional style** — prefer pure functions, external systems, declarative composition
- **Jabr Stores and Signals** for all reactive state
- **No TypeScript** — plain JavaScript with JSDoc where helpful
- **No class inheritance** — use factory functions and composition
- **2-space indentation**
- **Semicolons optional** — the codebase is inconsistent; match the file you're editing

### Naming

- Factories: `createThing` → `createGameCore`, `createEntity`, `createMatterPlugin`
- Plugins: `thingPlugin` or `createThingPlugin`
- Entity properties: lowercase camelCase (`imageURL`, `renderPriority`, `noMatterRender`)

---

## Testing

- **Framework:** Mocha + Chai
- **Location:** `tests/`
- **Run:** `npm test`
- Tests cover core entity/entity-list behavior and import integrity.
- **When adding a plugin or core feature, add tests.** There is no TypeScript to catch type errors — tests are the safety net.

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Plugin imports another plugin | Use entity properties as the interface. Plugins communicate through entities, not imports. |
| Reading entity properties every frame | Use `entity.on('property', handler)` — Jabr fires listeners only on change. |
| Forgetting to clean up in `unmount` | Remove listeners with `entity.off(...)`, null out references, remove bodies. |
| Writing to an entity during a physics step | Guard with a flag (see `isDoingPhysicsUpdate` in matter.js) or queue the write. |
| Using screen pixels for positions | Use the virtual coordinate space (−50 to +50). |
| Adding a plugin without registering it | Add the export to `package.json` `"exports"`. |
| Hardcoding `50` for world bounds | Use `height / 2` (there was a known bug in `createMatterBoundaries` where bottom used a literal `50`). |

---

## Demo Conventions

Demos live in `demos/`. Each demo:

- Has its own `package.json`
- Declares `"demoOutputDir"` (defaults to `"dist"`; `"."` means the demo dir is the site root)
- Has a `"build"` script (if it needs building) — the deploy workflow trusts this script
- Reads `DEMO_BASE_PATH` env var in its build script if it needs a Vite base path:
  ```json
  { "build": "vite build --base=$DEMO_BASE_PATH" }
  ```
- Uses `vite` for minimal demos, `astro` for full-featured demos
- Uses `lilis-engine` as a dependency (CI installs `lilis-engine@latest`)

**Adding a new demo:** create `demos/your-demo/` with a `package.json` — the deploy workflow discovers it automatically.

---

## Git & PR Conventions

- **Branch:** `master` is the deploy branch.
- **Deploy trigger:** pushes to `master` that touch `demos/**`, `site/**`, `package.json`, or `package-lock.json`.
- **Commit style:** descriptive, lowercase, imperative (e.g., "fix a bug in the demo", "update to new level loader syntax").
- **PR checklist:**
  - `npm test` passes
  - Demo builds locally (`cd demos/your-demo && npm run build`)
  - No `node_modules/` or `dist/` committed
  - If adding a plugin, it's exported in `package.json`

---

## Boundaries

**Always do:**
- Run `npm test` before committing
- Use Jabr Stores/Signals for reactive state
- Keep plugins decoupled — communicate through entities
- Use the virtual coordinate space
- Add tests for new core functionality

**Ask first:**
- Changing the core entity schema (affects all plugins)
- Adding a new runtime dependency
- Modifying the deploy workflow
- Changing the virtual coordinate space range

**Never do:**
- Import one plugin from another
- Use OOP class hierarchies
- Position entities in screen pixels
- Hardcode world dimensions
- Commit `node_modules/`, `dist/`, or `.astro/`
- Add TypeScript to the core engine

---

## CLI Reference

```bash
# Install globally
npm install -g lilis-engine

# List all available demos
lilis-engine create

# Get info about a specific demo
lilis-engine info topdown

# Scaffold a demo into a new project
lilis-engine create topdown my-zelda-game
```

The CLI downloads demos from the GitHub `master` branch and caches them in the system temp directory (TTL: 60 minutes).

---

## Dependencies

| Package | Purpose | Required? |
|---|---|---|
| `jabr` | Signals & Stores (state management) | Core |
| `yargs` | CLI argument parsing | Core |
| `matter-js` | 2D physics | Optional |
| `p5` | Procedural rendering | Optional |
| `pixi.js` | GPU-accelerated 2D rendering | Optional |
| `solid-js` | Interactive HTML UI | Optional |
| `pixi-tiledmap` | Tiled map support for Pixi | Optional |
| `poly-decomp` | Convex decomposition for Matter | Optional |

**Optional dependencies** are only installed if the user needs the corresponding plugin. The core engine (entities, entity lists, game core, game loop) has no rendering or physics dependencies.

---

## Quick Reference

```js
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  Camera,
} from 'lilis-engine'

const entities = EntityList([])
entities.addChild(Entity({ x: 0, y: 0, width: 10, height: 10 }))

const gameCore = createGameCore({
  plugins: [createGameLoop()],
})
await gameCore.mount()
// gameCore.unmount() to tear down
```

Plugin signature: `{ tick, render, mount, unmount, tickPriority, renderPriority }`

Entity = `Store` (observable) · EntityList = `Signal` (observable array)

Virtual space: −50 to +50, center at (0,0).

---

*This file follows the [AGENTS.md](https://agents.md) open format. It is plain Markdown — no required fields, H2 sections, machine-parsable.*