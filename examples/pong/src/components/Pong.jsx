import { onMount } from "solid-js"
import { isServer } from "solid-js/web"
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop, createEntityList} from 'lilis-engine'
import createMatterPlugin from 'lilis-engine/matter'
import createP5Renderer from 'lilis-engine/p5'


export default function Pong() {
    let canvas
    onMount(async ()=>{
        if (isServer) return
        const entities = createEntityList()
        const renderSettings = RenderSettings({canvas})
        const gameCore = createGameCore({plugins: [createGameLoop(), createP5Renderer(entities, renderSettings), createMatterPlugin(entities)]})
        await gameCore.mount()
    })
    return <canvas ref={canvas}/>
}