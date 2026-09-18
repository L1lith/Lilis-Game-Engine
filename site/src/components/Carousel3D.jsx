import { onMount, onCleanup } from "solid-js";
import * as THREE from "three";
import "@/styles/Carousel3D.scss";

/**
 * panels: Array<{
 *   title: string,
 *   preview: string,   // image URL
 *   href: string,      // demo link
 *   source: string,    // source link
 * }>
 */
export default function Carousel3D(props) {
  const panels = () => props.panels ?? [];
  const cardWidth = () => props.cardWidth ?? 320;   // px
  const cardHeight = () => props.cardHeight ?? 420; // px
  const spinDuration = () => props.spinDuration ?? 25; // seconds per revolution
  const idleDelay = () => props.idleDelay ?? 2500;
  const minScale = () => props.minScale ?? 0.72;
  const cameraFov = () => props.cameraFov ?? 38;
  const zoom = () => props.zoom ?? 1.0;

  // World units: 1 unit = 100 px, purely for readable numbers.
  const worldWidth = () => cardWidth() / 100;
  const worldHeight = () => cardHeight() / 100;

  let mountRef;
  let renderer, scene, camera, group;
  let rafId = null;
  let isMounted = true;

  let rotationY = 0;
  let targetRotationY = null;
  let spinning = true;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartRotation = 0;
  let lastMoveTime = 0;
  let velocity = 0; // rad/sec
  let lastFrameTime = 0;
  let idleTimer = null;

  let pointerDownX = 0;
  let pointerDownY = 0;
  let pointerDownTime = 0;

  const raycastTargets = [];
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  // ---------- Geometry helpers ----------
  const count = () => Math.max(panels().length, 1);
  const anglePerCard = () => (Math.PI * 2) / count();

  // Radius so cards don't overlap: half-width + gap, over sin(half angle).
  const radius = () => {
    const n = count();
    if (n <= 1) return 0;
    const halfAngle = Math.PI / n;
    const pad = 0.15;
    return (worldWidth() / 2 + pad) / Math.sin(halfAngle);
  };

  // Camera distance so the front card fills `zoom` fraction of the vertical FOV,
  // plus the ring radius so the back of the ring stays in front of the camera.
  const cameraDistance = () => {
    const fovRad = (cameraFov() * Math.PI) / 180;
    const fill = 0.62 * zoom();
    const dist = worldHeight() / 2 / Math.tan(fovRad / 2) / fill;
    return dist + radius();
  };

  // ---------- Interaction state ----------
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

  // ---------- Panel canvas ----------
  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load failed: " + src));
      img.src = src;
    });

  const drawPanel = (ctx, panel, image) => {
    const w = cardWidth();
    const h = cardHeight();
    const pad = 20;
    const innerW = w - pad * 2;

    // Background + border
    ctx.fillStyle = "#0e1a16";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120, 220, 180, 0.7)";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    // Title (wrapped)
    ctx.fillStyle = "#b8ffd9";
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const words = (panel.title || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (const word of words) {
      const test = cur ? cur + " " + word : word;
      if (ctx.measureText(test).width > innerW && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);

    const titleY = pad + 6;
    lines.forEach((line, i) => ctx.fillText(line, w / 2, titleY + i * 28));
    const titleHeight = Math.max(lines.length, 1) * 28;

    // Preview
    const sourceBtnH = panel.source ? 40 : 0;
    const sourceBtnGap = panel.source ? 12 : 0;
    const imgTop = titleY + titleHeight + 14;
    const imgBottom = h - pad - sourceBtnH - sourceBtnGap;
    const imgH = Math.max(0, imgBottom - imgTop);

    if (imgH > 0) {
      if (image) {
        // object-fit: cover
        const imgAspect = image.width / image.height;
        const boxAspect = innerW / imgH;
        let sx, sy, sw, sh;
        if (imgAspect > boxAspect) {
          sh = image.height;
          sw = sh * boxAspect;
          sx = (image.width - sw) / 2;
          sy = 0;
        } else {
          sw = image.width;
          sh = sw / boxAspect;
          sx = 0;
          sy = (image.height - sh) / 2;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, imgTop, innerW, imgH);
        ctx.clip();
        ctx.drawImage(image, sx, sy, sw, sh, pad, imgTop, innerW, imgH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(pad, imgTop, innerW, imgH);
        ctx.fillStyle = "rgba(120, 220, 180, 0.5)";
        ctx.font = "14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Loading preview…", w / 2, imgTop + imgH / 2);
      }
    }

    // Source button
    if (panel.source) {
      const btnY = h - pad - sourceBtnH;
      ctx.fillStyle = "#0b1a12";
      ctx.fillRect(pad, btnY, innerW, sourceBtnH);
      ctx.strokeStyle = "rgba(120, 220, 180, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(pad + 1, btnY + 1, innerW - 2, sourceBtnH - 2);
      ctx.fillStyle = "#b8ffd9";
      ctx.font = "15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("View Source Code", w / 2, btnY + sourceBtnH / 2);
    }
  };

  const makePanelCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = cardWidth() * dpr;
    canvas.height = cardHeight() * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas, ctx };
  };

  // ---------- Scene ----------
  const buildScene = () => {
    const w = Math.max(mountRef.clientWidth, 1);
    const h = Math.max(mountRef.clientHeight, 1);

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

    camera = new THREE.PerspectiveCamera(cameraFov(), w / h, 0.1, 200);
    camera.position.set(0, 0, cameraDistance());
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
      drawPanel(ctx, panel, null);

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
      mesh.userData = { index: i, panel, texture };

      holder.add(mesh);
      group.add(holder);
      raycastTargets.push(mesh);

      if (panel.preview) {
        loadImage(panel.preview)
          .then((img) => {
            if (!isMounted) return;
            drawPanel(ctx, panel, img);
            texture.needsUpdate = true;
          })
          .catch((err) => {
            console.warn("[Carousel3D] preview failed:", err);
          });
      }
    }

    renderer.render(scene, camera);
  };

  // ---------- Frame loop ----------
  const update = (time) => {
    if (!isMounted) return;

    if (!lastFrameTime) lastFrameTime = time;
    let dt = (time - lastFrameTime) / 1000;
    lastFrameTime = time;
    if (dt > 0.1) dt = 0.1;

    // Auto-spin
    if (spinning && !isDragging && targetRotationY === null) {
      rotationY += ((Math.PI * 2) / spinDuration()) * dt;
    }

    // Snap tween
    if (targetRotationY !== null) {
      const delta = targetRotationY - rotationY;
      rotationY += delta * Math.min(1, dt * 12);
      if (Math.abs(delta) < 0.001) {
        rotationY = targetRotationY;
        targetRotationY = null;
        startIdleTimer();
      }
    }

    // Momentum
    if (!isDragging && targetRotationY === null && Math.abs(velocity) > 0.02) {
      velocity *= 0.94;
      rotationY += velocity * dt;
      if (Math.abs(velocity) < 0.1) {
        velocity = 0;
        snapToNearest();
      }
    }

    group.rotation.y = rotationY;

    // Per-card scale based on angular distance from the front.
    for (const holder of group.children) {
      const mesh = holder.children[0];
      if (!mesh) continue;

      let effective = holder.rotation.y + group.rotation.y;
      effective = ((effective % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const diff = effective > Math.PI ? Math.PI * 2 - effective : effective;
      const t = diff / Math.PI;
      const eased = t * t;
      const s = 1 - eased * (1 - minScale());
      mesh.scale.set(s, s, 1);
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
      camera.updateProjectionMatrix();
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

  // ---------- Pointer ----------
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
    // Hover (no button) → cursor feedback only
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
        // UV (0,0) is bottom-left of the plane in three.js.
        // The source button is drawn in the bottom ~13% of the canvas.
        const sourceThreshold = (40 + 20) / cardHeight();
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
      // Otherwise momentum branch in `update` will slow it and then snap.
    }
    isDragging = false;
  };

  return (
    <div
      aria-hidden 
      class="carousel3d-wrapper"
      style={{ cursor: "grab" }}
      ref={mountRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}