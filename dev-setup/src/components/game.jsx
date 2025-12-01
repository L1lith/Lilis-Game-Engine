import "../styles/game.scss"
import { onCleanup, onMount } from "solid-js"
import runGame from "../game/runGame.js"

export default function Game() {
    let canvas = null
    let stopGame = null

    onMount(()=>{
        const isClient = typeof window !== 'undefined'
        if (!isClient) return
        stopGame = runGame(canvas)
    })
    onCleanup(()=>{
        const isClient = typeof window !== 'undefined'
        if (!isClient) return
        stopGame()
    })
    return <canvas ref={canvas}/>
}