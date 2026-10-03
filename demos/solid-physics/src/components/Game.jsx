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

function createDraggableBox(getPlayAreaRect) {
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

      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        const rect = getPlayAreaRect()
        if (!rect || !rect.width || !rect.height) return

        // Screen client coords → play-area-relative [0..100] → centered [-50..50].
        const normalizedX =
          ((ev.clientX - rect.left) / rect.width) * WORLD - HALF
        const normalizedY =
          ((ev.clientY - rect.top) / rect.height) * WORLD - HALF

        const worldX = camera && typeof camera.inverseTransformX === 'function'
          ? camera.inverseTransformX(normalizedX)
          : normalizedX
        const worldY = camera && typeof camera.inverseTransformY === 'function'
          ? camera.inverseTransformY(normalizedY)
          : normalizedY

        const body = entity.matterBody
        if (body) {
          Body.setVelocity(body, {
            x: (worldX - body.position.x) * 0.4,
            y: (worldY - body.position.y) * 0.4,
          })
        }
      }

      const up = (ev) => {
        if (ev.pointerId !== e.pointerId) return
        setDragging(false)
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

    // Physics-only boundaries via the engine helper. Skip the top so boxes
    // can fall into the arena from above.
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

    const DraggableBox = createDraggableBox(getPlayAreaRect)

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
        //engine.velocityIterations = 1
      },
    })

    const gameCore = createGameCore({
      plugins: [
        createGameLoop(),
        solidRenderer,
        matterPhysics,
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