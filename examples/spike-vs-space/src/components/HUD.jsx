export default function HUD({entity}) {
    return <div style="position: absolute; top: 1%; height: 10%; display: flex; flex-direction: row; align-items: center; font-size: 3vmin;">
        <button style="height: fit-content; padding: 1vmin; display: inline;" onClick={entity.reset}>Reset</button>
    </div>
}