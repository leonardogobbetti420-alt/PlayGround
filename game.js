import * as THREE from './vendor/three.module.js';

const canvas = document.querySelector('#game');
const stage = document.querySelector('.game-stage');
const scoreNode = document.querySelector('#score');
const bestNode = document.querySelector('#best');
const distanceNode = document.querySelector('#distance');
const intro = document.querySelector('#intro');
const endCard = document.querySelector('#endCard');
const finalScore = document.querySelector('#finalScore');
const newRecord = document.querySelector('#newRecord');
const pauseButton = document.querySelector('#pauseButton');
const pauseOverlay = document.querySelector('#pauseOverlay');
const toast = document.querySelector('#toast');
const touchZone = document.querySelector('#touchZone');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
renderer.setClearColor(0x26374d, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
camera.position.set(0, 0, 24);
const ambient = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambient);
const sunLight = new THREE.DirectionalLight(0xffcf9a, 1.2);
sunLight.position.set(-5, 8, 10);
scene.add(sunLight);

let viewportWidth = 16, viewportHeight = 9, unit = 1, groundY = -2.1, gameState = 'ready';
let lastTime = 0, runTime = 0, distance = 0, coins = 0, spawnTimer = 0, coinTimer = 1.4, speed = 6.2;
let jumpVelocity = 0, isGrounded = true, best = Number(localStorage.getItem('dustbyte-best') || 0), newBest = false;
let muted = true, soundContext = null;
bestNode.textContent = String(best).padStart(5, '0');

function pixelTexture(paint, width = 32, height = 32) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; paint(ctx, width, height);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; return tex;
}
function sprite(tex, w, h, z = 2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.z = z; scene.add(m); return m;
}
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

const skyTex = pixelTexture((ctx, w, h) => {
  const bands = ['#344b68','#46546f','#625c77','#8b6578','#c27672','#e88b68','#f5a46d','#f7bd78'];
  bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor(i * h / bands.length), w, Math.ceil(h / bands.length)); });
  for (let i = 0; i < 17; i++) { const x = (i * 47 + 13) % w, y = 7 + ((i * 19) % 38); rect(ctx, x, y, i % 3 ? 1 : 2, 1, i % 2 ? '#fbd8a3' : '#f6c599'); }
});
const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false })); skyMesh.position.z = -18; scene.add(skyMesh);
const sunTex = pixelTexture((ctx) => {
  ctx.fillStyle = '#ffdb91'; ctx.fillRect(8, 8, 16, 16);
  ctx.fillStyle = '#ffe8ad'; ctx.fillRect(10, 6, 12, 2); ctx.fillRect(6, 10, 2, 12); ctx.fillRect(24, 10, 2, 12); ctx.fillRect(10, 24, 12, 2);
  ctx.fillStyle = '#f6b77c'; ctx.fillRect(8, 19, 16, 2); ctx.fillRect(10, 23, 12, 1);
});
const sun = sprite(sunTex, 2.05, 2.05, -14);
const farTex = pixelTexture((ctx, w, h) => {
  const peaks = [[0,60],[28,25],[46,46],[77,9],[104,42],[133,18],[161,51],[192,5],[224,37],[258,13],[285,48],[320,25]];
  ctx.beginPath(); ctx.moveTo(0,h); peaks.forEach(([x,y])=>ctx.lineTo(x,y)); ctx.lineTo(w,h); ctx.closePath(); ctx.fillStyle='#755f74'; ctx.fill();
  ctx.fillStyle='#947076'; ctx.fillRect(0,83,w,27);
  ctx.fillStyle='#ad796f'; for(let i=0;i<16;i++){ctx.fillRect((i*27)%w,74+(i%3)*8,3+(i%4),2)}
});
const nearTex = pixelTexture((ctx, w, h) => {
  ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,42);ctx.lineTo(39,20);ctx.lineTo(61,41);ctx.lineTo(96,10);ctx.lineTo(125,48);ctx.lineTo(164,19);ctx.lineTo(202,51);ctx.lineTo(240,15);ctx.lineTo(278,42);ctx.lineTo(320,22);ctx.lineTo(320,h);ctx.closePath();ctx.fillStyle='#65546a';ctx.fill();
  ctx.fillStyle='#755563';ctx.fillRect(0,70,w,40);
  ctx.fillStyle='#9b665e'; for(let i=0;i<13;i++){const x=(i*41+8)%w;ctx.fillRect(x,83+(i%3)*6,2+(i%4),2)}
});
const far = sprite(farTex, 1, 3.3, -11); far.position.y = -0.5;
const near = sprite(nearTex, 1, 2.6, -8); near.position.y = -1.35;

