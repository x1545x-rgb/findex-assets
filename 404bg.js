/**
 * 404bg.js
 * #404bg という id の div 要素内に Three.js パーティクル球を描画するスクリプト
 * 球体グリッドパーティクル + マウスで離れる + 404 OBJ モーフ
 */
import * as THREE from 'https://unpkg.com/three@0.164.0/build/three.module.js';
import { OBJLoader } from 'https://unpkg.com/three@0.164.0/examples/jsm/loaders/OBJLoader.js?module';

// =======================
// ターゲット div を取得
// =======================
const container = document.getElementById('404bg');
if (!container) {
  console.error('404bg.js: #404bg 要素が見つかりません');
  throw new Error('#404bg not found');
}

// =======================
// シーン・カメラ・レンダラー
// =======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(0, 0, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 1.0);
container.appendChild(renderer.domElement);

// キャンバスを親要素いっぱいに広げる
renderer.domElement.style.display = 'block';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';

function setCanvasSize() {
  const w = container.clientWidth || 1;
  const h = container.clientHeight || 1;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
setCanvasSize();
window.addEventListener('resize', setCanvasSize);

// =======================
// マウス位置（NDC: -1〜1）
// =======================
const mouseNDC = { x: 99, y: 99 };
const MOUSE_RADIUS = 0.50;
const REPEL_STRENGTH = 1.5;
const INERTIA = 0.05;

renderer.domElement.addEventListener('mousemove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const u = (e.clientX - rect.left) / rect.width;
  const v = (e.clientY - rect.top) / rect.height;
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    mouseNDC.x = u * 2 - 1;
    mouseNDC.y = -v * 2 + 1;
  }
});
renderer.domElement.addEventListener('mouseleave', () => {
  mouseNDC.x = 99;
  mouseNDC.y = 99;
});

// =======================
// 球体パーティクル（フィボナッチ球）
// =======================
function createCircleTexture(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

const particleCount = 2600;
const radius = 1.5;
const positions = new Float32Array(particleCount * 3);
const basePositions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);
const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const innerColor = new THREE.Color(0x1E3A60);
const outerColor = new THREE.Color(0x5A70E0);

for (let i = 0; i < particleCount; i++) {
  const t = (i + 0.5) / particleCount;
  const inclination = Math.acos(1 - 2 * t);
  const azimuth = goldenAngle * i;
  const x = radius * Math.sin(inclination) * Math.cos(azimuth);
  const y = radius * Math.cos(inclination);
  const z = radius * Math.sin(inclination) * Math.sin(azimuth);
  const idx = i * 3;
  positions[idx] = x;
  positions[idx + 1] = y;
  positions[idx + 2] = z;
  basePositions[idx] = x;
  basePositions[idx + 1] = y;
  basePositions[idx + 2] = z;
  const ny = (y / radius + 1) / 2;
  const c = innerColor.clone().lerp(outerColor, ny);
  colors[idx] = c.r;
  colors[idx + 1] = c.g;
  colors[idx + 2] = c.b;
}

const currentDisp = new Float32Array(particleCount * 3);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.035,
  sizeAttenuation: true,
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  map: createCircleTexture(),
  alphaTest: 0.25,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// =======================
// OBJ モーフ（404のみ・50%スケール）
// =======================
const objLoader = new OBJLoader();
const objMorphPositions = [];
let objReady = false;

async function loadObjFromUrl(url, objectScale = 1.0) {
  return new Promise((resolve, reject) => {
    objLoader.load(
      url,
      (obj) => {
        const vertices = [];
        const v = new THREE.Vector3();
        obj.updateMatrixWorld(true);
        obj.traverse((child) => {
          if (child.isMesh) {
            let g = child.geometry.clone();
            g = g.toNonIndexed();
            const posAttr = g.attributes.position;
            const m = child.matrixWorld;
            for (let i = 0; i < posAttr.count; i++) {
              v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
              v.applyMatrix4(m);
              vertices.push(v.x, v.y, v.z);
            }
          }
        });
        if (vertices.length === 0) {
          reject(new Error('OBJ内にメッシュがありません'));
          return;
        }
        const mergedGeom = new THREE.BufferGeometry();
        mergedGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        mergedGeom.computeBoundingSphere();
        const bs = mergedGeom.boundingSphere;
        const s = (radius / bs.radius) * objectScale;
        mergedGeom.translate(-bs.center.x, -bs.center.y, -bs.center.z);
        mergedGeom.scale(s, s, s);
        const posAttr = mergedGeom.attributes.position;
        const vertCount = posAttr.count;
        const morphPos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
          const srcIndex = Math.floor((i / particleCount) * vertCount);
          const idx = i * 3;
          morphPos[idx]     = posAttr.getX(srcIndex);
          morphPos[idx + 1] = posAttr.getY(srcIndex);
          morphPos[idx + 2] = posAttr.getZ(srcIndex);
        }
        objMorphPositions.push(morphPos);
        objReady = true;
        resolve();
      },
      undefined,
      reject
    );
  });
}

// OBJ ファイルのパスは実際のサイト構成に合わせて調整してください
loadObjFromUrl('/models/object_404.obj', 0.5).catch(err => {
  console.warn('404bg.js: OBJ load failed:', err.message);
});

// モーフ周期（4区間: 404表示 → 404→グリッド → グリッド表示 → グリッド→404 → ループ）
const GRID_DISPLAY_SEC = 5.0;
const GRID_TO_OBJECT_SEC = 1.0;
const OBJECT_DISPLAY_SEC = 5.0;
const OBJECT_TO_GRID_SEC = 1.0;

function easeOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  const u = 1 - x;
  return 1 - u * u * u;
}

// =======================
// 周りのオーブ（フレネル）
// =======================
const orbGeo = new THREE.SphereGeometry(radius * 1.02, 128, 128);
const orbMat = new THREE.ShaderMaterial({
  uniforms: {
    uEdgeColor: { value: new THREE.Color('#5A70E0') },
    uInnerColor: { value: new THREE.Color('#0F1020') },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uEdgeColor;
    uniform vec3 uInnerColor;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
      float wave = 0.5 + 0.5 * sin(uTime * 2.0 + vWorldPos.y * 4.0 + vWorldPos.x * 3.0);
      float edge = fresnel * (0.6 + 0.5 * wave);
      vec3 color = mix(uInnerColor, uEdgeColor, edge);
      gl_FragColor = vec4(color, edge);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.FrontSide,
});
const orbMesh = new THREE.Mesh(orbGeo, orbMat);
scene.add(orbMesh);

const ROTATION_SPEED = 0.28;

// =======================
// マウス影響用
// =======================
const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _cameraRight = new THREE.Vector3();
const _cameraUp = new THREE.Vector3();
const _displacement = new THREE.Vector3();
const _pointsInvWorld = new THREE.Matrix4();

function smoothstep(a, b, t) {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  points.rotation.y = elapsed * ROTATION_SPEED;
  points.rotation.x = Math.sin(elapsed * 0.3) * 0.22;
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  // 4区間: 404表示 → 404→グリッド → グリッド表示 → グリッド→404 → ループ
  const totalCycleSec = OBJECT_DISPLAY_SEC + OBJECT_TO_GRID_SEC + GRID_DISPLAY_SEC + GRID_TO_OBJECT_SEC;
  const t = elapsed % totalCycleSec;

  const segDur = [OBJECT_DISPLAY_SEC, OBJECT_TO_GRID_SEC, GRID_DISPLAY_SEC, GRID_TO_OBJECT_SEC];
  let morphStrength = 0.0;
  let segStart = 0;
  for (let seg = 0; seg < 4; seg++) {
    if (t < segStart + segDur[seg]) {
      const localT = segDur[seg] > 0 ? (t - segStart) / segDur[seg] : 0;
      switch (seg) {
        case 0: morphStrength = 1.0; break;
        case 1: morphStrength = 1.0 - easeOutCubic(localT); break;
        case 2: morphStrength = 0.0; break;
        case 3: morphStrength = easeOutCubic(localT); break;
      }
      break;
    }
    segStart += segDur[seg];
  }

  if (!objReady || !objMorphPositions[0]) morphStrength = 0.0;

  _cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  _pointsInvWorld.copy(points.matrixWorld).invert();

  const posArr = geometry.attributes.position.array;
  const mouseOnScreen = mouseNDC.x >= -1.5 && mouseNDC.x <= 1.5 && mouseNDC.y >= -1.5 && mouseNDC.y <= 1.5;
  const morphPos = objReady ? objMorphPositions[0] : null;

  for (let i = 0; i < particleCount; i++) {
    const idx = i * 3;
    const sx = basePositions[idx];
    const sy = basePositions[idx + 1];
    const sz = basePositions[idx + 2];
    let tx = sx, ty = sy, tz = sz;
    if (morphPos) {
      tx = morphPos[idx];
      ty = morphPos[idx + 1];
      tz = morphPos[idx + 2];
    }
    const mx = sx + (tx - sx) * morphStrength;
    const my = sy + (ty - sy) * morphStrength;
    const mz = sz + (tz - sz) * morphStrength;

    _world.set(mx, my, mz).applyMatrix4(points.matrixWorld);
    _ndc.copy(_world).project(camera);

    let influence = 0;
    if (mouseOnScreen && _ndc.z >= -1 && _ndc.z <= 1) {
      const dist = Math.hypot(_ndc.x - mouseNDC.x, _ndc.y - mouseNDC.y);
      influence = 1 - smoothstep(0, MOUSE_RADIUS, dist);
      influence = Math.max(0, Math.min(1, influence));
    }

    const dirX = _ndc.x - mouseNDC.x;
    const dirY = _ndc.y - mouseNDC.y;
    const targetX = dirX * influence * REPEL_STRENGTH;
    const targetY = dirY * influence * REPEL_STRENGTH;
    _displacement
      .set(0, 0, 0)
      .addScaledVector(_cameraRight, targetX)
      .addScaledVector(_cameraUp, targetY);

    const dispLen = _displacement.length();
    _displacement.transformDirection(_pointsInvWorld);
    if (dispLen > 0) _displacement.multiplyScalar(dispLen);

    currentDisp[idx] += (_displacement.x - currentDisp[idx]) * INERTIA;
    currentDisp[idx + 1] += (_displacement.y - currentDisp[idx + 1]) * INERTIA;
    currentDisp[idx + 2] += (_displacement.z - currentDisp[idx + 2]) * INERTIA;

    posArr[idx] = mx + currentDisp[idx];
    posArr[idx + 1] = my + currentDisp[idx + 1];
    posArr[idx + 2] = mz + currentDisp[idx + 2];
  }

  geometry.attributes.position.needsUpdate = true;

  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2);
  material.size = 0.03 + 0.015 * pulse;
  material.opacity = 0.6 + 0.3 * pulse;

  orbMesh.rotation.y = elapsed * ROTATION_SPEED;
  orbMat.uniforms.uTime.value = elapsed;

  renderer.render(scene, camera);
}

animate();
