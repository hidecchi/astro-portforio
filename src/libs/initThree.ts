import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { isAndroid, isSmartPhone, loadGLSLFile } from "../utils/utils";

gsap.registerPlugin(ScrollTrigger);

if (isAndroid()) {
  document.body.classList.add("is-android");
}

const SHADER_PATHS = {
  vertex: new URL("./vertex.glsl", import.meta.url),
  fragment: new URL("./fragment.glsl", import.meta.url),
  planeFragment: new URL("./planefragment.glsl", import.meta.url),
  bgFragment: new URL("./bgfragment.glsl", import.meta.url),
  blackFragment: new URL("./blackfragment.glsl", import.meta.url),
};
const BG_COLOR = 0xffffff;
const SPHERE_RADIUS = 0.05;
const TEXTURE_PATH = "/pic4.png";
const BG_TEXTURE_PATH = "/test4.jpg";
const BG_IMAGE_BRIGHTNESS_START = 1.0;
const BG_IMAGE_BRIGHTNESS_END = 0.35;
const META_OPACITY_START = 1.0;
const META_OPACITY_END = 0;
const META_OBJECT_X = 0.28;
const TITLE_OPACITY_START = 1;
const TITLE_OPACITY_END = 0;
/** モバイルのアドレスバー縮小時に足りなくなる分 */
const CANVAS_HEIGHT_EXTRA = 100;
/** スクロール連動: 終盤で一気に変化させるイージング */
const SCROLL_SCRUB_EASE = "power4.out";

const getCanvasSize = () => ({
  width: document.documentElement.clientWidth,
  height: window.innerHeight + CANVAS_HEIGHT_EXTRA,
});

type Point = { x: number; y: number } | null;

const contactEl = document.querySelector("#contact");
const titleEl = document.querySelector("#title");

