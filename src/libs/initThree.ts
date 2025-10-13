import * as THREE from "three";
import { extendMaterial } from "./extendMaterial";
import { SUBTRACTION, Brush, Evaluator } from "three-bvh-csg";
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

type Point = { x: number; y: number } | null;

export const initThree = async (): Promise<void> => {
  let tick = 0;
  let aspect = document.documentElement.clientWidth / window.innerHeight;
  const originalWidth = document.documentElement.clientWidth;

  const ribbonAnimationDom = document.getElementById("ribbon");

  const [sceneSphere, scenePallet1, sceneResult, sceneRibbon] = [
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
    new THREE.Scene(),
  ];

  const camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const cameraRibbon = new THREE.PerspectiveCamera(45, 1.0, 0.2, 100);
  cameraRibbon.position.set(0.8, 1.0, 0.7);
  cameraRibbon.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(BG_COLOR, 1);
  renderer.setSize(originalWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const ribbons: THREE.Mesh<THREE.BoxGeometry, any, THREE.Object3DEventMap>[] =
    [];
  for (let i = 0; i < 9; i++) {
    const geometry = new THREE.BoxGeometry(0.1, 0.005, 1, 64, 64, 64);

    const myMaterial = extendMaterial(THREE.MeshPhongMaterial, {
      header: `
    varying vec3 vEye;
    uniform float u_tick;
    uniform float index;
    `,

      headerVertex: "",

      headerFragment: "",

      vertex: {
        "#include <begin_vertex>": `
      transformed.y += (0.25 - transformed.z * transformed.z) * (0.2 + sin(transformed.z * 10.0 + u_tick * 0.03 + index)) * 0.04 * (18.0 - (index - 4.0) * (index - 4.0));
     
      `,
        // Inserts the line after #include <fog_vertex>
      },
      fragment: {},

      // Properties to apply to the new THREE.ShaderMaterial
      material: {
        skinning: true,
      },

      // Uniforms (will be applied to existing or added) as value or uniform object
      uniforms: {
        // Use a value directly, uniform object will be created for or ..
        diffuse: new THREE.Color(0xffffff),
        index: {
          shared: true, // This uniform can be shared across all materials it gets assigned to, sharing the value
          mixed: true, // When creating a material with/from a template this will be passed through
          linked: true, // To share them when used as template but not when extending them further, this ensures you don’t have
          value: i,
        },
        u_tick: {
          shared: true, // This uniform can be shared across all materials it gets assigned to, sharing the value
          mixed: true, // When creating a material with/from a template this will be passed through
          linked: true, // To share them when used as template but not when extending them further, this ensures you don’t have
          value: 0.0,
        },
      },
    });

    const ribbon = new THREE.Mesh(geometry, myMaterial);
    ribbon.castShadow = true;
    ribbon.receiveShadow = true;
    ribbon.position.x = (i - 4) * 0.1;
    ribbon.customDepthMaterial = extendMaterial(THREE.MeshDepthMaterial, {
      template: myMaterial,
    });

    sceneRibbon.add(ribbon);
    ribbons.push(ribbon);
  }

  const floorGeometry = new THREE.PlaneGeometry(23.0, 23.0, 100, 100).rotateX(
    -Math.PI / 2
  );
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.0,
  });

  const brush1 = new Brush(floorGeometry);
  brush1.updateMatrixWorld();

  const brush2 = new Brush(new THREE.BoxGeometry(0.9, 100, 1));
  brush2.updateMatrixWorld();

  const evaluator = new Evaluator();

  const floor = new THREE.Mesh(
    evaluator.evaluate(brush1, brush2, SUBTRACTION).geometry,
    floorMaterial
  );
  sceneRibbon.add(floor);
  floor.receiveShadow = true;

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(0.85, 0.3, 1.0);
  dirLight.castShadow = true;

  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 10;
  dirLight.shadow.camera.left = -2;
  dirLight.shadow.camera.right = 2;
  dirLight.shadow.camera.top = 2;
  dirLight.shadow.camera.bottom = -2;
  dirLight.shadow.bias = -0.001;

  sceneRibbon.add(dirLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 3.0); // 少しだけ全体を照らす
  sceneRibbon.add(ambientLight);

  // ---- レンダーターゲット ---- //
  const rtSPhere = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight
  );
  const rtPallet1 = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight
  );
  const rtPallet2 = new THREE.WebGLRenderTarget(
    originalWidth,
    window.innerHeight
  );
  const rtRibbon = new THREE.WebGLRenderTarget(1200, 1200);

  // ---- シェーダロード ---- //
  const [vShader, fShader, planeFShader, ribbonVShader, ribbonFShader] =
    await Promise.all([
      loadGLSLFile(SHADER_PATHS.vertex),
      loadGLSLFile(SHADER_PATHS.fragment),
      loadGLSLFile(SHADER_PATHS.planeFragment),
      loadGLSLFile(SHADER_PATHS.ribbonVertex),
      loadGLSLFile(SHADER_PATHS.ribbonFragment),
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
  sceneSphere.add(sphereMesh);

  const planeGeometry = new THREE.PlaneGeometry(2 * aspect, 2);
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

  const planeMeshRibbonSize =
    ((ribbonAnimationDom?.clientWidth ?? 0) * 2) / window.innerHeight;
  const planeMeshRibbon = new THREE.Mesh(
    new THREE.PlaneGeometry(planeMeshRibbonSize, planeMeshRibbonSize),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        u_tex: { value: null },
      },
      vertexShader: ribbonVShader,
      fragmentShader: ribbonFShader,
    })
  );

  scenePallet1.add(planeMeshA);
  sceneResult.add(planeMeshB);
  sceneResult.add(planeMeshRibbon);

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

    const planeMeshRibbonSize =
      ((ribbonAnimationDom?.clientWidth ?? 0) * 2) / window.innerHeight;
    planeMeshRibbon.geometry.dispose();
    const sp = window.innerWidth < 500;
    planeMeshRibbon.geometry = new THREE.PlaneGeometry(
      planeMeshRibbonSize * (sp ? 1.2 : 1),
      planeMeshRibbonSize * (sp ? 1.2 : 1)
    );

    planeMeshRibbon.position.x =
      (((ribbonAnimationDom?.getBoundingClientRect().left ?? 0) +
        (ribbonAnimationDom?.clientWidth ?? 0) * 0.5 -
        document.documentElement.clientWidth / 2) *
        2) /
      window.innerHeight;
  };
  const onScroll = () => {
    planeMeshRibbon.position.y =
      (((ribbonAnimationDom?.getBoundingClientRect().top ?? 0) +
        0.5 * (ribbonAnimationDom?.clientWidth ?? 0) -
        window.innerHeight * 0.5) *
        -1) /
      0.5 /
      window.innerHeight;
    planeMeshB.position.y = (2 * window.pageYOffset) / window.innerHeight;
  };

  onResize();
  onScroll();

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

    for (const ribbon of ribbons) {
      ribbon.material.uniforms.u_tick.value += elapsedTime * 30;
    }
    renderer.setRenderTarget(rtRibbon);
    renderer.setClearColor(0xe0f3e8, 1);
    planeMeshRibbon.material.uniforms.u_tex.value = rtRibbon.texture;
    renderer.render(sceneRibbon, cameraRibbon);

    renderer.setRenderTarget(null);
    renderer.setClearColor(BG_COLOR, 1);
    renderer.render(sceneResult, camera);

    lastTickMouse = mouse;
  };

  animate();
};
