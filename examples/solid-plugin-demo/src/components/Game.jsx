import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop} from 'lilis-engine'
import createSolidRenderer from 'lilis-engine/solid'
import TestText from "./TestText.jsx"

export default function Game() {
    let unmountGameEngine
    const [getGameEngineSolidOutput, setGameEngineSolidOutput] = createSignal(null)
    onMount(async ()=>{
        if (isServer) return
        console.log('Mounted! Rendering a chicken on the canvas every animation frame')
        const renderSettings = new RenderSettings({solidSetter: setGameEngineSolidOutput})
        const textEntity = Entity({solid: TestText})
        const entities = new EntityList([textEntity])
        const solidRenderer = createSolidRenderer(entities, renderSettings)
        const gameCore = createGameCore({plugins:[solidRenderer]})
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })
    onCleanup(async ()=>{
        if (isServer) return // Browser Only, shut down the game engine. Not technically mandatory but good practice and shows how to gracefully shut down the game engine
        await unmountGameEngine()
    })
    return <div>{getGameEngineSolidOutput()}</div>
}