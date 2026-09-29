import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop, Camera} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import createSolidRenderer from 'lilis-engine/solid'
import '@/styles/Game.scss'
import createMatterPlugin from 'lilis-engine/matter'
import { detectKeys } from "lilis-engine/utility"
import Matter from 'matter-js'
import MatterAttractors from 'matter-attractors'
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
        const entities = EntityList([])
        const background = entities.addChild(Entity({
            imageURL: 'space-bg.jpg',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            renderPriority: -100
        }))
        const cursor = entities.addChild(Entity({
            width: 15,
            height: 15,
            matter: {
                static: true,
                plugin: {
                    attractors: [
                        function(bodyA, bodyB) {
                            return {
                                x: (bodyA.position.x - bodyB.position.x) * 1e-6,
                                y: (bodyA.position.y - bodyB.position.y) * 1e-6,
                            };
                        }
                    ]
                }
            }
        }))
        const pixiRenderer = createPixiRenderer(entities, renderSettings)
        renderSettings.solidSetter = setSolidGameContents
        const solidRenderer = createSolidRenderer(entities, renderSettings)
        const matterPhysics = createMatterPlugin(entities, {setup: engine => {
            engine.world.gravity.scale = 0
        }})
        matterPhysics.useMatterPlugin(MatterAttractors)
        const gameCore = createGameCore({plugins:[createGameLoop(), pixiRenderer, solidRenderer, matterPhysics]})
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