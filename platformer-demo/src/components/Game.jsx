import { onCleanup, onMount } from 'solid-js'
import {createGameCore, createGameLoop, createEntity, createEntityList, createRenderSettings } from '../../../'
import createP5Renderer from '../../../src/plugins/p5.js'

export default function Game() {
    let unmountGameEngine
    let container
    onMount(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        const entity = createEntity();
        const entities = createEntityList([entity]);
        window.entities = entities;
        const renderSettings = createRenderSettings({
            container,
            setup: (p) => {
            console.log(p);
            p.createCanvas(1000, 1000);
            p.background(200);
            },
        });
        const gameCore = createGameCore({
            plugins: [createGameLoop(), createP5Renderer(entities, renderSettings)],
        });
        gameCore.events.on("tick", () => {
            entity.x = (entity.x + 1) % 100;
        });
        await gameCore.mount();
        unmountGameEngine = gameCore.unmount;
    })
    onCleanup(async ()=>{
        if (typeof window === 'undefined') return // Browser Only
        await unmountGameEngine()
    })
    return <div ref={container}/>
}