function makeRunner(frame) {
  return pixelTexture((ctx) => {
    // shadow
    rect(ctx, 3, 21, 18, 2, '#47374a');
    // trailing scarf
    rect(ctx, 3, 7, 5, 3, '#d6584e'); rect(ctx, 1, 9 + frame, 5, 2, '#ec7654'); rect(ctx, 4, 11 + frame, 4, 2, '#f2a15d');
    // head and hair
    rect(ctx, 10, 2, 9, 8, '#eaa878'); rect(ctx, 9, 1, 10, 3, '#392c3f'); rect(ctx, 8, 3, 3, 5, '#392c3f'); rect(ctx, 11, 8, 3, 2, '#d98d70');
    // eye
    rect(ctx, 16, 5, 2, 2, '#2e3244');
    // jacket
    rect(ctx, 8, 10, 11, 7, '#3b7180'); rect(ctx, 9, 11, 9, 5, '#5796a0'); rect(ctx, 13, 11, 2, 5, '#e0b768');
    // arms
    rect(ctx, 6, 11, 3, 5, '#e9a47e'); rect(ctx, 18, 11, 3, 4, '#e9a47e');
    // legs alternate
    if (frame === 0) { rect(ctx, 9, 16, 4, 4, '#33394b'); rect(ctx, 15, 16, 4, 3, '#33394b'); rect(ctx, 6, 19, 7, 3, '#e5c18b'); rect(ctx, 15, 19, 7, 3, '#e5c18b'); }
    else { rect(ctx, 9, 16, 4, 3, '#33394b'); rect(ctx, 15, 16, 4, 4, '#33394b'); rect(ctx, 7, 19, 7, 3, '#e5c18b'); rect(ctx, 14, 19, 7, 3, '#e5c18b'); }
    // small pixel highlights
    rect(ctx, 11, 12, 2, 1, '#81b3aa'); rect(ctx, 6, 12, 2, 2, '#ffbe82');
  }, 24, 24);
}
const runnerTextures = [makeRunner(0), makeRunner(1)];
const runner = sprite(runnerTextures[0], 1.18, 1.42, 4);
const runnerMaterial = runner.material;