export const initThree = async (): Promise<void> => {
  let tick = 0;
  const { width: originalWidth, height: originalHeight } = getCanvasSize();
  let aspect = originalWidth / originalHeight;

  const [sceneSphere, scenePallet1, sceneResult, sceneBg] = [
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
  ];

  const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(BG_COLOR, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  renderer.setSize(originalWidth, originalHeight);
  document.documentElement.style.setProperty(
    "--canvas-height-extra",
    `${CANVAS_HEIGHT_EXTRA}px`,
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  // ---- レンダーターゲット ---- //
  const rtSPhere = new THREE.WebGLRenderTarget(originalWidth, originalHeight);
  const rtPallet1 = new THREE.WebGLRenderTarget(originalWidth, originalHeight);
  const rtPallet2 = new THREE.WebGLRenderTarget(originalWidth, originalHeight);

  // ---- シェーダ・背景画像ロード ---- //
  const [vShader, fShader, planeFShader, bgFShader, blackFShader] =
    await Promise.all([
      loadGLSLFile(SHADER_PATHS.vertex),
      loadGLSLFile(SHADER_PATHS.fragment),
      loadGLSLFile(SHADER_PATHS.planeFragment),
      loadGLSLFile(SHADER_PATHS.bgFragment),
      loadGLSLFile(SHADER_PATHS.blackFragment),
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

  const bgMaterial = new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      u_brightness: { value: BG_IMAGE_BRIGHTNESS_START },
      u_tick: { value: tick },
      u_bg_adjust: { value: window.innerWidth < 768 ? 1.0 : 6.0 },
      u_tex: { value: new THREE.TextureLoader().load(BG_TEXTURE_PATH) },
    },
    vertexShader: vShader,
    fragmentShader: bgFShader,
  });
  const bgPlaneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * aspect, 2),
    bgMaterial,
  );
  sceneBg.add(bgPlaneMesh);

  const scrollTriggerEl = document.querySelector(".image-wrapper");

  // ---- リサイズ対応 ---- //
  let lastInnerWidth: null | number = null;
  const onResize = () => {
    const { width, height } = getCanvasSize();

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

    applyBlackObjectLayout?.();

    ScrollTrigger.refresh();

    if (window.innerWidth < 768) {
      bgMaterial.uniforms.u_bg_adjust.value = 1.0;
    } else {
      bgMaterial.uniforms.u_bg_adjust.value = 6.0;
    }
  };

  window.addEventListener("resize", onResize);

  // ---- マウス処理 ---- //
  let lastMouse: Point = null;
  let mouse: Point = null;
  let lastTickMouse: Point = null;

  const updateMousePosition = (e: MouseEvent) => {
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

  // ---- 黒オブジェクト（レイマーチング） ---- //
  const blackObjectMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      u_tick: { value: 0 },
      u_opacity: { value: META_OPACITY_START },
      u_aspect: { value: aspect },
    },
    vertexShader: vShader,
    fragmentShader: blackFShader,
  });

  const blackObjectMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    blackObjectMaterial,
  );
  blackObjectMesh.position.x = aspect / 2;
  blackObjectMesh.position.z = 0.01;
  blackObjectMesh.renderOrder = 1;

  const applyBlackObjectLayout = () => {
    blackObjectMesh.geometry.dispose();
    blackObjectMesh.geometry = new THREE.PlaneGeometry(2, 2);
    blackObjectMesh.position.x = aspect / 2;
    blackObjectMaterial.uniforms.u_aspect.value = aspect;
    if (window.innerWidth < 1200) {
      blackObjectMesh.position.x = 0;
    } else {
      blackObjectMesh.position.x = aspect / 2;
    }
  };
  applyBlackObjectLayout();

  sceneBg.add(blackObjectMesh);

  const applyBlackObjectScrollState = (opacity: number) => {
    blackObjectMaterial.uniforms.u_opacity.value = opacity;
    blackObjectMesh.visible = opacity > 0.01;
  };

  if (scrollTriggerEl) {
    const scrollState = {
      bgBrightness: BG_IMAGE_BRIGHTNESS_START,
      metaOpacity: META_OPACITY_START,
      titleOpacity: TITLE_OPACITY_START,
    };
    gsap.to(scrollState, {
      bgBrightness: BG_IMAGE_BRIGHTNESS_END,
      metaOpacity: META_OPACITY_END,
      titleOpacity: TITLE_OPACITY_END,
      ease: SCROLL_SCRUB_EASE,
      scrollTrigger: {
        trigger: scrollTriggerEl,
        start: "top top",
        end: "70% top",
        scrub: true,
        onRefresh: () => applyBlackObjectScrollState(scrollState.metaOpacity),
      },
      onUpdate: () => {
        bgMaterial.uniforms.u_brightness.value = scrollState.bgBrightness;
        applyBlackObjectScrollState(scrollState.metaOpacity);

        if (titleEl instanceof HTMLElement) {
          titleEl.style.opacity = String(scrollState.titleOpacity);
        }
      },
    });
    applyBlackObjectScrollState(scrollState.metaOpacity);
  }

  onResize();

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
  const animate = () => {
    tick++;
    const elapsedTime = clock.getDelta() * 2;
    const tickDelta = elapsedTime * 30;

    requestAnimationFrame(animate);

    renderer.setClearColor(BG_COLOR, 1);

    if (contactEl && contactEl.getBoundingClientRect().top > 400) {
      bgMaterial.uniforms.u_tick.value += tickDelta;
      blackObjectMaterial.uniforms.u_tick.value += tickDelta;
      renderer.setRenderTarget(null);
      renderer.render(sceneBg, camera);
      sphereMaterial.uniforms.u_tick.value += tickDelta;
    } else if (!isSmartPhone()) {
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

      sphereMaterial.uniforms.u_tick.value += tickDelta;
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
      renderer.render(sceneResult, camera);
    }

    renderer.autoClear = false;
    renderer.autoClear = true;

    lastTickMouse = mouse;
  };

  animate();
};
