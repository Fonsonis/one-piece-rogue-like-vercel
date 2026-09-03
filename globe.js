// ============================================================================
// ONE PIECE WORLD 3D GLOBE ENGINE (Three.js)
// Fiel al mapa oficial de One Piece (op-maps.com)
// Incluye los 4 Mares (North, East, West, South Blue), Cinturones de la Calma,
// Grand Line (Paraíso y Nuevo Mundo) y el continente rocoso de la Red Line.
// ============================================================================

let globeState = null;

function isThreeAvailable() {
  return typeof THREE !== 'undefined';
}

function initOnePieceGlobe(containerEl, onSelectSaga, initialFocusIdx = null) {
  if (!isThreeAvailable() || !containerEl) return null;
  destroyGlobe();

  const width = containerEl.clientWidth || 600;
  const height = containerEl.clientHeight || 480;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050c1a, 0.01);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 15.5); // Esfera grande y detallada

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  containerEl.innerHTML = '';
  containerEl.appendChild(renderer.domElement);

  // ---------- Luces ----------
  const ambientLight = new THREE.AmbientLight(0xf0f5ff, 1.1);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 1.7);
  sunLight.position.set(15, 12, 18);
  scene.add(sunLight);

  const backLight = new THREE.DirectionalLight(0x336699, 0.8);
  backLight.position.set(-15, -8, -12);
  scene.add(backLight);

  // ---------- Fondo de Estrellas ----------
  const starGeo = new THREE.BufferGeometry();
  const starCount = 800;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 90;
    starPos[i + 1] = (Math.random() - 0.5) * 90;
    starPos[i + 2] = (Math.random() - 0.5) * 90;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.85 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ---------- Esfera del Planeta Azul (Textura Fiel al Mapa Oficial OP-MAPS) ----------
  const radius = 8.8;
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Generación Procedural de Alta Resolución (2048x1024)
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 2048;
  textureCanvas.height = 1024;
  const ctx = textureCanvas.getContext('2d');

  // 1. Océano Base de los 4 Mares (North, East, West, South Blue)
  ctx.fillStyle = '#184e77';
  ctx.fillRect(0, 0, 2048, 1024);

  // Detalle marino / Olas suaves
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  for (let i = 0; i < 900; i++) {
    const rx = Math.random() * 2048;
    const ry = Math.random() * 1024;
    const rw = Math.random() * 70 + 10;
    ctx.fillRect(rx, ry, rw, 2);
  }

  // 2. Cinturones de la Calma (Calm Belts) - Franjas turquesa/verdosas pálidas
  ctx.fillStyle = '#64dfdf';
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 420, 2048, 45); // Upper Calm Belt
  ctx.fillRect(0, 559, 2048, 45); // Lower Calm Belt
  ctx.globalAlpha = 1.0;

  // 3. Canal del Grand Line (Ecuatorial)
  ctx.fillStyle = '#1e6091';
  ctx.fillRect(0, 465, 2048, 94);

  // Ruta punteada dorada del Grand Line
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.75)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 8]);
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(2048, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Red Line Continental (Continente Rocoso de Pergamino/Arena)
  const drawRedLineContinent = (centerX) => {
    ctx.fillStyle = '#d4a373'; // Tono roca/pergamino oficial
    ctx.beginPath();
    ctx.moveTo(centerX - 95, 0);
    for (let y = 0; y <= 1024; y += 32) {
      const offset = Math.sin(y * 0.03) * 25 + Math.cos(y * 0.07) * 15;
      if (y >= 480 && y <= 544) {
        // Estrechamiento de Reverse Mountain / Mary Geoise
        ctx.lineTo(centerX - 35, y);
      } else {
        ctx.lineTo(centerX - 85 + offset, y);
      }
    }
    ctx.lineTo(centerX + 95, 1024);
    for (let y = 1024; y >= 0; y -= 32) {
      const offset = Math.cos(y * 0.04) * 25 + Math.sin(y * 0.06) * 15;
      if (y >= 480 && y <= 544) {
        ctx.lineTo(centerX + 35, y);
      } else {
        ctx.lineTo(centerX + 85 + offset, y);
      }
    }
    ctx.closePath();
    ctx.fill();

    // Bordes rocosos marrones
    ctx.strokeStyle = '#8c5e3c';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Cruz de Canales de Reverse Mountain
    ctx.fillStyle = '#1e6091';
    ctx.beginPath();
    ctx.arc(centerX, 512, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64dfdf';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  drawRedLineContinent(0);      // Reverse Mountain (Oeste)
  drawRedLineContinent(2048);   // Envolvente
  drawRedLineContinent(1024);   // Mary Geoise / Red Line Central

  // 5. Nombres y Rotulaciones de los 4 Mares y Zonas (Fieles al Mapa OP-MAPS)
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';

  // Los 4 Mares
  ctx.fillText('NORTH BLUE', 450, 180);
  ctx.fillText('EAST BLUE', 1550, 180);
  ctx.fillText('WEST BLUE', 450, 880);
  ctx.fillText('SOUTH BLUE', 1550, 880);

  // Red Line
  ctx.fillStyle = '#ffe6a7';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('RED LINE', 1024, 250);
  ctx.fillText('RED LINE', 1024, 780);

  // Grand Line & Calm Belts
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('GRAND LINE — PARAÍSO', 500, 502);
  ctx.fillText('GRAND LINE — NUEVO MUNDO', 1550, 502);

  ctx.fillStyle = '#b7e4c7';
  ctx.font = '16px sans-serif';
  ctx.fillText('CINTURÓN DE LA CALMA', 500, 442);
  ctx.fillText('CINTURÓN DE LA CALMA', 1550, 442);
  ctx.fillText('CINTURÓN DE LA CALMA', 500, 582);
  ctx.fillText('CINTURÓN DE LA CALMA', 1550, 582);

  ctx.shadowBlur = 0;

  const oceanTexture = new THREE.CanvasTexture(textureCanvas);
  const planetGeo = new THREE.SphereGeometry(radius, 64, 64);
  const planetMat = new THREE.MeshPhongMaterial({
    map: oceanTexture,
    shininess: 35,
    specular: new THREE.Color(0x4488cc),
  });
  const planetMesh = new THREE.Mesh(planetGeo, planetMat);
  globeGroup.add(planetMesh);

  // Resplandor Atmosférico (Aura)
  const atmosGeo = new THREE.SphereGeometry(radius * 1.035, 32, 32);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.14,
    side: THREE.BackSide,
  });
  const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
  globeGroup.add(atmosMesh);

  // ---------- Red Line 3D (Cinturón Montañoso Elevado) ----------
  const redLineGroup = new THREE.Group();
  const redLineGeo = new THREE.TorusGeometry(radius + 0.06, 0.52, 16, 120);
  const redLineMat = new THREE.MeshStandardMaterial({
    color: 0xc48b57,
    roughness: 0.75,
    metalness: 0.2,
    bumpScale: 0.08,
  });
  const redLineMesh = new THREE.Mesh(redLineGeo, redLineMat);
  redLineMesh.rotation.y = Math.PI / 2;
  redLineGroup.add(redLineMesh);
  globeGroup.add(redLineGroup);

  // ---------- Grand Line 3D (Canal Marino Ecuatorial) ----------
  const grandLineGeo = new THREE.TorusGeometry(radius + 0.04, 0.38, 12, 120);
  const grandLineMat = new THREE.MeshStandardMaterial({
    color: 0xffb703,
    roughness: 0.25,
    metalness: 0.45,
    transparent: true,
    opacity: 0.85,
  });
  const grandLineMesh = new THREE.Mesh(grandLineGeo, grandLineMat);
  grandLineMesh.rotation.x = Math.PI / 2;
  globeGroup.add(grandLineMesh);

  // ---------- Determinación de la Saga Activa ----------
  const findCurrentSagaIdx = () => {
    for (let i = 0; i < SAGAS.length; i++) {
      if (sagaUnlocked(i)) {
        const diffWinsMap = (meta.sagaDiffWins && meta.sagaDiffWins[SAGAS[i].id]) || {};
        if (Object.keys(diffWinsMap).length === 0) return i;
      }
    }
    for (let i = SAGAS.length - 1; i >= 0; i--) {
      if (sagaUnlocked(i)) return i;
    }
    return 0;
  };

  let activeSagaIdx = findCurrentSagaIdx();
  let focusedSagaIdx = initialFocusIdx !== null ? clamp(initialFocusIdx, 0, SAGAS.length - 1) : activeSagaIdx;

  // ---------- Coordenadas de los Nodos 3D ----------
  const sagaNodes = [];
  const nodeGroup = new THREE.Group();
  globeGroup.add(nodeGroup);

  // Longitudes calculadas para coincidir exactamente con el Grand Line oficial
  // Paraíso (0° a 170°), Cruce Red Line / Gyojin (180°), Nuevo Mundo (190° a 310°)
  const sagaLongitudes = [0, 36, 72, 108, 144, 168, 185, 220, 260, 300];

  SAGAS.forEach((s, idx) => {
    const isUnlocked = sagaUnlocked(idx);
    const diffWinsMap = (meta.sagaDiffWins && meta.sagaDiffWins[s.id]) || {};
    const isBeaten = Object.keys(diffWinsMap).length > 0;
    const isCurrentActive = idx === activeSagaIdx;

    const lonDeg = sagaLongitudes[idx] || (idx * 36);
    const lon = (lonDeg * Math.PI) / 180;
    const lat = Math.sin(idx * 0.8) * 0.15;

    const rPos = radius + 0.35;
    const x = rPos * Math.cos(lat) * Math.cos(lon);
    const y = rPos * Math.sin(lat);
    const z = rPos * Math.cos(lat) * Math.sin(lon);

    const baseColor = isBeaten ? 0x2ec4b6 : isCurrentActive ? 0xff0055 : isUnlocked ? 0xffb703 : 0x555555;

    const nGeo = new THREE.SphereGeometry(0.35, 20, 20);
    const nMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.15,
      metalness: 0.6,
      emissive: isCurrentActive ? 0xbb0033 : isUnlocked ? (isBeaten ? 0x115544 : 0x774400) : 0x111111,
      emissiveIntensity: 0.6,
    });
    const nodeMesh = new THREE.Mesh(nGeo, nMat);
    nodeMesh.position.set(x, y, z);
    nodeMesh.userData = { sagaIdx: idx, saga: s, unlocked: isUnlocked, beaten: isBeaten, isCurrentActive, lon, lat, baseColor };
    nodeGroup.add(nodeMesh);

    // Anillo exterior de resplandor
    const ringGeo = new THREE.RingGeometry(0.42, 0.62, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(x, y, z);
    ringMesh.lookAt(x * 2, y * 2, z * 2);
    nodeGroup.add(ringMesh);

    sagaNodes.push({ mesh: nodeMesh, ring: ringMesh, idx, saga: s, lon, lat, baseColor });
  });

  // ---------- Cálculo de Ángulos de la Cámara ----------
  const getAnglesForIndex = idx => {
    const node = sagaNodes[idx];
    if (!node) return { rotY: 0, rotX: 0 };
    return {
      rotY: node.lon - Math.PI / 2,
      rotX: node.lat,
    };
  };

  let { rotY: targetRotY, rotX: targetRotX } = getAnglesForIndex(focusedSagaIdx);
  // Orientación inicial inmediata
  globeGroup.rotation.y = targetRotY;
  globeGroup.rotation.x = targetRotX;

  // ---------- UI Overlays en el Contenedor ----------
  // 1. Barra de Navegación por Flechas ◀ RETROCEDER / AVANZAR ▶
  let navOverlay = containerEl.querySelector('#globe-nav-overlay');
  if (!navOverlay) {
    navOverlay = document.createElement('div');
    navOverlay.id = 'globe-nav-overlay';
    navOverlay.className = 'globe-nav-overlay';
    containerEl.appendChild(navOverlay);
  }

  // 2. Tarjeta Inferior de la Saga Enfocada
  let bottomCard = containerEl.querySelector('#globe-bottom-card');
  if (!bottomCard) {
    bottomCard = document.createElement('div');
    bottomCard.id = 'globe-bottom-card';
    bottomCard.className = 'globe-bottom-card';
    containerEl.appendChild(bottomCard);
  }

  let autoReturnEnabled = true;
  let lastInteractionTime = Date.now();

  const updateUIOverlays = () => {
    const s = SAGAS[focusedSagaIdx];
    const unlocked = sagaUnlocked(focusedSagaIdx);
    const diffWinsMap = (meta.sagaDiffWins && meta.sagaDiffWins[s.id]) || {};
    const isBeaten = Object.keys(diffWinsMap).length > 0;
    const isSelectedCleared = !!diffWinsMap[selectedDiff];
    const curDiffName = (DIFFICULTIES.find(d => d.id === selectedDiff) || {}).name;
    const isCurrentActive = focusedSagaIdx === activeSagaIdx;

    const grandLineZone = focusedSagaIdx < 6 ? 'Paraíso 🌊' : focusedSagaIdx === 6 ? 'Cruce Red Line ⚓' : 'Nuevo Mundo ⚡';

    navOverlay.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn small gray globe-arrow-btn" id="gnav-prev" ${focusedSagaIdx === 0 ? 'disabled' : ''}>◀ RETROCEDER</button>
        <button class="btn small gold" id="gnav-active" title="Ir a tu saga activa actual">🎯 MI SAGA (${SAGAS[activeSagaIdx].name})</button>
        <button class="btn small gray globe-arrow-btn" id="gnav-next" ${focusedSagaIdx === SAGAS.length - 1 ? 'disabled' : ''}>AVANZAR ▶</button>
      </div>
      <button class="btn small ${autoReturnEnabled ? 'blue' : 'gray'}" id="gnav-lock" style="font-size:7px;padding:4px 6px;">
        ${autoReturnEnabled ? '⏱️ RETORNO 3s: SÍ' : '🔒 GIRO LIBRE FIJO'}
      </button>
    `;

    bottomCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="text-align:left;">
          <div style="font-size:12px;font-weight:bold;color:${s.color || '#fff'};">
            ${unlocked ? '' : '🔒 '}${s.name} <small style="color:#aaa;font-size:8px;">(${grandLineZone} · ${idxToRoman(focusedSagaIdx + 1)} de ${SAGAS.length})</small>
          </div>
          <small style="color:#ccc;font-size:8px;">${s.sub}</small>
          <div style="font-size:8px;margin-top:4px;">
            ${isSelectedCleared
              ? `<span class="diff-cleared-tag" style="display:inline-block;margin-right:6px;">⭐ ${curDiffName} SUPERADA</span>`
              : `<span class="diff-pending-tag" style="display:inline-block;margin-right:6px;">🔒 ${curDiffName} PENDIENTE</span>`}
            ${isCurrentActive ? '<span style="color:var(--accent);font-weight:bold;">📍 TU RUTA ACTUAL</span> · ' : ''}
            Dificultades Superadas: <b>${Object.keys(diffWinsMap).length}/5 ⭐</b>
          </div>
        </div>
        <div>
          ${unlocked
            ? `<button class="btn green" id="gnav-enter" style="padding:8px 16px;font-size:10px;">🏴‍☠️ ENTRAR A LA SAGA</button>`
            : `<button class="btn gray" disabled style="padding:8px 16px;font-size:10px;">🔒 BLOQUEADA</button>`}
        </div>
      </div>
    `;

    navOverlay.querySelector('#gnav-prev').onclick = () => focusSaga(focusedSagaIdx - 1);
    navOverlay.querySelector('#gnav-next').onclick = () => focusSaga(focusedSagaIdx + 1);
    navOverlay.querySelector('#gnav-active').onclick = () => focusSaga(activeSagaIdx);
    navOverlay.querySelector('#gnav-lock').onclick = () => {
      autoReturnEnabled = !autoReturnEnabled;
      updateUIOverlays();
      toast(autoReturnEnabled ? '⏱️ Retorno automático tras 3s activado' : '🔒 Giro libre fijo');
    };

    const enterBtn = bottomCard.querySelector('#gnav-enter');
    if (enterBtn) {
      enterBtn.onclick = () => {
        if (typeof onSelectSaga === 'function') onSelectSaga(focusedSagaIdx);
      };
    }
  };

  const focusSaga = idx => {
    focusedSagaIdx = clamp(idx, 0, SAGAS.length - 1);
    if (typeof window.onGlobeFocusChange === 'function') {
      window.onGlobeFocusChange(focusedSagaIdx);
    }
    const angles = getAnglesForIndex(focusedSagaIdx);
    targetRotY = angles.rotY;
    targetRotX = angles.rotX;
    lastInteractionTime = Date.now();
    updateUIOverlays();
  };

  function idxToRoman(n) {
    const r = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    return r[n - 1] || n;
  }

  updateUIOverlays();

  // ---------- Raycaster a Prueba de Oclusión (Solo Nodos Frontales) ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let hoveredNode = null;

  const onPointerDown = e => {
    isDragging = true;
    lastInteractionTime = Date.now();
    prevMousePos = { x: e.clientX || e.touches[0].clientX, y: e.clientY || e.touches[0].clientY };
  };

  const onPointerMove = e => {
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    if (isDragging) {
      lastInteractionTime = Date.now();
      const deltaX = clientX - prevMousePos.x;
      const deltaY = clientY - prevMousePos.y;
      targetRotY += deltaX * 0.005;
      targetRotX += deltaY * 0.005;
      targetRotX = Math.max(-Math.PI / 2.6, Math.min(Math.PI / 2.6, targetRotX));
      prevMousePos = { x: clientX, y: clientY };
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([...sagaNodes.map(n => n.mesh), planetMesh]);

    if (hits.length > 0 && hits[0].object !== planetMesh) {
      const hitNode = hits[0].object;
      if (hoveredNode !== hitNode) {
        if (hoveredNode) hoveredNode.scale.set(1, 1, 1);
        hoveredNode = hitNode;
        hoveredNode.scale.set(1.4, 1.4, 1.4);
        containerEl.style.cursor = 'pointer';
      }
    } else if (hoveredNode) {
      hoveredNode.scale.set(1, 1, 1);
      hoveredNode = null;
      containerEl.style.cursor = 'grab';
    }
  };

  const onPointerUp = () => {
    if (isDragging) {
      isDragging = false;
      lastInteractionTime = Date.now();
    }
  };

  const onClick = e => {
    if (!hoveredNode) return;
    const idx = hoveredNode.userData.sagaIdx;
    focusSaga(idx);
  };

  const domEl = renderer.domElement;
  domEl.addEventListener('mousedown', onPointerDown);
  domEl.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  domEl.addEventListener('touchstart', onPointerDown, { passive: true });
  domEl.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  domEl.addEventListener('click', onClick);

  // Redimensionado
  const onResize = () => {
    if (!containerEl || !renderer) return;
    const nw = containerEl.clientWidth || 600;
    const nh = containerEl.clientHeight || 480;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  };
  window.addEventListener('resize', onResize);

  // ---------- Bucle de Animación ----------
  let animFrameId = null;
  const animate = () => {
    animFrameId = requestAnimationFrame(animate);

    // Auto-Retorno tras 3 segundos de inactividad
    if (!isDragging && autoReturnEnabled && Date.now() - lastInteractionTime > 3000) {
      const angles = getAnglesForIndex(focusedSagaIdx);
      targetRotY = angles.rotY;
      targetRotX = angles.rotX;
    }

    // Suavizado de rotación (Inercia)
    globeGroup.rotation.y += (targetRotY - globeGroup.rotation.y) * 0.08;
    globeGroup.rotation.x += (targetRotX - globeGroup.rotation.x) * 0.08;

    // Resplandor y diferenciación visual clara de la isla enfocada/seleccionada
    const time = Date.now() * 0.003;
    sagaNodes.forEach(n => {
      const isFocused = n.idx === focusedSagaIdx;
      if (isFocused) {
        n.mesh.material.color.setHex(0x00ffff);
        n.mesh.material.emissive.setHex(0x0088cc);
        n.mesh.material.emissiveIntensity = 1.0;
        n.ring.material.color.setHex(0x00ffff);
        const s = 1.8 + Math.sin(time * 2) * 0.25;
        n.ring.scale.set(s, s, s);
      } else {
        n.mesh.material.color.setHex(n.baseColor);
        n.mesh.material.emissive.setHex(n.mesh.userData.isCurrentActive ? 0xbb0033 : n.mesh.userData.unlocked ? (n.mesh.userData.beaten ? 0x115544 : 0x774400) : 0x111111);
        n.mesh.material.emissiveIntensity = 0.6;
        n.ring.material.color.setHex(n.baseColor);
        const s = 1.0 + Math.sin(time + n.idx) * 0.12;
        n.ring.scale.set(s, s, s);
      }
    });

    starField.rotation.y -= 0.0003;

    renderer.render(scene, camera);
  };
  animate();

  // Guardar estado global del globo para destrucción limpia
  globeState = {
    renderer,
    animFrameId,
    focusedSagaIdx,
    cleanup: () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
      if (domEl) {
        domEl.removeEventListener('mousedown', onPointerDown);
        domEl.removeEventListener('mousemove', onPointerMove);
        domEl.removeEventListener('touchstart', onPointerDown);
        domEl.removeEventListener('touchmove', onPointerMove);
        domEl.removeEventListener('click', onClick);
      }
      renderer.dispose();
      containerEl.innerHTML = '';
      globeState = null;
    },
  };

  return globeState;
}

function destroyGlobe() {
  if (globeState && typeof globeState.cleanup === 'function') {
    globeState.cleanup();
  }
}