const cactusTex = pixelTexture((ctx) => {
  rect(ctx, 11, 6, 9, 23, '#31504b'); rect(ctx, 13, 5, 5, 23, '#58806a');
  rect(ctx, 5, 13, 8, 5, '#31504b'); rect(ctx, 5, 11, 5, 8, '#58806a'); rect(ctx, 4, 12, 2, 4, '#80a078');
  rect(ctx, 18, 18, 7, 5, '#31504b'); rect(ctx, 21, 15, 5, 8, '#58806a'); rect(ctx, 23, 16, 2, 4, '#82a57c');
  rect(ctx, 14, 7, 2, 4, '#91ad80'); rect(ctx, 9, 12, 2, 2, '#91ad80');
}, 32, 32);
const rockTex = pixelTexture((ctx) => {
  rect(ctx, 3, 19, 26, 10, '#54455a'); rect(ctx, 6, 15, 20, 12, '#746070'); rect(ctx, 10, 10, 14, 12, '#8a6c76');
  rect(ctx, 13, 8, 8, 4, '#9d777a'); rect(ctx, 8, 17, 7, 3, '#b17d78'); rect(ctx, 19, 14, 5, 3, '#a97a78');
  rect(ctx, 4, 26, 25, 3, '#463d52');
}, 32, 32);
const coinTex = pixelTexture((ctx) => {
  rect(ctx, 11, 3, 10, 2, '#ffe89b'); rect(ctx, 7, 5, 18, 3, '#ffd967'); rect(ctx, 5, 8, 22, 16, '#efaa45');
  rect(ctx, 7, 7, 18, 17, '#ffda68'); rect(ctx, 9, 9, 14, 13, '#f6b94c'); rect(ctx, 11, 10, 3, 10, '#ffe58a');
  rect(ctx, 7, 24, 18, 3, '#d9873d'); rect(ctx, 11, 27, 10, 2, '#be7043');
}, 32, 32);
const birdTex = pixelTexture((ctx) => {
  rect(ctx, 11, 11, 12, 8, '#39384b'); rect(ctx, 15, 13, 9, 4, '#a35b59');
  rect(ctx, 19, 13, 2, 2, '#ffe2a0'); rect(ctx, 20, 14, 1, 1, '#353347');
  rect(ctx, 5, 8, 8, 5, '#464053'); rect(ctx, 2, 4, 8, 5, '#464053'); rect(ctx, 3, 5, 5, 2, '#c27762');
  rect(ctx, 14, 18, 7, 2, '#302f42'); rect(ctx, 9, 18, 6, 2, '#302f42');
}, 32, 24);

let groundTiles = [], obstacles = [], pickups = [], particles = [];
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x654b52 });
const groundTopMaterial = new THREE.MeshBasicMaterial({ color: 0xc48163 });
const groundSideMaterial = new THREE.MeshBasicMaterial({ color: 0x513f50 });
function makeGroundTile() {
  const group = new THREE.Group(); scene.add(group);
  const base = new THREE.Mesh(new THREE.BoxGeometry(8, .66, .7), [groundSideMaterial, groundSideMaterial, groundTopMaterial, groundMaterial, groundSideMaterial, groundSideMaterial]);
  base.position.y = -.33; group.add(base);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(8, .07, .72), new THREE.MeshBasicMaterial({ color: 0xf0a36d }));
  trim.position.y = -.015; group.add(trim);
  // chunky, repeating pixel flecks across the dirt top
  for (let i = 0; i < 10; i++) {
    const fleck = new THREE.Mesh(new THREE.BoxGeometry(.13 + (i % 3) * .06, .04, .74), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x986269 : 0xb57461 }));
    fleck.position.set(-3.55 + i * .77, -.10 - (i % 2) * .13, 0); group.add(fleck);
  }
  return group;
}
for (let i = 0; i < 5; i++) { const tile = makeGroundTile(); groundTiles.push(tile); }

