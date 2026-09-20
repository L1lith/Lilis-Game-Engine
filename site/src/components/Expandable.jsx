import { createSignal } from "solid-js"
import '@/styles/Expandable.scss'

export default function Expandable(props) {
    const {class: className, title="Untitled", children, startExpanded=false} = props
    const [expanded, setExpanded] = createSignal(startExpanded)
    const toggleExpanded = ()=>{
        setExpanded(!expanded())
        console.log('expanded:', expanded())
    }
    return <div class={"expandable" + (typeof className == 'string' ? ' ' + className : '')}>
        <h2 class="title">{title}<button onClick={toggleExpanded}><span class="text-icon">{!expanded() ? '+' : '-'}</span></button></h2>
        <div style={expanded() ? {display: 'initial'} : {display: 'none'}} class="content">{children || null}</div>
    </div>
}