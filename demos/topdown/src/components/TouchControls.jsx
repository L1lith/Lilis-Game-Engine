import '@/styles/TouchControls.scss'
import { onMount } from 'solid-js'
import JoystickIcon from '@/svgs/joystick-icon.svg?component-solid'

export default function Joystick({ entity }) {
    let containerRef
    let svgRef
    let stickRef
    let stickBaseTransform = ''
    let activePointerId = null

    // Filled in on mount
    const viewBox = { x: 0, y: 0, width: 1, height: 1 }
    const pivotSVG = { x: 0, y: 0 }
    let dragRadius = 1

    // Initialise entity
    entity.xDirection = 0
    entity.yDirection = 0

    onMount(() => {
        const svgEl = containerRef?.querySelector('svg')
        if (!svgEl) return
        svgRef = svgEl

        // Use the SVG's own coordinate system so translate() values are in user units.
        const vb = svgEl.viewBox?.baseVal
        if (vb && vb.width > 0 && vb.height > 0) {
            viewBox.x = vb.x
            viewBox.y = vb.y
            viewBox.width = vb.width
            viewBox.height = vb.height
        } else {
            const r = svgEl.getBoundingClientRect()
            viewBox.width = r.width || 1
            viewBox.height = r.height || 1
        }

        const stickEl = svgEl.querySelector('#stick')
        if (!stickEl) return
        stickRef = stickEl
        stickBaseTransform = stickEl.getAttribute('transform') || ''

        // The stick's current on-screen centre is our pivot. Convert it into SVG units.
        const svgRect = svgEl.getBoundingClientRect()
        const stickRect = stickEl.getBoundingClientRect()
        pivotSVG.x =
            viewBox.x +
            ((stickRect.left + stickRect.width / 2 - svgRect.left) / svgRect.width) * viewBox.width
        pivotSVG.y =
            viewBox.y +
            ((stickRect.top + stickRect.height / 2 - svgRect.top) / svgRect.height) * viewBox.height

        // The outer circle touches the SVG edges, so its radius is half the smaller dimension.
        const outerRadius = Math.min(viewBox.width, viewBox.height) / 2
        const stickRadius = ((stickRect.width / svgRect.width) * viewBox.width) / 2
        dragRadius = Math.max(1, outerRadius - stickRadius)
    })

    const screenToSVG = (clientX, clientY) => {
        const rect = svgRef.getBoundingClientRect()
        return {
            x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
            y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
        }
    }

    const applyStickOffset = (dx, dy) => {
        const parts = []
        if (stickBaseTransform) parts.push(stickBaseTransform)
        parts.push(`translate(${dx} ${dy})`)
        stickRef.setAttribute('transform', parts.join(' '))
    }

    const updateFromPointer = (clientX, clientY) => {
        if (!svgRef || !stickRef) return

        const p = screenToSVG(clientX, clientY)
        let dx = p.x - pivotSVG.x
        let dy = p.y - pivotSVG.y

        // Clamp to the CIRCLE (not the square bounding box). This means a
        // diagonal drag maxes out at (±0.707, ±0.707), never (±1, ±1).
        const dist = Math.hypot(dx, dy)
        if (dist > dragRadius) {
            const s = dragRadius / dist
            dx *= s
            dy *= s
        }

        applyStickOffset(dx, dy)
        entity.xDirection = dx / dragRadius // -1 left  → +1 right
        entity.yDirection = dy / dragRadius // -1 up    → +1 down
    }

    const reset = () => {
        if (stickRef) applyStickOffset(0, 0)
        entity.xDirection = 0
        entity.yDirection = 0
    }

    const onPointerDown = (e) => {
        e.preventDefault()
        if (activePointerId !== null) return
        activePointerId = e.pointerId
        try { containerRef.setPointerCapture(e.pointerId) } catch {}
        updateFromPointer(e.clientX, e.clientY)
    }

    const onPointerMove = (e) => {
        if (e.pointerId !== activePointerId) return
        e.preventDefault()
        updateFromPointer(e.clientX, e.clientY)
    }

    const onPointerUp = (e) => {
        if (e.pointerId !== activePointerId) return
        activePointerId = null
        try { containerRef.releasePointerCapture(e.pointerId) } catch {}
        reset()
    }

    return (
        <div
            ref={containerRef}
            class="touchControls joystick"
            onContextMenu={e => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <JoystickIcon class="joystick-icon" />
        </div>
    )
}