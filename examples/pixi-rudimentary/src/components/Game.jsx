import { onMount } from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'

export default function Game() {
    let canvas
    onMount(async ()=>{
        if (isServer) return
        console.log('Mounted! Rendering a chicken on the canvas every animation frame')
        const renderSettings = new RenderSettings({canvas})
        const player = new Entity({imageURL: '/chicken by Diarandor.png', x: 0, y: 0, width: 50, height: 50})
        const entities = new EntityList([player])
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer]})
        await gameCore.mount()
    })
    return <canvas ref={canvas}/>
}