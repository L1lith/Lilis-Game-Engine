import { onCleanup, onMount } from 'solid-js'
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from '../../../'
import createPixiRenderer from '../../../src/plugins/pixi.js'
import createPixiTiledmap from '../../../src/plugins/pixi-tiledmap.js'
import {Store} from 'jabr'

export default function Game() {
    let unmountGameEngine
    let canvas
    onMount(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        // const entity = createEntity({
        //     imageURL: '/human-skull.png',
        //     x: 0
        // });
        const map = await createPixiTiledmap("/gameart2d-desert.tmx", {x: 0, y: 0, width: 100, height: 100})
        const entities = createEntityList([map]);
        window.entities = entities;
        const camera = new Store({x: 0, y: 0, width: 100, height: 20})
        const renderSettings = createRenderSettings({
            canvas,
            camera
        });
        const gameCore = createGameCore({
            plugins: [createGameLoop(), createPixiRenderer(entities, renderSettings)],
        });
        // gameCore.events.on("tick", () => {
        //     entity.x = (entity.x + 1) % 100;
        // });
        gameCore.events.on('tick', ()=>{
            // console.log(map.width)
            camera.x = (camera.x + 1) % map.width
        })
        await gameCore.mount();
        unmountGameEngine = gameCore.unmount;
    })
    onCleanup(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        await unmountGameEngine()
    })
    return <canvas ref={canvas}/>
}