import { onMount, onCleanup } from "solid-js";
import * as THREE from "three";
import "@/styles/Carousel3D.scss";

const MAX_TITLE_SIZE = 22;
const MIN_TITLE_SIZE = 12;
const MARQUEE_START_PAUSE_MS = 1200;
const MARQUEE_END_PAUSE_MS = 1200;
const MARQUEE_SPEED_PX_PER_SEC = 35;

export default function Carousel3D(props) {
  const panels = () => props.panels ?? [];
  const explicitCardWidth = () => props.cardWidth ?? null;
  const explicitCardHeight = () => props.cardHeight ?? null;
  const spinDuration = () => props.spinDuration ?? 25;
  const idleDelay = () => props.idleDelay ?? 2500;
  const minScale = () => props.minScale ?? 0.72;
  const cameraFov = () => props.cameraFov ?? 38;
  const fitPadding = () => props.fitPadding ?? 0.9;

  const width = () => props.width ?? "100%";
  const height = () => props.height ?? "100%";
  const minHeight = () => props.minHeight ?? "400px";

  let mountRef;
  let renderer, scene, camera, group;
  let rafId = null;
  let isMounted = true;

  let cardW = 0;
  let cardH = 0;

  let rotationY = 0;
  let targetRotationY = null;
  let spinning = true;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let lastMoveTime = 0;
  let velocity = 0;
  let lastFrameTime = 0;
  let idleTimer = null;

  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownTime = 0;

  const raycastTargets = [];
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  const count = () => Math.max(panels().length, 1);
  const anglePerCard = () => (Math.PI * 2) / count();

  const worldWidth = () => cardW / 100;
  const worldHeight = () => cardH / 100;

  const radius = () => {
    const n = count();
    if (n <= 1) return 0;
    const halfAngle = Math.PI / n;
    const pad = 0.15;
    return (worldWidth() / 2 + pad) / Math.sin(halfAngle);
  };

  const chooseBaseCardSize = (canvasW, canvasH) => {
    const ew = explicitCardWidth();
    const eh = explicitCardHeight();
    if (ew && eh) return { w: ew, h: eh };
    if (ew && !eh) return { w: ew, h: ew * (4 / 3) };
    if (!ew && eh) return { w: eh * (3 / 4), h: eh };

    const n = count();
    const sizeFactor = n <= 3 ? 0.7 : n <= 6 ? 0.55 : n <= 10 ? 0.45 : 0.38;
    const targetH = Math.min(canvasH * sizeFactor, canvasW * 0.9);
    const targetW = targetH * 0.72;
    return { w: Math.round(targetW), h: Math.round(targetH) };
  };

  const stopAutoSpin = () => {
    spinning = false;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  };
  const startIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { spinning = true; }, idleDelay());
  };
  const snapToNearest = () => {
    const step = anglePerCard();
    targetRotationY = Math.round(rotationY / step) * step;
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed: " + src));
      img.src = src;
    });

  // ---------- Panel drawing ----------
  // titleOffset: 0 = title's left edge at innerW's left edge (marquee start).
  //              Negative values slide the title leftward.
  // For non-marquee panels, titleOffset is ignored and the title is centered.
  const drawPanel = (ctx, panel, image, titleOffset = 0) => {
    const w = cardW;
    const h = cardH;
    const pad = 20;
    const innerW = w - pad * 2;

    // Background + border
    ctx.fillStyle = "#0e1a16";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120, 220, 180, 0.7)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // ---- Title: single line, shrinks to fit, marquees if still too long ----
    const titleText = panel.title || "";
    ctx.textBaseline = "top";

    let titleSize = MAX_TITLE_SIZE;
    ctx.font = `bold ${titleSize}px system-ui, -apple-system, sans-serif`;
    while (titleSize > MIN_TITLE_SIZE && ctx.measureText(titleText).width > innerW) {
      titleSize -= 1;
      ctx.font = `bold ${titleSize}px system-ui, -apple-system, sans-serif`;
    }
    const textWidth = ctx.measureText(titleText).width;
    const needsMarquee = textWidth > innerW;

    const titleLineHeight = Math.round(titleSize * 1.2);
    const titleY = pad + 4;

    ctx.fillStyle = "#b8ffd9";
    if (needsMarquee) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad, titleY, innerW, titleLineHeight);
      ctx.clip();
      ctx.textAlign = "left";
      ctx.fillText(titleText, pad + titleOffset, titleY);
      ctx.restore();
    } else {
      ctx.textAlign = "center";
      ctx.fillText(titleText, w / 2, titleY);
    }
    const titleBlockH = titleLineHeight;

    // ---- Source button reserved height ----
    const sourceBtnH = panel.source ? 34 : 0;
    const sourceBtnGap = panel.source ? 12 : 0;
    const sourceBtnY = h - pad - sourceBtnH;

    // ---- Preview area ----
    const imgTop = titleY + titleBlockH + 10;
    const imgBottom = sourceBtnY - sourceBtnGap;
    const imgAreaX = pad;
    const imgAreaY = imgTop;
    const imgAreaW = innerW;
    const imgAreaH = Math.max(0, imgBottom - imgTop);

    if (imgAreaH > 0) {
      if (image) {
        const imgAspect = image.width / image.height;
        const boxAspect = imgAreaW / imgAreaH;
        let dw, dh;
        if (imgAspect > boxAspect) {
          dw = imgAreaW;
          dh = dw / imgAspect;
        } else {
          dh = imgAreaH;
          dw = dh * imgAspect;
        }
        const dx = imgAreaX + (imgAreaW - dw) / 2;
        const dy = imgAreaY + (imgAreaH - dh) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
        ctx.clip();
        ctx.drawImage(image, dx, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
        ctx.fillStyle = "rgba(120, 220, 180, 0.5)";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading preview…", imgAreaX + imgAreaW / 2, imgAreaY + imgAreaH / 2);
      }
    }

    // ---- Source button ----
    if (panel.source) {
      ctx.fillStyle = "#0b1a12";
      ctx.fillRect(pad, sourceBtnY, innerW, sourceBtnH);
      ctx.strokeStyle = "rgba(120, 220, 180, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(pad + 1, sourceBtnY + 1, innerW - 2, sourceBtnH - 2);
      ctx.fillStyle = "#b8ffd9";
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("View Source Code", w / 2, sourceBtnY + sourceBtnH / 2);
    }
  };

  const makePanelCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = cardW * dpr;
    canvas.height = cardH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas, ctx };
  };

  // ---------- Fit-to-canvas ----------
  const projectedExtent = () => {
    const v = new THREE.Vector3();
    const p = new THREE.Vector3();
    let max = 0;
    for (const holder of group.children) {
      for (const mesh of holder.children) {
        if (!mesh.isMesh || !mesh.geometry) continue;
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          v.applyMatrix4(mesh.matrixWorld);
          p.copy(v).project(camera);
          const m = Math.max(Math.abs(p.x), Math.abs(p.y));
          if (m > max) max = m;
        }
      }
    }
    return max;
  };

  const computeFitScale = () => {
    if (!group || !camera) return 1;
    camera.updateMatrixWorld(true);
    let s = group.scale.x || 1;
    for (let iter = 0; iter < 8; iter++) {
      group.scale.set(s, s, s);
      group.updateMatrixWorld(true);
      const extent = projectedExtent();
      if (!isFinite(extent) || extent < 1e-5) break;
      const factor = fitPadding() / extent;
      if (Math.abs(factor - 1) < 0.003) break;
      s *= factor;
    }
    group.scale.set(s, s, s);
    group.updateMatrixWorld(true);
    return s;
  };

  const computeCameraDistance = () => {
    const r = radius();
    return r * 2.67 + worldHeight() * 0.6;
  };

  // ---------- Scene build ----------
  const buildScene = () => {
    const w = Math.max(mountRef.clientWidth, 1);
    const h = Math.max(mountRef.clientHeight, 1);

    const { w: cw, h: ch } = chooseBaseCardSize(w, h);
    cardW = cw;
    cardH = ch;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mountRef.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(cameraFov(), w / h, 0.01, 1000);
    camera.position.set(0, 0, computeCameraDistance());
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    group = new THREE.Group();
    scene.add(group);

    const n = count();
    const step = (Math.PI * 2) / n;
    const r = radius();
    const list = panels();

    for (let i = 0; i < n; i++) {
      const panel = list[i] ?? { title: `Panel ${i + 1}` };

      const holder = new THREE.Group();
      holder.rotation.y = i * step;

      const { canvas, ctx } = makePanelCanvas();
      drawPanel(ctx, panel, null, 0);

      // Determine if this panel's title needs a marquee, and precompute
      // the scroll geometry. We do this once from the initial measurement.
      const innerW = cardW - 40;
      let measureSize = MAX_TITLE_SIZE;
      ctx.font = `bold ${measureSize}px system-ui, -apple-system, sans-serif`;
      while (measureSize > MIN_TITLE_SIZE && ctx.measureText(panel.title || "").width > innerW) {
        measureSize -= 1;
        ctx.font = `bold ${measureSize}px system-ui, -apple-system, sans-serif`;
      }
      const textWidth = ctx.measureText(panel.title || "").width;
      const overflow = Math.max(0, textWidth - innerW);
      const marquee = overflow > 0
        ? {
            textWidth,
            innerW,
            overflow,
            scrollDur: overflow / MARQUEE_SPEED_PX_PER_SEC, // seconds
            startPause: MARQUEE_START_PAUSE_MS / 1000,
            endPause: MARQUEE_END_PAUSE_MS / 1000,
          }
        : null;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 4;
      texture.needsUpdate = true;

      const geo = new THREE.PlaneGeometry(worldWidth(), worldHeight());
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, r);
      mesh.userData = {
        index: i,
        panel,
        texture,
        ctx,
        image: null,
        marquee,
        marqueeTime: 0,
        titleOffset: 0,
      };

      holder.add(mesh);
      group.add(holder);
      raycastTargets.push(mesh);

      if (panel.preview) {
        loadImage(panel.preview)
          .then((img) => {
            if (!isMounted) return;
            mesh.userData.image = img;
            drawPanel(ctx, panel, img, mesh.userData.titleOffset);
            texture.needsUpdate = true;
          })
          .catch((err) => console.warn("[Carousel3D] preview failed:", err));
      }
    }

    computeFitScale();
    renderer.render(scene, camera);
  };

  // ---------- Render loop ----------
  const update = (time) => {
    if (!isMounted) return;

    if (!lastFrameTime) lastFrameTime = time;
    let dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;
    if (dt > 0.1) dt = 0.1;

    if (spinning && !isDragging && targetRotationY === null) {
      rotationY += ((Math.PI * 2) / spinDuration()) * dt;
    }

    if (targetRotationY !== null) {
      const delta = targetRotationY - rotationY;
      rotationY += delta * Math.min(1, dt * 12);
      if (Math.abs(delta) < 0.001) {
        rotationY = targetRotationY;
        targetRotationY = null;
        startIdleTimer();
      }
    }

    if (!isDragging && targetRotationY === null && Math.abs(velocity) > 0.02) {
      velocity *= 0.94;
      rotationY += velocity * dt;
      if (Math.abs(velocity) < 0.1) {
        velocity = 0;
        snapToNearest();
      }
    }

    group.rotation.y = rotationY;

    for (const holder of group.children) {
      const mesh = holder.children[0];
      if (!mesh) continue;
      const ud = mesh.userData;

      // Per-card scale based on angular distance from the front.
      let effective = holder.rotation.y + group.rotation.y;
      effective = ((effective % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const diff = effective > Math.PI ? Math.PI * 2 - effective : effective;
      const t = diff / Math.PI;
      const eased = t * t;
      const s = 1 - eased * (1 - minScale());
      mesh.scale.set(s, s, 1);

      // Advance marquee if this panel's title overflows.
      if (ud.marquee) {
        ud.marqueeTime += dt;
        const m = ud.marquee;
        const cycle = m.startPause + m.scrollDur + m.endPause;
        const tCycle = ud.marqueeTime % cycle;

        let newOffset;
        if (tCycle < m.startPause) {
          newOffset = 0;
        } else if (tCycle < m.startPause + m.scrollDur) {
          const p = (tCycle - m.startPause) / m.scrollDur;
          newOffset = -m.overflow * p;
        } else {
          newOffset = -m.overflow;
        }

        // Only redraw when the offset actually changed (i.e. during scroll
        // phase). Skips redundant draws during the pauses.
        if (Math.abs(newOffset - ud.titleOffset) > 0.5) {
          ud.titleOffset = newOffset;
          drawPanel(ud.ctx, ud.panel, ud.image, newOffset);
          ud.texture.needsUpdate = true;
        }
      }
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(update);
  };

  // ---------- Lifecycle ----------
  onMount(() => {
    isMounted = true;
    buildScene();
    rafId = requestAnimationFrame(update);

    const onResize = () => {
      if (!renderer || !camera || !mountRef) return;
      const w = mountRef.clientWidth;
      const h = mountRef.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.z = computeCameraDistance();
      camera.updateProjectionMatrix();
      computeFitScale();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mountRef);

    onCleanup(() => {
      isMounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      raycastTargets.length = 0;
      if (scene) {
        scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
      }
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement) {
          renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
      }
    });
  });

  // ---------- Pointer / raycast ----------
  const hitTest = (clientX, clientY) => {
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(raycastTargets, false);
    return hits.length > 0 ? hits[0] : null;
  };

  const onPointerDown = (e) => {
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    pointerDownTime = performance.now();
    dragStartX = e.clientX;
    dragStartRotation = rotationY;
    velocity = 0;
    lastMoveTime = performance.now();
    targetRotationY = null;
    isDragging = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = "grabbing";
  };

  const onPointerMove = (e) => {
    if (e.buttons === 0 && !isDragging) {
      const hit = hitTest(e.clientX, e.clientY);
      e.currentTarget.style.cursor = hit ? "pointer" : "grab";
      return;
    }
    const totalDx = e.clientX - pointerDownX;
    if (!isDragging && Math.abs(totalDx) > 5) {
      isDragging = true;
      stopAutoSpin();
    }
    if (!isDragging) return;

    const now = performance.now();
    const dt = now - lastMoveTime;
    const dx = e.clientX - dragStartX;
    const degPerPx = 0.4;
    const newRotation = dragStartRotation + (dx * degPerPx * Math.PI) / 180;
    if (dt > 0) velocity = ((newRotation - rotationY) / dt) * 1000;
    lastMoveTime = now;
    rotationY = newRotation;
  };

  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    e.currentTarget.style.cursor = "grab";

    const totalDx = e.clientX - pointerDownX;
    const totalDy = e.clientY - pointerDownY;
    const totalTime = performance.now() - pointerDownTime;

    const wasClick =
      !isDragging &&
      Math.abs(totalDx) < 5 &&
      Math.abs(totalDy) < 5 &&
      totalTime < 500;

    if (wasClick) {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        const panel = hit.object.userData.panel;
        const sourceThreshold = (34 + 20) / cardH;
        if (panel.source && hit.uv.y < sourceThreshold) {
          window.open(panel.source, "_blank", "noopener,noreferrer");
        } else if (panel.href) {
          window.location.href = panel.href;
        }
      }
      isDragging = false;
      return;
    }

    if (isDragging) {
      if (Math.abs(velocity) < 0.5) {
        velocity = 0;
        snapToNearest();
      }
    }
    isDragging = false;
  };

  return (
    <div
      class="carousel3d-wrapper"
      style={{
        width: width(),
        height: height(),
        "min-height": minHeight(),
        cursor: "grab",
      }}
      ref={mountRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}