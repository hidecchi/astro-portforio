import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { isSmartPhone, loadGLSLFile } from "../utils/utils";
import { MarchingCubes } from "three/examples/jsm/Addons.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

gsap.registerPlugin(ScrollTrigger);

const SHADER_PATHS = {
  vertex: new URL("./vertex.glsl", import.meta.url),
  fragment: new URL("./fragment.glsl", import.meta.url),
  planeFragment: new URL("./planefragment.glsl", import.meta.url),
};
const BG_COLOR = 0xffffff;
const SPHERE_RADIUS = 0.05;
const TEXTURE_PATH = "/pic4.png";
const BG_IMAGE_PATH = "/test4.jpg";
const BG_IMAGE_BRIGHTNESS_START = 1.0;
const BG_IMAGE_BRIGHTNESS_END = 0.35;
const META_OPACITY_START = 0.88;
const META_OPACITY_END = 0;
const META_TRANSMISSION_START = 1.0;
const META_ENV_INTENSITY_START = 0.65;
const META_CLEARCOAT_START = 0.7;
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

/** CSS object-fit: cover と同様に、歪めずに領域を覆う */
const applyTextureCover = (
  texture: THREE.Texture,
  containerAspect: number,
): void => {
  const img = texture.image as HTMLImageElement | undefined;
  if (!img?.width || !img.height) return;

  const imageAspect = img.width / img.height;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  if (containerAspect > imageAspect) {
    const repeatY = imageAspect / containerAspect;
    texture.repeat.set(1, repeatY);
    texture.offset.set(0, (1 - repeatY) / 2);
  } else {
    const repeatX = containerAspect / imageAspect;
    texture.repeat.set(repeatX, 1);
    texture.offset.set((1 - repeatX) / 2, 0);
  }
};

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

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  // ---- レンダーターゲット ---- //
  const rtSPhere = new THREE.WebGLRenderTarget(originalWidth, originalHeight);
  const rtPallet1 = new THREE.WebGLRenderTarget(originalWidth, originalHeight);
  const rtPallet2 = new THREE.WebGLRenderTarget(originalWidth, originalHeight);

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

  const bgMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color().setScalar(BG_IMAGE_BRIGHTNESS_START),
  });
  const bgPlaneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * aspect, 2),
    bgMaterial,
  );
  sceneBg.add(bgPlaneMesh);

  const applyBgCover = () => {
    if (bgMaterial.map) applyTextureCover(bgMaterial.map, aspect);
  };

  new THREE.TextureLoader().load(BG_IMAGE_PATH, (bgTexture) => {
    bgTexture.colorSpace = THREE.SRGBColorSpace;
    bgMaterial.map = bgTexture;
    bgMaterial.needsUpdate = true;
    applyBgCover();
  });

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

    applyBgCover();

    applyMetaballLayout?.();

    ScrollTrigger.refresh();
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

  // METABALLS
  sceneBg.environment = envMap;
  sceneBg.add(new THREE.AmbientLight(0xffffff, 0.35));
  sceneBg.add(new THREE.HemisphereLight(0xffffff, 0x6a7a9a, 0.45));
  const metaLight = new THREE.DirectionalLight(0xffffff, 1.4);
  metaLight.position.set(1.2, 1.5, 2);
  sceneBg.add(metaLight);
  const metaRim = new THREE.DirectionalLight(0xc8e0ff, 0.7);
  metaRim.position.set(-1.5, 0.3, 1);
  sceneBg.add(metaRim);

  const metaMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    transmission: 1.0,
    thickness: 0.0,
    roughness: 0.02,
    metalness: 0,
    ior: 1.15,
    transparent: true,
    opacity: 0.88,
    envMap,
    envMapIntensity: 0.85,
    clearcoat: 0.7,
    clearcoatRoughness: 0.03,
    attenuationColor: new THREE.Color(0xf8f6ff),
    attenuationDistance: 8.0,
    side: THREE.FrontSide,
  });
  const metaballs = new MarchingCubes(96, metaMat, false, true, 90000);
  metaballs.isolation = 85;
  metaballs.renderOrder = 1;

  const META_BALL_SCALE = 0.9 * 2.3;
  const applyMetaballLayout = () => {
    metaballs.scale.setScalar(META_BALL_SCALE);
    metaballs.position.set(aspect * 0.28, 0, 0);
  };
  applyMetaballLayout();

  const metaColors = [
    new THREE.Color(0xf0ecff),
    new THREE.Color(0xffeef6),
    new THREE.Color(0xecf6ff),
    new THREE.Color(0xeefff8),
  ];
  const updateMetaballs = (time: number) => {
    const cx = 0.5;
    const cy = 0.5;
    const cz = 0.5;

    metaballs.reset();
    metaballs.addBall(cx, cy, cz, 1.15, 22, metaColors[0]);

    const wobbleCount = 4;
    const orbit = 0.055;
    const breathe = 0.018;
    for (let i = 0; i < wobbleCount; i++) {
      const phase = (i / wobbleCount) * Math.PI * 2;
      const angle = time * 0.35 + phase;
      const angle2 = time * 0.48 + phase * 1.7;
      metaballs.addBall(
        cx + Math.cos(angle) * orbit,
        cy + Math.sin(angle2) * orbit * 0.85,
        cz + Math.sin(angle) * orbit,
        0.22 + breathe * Math.sin(time * 0.6 + phase),
        16,
        metaColors[(i + 1) % metaColors.length],
      );
    }
    metaballs.update();
  };

  sceneBg.add(metaballs);

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
      },
      onUpdate: () => {
        bgMaterial.color.setScalar(scrollState.bgBrightness);

        const o = scrollState.metaOpacity;
        metaMat.opacity = o;
        metaMat.transmission = META_TRANSMISSION_START * o;
        metaMat.envMapIntensity = META_ENV_INTENSITY_START * o;
        metaMat.clearcoat = META_CLEARCOAT_START * o;
        metaballs.visible = o > 0.01;

        if (titleEl instanceof HTMLElement) {
          titleEl.style.opacity = String(scrollState.titleOpacity);
        }
      },
    });
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
    let elapsedTime = clock.getDelta() * 2;

    requestAnimationFrame(animate);

    renderer.setClearColor(BG_COLOR, 1);

    if (contactEl && contactEl.getBoundingClientRect().top > 400) {
      updateMetaballs(clock.getElapsedTime());
      renderer.setRenderTarget(null);
      renderer.render(sceneBg, camera);
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

      sphereMaterial.uniforms.u_tick.value += elapsedTime * 30;
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
