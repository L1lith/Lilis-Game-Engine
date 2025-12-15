import "../styles/game.scss"
import { onCleanup, onMount } from "solid-js"
import runGame from "../game/runGame.js"

export default function Game() {
    let container = null
    let stopGame = null

    onMount(async ()=>{
        const isClient = typeof window !== 'undefined'
        if (!isClient) return
        stopGame = await runGame(container)
    })
    onCleanup(()=>{
        const isClient = typeof window !== 'undefined'
        if (!isClient) return
        stopGame()
    })
    return <div ref={container}/>
}