import { onMount, onCleanup, createSignal } from "solid-js"
import { isServer } from 'solid-js/web'
import {
  createGameCore,
  Entity,
  EntityList,
  RenderSettings,
  createGameLoop,
  Camera,
} from 'lilis-engine'
import createSolidRenderer from 'lilis-engine/solid'
import createMatterPlugin, { createMatterBoundaries } from 'lilis-engine/matter'
import Matter from 'matter-js'
const { Body } = Matter

const WORLD = 100
const HALF = WORLD / 2

const COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#a06cd5',
  '#00b8a9', '#ff8c42', '#5e60ce', '#f25c54',
  '#06d6a0', '#ef476f', '#118ab2', '#ffd166',
  '#f7b801', '#7678ed', '#3d5a80', '#ee6c4d',
]

const rand = (min, max) => min + Math.random() * (max - min)

function createDraggableBox(getPlayAreaRect, dragState) {
  return function DraggableBox(props) {
    const { entity, camera } = props
    const [dragging, setDragging] = createSignal(false)

    const rotation = () => {
      if (typeof props.getReactiveProp === 'function') {
        const getter = props.getReactiveProp('rotation')
        if (typeof getter === 'function') return getter() || 0
      }
      return entity.rotation || 0
    }

    const handlePointerDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
      setDragging(true)

      // Disable gravity for this body during the drag.
      if (entity.matterBody) entity.matterBody.gravityScale = 0

      // Record the drag target into shared state. The tick plugin in Game
      // steers the body toward it every frame, so a stationary pointer
      // still applies steering (and can't drift).
      const updateTarget = (clientX, clientY) => {
        const rect = getPlayAreaRect()
        if (!rect || !rect.width || !rect.height) return
        const normalizedX =
          ((clientX - rect.left) / rect.width) * WORLD - HALF
        const normalizedY =
          ((clientY - rect.top) / rect.height) * WORLD - HALF
        const worldX = camera && typeof camera.inverseTransformX === 'function'
          ? camera.inverseTransformX(normalizedX)
          : normalizedX
        const worldY = camera && typeof camera.inverseTransformY === 'function'
          ? camera.inverseTransformY(normalizedY)
          : normalizedY
        dragState.entity = entity
        dragState.pointerId = e.pointerId
        dragState.targetX = worldX
        dragState.targetY = worldY
      }

      // Seed immediately so the first frame of steering has a target.
      updateTarget(e.clientX, e.clientY)

      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        updateTarget(ev.clientX, ev.clientY)
      }

      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        setDragging(false)
        if (entity.matterBody) entity.matterBody.gravityScale = 1
        // Only clear if we're still the active drag — another component
        // may have started dragging in the meantime.
        if (dragState.entity === entity) {
          dragState.entity = null
          dragState.pointerId = null
        }
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
        document.removeEventListener('pointercancel', up)
      }

      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
      document.addEventListener('pointercancel', up)
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: entity.color || '#888',
          'border-radius': '6px',
          transform: `rotate(${rotation()}rad)`,
          'box-shadow': dragging()
            ? '0 0 20px rgba(255,255,255,0.9), inset 0 0 12px rgba(255,255,255,0.4)'
            : '0 2px 10px rgba(0,0,0,0.5)',
          cursor: dragging() ? 'grabbing' : 'grab',
          'user-select': 'none',
          'touch-action': 'none',
          'box-sizing': 'border-box',
        }}
        onPointerDown={handlePointerDown}
      />
    )
  }
}

export default function Game() {
  const [solidGameContents, setSolidGameContents] = createSignal(null)
  let playArea
  let unmountGameEngine

  onMount(async () => {
    if (isServer) return

    const camera = Camera()
    camera.width = camera.height = WORLD

    const entities = EntityList([])

    entities.addChild(
      createMatterBoundaries({
        width: WORLD,
        height: WORLD,
        thickness: 2,
        skipBoundaries: ['top'],
      }),
    )

    const getPlayAreaRect = () =>
      playArea ? playArea.getBoundingClientRect() : null

    // Shared drag state. The component writes the target; the tick plugin
    // below reads it and steers the body each frame.
    const dragState = {
      entity: null,
      pointerId: null,
      targetX: 0,
      targetY: 0,
    }

    const DraggableBox = createDraggableBox(getPlayAreaRect, dragState)

    const COUNT = 14
    for (let i = 0; i < COUNT; i++) {
      const size = rand(5, 30)
      const x = rand(-HALF + size / 2 + 2, HALF - size / 2 - 2)
      const y = -HALF - rand(15, 150) - size

      entities.addChild(Entity({
        x, y,
        width: size,
        height: size,
        rotation: 0,
        color: COLORS[i % COLORS.length],
        positionTransform: true,
        noMatterRender: true,
        solid: DraggableBox,
        matter: {
          shape: 'rectangle',
          restitution: 0.15,
          friction: 0.4,
          frictionAir: 0.01,
        },
      }))
    }

    // Steer the dragged body every frame toward the current target.
    // Running this on tick rather than on pointermove means a stationary
    // pointer keeps the box pinned: velocity is refreshed each frame, so
    // friction and collisions can't bleed it away, and because gravity is
    // still off on the body it won't fall.
    const dragPlugin = {
      tick: () => {
        const entity = dragState.entity
        if (!entity) return
        const body = entity.matterBody
        if (!body) {
          // Entity was unmounted mid-drag.
          dragState.entity = null
          dragState.pointerId = null
          return
        }
        Body.setVelocity(body, {
          x: (dragState.targetX - body.position.x) * 0.4,
          y: (dragState.targetY - body.position.y) * 0.4,
        })
      },
      tickPriority: 100,
    }

    const outOfBoundsPlugin = {
      tick: () => {
        for (const entity of entities.get()) {
          if (!entity.matterBody) continue
          if (entity.matter?.static) continue
          const escaped =
            entity.y >  HALF + 100 ||
            entity.y < -HALF - 1000 ||
            entity.x >  HALF + 100 ||
            entity.x < -HALF - 100
          if (escaped) {
            Body.setVelocity(entity.matterBody, { x: 0, y: 0 })
            entity.x = rand(-HALF + entity.width, HALF - entity.width)
            entity.y = -HALF - 20
          }
        }
      },
      tickPriority: 50,
    }

    const solidRenderer = createSolidRenderer(entities, {
      solidSetter: setSolidGameContents,
      camera,
    })

    const matterPhysics = createMatterPlugin(entities, {
      setup: (engine) => {
        engine.gravity.x = 0
        engine.gravity.y = 1
        engine.velocityIterations = 20
      },
    })

    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        solidRenderer,
        matterPhysics,
        dragPlugin,
        outOfBoundsPlugin,
      ],
    })

    await gameCore.mount()
    unmountGameEngine = gameCore.unmount
  })

  onCleanup(async () => {
    if (isServer) return
    if (unmountGameEngine) await unmountGameEngine()
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        background: '#000',
        overflow: 'hidden',
      }}
    >
      <div
        ref={playArea}
        style={{
          position: 'relative',
          width: '100dvmin',
          height: '100dvmin',
          background: '#1a1a2e',
          overflow: 'hidden',
        }}
      >
        {solidGameContents()}
      </div>
    </div>
  )
}