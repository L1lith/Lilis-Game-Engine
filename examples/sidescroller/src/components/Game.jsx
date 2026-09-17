import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop, Camera} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import { LevelLoader } from "lilis-engine"
import createSolidRenderer from 'lilis-engine/solid'
import levels from '@/levels/index.js'
import '@/styles/Game.scss'
import createMatterPlugin from 'lilis-engine/matter'
import { detectKeys } from "lilis-engine/utility"
import Matter from 'matter-js'
const {Body} = Matter

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
        const playerCam = renderSettings.camera = Camera({width: 60, height: 60})
        window.cam = playerCam
        const entities = EntityList([])
        const player = window.player = entities.addChild({renderPriority: 3, x: 10, y:-30, width: 5, height: 5, matter: {shape: 'circle'}, imageURL: 'chicken by Diarandor.png'})
        player.on('x', x => playerCam.x = x)
        player.on('y', y => playerCam.y = y)
        const inputs = {
            up: detectKeys('ArrowUp'),
            down: detectKeys('ArrowDown'),
            left: detectKeys('ArrowLeft'),
            right: detectKeys('ArrowRight')
        }
        const walkForce = 1
        const jumpForce = 3
        const playerControlPlugin = {
            tick: () => {
                if (!player.matterBody) return
                const xForce = inputs.right.get() ? (inputs.left.get() ? 0 : 1) : inputs.left.get() ? -1 : 0
                const isTouchingSurface = (player.collisions || []).filter(event => event.colliderBody && event.colliderBody.position.y + event.colliderBody.bounds.max.y / 2 > player.y + player.height / 2 && (!event.colliderEntity || typeof event.colliderEntity.boundaryType != 'string')).length > 0
                const isJumping = inputs.up.get() && isTouchingSurface //&& Body.getVelocity(player.matterBody).y < 0.001
                Body.setVelocity(player.matterBody, {x: xForce * walkForce, y: isJumping ? jumpForce * -1 : player.matterBody.velocity.y})
            }
        }
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
                playerCam.bounds = {left: -50, right: 50, top: -50, bottom: 50}
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
        const playerOutOfBoundsPlugin = {
            tick: ()=> {            
                const map = levelLoader.activeLevel.get()?.exports?.map;
                if (!map) return
                const isOutOfBounds = player.x > map.width / 2 + player.width / 2 || player.x < map.width / -2  - player.width / 2 || player.y < map.height / -2 - player.height / 2 || player.y > map.height / 2 + player.height / 2 
                if (isOutOfBounds) {
                    const respawnPoint = levelLoader.activeLevel.get()?.exports?.spawn || {x: 0, y: -30}
                    Body.setVelocity(player.matterBody, {x: 0, y: 0})
                    player.x = respawnPoint.x
                    player.y = respawnPoint.y
                }
            }
        }
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        renderSettings.solidSetter = setSolidGameContents
        const solidRenderer = createSolidRenderer(entities, renderSettings)
        const matterPhysics = createMatterPlugin(entities)
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, levelLoader, solidRenderer, matterPhysics, playerControlPlugin, playerOutOfBoundsPlugin]})
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