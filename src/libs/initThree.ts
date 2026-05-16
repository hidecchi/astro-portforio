import * as THREE from "three";
import { isAndroid, isSmartPhone, loadGLSLFile } from "../utils/utils";

if (isAndroid()) {
  document.body.classList.add("is-android");
}

const SHADER_PATHS = {
  vertex: new URL("./vertex.glsl", import.meta.url),
  fragment: new URL("./fragment.glsl", import.meta.url),
  planeFragment: new URL("./planefragment.glsl", import.meta.url),
  ribbonVertex: new URL("./ribbonVertex.glsl", import.meta.url),
  ribbonFragment: new URL("./ribbonFragment.glsl", import.meta.url),
};
const BG_COLOR = 0xffffff;
const SPHERE_RADIUS = 0.05;
const TEXTURE_PATH = "/pic4.png";
const BG_IMAGE_PATH = "/test2.jpg";

type Point = { x: number; y: number } | null;

export const initThree = async (): Promise<void> => {
  let tick = 0;
  let aspect = document.documentElement.clientWidth / window.innerHeight;
  const originalWidth = document.documentElement.clientWidth;

  const [sceneSphere, scenePallet1, sceneResult, sceneBg] = [
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
  ];

  const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(BG_COLOR, 1);
  renderer.setSize(originalWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ---- レンダーターゲット ---- //
  const rtSPhere = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight,
  );
  const rtPallet1 = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight,
  );
  const rtPallet2 = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight,
  );

  // ---- シェーダロード ---- //
  const [vShader, fShader, planeFShader] = await Promise.all([
    loadGLSLFile(SHADER_PATHS.vertex),
    loadGLSLFile(SHADER_PATHS.fragment),
    loadGLSLFile(SHADER_PATHS.planeFragment),
  ]);

  // ---- メッシュ ---- //
  const sphereMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      u_tex: { value: new THREE.TextureLoader().load(TEXTURE_PATH) },
      u_first_tick: { value: 0.0 },
      u_distance: { value: 0.0 },
      u_tick: { value: tick },
    },
    vertexShader: vShader,
    fragmentShader: fShader,
  });

  const sphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SPHERE_RADIUS),
    sphereMaterial,
  );
  sphereMesh.scale.set(0, 0, 0);
  sceneSphere.add(sphereMesh);

  const planeGeometry = new THREE.PlaneGeometry(2 * aspect, 2);
  const planeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      u_tex: { value: null },
      u_prev: { value: null },
    },
    vertexShader: vShader,
    fragmentShader: planeFShader,
  });

  const planeMeshA = new THREE.Mesh(planeGeometry, planeMaterial);
  const planeMeshB = new THREE.Mesh(planeGeometry, planeMaterial);

  scenePallet1.add(planeMeshA);
  sceneResult.add(planeMeshB);

  const bgTexture = new THREE.TextureLoader().load(BG_IMAGE_PATH);
  bgTexture.colorSpace = THREE.SRGBColorSpace;

  const bgPlaneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * aspect, 2),
    new THREE.MeshBasicMaterial({ map: bgTexture }),
  );
  sceneBg.add(bgPlaneMesh);

  // ---- リサイズ対応 ---- //
  let lastInnerWidth: null | number = null;
  const onResize = () => {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;

    if (width === lastInnerWidth && isSmartPhone()) return;
    lastInnerWidth = width;
    aspect = width / height;

    camera.left = -aspect;
    camera.right = aspect;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    rtSPhere.setSize(width, height);
    rtPallet1.setSize(width, height);
    rtPallet2.setSize(width, height);

    planeMeshA.geometry.dispose();
    planeMeshB.geometry.dispose();
    planeMeshA.geometry = new THREE.PlaneGeometry(2 * aspect, 2);
    planeMeshB.geometry = new THREE.PlaneGeometry(2 * aspect, 2);

    bgPlaneMesh.geometry.dispose();
    bgPlaneMesh.geometry = new THREE.PlaneGeometry(2 * aspect, 2);
  };
  const onScroll = () => {
    // planeMeshB.position.y = (2 * window.pageYOffset) / window.innerHeight;
  };

  onResize();
  onScroll();

  window.addEventListener("resize", onResize);

  // ---- マウス処理 ---- //
  let lastMouse: Point = null;
  let mouse: Point = null;
  let lastTickMouse: Point = null;

  const updateMousePosition = (e: MouseEvent) => {
    // if (e.pageY > window.innerHeight) {
    //   resetMouse();
    //   return;
    // }
    mouse = { x: e.pageX, y: e.clientY };

    if (!lastMouse) {
      lastMouse = mouse;
      return;
    }

    const mid = {
      x: (lastMouse.x + mouse.x) / 2,
      y: (lastMouse.y + mouse.y) / 2,
    };

    sphereMesh.position.x =
      ((2 * mid.x) / document.documentElement.clientWidth - 1.0) * aspect;
    sphereMesh.position.y = 1 - (2 * mid.y) / window.innerHeight;
    lastMouse = mouse;
  };

  const resetMouse = () => {
    lastMouse = null;
    lastTickMouse = null;
    mouse = null;
  };

  if (!isSmartPhone()) {
    document.addEventListener("mousemove", updateMousePosition);
    window.addEventListener("blur", () => setTimeout(resetMouse, 100));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) resetMouse();
    });
    document.addEventListener("mouseleave", resetMouse);
  }

  // ---- アニメーション ---- //
  const clock = new THREE.Clock();
  let lastPageY = window.pageYOffset;
  const animate = () => {
    tick++;
    let elapsedTime = clock.getDelta() * 2;
    if (lastPageY !== window.pageYOffset) {
      lastPageY = window.pageYOffset;
      onScroll();
    }

    if (
      lastTickMouse === null ||
      (mouse?.x === lastTickMouse?.x && mouse?.y === lastTickMouse?.y)
    ) {
      sphereMesh.scale.set(0, 0, 0);
    } else {
      let distance = 0,
        angleRad = 0;
      if (lastTickMouse && mouse) {
        const dx = mouse.x - lastTickMouse.x;
        const dy = mouse.y - lastTickMouse.y;
        distance = Math.sqrt(dx * dx + dy * dy);
        angleRad = Math.atan2(dy, dx);
      }

      const scaleX = Math.max(1.0, distance / 30);
      sphereMesh.scale.set(scaleX, 1.0, 1.0);
      sphereMesh.rotation.z = -angleRad;
    }

    sphereMaterial.uniforms.u_tick.value += elapsedTime * 30;

    requestAnimationFrame(animate);

    renderer.setRenderTarget(rtSPhere);
    renderer.render(sceneSphere, camera);

    const isEven = tick % 2 === 0;
    planeMaterial.uniforms.u_tex.value = rtSPhere.texture;
    planeMaterial.uniforms.u_prev.value = isEven
      ? rtPallet2.texture
      : rtPallet1.texture;
    renderer.setRenderTarget(isEven ? rtPallet1 : rtPallet2);
    renderer.render(scenePallet1, camera);

    renderer.setRenderTarget(null);
    renderer.setClearColor(BG_COLOR, 1);
    renderer.clear();
    renderer.render(sceneBg, camera);

    renderer.autoClear = false;
    // renderer.render(sceneResult, camera);
    renderer.autoClear = true;

    lastTickMouse = mouse;
  };

  animate();
};
