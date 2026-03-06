import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  DirectionalLight,
  AmbientLight,
  type ColorRepresentation,
} from 'three';

export function createScene(container: HTMLElement) {
  const width = container.clientWidth;
  const height = Math.min(width * 0.6, 400);

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambient = new AmbientLight(0xffffff as ColorRepresentation, 0.6);
  scene.add(ambient);

  const directional = new DirectionalLight(0xffffff as ColorRepresentation, 0.8);
  directional.position.set(3, 4, 5);
  scene.add(directional);

  const geometry = new BoxGeometry(1.2, 1.2, 1.2);
  const material = new MeshStandardMaterial({ color: 0x3a86ff as ColorRepresentation });
  const cube = new Mesh(geometry, material);
  scene.add(cube);

  let animationId: number;

  function animate() {
    animationId = requestAnimationFrame(animate);
    cube.rotation.x += 0.008;
    cube.rotation.y += 0.012;
    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = Math.min(w * 0.6, 400);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', onResize);

  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener('resize', onResize);
    renderer.dispose();
    geometry.dispose();
    material.dispose();
  };
}
