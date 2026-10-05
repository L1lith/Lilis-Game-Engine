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
import TouchControls from "./TouchControls"
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
        const playerCam = renderSettings.camera = Camera({width: 70, height: 70})
        window.cam = playerCam
        const entities = EntityList([])
        // GUI Stuff
        const touchControls = entities.addChild({solid: TouchControls})
        // End GUI Stuff
        const player = window.player = entities.addChild({
            renderPriority: 3,
            x: 10, y:-30,
            width: 5,
            height: 5,
            matter: {shape: 'circle'},
            imageURL: 'chicken by Diarandor.png',
            renderRotation: 0
        })
        player.on('x', x => playerCam.x = x)
        player.on('y', y => playerCam.y = y)
        playerCam.x = player.x
        playerCam.y = player.y

        // Keyboard inputs. detectKeys returns a Signal whose .get() is
        // truthy while the key is held down.
        const inputs = {
            up: detectKeys('ArrowUp'),
            down: detectKeys('ArrowDown'),
            left: detectKeys('ArrowLeft'),
            right: detectKeys('ArrowRight'),
            space: detectKeys(' ')
        }
        const walkForce = 1
        // 1 / sqrt(2). Used to normalize diagonal movement so that
        // pressing two keys at once doesn't move the player ~41% faster
        // than pressing one.
        const DIAGONAL = Math.SQRT1_2

        const playerControlPlugin = {
            tick: () => {
                if (!player.matterBody) return

                // touchControls.xDirection / yDirection are numbers
                // (-1, 0, or 1) driven by the TouchControls component.
                // Keyboard overrides touch when a key is held.
                let xDirection = touchControls.xDirection ?? 0
                if (inputs.right.get()) xDirection = 1
                else if (inputs.left.get()) xDirection = -1

                let yDirection = touchControls.yDirection ?? 0
                if (inputs.down.get()) yDirection = 1
                else if (inputs.up.get()) yDirection = -1

                // Normalize diagonals: if both axes are active, scale
                // each by 1/sqrt(2) so the resulting vector has the same
                // magnitude as a cardinal direction.
                if (xDirection !== 0 && yDirection !== 0) {
                    xDirection *= DIAGONAL
                    yDirection *= DIAGONAL
                }

                Body.setVelocity(player.matterBody, {
                    x: xDirection * walkForce,
                    y: yDirection * walkForce
                })
            }
        }

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
        adjustCameraBounds()
        levelLoader.activeLevel.addListener(adjustCameraBounds)

        const playerOutOfBoundsPlugin = {
            tick: ()=>{
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
        const matterPhysics = createMatterPlugin(entities, {setup: e => {
            e.gravity.x = 0
            e.gravity.y = 0
        }})
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, levelLoader, solidRenderer, matterPhysics, playerControlPlugin, playerOutOfBoundsPlugin]})
        await gameCore.mount()
        unmountGameEngine = async () => {
            window.removeEventListener('resize', autoResize)
            await gameCore.unmount()
        }
    })
    onCleanup(async ()=>{
        if (isServer) return
        if (unmountGameEngine) await unmountGameEngine()
    })
    return (<div class="game-container">
        <canvas ref={canvas}/>
        {solidGameContents()}
    </div>)
}