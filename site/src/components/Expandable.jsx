import { createSignal, createEffect, onMount, onCleanup } from "solid-js"
import { isServer } from "solid-js/web"
import "@/styles/Expandable.scss"

/* ------------------------------------------------------------------ *
 * Helpers & shared state
 * ------------------------------------------------------------------ */

const STATE_KEY = "expandable:state"
const SCROLL_KEY = "expandable:scroll"

const hasStorage = () => {
    if (isServer) return false
    try {
        return !!window.sessionStorage
    } catch {
        return false
    }
}

const readJSON = (key, fallback) => {
    if (!hasStorage()) return fallback
    try {
        const raw = sessionStorage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
    } catch {
        return fallback
    }
}

const writeJSON = (key, value) => {
    if (!hasStorage()) return
    try {
        sessionStorage.setItem(key, JSON.stringify(value))
    } catch {}
}

const slugify = (v) =>
    String(v)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['’"]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")

const pathKey = () => (isServer ? "" : window.location.pathname + window.location.search)

const getHashId = () => {
    if (isServer) return null
    const hash = window.location.hash
    if (!hash || hash === "#") return null
    try {
        return decodeURIComponent(hash.slice(1))
    } catch {
        return hash.slice(1)
    }
}

let stateCache = null
const getState = () => {
    if (!stateCache) stateCache = readJSON(STATE_KEY, {})
    return stateCache
}

let scrollCache = null
const getScroll = () => {
    if (!scrollCache) scrollCache = readJSON(SCROLL_KEY, {})
    return scrollCache
}

let saveQueued = false
const queueSaveScroll = () => {
    if (isServer || saveQueued) return
    saveQueued = true
    requestAnimationFrame(() => {
        saveQueued = false
        const store = getScroll()
        store[pathKey()] = Math.round(window.scrollY || 0)
        writeJSON(SCROLL_KEY, store)
    })
}

let globalListenersAttached = false
const attachGlobalListeners = () => {
    if (isServer || globalListenersAttached) return
    globalListenersAttached = true
    if (typeof history !== "undefined" && "scrollRestoration" in history) {
        history.scrollRestoration = "manual"
    }
    window.addEventListener("scroll", queueSaveScroll, { passive: true })
    window.addEventListener("pagehide", queueSaveScroll)
}

const navigationType = () => {
    if (isServer) return "navigate"
    try {
        const [n] = performance.getEntriesByType?.("navigation") ?? []
        if (n?.type) return n.type
    } catch {}
    return "navigate"
}

let restoreDone = false
const restoreScroll = () => {
    if (isServer || restoreDone) return
    restoreDone = true
    const type = navigationType()
    if (type !== "reload" && type !== "back_forward") return
    const y = getScroll()[pathKey()]
    if (!Number.isFinite(y) || y <= 0) return
    requestAnimationFrame(() => window.scrollTo(0, y))
}

let bootScheduled = false
let hashHandled = false
const scheduleBoot = () => {
    if (isServer || bootScheduled) return
    bootScheduled = true
    requestAnimationFrame(() => {
        if (!hashHandled) restoreScroll()
    })
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export default function Expandable(props) {
    const { class: className, title = null, startExpanded = false } = props

    const label = typeof title === "string" ? title.trim() : ""
    const slug = label ? slugify(label) : ""
    const elementId = slug || undefined
    const contentId = slug ? `${slug}-content` : undefined

    const stored = slug ? getState()[slug] : undefined
    const initial = typeof stored === "boolean" ? stored : startExpanded
    const [expanded, setExpanded] = createSignal(initial)

    let rootEl = null
    let contentEl = null

    // Persistence + content display sync. The icon lives directly in the
    // parent's JSX below, so Solid tracks its reactive class binding there.
    createEffect(() => {
        const isOpen = expanded()

        if (slug) {
            const state = getState()
            if (state[slug] !== isOpen) {
                state[slug] = isOpen
                writeJSON(STATE_KEY, state)
            }
        }

        if (!isServer && contentEl) {
            contentEl.style.display = isOpen ? "initial" : "none"
        }
    })

    const containsId = (id) => {
        if (!id || !rootEl) return false
        if (rootEl.id === id) return true
        const el = document.getElementById(id)
        return !!el && rootEl.contains(el)
    }

    const scrollToId = (id, smooth) => {
        const el = rootEl && rootEl.id === id ? rootEl : document.getElementById(id)
        if (!el) return
        el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" })
    }

    const openAndScroll = (id, smooth = true) => {
        setExpanded(true)
        requestAnimationFrame(() => scrollToId(id, smooth))
    }

    const handleHashChange = () => {
        const id = getHashId()
        if (!id || !containsId(id)) return
        hashHandled = true
        openAndScroll(id, true)
    }

    const handleClick = (e) => {
        if (e.defaultPrevented || e.button !== 0) return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null
        if (!a) return
        const href = a.getAttribute("href")
        if (!href || href === "#") return

        let id
        try {
            id = decodeURIComponent(href.slice(1))
        } catch {
            id = href.slice(1)
        }
        if (!id || !containsId(id)) return

        e.preventDefault()
        if (window.location.hash !== href) history.pushState(null, "", href)
        hashHandled = true
        openAndScroll(id, true)
    }

    onMount(() => {
        if (isServer) return

        attachGlobalListeners()

        const id = getHashId()
        if (id && containsId(id)) {
            hashHandled = true
            setExpanded(true)
            requestAnimationFrame(() => scrollToId(id, false))
        } else {
            scheduleBoot()
        }

        window.addEventListener("hashchange", handleHashChange)
        window.addEventListener("popstate", handleHashChange)
        document.addEventListener("click", handleClick)
    })

    onCleanup(() => {
        if (isServer) return
        window.removeEventListener("hashchange", handleHashChange)
        window.removeEventListener("popstate", handleHashChange)
        document.removeEventListener("click", handleClick)
    })

    return (
        <div
            ref={rootEl}
            id={elementId}
            class={"expandable" + (typeof className === "string" ? " " + className : "")}
        >
            <h2 class="title">
                {label ? <a href={"#" + slug}>{label}</a> : "Untitled"}
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded()}
                    aria-controls={contentId}
                >
                    <span class="text-icon">
                        {/* The reactive class binding lives HERE, on a real
                            DOM node. Solid re-evaluates this expression
                            whenever `expanded()` changes, so the class
                            flips and the CSS transition fires. */}
                        <div class="plus" classList={{ open: expanded(), closed: !expanded() }}>
                            <div class="horizontal-bar" />
                            <div class="vertical-bar" />
                        </div>
                    </span>
                </button>
            </h2>
            <div
                ref={contentEl}
                id={contentId}
                class="content"
                style={expanded() ? { display: "initial" } : { display: "none" }}
            >
                {props.children || null}
            </div>
        </div>
    )
}