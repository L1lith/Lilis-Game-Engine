import { onCleanup, onMount } from 'solid-js'
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from '../../../'
import createPixiRenderer from '../../../src/plugins/pixi.js'
import createPixiTiledmap from '../../../src/plugins/pixi-tiledmap.js'
import {Store} from 'jabr'
import Camera from '../../../src/createCamera.js'
import createMatterPhysics from "../../../src/plugins/matter.js"
import createCountdown from '../../../src/timing/createCountdown.js'
import Entity from '../../../src/createEntity.js'

export default function Game() {
    let unmountGameEngine
    let canvas
    onMount(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        // const entity = createEntity({
        //     imageURL: '/human-skull.png',
        //     x: 0
        // });
        const map = await createPixiTiledmap("/gameart2d-desert.tmx")
        const player = new Entity({
            x: 0,
            y: 0,
            width: 5,
            height: 5,
            matter: {shape: 'rectangle'}
        }) 
        window.player = player
        const entities = createEntityList([map, player]);
        window.entities = entities;
        const camera = new Camera({x: 0, y: 0, width: 100, height: 100})
        const renderSettings = createRenderSettings({
            canvas,
            camera
        });
        const physicsEngine = createMatterPhysics(entities)
        const gameCore = createGameCore({
            plugins: [createGameLoop(), createPixiRenderer(entities, renderSettings), physicsEngine],
        });
        // gameCore.events.on("tick", () => {
        //     entity.x = (entity.x + 1) % 100;
        // });
        gameCore.events.on('tick', timingData=>{
            // console.log(map.width)
            //camera.x = (camera.x + 0.1) % (map.width - 100)
        })
        window.map = map

        await gameCore.mount();
        console.log(physicsEngine.engineSignal.get())
        const matterEngine = physicsEngine.engineSignal.get()
        //matterEngine.gravity.y = -0.000000001;
        //matterEngine.gravity.y =
        unmountGameEngine = gameCore.unmount;
    })
    onCleanup(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        await unmountGameEngine()
    })
    return <canvas ref={canvas}/>
}