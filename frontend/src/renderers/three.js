// Three.js 场景渲染：处理 <three-scene>
// 标签内为 JSON 配置：{ objects: [{type,color,size,...}], camera, background }
import { loadLib } from './loader.js';

export async function renderThreeScenes(container) {
  const THREE = await loadLib('three');
  const nodes = [...container.querySelectorAll('three-scene')];

  nodes.forEach((el) => {
    let config;
    try {
      config = JSON.parse(el.textContent.trim() || '{}');
    } catch (e) {
      el.textContent = `3D 场景配置解析失败: ${e.message}`;
      return;
    }

    const width = el.clientWidth || 480;
    const height = config.height || 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(config.background || 0x111318);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, config.cameraDistance || 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    (config.objects || [{ type: 'box', color: 0x5b8cff }]).forEach((obj) => {
      let geometry;
      if (obj.type === 'sphere') geometry = new THREE.SphereGeometry(obj.size || 1, 32, 32);
      else if (obj.type === 'torus') geometry = new THREE.TorusGeometry(obj.size || 1, 0.4, 16, 60);
      else geometry = new THREE.BoxGeometry(obj.size || 1.5, obj.size || 1.5, obj.size || 1.5);

      const material = new THREE.MeshStandardMaterial({
        color: obj.color || 0x5b8cff,
        wireframe: !!obj.wireframe
      });
      const mesh = new THREE.Mesh(geometry, material);
      if (obj.position) mesh.position.set(...obj.position);
      scene.add(mesh);
    });

    const animate = () => {
      renderer.render(scene, camera);
      scene.rotation.y += 0.005;
      if (el.isConnected) requestAnimationFrame(animate);
    };
    animate();
  });
}
