import { onMount, onCleanup, createSignal} from "solid-js"
import { isServer } from 'solid-js/web'
import {createGameCore, Entity, EntityList, RenderSettings, createGameLoop} from 'lilis-engine'
import createPixiRenderer from 'lilis-engine/pixi'
import { LevelLoader } from "lilis-engine"
import createSolidRenderer from 'lilis-engine/solid'

export default function Game() {
    const [solidGameContents, setSolidGameContents] = createSignal(null)
    let canvas
    let unmountGameEngine
    onMount(async ()=>{
        if (isServer) return
        console.log('Mounted! Rendering a chicken on the canvas every animation frame')
        const renderSettings = new RenderSettings({canvas})
        const entities = new EntityList([])
        const levelLoader = LevelLoader(entities, {
            levelA: {
                mount: (_, {entityList})=>{
                    entityList.set([new Entity({imageURL: '/chicken by Diarandor.png', x: 0, y: 0, width: 50, height: 50})])
                }
            },
            levelB: {
                mount: (_, {entityList})=>{
                    entityList.set([new Entity({imageURL: '/warrior.png', x: 0, y: 0, width: 50, height: 50})])
                }
            }
        }, {
            defaultLevel: 'levelA'
        })
        const levelSwitcher = Entity({solid: function LevelSwitcher(){
            return <button onClick={()=>{
                levelLoader.loadLevel(levelLoader.activeLevel.get().name === "levelA" ? 'levelB' : 'levelA')
            }}>Switch Levels</button>
        }})
        entities.set([levelSwitcher])
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
    return (<div>
        <canvas ref={canvas}/>
        {solidGameContents()}
    </div>)
}