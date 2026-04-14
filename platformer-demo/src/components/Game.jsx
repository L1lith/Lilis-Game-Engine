import { onCleanup, onMount } from 'solid-js'
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from '../../../'
import createPixiRenderer from '../../../src/plugins/pixi.js'
import createPixiTiledmap from '../../../src/plugins/pixi-tiledmap.js'
import {Store, Signal} from 'jabr'
import Camera from '../../../src/createCamera.js'
import createMatterPhysics from "../../../src/plugins/matter.js"
import createCountdown from '../../../src/utility/createCountdown.js'
import Entity from '../../../src/createEntity.js'
import pixiTiledToMatter from '../../../src/plugins/pixi-tiled-to-matter.js'
import detectKeys from '../../../src/utility/detectKeys.js'
import Matter from 'matter-js'

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
        const mapCollision = pixiTiledToMatter(map, layer => layer.name === 'collision')
        mapCollision.width = map.width
        const player = new Entity({
            x: -50,
            y: 0,
            width: 5,
            height: 5,
            matter: {shape: 'rectangle'}
        })
        window.player = player
        const entities = createEntityList([map, player, new Entity({x: -45, y: -45, width: 10, height: 10, ignoreSceneCamera: true}), mapCollision]);
        window.entities = entities;
        const camera = new Camera({x: 0, y: 0, width: 100, height: 100})
        const renderSettings = createRenderSettings({
            canvas,
            camera
        });
        const physicsEngine = createMatterPhysics(entities)
        const arrowKeys = {
            left: detectKeys('arrowleft'),
            right: detectKeys('arrowright'),
            up: detectKeys('arrowup'),
            down: detectKeys('arrowdown')
        }
        const playerControlPlugin = {
            tick: ()=>{
                if (!player.matterBody) return
                const velocity = {}
                if (arrowKeys.left.get() || arrowKeys.right.get()) velocity.x = arrowKeys.left.get() ? -0.5 : 0.5
                if (arrowKeys.up.get()) velocity.y = arrowKeys.up.get() ? -0.5 : 0
                console.log(Object.keys(velocity))
                if (Object.keys(velocity).length > 0) Matter.Body.setVelocity(player.matterBody, {x: player.matterBody.velocity.x, y: player.matterBody.velocity.y, ...velocity});
            }
        }
        const cameraControlPlugin = {
            tick: ()=>{
                //player.x = player.x % (map.width / 2)
                camera.x = player.x+ 0.0001
                camera.y = player.y + 0.0001
            },
            tickPriority: 1
        }
        const gameCore = createGameCore({
            plugins: [createGameLoop(), createPixiRenderer(entities, renderSettings), physicsEngine, cameraControlPlugin, playerControlPlugin],
        });
        window.map = map

        await gameCore.mount();
        console.log(physicsEngine.engineSignal.get())
        const matterEngine = physicsEngine.engineSignal.get()
        //matterEngine.gravity.y = -0.000000001;
        matterEngine.gravity.x = 0
        matterEngine.gravity.y = 0.1
        unmountGameEngine = gameCore.unmount;
    })
    onCleanup(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        await unmountGameEngine()
    })
    return <canvas ref={canvas}/>
}