function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return;
  viewportHeight = r.width / r.height > 1.15 ? 8.5 : Math.max(8.5, 8.5 * (1.15 / (r.width / r.height)));
  unit = viewportHeight / 8.5; viewportWidth = viewportHeight * r.width / r.height;
  camera.left = -viewportWidth / 2; camera.right = viewportWidth / 2;
  camera.top = viewportHeight / 2; camera.bottom = -viewportHeight / 2; camera.updateProjectionMatrix();
  const pixelHeight = Math.max(180, Math.min(360, Math.round(r.height * .58)));
  renderer.setSize(Math.round(pixelHeight * r.width / r.height), pixelHeight, false);
  groundY = -2.05 * unit;
  skyMesh.scale.set(viewportWidth * 1.25, viewportHeight * 1.16, 1); skyMesh.position.y = .22 * unit;
  sun.position.set(viewportWidth * .25, .95 * unit, -14); sun.scale.setScalar(unit);
  far.position.set(0, -.45 * unit, -11); far.scale.set(viewportWidth * 1.22, 3.2 * unit, 1);
  near.position.set(0, -1.32 * unit, -8); near.scale.set(viewportWidth * 1.18, 2.45 * unit, 1);
  const tileWidth = 8 * unit;
  groundTiles.forEach((tile, i) => { tile.scale.set(unit, unit, unit); tile.position.set((-2 + i) * tileWidth + ((distance * .4) % tileWidth), groundY, 0); });
  runner.scale.set(1.16 * unit, 1.42 * unit, 1); runner.position.x = -Math.min(2.4 * unit, viewportWidth * .30); runner.position.y = groundY + .71 * unit;
  obstacles.forEach(o => { o.mesh.scale.set(o.w * unit, o.h * unit, 1); o.mesh.position.y = groundY + o.y * unit; });
  pickups.forEach(p => { p.mesh.scale.set(.64 * unit, .64 * unit, 1); p.mesh.position.y = groundY + p.y * unit; });
}
new ResizeObserver(resize).observe(stage);
resize();

let sliding = false, slideTimer = 0, animClock = 0;
function makeObstacle(kind) {
  const cactus = kind === 'cactus'; const bird = kind === 'bird';
  const h = cactus ? 1.28 : bird ? .70 : .78, w = cactus ? .92 : bird ? 1.05 : .92;
  const tex = cactus ? cactusTex : bird ? birdTex : rockTex;
  const mesh = sprite(tex, w * unit, h * unit, 3);
  mesh.scale.set(w * unit, h * unit, 1);
  mesh.position.set(viewportWidth / 2 + w, groundY + (bird ? 1.48 : h / 2) * unit, 0);
  obstacles.push({ mesh, kind, w, h, y: bird ? 1.48 : h / 2, scored: false });
}
function makeCoinLine() {
  const count = 3 + Math.floor(Math.random() * 3);
  const startX = viewportWidth / 2 + 1.5;
  for (let i = 0; i < count; i++) {
    const y = 1.2 + (Math.random() > .5 ? .52 : 0);
    const mesh = sprite(coinTex, .62 * unit, .62 * unit, 2.5);
    mesh.position.set(startX + i * .84 * unit, groundY + y * unit, 0);
    pickups.push({ mesh, x: startX + i * .84 * unit, y, taken: false, phase: i * .8 });
  }
}

