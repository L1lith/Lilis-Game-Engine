import '@/styles/TouchControls.scss'
import { createSignal } from 'solid-js'

export default function JumpButton({entity}) {
    const [movementButtonHeld, setMovementButtonHeld] = createSignal(false)
    const [jumpButtonHeld, setJumpButtonHeld] = createSignal(false)
    let movementButton
    
    // Initialize entity properties
    entity.jumping = false
    entity.direction = null

    const calculateDirection = (e) => {
        if (!movementButton) return null
        
        // Get touch or mouse coordinates
        const touch = (e.touches?.[0] || e.changedTouches?.[0] || e)
        const { clientX, clientY } = touch
        const bounds = movementButton.getBoundingClientRect()
        
        // Check if touch is outside button bounds
        if (clientX < bounds.left || clientY < bounds.top || 
            clientX > bounds.right || clientY > bounds.bottom) {
            return null
        }
        
        // Calculate which half of the button was pressed
        const xPercent = (clientX - bounds.left) / bounds.width
        return xPercent >= 0.5 ? 'right' : 'left'
    }

    const movementButtonDown = (e) => {
        e.preventDefault() // Prevent default touch behaviors
        setMovementButtonHeld(true)
        entity.direction = calculateDirection(e)
    }

    const movementButtonUp = (e) => {
        if (e) e.preventDefault()
        setMovementButtonHeld(false)
        entity.direction = null
    }

    const movementButtonMoved = (e) => {
        if (!movementButtonHeld()) return
        e.preventDefault()
        entity.direction = calculateDirection(e)
    }

    const jumpButtonDown = (e) => {
        e.preventDefault()
        setJumpButtonHeld(true)
        entity.jumping = true
    }

    const jumpButtonUp = (e) => {
        if (e) e.preventDefault()
        setJumpButtonHeld(false)
        entity.jumping = false
    }

    return (
        <div 
            onContextMenu={e => e.preventDefault()} 
            class="touchControls"
        >
            <button
                ref={movementButton}
                onMouseDown={movementButtonDown}
                onMouseMove={movementButtonMoved}
                onMouseUp={movementButtonUp}
                onMouseLeave={movementButtonUp}
                onTouchStart={movementButtonDown}
                onTouchMove={movementButtonMoved}
                onTouchEnd={movementButtonUp}
                onTouchCancel={movementButtonUp}
                class={"move" + (movementButtonHeld() ? ' held' : '')}
            >
                <img 
                    draggable={false} 
                    src="left-right.png" 
                    alt="left and right movement icon"
                    onDragStart={e => e.preventDefault()}
                />
            </button>
            
            <button
                onMouseDown={jumpButtonDown}
                onMouseUp={jumpButtonUp}
                onMouseLeave={jumpButtonUp}
                onTouchStart={jumpButtonDown}
                onTouchEnd={jumpButtonUp}
                onTouchCancel={jumpButtonUp}
                class={"jump" + (jumpButtonHeld() ? ' held' : '')}
            >
                <img 
                    draggable={false} 
                    src="jump-button.png" 
                    alt="jump icon"
                    onDragStart={e => e.preventDefault()}
                />
            </button>
        </div>
    )
}