import { onMount, onCleanup, createSignal } from "solid-js"
import { isServer } from 'solid-js/web'
import {
  createGameCore,
  Entity,
  EntityList,
  createGameLoop,
  Camera,
} from 'lilis-engine'
import createSolidRenderer from 'lilis-engine/solid'
import createMatterPlugin, { createMatterBoundaries } from 'lilis-engine/matter'
import Matter from 'matter-js'
import '@/styles/Game.scss'

const { Body } = Matter

const WORLD = 100
const HALF = WORLD / 2

const COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#a06cd5',
  '#00b8a9', '#ff8c42', '#5e60ce', '#f25c54',
  '#06d6a0', '#ef476f', '#118ab2', '#ffd166',
  '#f7b801', '#7678ed', '#3d5a80', '#ee6c4d',
]

const COUNT = 14
const WALL_THICKNESS = 4
const DRAG_STRENGTH = 0.4

const boxMatterOptions = {
  shape: 'rectangle',
  restitution: 0.15,
  friction: 0.04,
  frictionStatic: 0,
  frictionAir: 0.01,
}

const rand = (min, max) => min + Math.random() * (max - min)

function createDraggableBox(getPlayAreaRect, dragState) {
  return function DraggableBox(props) {
    const { entity, camera } = props
    const [dragging, setDragging] = createSignal(false)

    const rotationSignal = typeof props.getReactiveProp === 'function'
      ? props.getReactiveProp('rotation')
      : null
    const rotation = () => {
      if (rotationSignal) return rotationSignal() || 0
      return entity.rotation || 0
    }

    // Translate a client-space pointer position into world coordinates.
    // Shared by pointerdown (to seed the target) and pointermove.
    const pointerToWorld = (clientX, clientY) => {
      const rect = getPlayAreaRect()
      if (!rect || !rect.width || !rect.height) return null

      const normalizedX = ((clientX - rect.left) / rect.width) * WORLD - HALF
      const normalizedY = ((clientY - rect.top) / rect.height) * WORLD - HALF

      const hasInverse =
        camera &&
        typeof camera.inverseTransformX === 'function' &&
        typeof camera.inverseTransformY === 'function'

      if (!hasInverse) return { x: normalizedX, y: normalizedY }
      return {
        x: camera.inverseTransformX(normalizedX),
        y: camera.inverseTransformY(normalizedY),
      }
    }

    const handlePointerDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}

      setDragging(true)
      if (entity.matterBody) entity.matterBody.gravityScale = 0

      const updateTarget = (clientX, clientY) => {
        const world = pointerToWorld(clientX, clientY)
        if (!world) return
        dragState.entity = entity
        dragState.pointerId = e.pointerId
        dragState.targetX = world.x
        dragState.targetY = world.y
      }

      // Seed immediately so the first physics frame has a valid target.
      updateTarget(e.clientX, e.clientY)

      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        updateTarget(ev.clientX, ev.clientY)
      }

      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        setDragging(false)
        if (entity.matterBody) entity.matterBody.gravityScale = 1
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
        class="game-box"
        classList={{ 'game-box--dragging': dragging() }}
        style={{
          background: entity.color || '#888',
          transform: `rotate(${rotation()}rad)`,
        }}
        onPointerDown={handlePointerDown}
      />
    )
  }
}

// Steer the dragged body toward its target every frame, so a stationary
// pointer keeps it pinned (velocity is refreshed each tick, and gravity is
// off on the body).
function createDragPlugin(dragState) {
  return {
    tickPriority: 100,
    tick: () => {
      const entity = dragState.entity
      if (!entity) return
      const body = entity.matterBody
      if (!body) {
        dragState.entity = null
        dragState.pointerId = null
        return
      }
      Body.setVelocity(body, {
        x: (dragState.targetX - body.position.x) * DRAG_STRENGTH,
        y: (dragState.targetY - body.position.y) * DRAG_STRENGTH,
      })
    },
  }
}