function playTone(frequency = 520, duration = .08, type = 'square', volume = .035) {
  if (muted) return;
  try {
    soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (soundContext.state === 'suspended') soundContext.resume();
    const osc = soundContext.createOscillator(), gain = soundContext.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, soundContext.currentTime);
    gain.gain.setValueAtTime(volume, soundContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, soundContext.currentTime + duration);
    osc.connect(gain); gain.connect(soundContext.destination); osc.start(); osc.stop(soundContext.currentTime + duration);
  } catch { /* Audio is optional; gameplay stays available without it. */ }
}
function showToast() {
  toast.classList.remove('hidden');
  // Restart the CSS animation for consecutive pickups.
  toast.style.animation = 'none'; void toast.offsetWidth; toast.style.animation = '';
  window.setTimeout(() => toast.classList.add('hidden'), 950);
}
function updateScore() {
  const score = Math.floor(distance) + coins * 25;
  scoreNode.textContent = String(score).padStart(5, '0');
  distanceNode.textContent = `${Math.floor(distance)} M`;
  bestNode.textContent = String(Math.max(best, score)).padStart(5, '0');
}
function clearEntities() {
  for (const entity of [...obstacles, ...pickups, ...particles]) {
    scene.remove(entity.mesh); entity.mesh.geometry.dispose(); entity.mesh.material.dispose();
  }
  obstacles = []; pickups = []; particles = [];
}
function startRun() {
  clearEntities();
  gameState = 'running'; runTime = 0; distance = 0; coins = 0; speed = 6.2;
  spawnTimer = 1.15; coinTimer = 1.9; jumpVelocity = 0; isGrounded = true;
  newBest = false; sliding = false; slideTimer = 0;
  intro.classList.add('hidden'); endCard.classList.add('hidden'); pauseOverlay.classList.add('hidden'); pauseButton.classList.remove('hidden');
  scoreNode.textContent = '00000'; distanceNode.textContent = '0 M';
  runner.position.y = groundY + .71 * unit;
  lastTime = performance.now();
  playTone(440, .09);
}
function finishRun() {
  if (gameState !== 'running') return;
  gameState = 'over';
  const score = Math.floor(distance) + coins * 25;
  finalScore.textContent = String(Math.floor(distance));
  newBest = score > best;
  if (newBest) {
    best = score; localStorage.setItem('dustbyte-best', String(best));
    bestNode.textContent = String(best).padStart(5, '0'); newRecord.classList.remove('hidden');
  } else newRecord.classList.add('hidden');
  pauseButton.classList.add('hidden'); endCard.classList.remove('hidden');
  playTone(145, .3, 'sawtooth', .045);
}
function setPaused(paused) {
  if (paused && gameState === 'running') {
    gameState = 'paused'; pauseOverlay.classList.remove('hidden'); pauseButton.textContent = '▶';
  } else if (!paused && gameState === 'paused') {
    gameState = 'running'; pauseOverlay.classList.add('hidden'); pauseButton.textContent = 'Ⅱ'; lastTime = performance.now();
  }
}
function jump() {
  if (gameState === 'ready' || gameState === 'over') { startRun(); return; }
  if (gameState !== 'running') return;
  if (isGrounded) {
    jumpVelocity = 10.1; isGrounded = false; playTone(370, .07, 'square', .02);
  }
}
function spawnObstacle() {
  const roll = Math.random();
  makeObstacle(roll < .57 ? 'cactus' : 'rock');
  spawnTimer = Math.max(1.16, 1.72 + Math.random() * .52 - Math.min(.38, distance / 700));
}
function spawnDust() {
  const tex = pixelTexture((ctx) => {
    rect(ctx, 1, 1, 5, 5, '#f3bd83'); rect(ctx, 2, 2, 3, 3, '#ffe0a3');
  }, 8, 8);
  const mesh = sprite(tex, .17 * unit, .17 * unit, 3.5);
  mesh.position.set(runner.position.x - .3 * unit, groundY + .07 * unit, 0);
  particles.push({ mesh, vx: -1.5 - Math.random() * 1.5, vy: .8 + Math.random() * 1.4, life: .32, maxLife: .32, tex });
}

