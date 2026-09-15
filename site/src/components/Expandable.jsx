import { createSignal } from "solid-js"
import '@/styles/Expandable.scss'

export default function Expandable(props) {
    const {class: className, title="Untitled", children, startExpanded=false} = props
    const [expanded, setExpanded] = createSignal(startExpanded)
    console.log(children, expanded)
    const toggleExpanded = ()=>{
        setExpanded(!expanded())
        console.log(expanded())
    }
    return <div class="expandable">
        <h2 class="title">{title}<button onClick={toggleExpanded}>{!expanded() ? '+' : '-'}</button></h2>
        <div style={expanded() ? {display: 'initial'} : {display: 'none'}} class="content">{children || null}</div>
    </div>
}