// Force every dynamic body upright after the physics step. When the lock
// is off, this becomes a no-op.
function createRotationLockPlugin(entities, rotationLocked) {
  return {
    tickPriority: 200,
    tick: () => {
      if (!rotationLocked()) return
      for (const entity of entities.get()) {
        const body = entity.matterBody
        if (!body || entity.matter?.static) continue
        if (body.angle !== 0) Body.setAngle(body, 0)
        if (body.angularVelocity !== 0) Body.setAngularVelocity(body, 0)
      }
    },
  }
}

// Catch bodies that tunnel or get ejected, and drop them back in from the
// top with clean velocity.
function createOutOfBoundsPlugin(entities) {
  return {
    tickPriority: 50,
    tick: () => {
      for (const entity of entities.get()) {
        if (!entity.matterBody) continue
        if (entity.matter?.static) continue

        const escaped =
          entity.y >  HALF + 100 ||
          entity.y < -HALF - 1000 ||
          entity.x >  HALF + 100 ||
          entity.x < -HALF - 100
        if (!escaped) continue

        const body = entity.matterBody
        Body.setVelocity(body, { x: 0, y: 0 })
        Body.setAngularVelocity(body, 0)
        Body.setAngle(body, 0)
        entity.x = rand(-HALF + entity.width, HALF - entity.width)
        entity.y = -HALF - 20
        entity.rotation = 0
      }
    },
  }
}

export default function Game() {
  const [solidGameContents, setSolidGameContents] = createSignal(null)
  const [rotationLocked, setRotationLocked] = createSignal(true)
  let playArea
  let unmountGameEngine

  onMount(async () => {
    if (isServer) return

    const camera = Camera()
    camera.width = camera.height = WORLD

    const entities = EntityList([])
    window.entities = entities

    entities.addChild(
      createMatterBoundaries({
        width: WORLD,
        height: WORLD,
        thickness: WALL_THICKNESS,
        skipBoundaries: ['top'],
        matterOptions: {
          friction: 0,
          frictionStatic: 0,
          frictionAir: 0,
        },
      }),
    )

    const getPlayAreaRect = () =>
      playArea ? playArea.getBoundingClientRect() : null

    const dragState = {
      entity: null,
      pointerId: null,
      targetX: 0,
      targetY: 0,
    }

    const DraggableBox = createDraggableBox(getPlayAreaRect, dragState)

    for (let i = 0; i < COUNT; i++) {
      const size = rand(5, 30)
      entities.addChild(Entity({
        x: rand(-HALF + size / 2 + WALL_THICKNESS, HALF - size / 2 - WALL_THICKNESS),
        y: -HALF - rand(15, 150) - size,
        width: size,
        height: size,
        rotation: 0,
        color: COLORS[i % COLORS.length],
        positionTransform: true,
        noMatterRender: true,
        solid: DraggableBox,
        matter: boxMatterOptions,
      }))
    }

    const solidRenderer = createSolidRenderer(entities, {
      solidSetter: setSolidGameContents,
      camera,
    })

    const matterPhysics = createMatterPlugin(entities, {
      setup: (engine) => {
        engine.gravity.x = 0
        engine.gravity.y = 0.3
        engine.velocityIterations = 6
      },
    })

    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        solidRenderer,
        matterPhysics,
        createDragPlugin(dragState),
        createOutOfBoundsPlugin(entities),
        createRotationLockPlugin(entities, rotationLocked),
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
    <div class="game-root">
      <div ref={playArea} class="game-play-area">
        {solidGameContents()}
      </div>

      <button
        class="game-rotation-toggle"
        classList={{ 'game-rotation-toggle--unlocked': !rotationLocked() }}
        onClick={() => setRotationLocked(v => !v)}
      >
        Rotation: {rotationLocked() ? 'Locked' : 'Free'}
      </button>
    </div>
  )
}