function update(dt) {
  runTime += dt; distance += speed * dt; speed = Math.min(10.2, 6.2 + distance * .018);
  const floor = groundY + .71 * unit;
  if (!isGrounded) {
    jumpVelocity -= 26 * unit * dt;
    runner.position.y += jumpVelocity * dt;
    if (runner.position.y <= floor) { runner.position.y = floor; jumpVelocity = 0; isGrounded = true; }
  } else if (Math.random() < dt * 5.2) spawnDust();
  runnerMaterial.map = runnerTextures[Math.floor(runTime * 10) % 2];
  runnerMaterial.needsUpdate = true;
  runner.rotation.z = isGrounded ? Math.sin(runTime * 19) * .035 : Math.max(-.12, Math.min(.12, jumpVelocity * .012));

  const tileWidth = 8 * unit;
  for (const tile of groundTiles) {
    tile.position.x -= speed * dt;
    if (tile.position.x < -viewportWidth / 2 - tileWidth) tile.position.x += tileWidth * groundTiles.length;
  }
  far.position.x = -((distance * .055) % 3);
  near.position.x = -((distance * .12) % 3);
  sun.position.y = (.95 + Math.sin(runTime * .5) * .035) * unit;

  spawnTimer -= dt;
  if (spawnTimer <= 0) spawnObstacle();
  coinTimer -= dt;
  if (coinTimer <= 0) { makeCoinLine(); coinTimer = 2.4 + Math.random() * 2.0; }

  const runnerX = runner.position.x / unit;
  const playerHeight = (runner.position.y - groundY) / unit;
  const playerBottom = playerHeight - .67;
  const playerTop = playerHeight + .56;
  for (const obstacle of obstacles) {
    obstacle.mesh.position.x -= speed * dt;
    const ox = obstacle.mesh.position.x / unit;
    if (Math.abs(ox - runnerX) < (obstacle.w + 1.16) * .36) {
      const obstacleBottom = obstacle.y - obstacle.h / 2;
      const obstacleTop = obstacle.y + obstacle.h / 2;
      if (playerBottom < obstacleTop - .08 && playerTop > obstacleBottom + .08) { finishRun(); break; }
    }
  }
  obstacles = obstacles.filter(o => {
    if (o.mesh.position.x < -viewportWidth / 2 - 2) { scene.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); return false; }
    return true;
  });
  for (const pickup of pickups) {
    pickup.mesh.position.x -= speed * dt;
    pickup.mesh.position.y = groundY + (pickup.y + Math.sin(runTime * 3 + pickup.phase) * .08) * unit;
    pickup.mesh.rotation.z += dt * 1.6;
    const px = pickup.mesh.position.x / unit, py = pickup.mesh.position.y / unit;
    if (!pickup.taken && Math.abs(px - runnerX) < .76 && Math.abs(py - runner.position.y / unit) < .88) {
      pickup.taken = true; coins++; showToast(); playTone(760 + Math.random() * 160, .09, 'sine', .035); updateScore();
      scene.remove(pickup.mesh); pickup.mesh.geometry.dispose(); pickup.mesh.material.dispose();
    }
  }
  pickups = pickups.filter(p => {
    if (p.taken || p.mesh.position.x < -viewportWidth / 2 - 1) {
      if (!p.taken) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); }
      return false;
    }
    return true;
  });
  for (const particle of particles) {
    particle.life -= dt; particle.mesh.position.x += particle.vx * unit * dt; particle.mesh.position.y += particle.vy * unit * dt;
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
  }
  particles = particles.filter(p => {
    if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); p.tex.dispose(); return false; }
    return true;
  });
  updateScore();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.04, Math.max(0, (now - (lastTime || now)) / 1000));
  lastTime = now;
  if (gameState === 'running') update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

function onStagePointer(event) {
  if (event.target.closest('button')) return;
  if (event.cancelable) event.preventDefault();
  if (gameState === 'paused') return;
  jump();
}
stage.addEventListener('pointerdown', onStagePointer, { passive: false });
document.querySelector('#startButton').addEventListener('click', startRun);
document.querySelector('#restartButton').addEventListener('click', startRun);
pauseButton.addEventListener('click', () => setPaused(gameState !== 'paused'));
document.querySelector('#resumeButton').addEventListener('click', () => setPaused(false));
touchZone.addEventListener('pointerdown', (event) => {
  event.preventDefault(); event.stopPropagation(); jump();
}, { passive: false });
document.querySelector('.sound-toggle').addEventListener('click', (event) => {
  muted = !muted;
  event.currentTarget.classList.toggle('muted', muted);
  event.currentTarget.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  event.currentTarget.title = muted ? 'Turn sound on' : 'Turn sound off';
  event.currentTarget.querySelector('.sound-icon').textContent = muted ? '♪' : '♫';
  if (!muted) playTone(620, .08, 'sine');
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    if (event.repeat) return;
    event.preventDefault(); jump();
  } else if (event.code === 'KeyP' || event.code === 'Escape') {
    if (gameState === 'running') setPaused(true);
    else if (gameState === 'paused') setPaused(false);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameState === 'running') setPaused(true);
});
window.addEventListener('resize', resize);
