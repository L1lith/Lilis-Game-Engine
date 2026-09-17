import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop, Camera} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import { LevelLoader } from "lilis-engine"
import createSolidRenderer from 'lilis-engine/solid'
import levels from '@/levels/index.js'
import '@/styles/Game.scss'

export default function Game() {
    const [solidGameContents, setSolidGameContents] = createSignal(null)
    let canvas
    let unmountGameEngine
    onMount(async ()=>{
        if (isServer) return
        console.log('Mounted!')
        const renderSettings = RenderSettings({canvas})
        const autoResize = () => {
        const size = Math.min(window.innerWidth, window.innerHeight);
        renderSettings.width = renderSettings.height = size;
        };
        window.addEventListener("resize", autoResize);
        autoResize();
        const playerCam = renderSettings.camera = Camera({width: 100, height: 100})
        window.cam = playerCam
        const entities = EntityList([])
        const background = entities.addChild(Entity({
            imageURL: 'BackgroundGradient.png',
            x: 0,
            y: 0,
            width: 1000,
            height: 101,
            renderPriority: -100
        }))
        window.entities = entities
        const levelLoader = LevelLoader(entities, levels, {
            defaultLevel: 'levelOne'
        })
        const adjustCameraBounds = ()=>{
            const map = levelLoader.activeLevel.get()?.exports?.map;
            if (!map) {
                playerCam.bounds = null
                return
            }
            playerCam.bounds = {
                left: map.width / -2,
                right: map.width / 2,
                top: map.height / -2,
                bottom: map.height / 2
            }
        }
        levelLoader.activeLevel.addListener(adjustCameraBounds)
        adjustCameraBounds
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        renderSettings.solidSetter = setSolidGameContents
        const solidRenderer = createSolidRenderer(entities, renderSettings)
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, levelLoader, solidRenderer]})
        await gameCore.mount()
        unmountGameEngine = gameCore.unmount
    })
    onCleanup(async ()=>{
        if (isServer) return // Browser Only, shut down the game engine. Not technically mandatory but good practice and shows how to gracefully shut down the game engine
        await unmountGameEngine()
    })
    return (<div class="game-container">
        <canvas ref={canvas}/>
        {solidGameContents()}
    </div>)
}