import '@/styles/TouchControls.scss'
import { createSignal } from 'solid-js'

export default function JumpButton({entity}) {
    const [movementButtonHeld, setMovementButtonHeld] = createSignal(false)
    const [jumpButtonHeld, setJumpButtonHeld] = createSignal(false)
    let movementButton
    entity.jumping = false
    entity.direction = null
    
    const calculateDirection = (e)=>{
        const {clientX, clientY} = (e?.touches || [])[0] || e
        const bounds = movementButton.getBoundingClientRect()
        const xPercent = (clientX - bounds.left) / bounds.width
        console.log(clientY, bounds.top,)
        if (clientX < bounds.left || clientY < bounds.top || clientX > bounds.right || clientY > bounds.bottom) return null
        return xPercent >= 0.5 ? 'right' : 'left'
    }

    const movementButtonDown = (e)=>{
        setMovementButtonHeld(true)
        entity.direction = calculateDirection(e)
    }
    const movementButtonUp = ()=>{
        setMovementButtonHeld(false)
        entity.direction = null
    }
    const movementButtonMoved = (e)=>{
        if (!movementButtonHeld()) return
        entity.direction = calculateDirection(e)
        console.log(entity.direction)
    }
    const jumpButtonDown = ()=>{
        setJumpButtonHeld(true)
        entity.jumping = true
    }
    const jumpButtonUp = ()=>{
        setJumpButtonHeld(false)
        entity.jumping = false
    }
    return <div onContextMenu={e => e.preventDefault()} class="touchControls">
        <button ref={movementButton} onMouseDown={movementButtonDown} onMouseMove={movementButtonMoved} onMouseUp={movementButtonUp} class={"move" + (movementButtonHeld() ? ' held' : '')}><img src="left-right.png" alt="left and right movement icon"/></button>
        <button onTouchStart={jumpButtonDown} onTouchEnd={jumpButtonUp} onTouchCancel={jumpButtonUp} onMouseDown={jumpButtonDown} onMouseUp={jumpButtonUp} class={"jump" + (jumpButtonHeld() ? ' held' : '')}><img src="jump-button.png" alt="jump icon"/></button>
    </div>
}