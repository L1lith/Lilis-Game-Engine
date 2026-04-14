import { onCleanup, onMount } from 'solid-js'
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from '../../../'
import createPixiRenderer from '../../../src/plugins/pixi.js'
import createPixiTiledmap from '../../../src/plugins/pixi-tiledmap.js'
import {Store, Signal} from 'jabr'
import Camera from '../../../src/createCamera.js'
import createMatterPhysics from "../../../src/plugins/matter.js"
import createCountdown from '../../../src/utility/createCountdown.js'
import Entity from '../../../src/createEntity.js'

export default function Game() {
    let unmountGameEngine
    let canvas
    const targetResolution = new Signal([800,800])
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
        const entities = createEntityList([map, player, new Entity({x: -45, y: -45, width: 10, height: 10, ignoreSceneCamera: true})]);
        window.entities = entities;
        const camera = new Camera({x: 0, y: 0, width: 100, height: 100})
        const renderSettings = createRenderSettings({
            canvas,
            camera
        });
        const physicsEngine = createMatterPhysics(entities)
        const cameraControlPlugin = {
            tick: ()=>{
                //player.x = player.x % (map.width / 2)
                camera.x = player.x+ 0.0001
                camera.y = player.y + 0.0001
            },
            tickPriority: 1
        }
        const gameCore = createGameCore({
            plugins: [createGameLoop(), createPixiRenderer(entities, renderSettings), physicsEngine, cameraControlPlugin],
        });
        window.map = map

        await gameCore.mount();
        console.log(physicsEngine.engineSignal.get())
        const matterEngine = physicsEngine.engineSignal.get()
        //matterEngine.gravity.y = -0.000000001;
        matterEngine.gravity.x = 0.1
        matterEngine.gravity.y = 0
        unmountGameEngine = gameCore.unmount;
    })
    onCleanup(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        await unmountGameEngine()
    })
    return <canvas ref={canvas}/>
}