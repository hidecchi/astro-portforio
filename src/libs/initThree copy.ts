import * as THREE from "three";

// ---- 設定 ---- //
const SHADER_PATHS = {
  vertex: new URL("./vertex.glsl", import.meta.url),
  fragment: new URL("./flagment.glsl", import.meta.url),
  planeFragment: new URL("./planeflagment.glsl", import.meta.url),
};
const BG_COLOR = 0xffffff;
const SPHERE_RADIUS = 0.05;
const TEXTURE_PATH = "/filter.png";

// ---- ユーティリティ ---- //
const loadGLSLFile = async (url: URL): Promise<string> => {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error("Failed to load shader:", error);
    return "";
  }
};

type Point = { x: number; y: number } | null;

export const initThree = async (): Promise<void> => {
  let tick = 0;
  let aspect = document.documentElement.clientWidth / window.innerHeight;

  // ---- シーン・カメラ・レンダラー ---- //
  const [sceneMain, scenePostA, scenePostB] = [
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
  ];
  const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const fov = 75; // 視野角（必要に応じて調整）
  const near = 0.1;
  const far = 10;

  const camera2 = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera2.position.z = 1.3;

  const renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(BG_COLOR, 1);
  renderer.setSize(document.documentElement.clientWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ---- レンダーターゲット ---- //
  let rtMain = new THREE.WebGLRenderTarget(
    document.documentElement.clientWidth,
    window.innerHeight
  );
  let rtPostA = new THREE.WebGLRenderTarget(
    document.documentElement.clientWidth,
    window.innerHeight
  );
  let rtPostB = new THREE.WebGLRenderTarget(
    document.documentElement.clientWidth,
    window.innerHeight
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
    sphereMaterial
  );
  sphereMesh.scale.set(0, 0, 0);
  sceneMain.add(sphereMesh);

  let planeGeometry = new THREE.PlaneGeometry(2 * aspect, 2);
  const planeMaterial = new THREE.ShaderMaterial({
    transparent: true,
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
  scenePostA.add(planeMeshA);
  scenePostB.add(planeMeshB);

  // ---- リサイズ対応 ---- //
  const onResize = () => {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    aspect = width / height;

    // camera.left = -aspect;
    // camera.right = aspect;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    // 再生成が必要なもの
    rtMain.dispose();
    rtPostA.dispose();
    rtPostB.dispose();

    rtMain = new THREE.WebGLRenderTarget(width, height);
    rtPostA = new THREE.WebGLRenderTarget(width, height);
    rtPostB = new THREE.WebGLRenderTarget(width, height);

    planeGeometry.dispose();
    planeGeometry = new THREE.PlaneGeometry(2 * aspect, 2);
    planeMeshA.geometry = planeGeometry;
    planeMeshB.geometry = planeGeometry;
  };

  window.addEventListener("resize", onResize);

  // ---- マウス処理 ---- //
  let lastMouse: Point = null;
  let mouse: Point = null;
  let lastTickMouse: Point = null;

  const updateMousePosition = (e: MouseEvent) => {
    if (e.pageY > window.innerHeight) {
      resetMouse();
      return;
    }
    mouse = { x: e.pageX, y: e.pageY };

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

  document.addEventListener("mousemove", updateMousePosition);
  window.addEventListener("blur", () => setTimeout(resetMouse, 100));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetMouse();
  });
  document.addEventListener("mouseleave", resetMouse);

  // ---- アニメーション ---- //
  const animate = () => {
    tick++;

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

    sphereMaterial.uniforms.u_tick.value = tick;

    requestAnimationFrame(animate);

    renderer.setRenderTarget(rtMain);
    renderer.render(sceneMain, camera);

    const isEven = tick % 2 === 0;
    planeMaterial.uniforms.u_tex.value = rtMain.texture;
    planeMaterial.uniforms.u_prev.value = isEven
      ? rtPostB.texture
      : rtPostA.texture;
    renderer.setRenderTarget(isEven ? rtPostA : rtPostB);
    renderer.render(scenePostA, camera);

    renderer.setRenderTarget(null);
    renderer.render(scenePostB, camera2);

    lastTickMouse = mouse;
  };

  animate();
};
