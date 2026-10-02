import { onMount, onCleanup, createSignal } from "solid-js"
import { isServer } from 'solid-js/web'
import { createGameCore, Entity, EntityList, RenderSettings, createGameLoop, Camera } from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import createSolidRenderer from 'lilis-engine/solid'
import '@/styles/Game.scss'
import createMatterPlugin from 'lilis-engine/matter'
import Matter from 'matter-js'
import MatterAttractors from 'matter-attractors'
const { Body, Common, Mouse, Composite } = Matter

// Inspiration
// This demo is adapted from matter-attractor's "basic" demo.
// It can be seen at: https://liabru.github.io/matter-attractors/#basic

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

// Cursor pull. The mass exponent controls how size-dependent the pull feels:
//   0.0 -> constant force (tiny bodies accelerate wildly)  — the original demo
//   0.5 -> sqrt scaling (small bodies noticeably livelier)  — what we use
//   1.0 -> uniform acceleration (all bodies arrive together) — boring, and janky
const ATTRACTOR_FORCE = 6e-7
const ATTRACTOR_MASS_EXPONENT = 0.5
const ATTRACTOR_RADIUS = 5

// Inter-body repulsion. Short-range, soft, fades to zero at REPULSION_RADIUS.
// Gives the cluster a natural size so bodies don't collapse onto the cursor.
const REPULSION_FORCE = 6e-6
const REPULSION_RADIUS = 3

// Anti-tunneling cap. Prevent any single step from moving a body further than
// it could plausibly resolve a collision in.
const MAX_SPEED = 12

// ---------------------------------------------------------------------------
// Attractor functions
// ---------------------------------------------------------------------------

// Pulls bodyB toward the cursor. Force scales with sqrt(mass) so small bodies
// accelerate ~5x more than large ones instead of the ~30x of the raw demo —
// enough variety to be playful, not enough to tunnel.
const cursorAttractor = function (bodyA, bodyB) {
    const dx = bodyA.position.x - bodyB.position.x
    const dy = bodyA.position.y - bodyB.position.y
    const scale = ATTRACTOR_FORCE * Math.pow(bodyB.mass, ATTRACTOR_MASS_EXPONENT)
    return { x: dx * scale, y: dy * scale }
}

// Soft repulsion on bodyB when it gets close to bodyA. The negative sign
// flips the same formula used for attraction, so the direction is away from
// bodyA. Because every polygon carries this attractor, each body pushes every
// other body, and the cluster spreads into a shell around the cursor instead
// of a point.
const repulsionAttractor = function (bodyA, bodyB) {
    const dx = bodyA.position.x - bodyB.position.x
    const dy = bodyA.position.y - bodyB.position.y
    const distSq = dx * dx + dy * dy
    if (distSq > REPULSION_RADIUS * REPULSION_RADIUS) return { x: 0, y: 0 }
    if (distSq < 1e-6) return { x: 0, y: 0 }
    const dist = Math.sqrt(distSq)
    const falloff = 1 - dist / REPULSION_RADIUS // 1 at contact, 0 at the edge
    const scale = -REPULSION_FORCE * falloff
    return { x: dx * scale, y: dy * scale }
}

// ---------------------------------------------------------------------------

export default function Game() {
    const [solidGameContents, setSolidGameContents] = createSignal(null)
    let pixiCanvas
    let unmountGameEngine
    let matterCanvas

    onMount(async () => {
        if (isServer) return

        const pixiRenderSettings = RenderSettings({ canvas: pixiCanvas })
        const matterRenderSettings = RenderSettings({
            canvas: matterCanvas,
            renderOptions: { wireframes: false },
            transparentBackground: true,
            setup: engine => { engine.world.gravity.scale = 0 },
        })

        const scaleCamera = Camera()
        const autoResize = () => {
            const size = Math.min(window.innerWidth, window.innerHeight);
            scaleCamera.width = scaleCamera.height =
                pixiRenderSettings.width = pixiRenderSettings.height =
                matterRenderSettings.width = matterRenderSettings.height = size;
        };
        window.addEventListener("resize", autoResize);
        autoResize();

        const entities = EntityList([])

        entities.addChild(Entity({
            imageURL: 'space-bg.jpg',
            x: 0, y: 0, width: 100, height: 100,
            renderPriority: -100,
        }))

        const cursorShape = entities.addChild(Entity({
            x: 0, y: 0,
            width: ATTRACTOR_RADIUS * 2,
            height: ATTRACTOR_RADIUS * 2,
            imageURL: 'magnet-circle.png',
            noMatterRender: true,
            matter: {
                shape: 'circle',
                static: true,
                plugin: { attractors: [cursorAttractor] },
            },
        }))

        for (let i = 0; i < 150; i += 1) {
            const sides = Common.random(3, 5)
            const radius = Common.random() > 0.9
                ? Common.random(2.5, 4)
                : Common.random(0.75, 1.75)
            entities.addChild(Entity({
                x: Common.random(-50, 50),
                y: Common.random(-50, 50),
                width: radius * 2,
                height: radius * 2,
                matter: {
                    shape: 'polygon',
                    sides,
                    // Repel neighbours. This runs in addition to the cursor's
                    // pull, so bodies orbit/cluster around the cursor without
                    // piling onto the same point.
                    plugin: { attractors: [repulsionAttractor] },
                },
            }))
        }

        const mouse = Mouse.create(matterRenderSettings.canvas)

        const pixiRenderer = createPixiRenderer(entities, pixiRenderSettings)
        const solidRenderer = createSolidRenderer(entities, { solidSetter: setSolidGameContents })
        const matterPhysics = createMatterPlugin(entities, matterRenderSettings)
        matterPhysics.useMatterPlugin(MatterAttractors)

        const mouseControlPlugin = {
            tick: () => {
                const body = cursorShape.matterBody
                if (!body || !isFinite(body.position.x)) return
                const cursorWorldX = scaleCamera.transformX(mouse.position.x) - 50
                const cursorWorldY = scaleCamera.transformY(mouse.position.y) - 50
                Body.translate(body, {
                    x: (cursorWorldX - body.position.x) * 0.25,
                    y: (cursorWorldY - body.position.y) * 0.25,
                })
            },
            tickPriority: 100,
        }

        // Runs after the physics step. Clamps any non-static body whose speed
        // exceeds MAX_SPEED so nothing can tunnel through the cursor.
        const velocityCapPlugin = {
            tick: () => {
                const engine = matterPhysics.engineSignal.get()
                if (!engine) return
                const bodies = Composite.allBodies(engine.world)
                for (let i = 0; i < bodies.length; i++) {
                    const b = bodies[i]
                    if (b.isStatic) continue
                    const vx = b.velocity.x
                    const vy = b.velocity.y
                    const speedSq = vx * vx + vy * vy
                    if (speedSq > MAX_SPEED * MAX_SPEED) {
                        const scale = MAX_SPEED / Math.sqrt(speedSq)
                        Body.setVelocity(b, { x: vx * scale, y: vy * scale })
                    }
                }
            },
            tickPriority: 200,
        }

        const gameCore = createGameCore({
            plugins: [
                createGameLoop(),
                pixiRenderer,
                solidRenderer,
                matterPhysics,
                mouseControlPlugin,
                velocityCapPlugin,
            ],
        })
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })

    onCleanup(async () => {
        if (isServer) return
        await unmountGameEngine()
    })

    return (<div class="game-container">
        <canvas class="pixi-canvas" ref={pixiCanvas} />
        <canvas class="matter-canvas" ref={matterCanvas} />
        {solidGameContents()}
    </div>)
}