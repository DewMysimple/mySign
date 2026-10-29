import * as THREE from 'three';
import { softenPaperShadow } from './softPaperShadow.js';

const UP = new THREE.Vector3(0, 1, 0);

/** A tip-pivoted, genuinely three-dimensional pencil in CSS-pixel world units. */
export class PencilScene {
  constructor(host, onContextLost) {
    this.host = host;
    this.width = 1;
    this.height = 1;
    this.disposed = false;
    this.direction = new THREE.Vector3();
    this.projected = new THREE.Vector3();
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 6000);
    this.camera.position.set(0, 0, 2400);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioLimit || 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.domElement.className = 'pencil-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.onLost = (event) => {
      event.preventDefault();
      if (!this.disposed) onContextLost?.();
    };
    this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
    host.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa7a59d, 2.1));
    const key = new THREE.DirectionalLight(0xfffdf6, 3.1);
    key.position.set(-550, 850, 650);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 4500;
    key.shadow.camera.left = -2100;
    key.shadow.camera.right = 2100;
    key.shadow.camera.top = 2100;
    key.shadow.camera.bottom = -2100;
    key.shadow.bias = -0.00012;
    key.shadow.normalBias = 0.4;
    key.shadow.radius = 1.1;
    key.shadow.blurSamples = 8;
    this.scene.add(key);
    this.scene.add(key.target);
    this.key = key;

    const fill = new THREE.DirectionalLight(0xffffff, 0.65);
    fill.position.set(600, 50, 1000);
    this.scene.add(fill);

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12000, 12000),
      new THREE.ShadowMaterial({ color: 0x585750, opacity: 0.42, depthWrite: false }),
    );
    this.floor.position.z = -0.75;
    this.floor.receiveShadow = true;
    // VSM also renders receivers into its depth pass. Exclude the paper from
    // that pass so area filtering cannot mistake the tilted paper for a blocker.
    this.floor.customDepthMaterial = new THREE.MeshDepthMaterial({ depthWrite: false, colorWrite: false });
    this.paperUniforms = softenPaperShadow(this.floor.material);
    this.scene.add(this.floor);

    this.pencil = new THREE.Group();
    this.scene.add(this.pencil);
    const lacquer = new THREE.MeshPhysicalMaterial({
      color: 0xf6f5f0, roughness: 0.48, metalness: 0,
      clearcoat: 0.16, clearcoatRoughness: 0.46,
    });
    const sharpened = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.74 });
    const graphite = new THREE.MeshStandardMaterial({ color: 0x626563, roughness: 0.72 });
    const seam = new THREE.MeshStandardMaterial({ color: 0xe1e0da, roughness: 0.7 });
    const add = (geometry, material, y) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.pencil.add(mesh);
      return mesh;
    };

    // CylinderGeometry's bottom is -Y: the graphite apex is exactly the group origin.
    add(new THREE.CylinderGeometry(3.2, 0.15, 11, 32), graphite, 5.5);
    add(new THREE.CylinderGeometry(26, 3.2, 72, 64), sharpened, 47);
    add(new THREE.CylinderGeometry(26.02, 26.02, 1.2, 64), seam, 83.1);
    add(new THREE.CylinderGeometry(26, 26, 1119, 64), lacquer, 643);
    add(new THREE.CylinderGeometry(26.05, 26.05, 1.1, 64), seam, 1202.5);
    add(new THREE.SphereGeometry(26, 48, 24), lacquer, 1203);
    this.setTip({ x: 0, y: 0, lift: 0, tilt: 0 });
  }

  resize(width, height) {
    if (this.disposed) return;
    this.width = width;
    this.height = height;
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioLimit || 2));
    this.renderer.setSize(width, height, false);
    const scale = THREE.MathUtils.clamp(Math.min(width / 1440, height / 900), 0.42, 1.65);
    this.pencil.scale.setScalar(scale);
    // Keep shadow texels proportional to the visible scene on small screens.
    const extent = Math.max(width, height, 720) * 1.35;
    Object.assign(this.key.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent });
    this.key.shadow.camera.updateProjectionMatrix();
    this.paperUniforms.paperShadowSpan.value = extent * 2;
  }

  setTip({ x, y, lift = 0, tilt = 0 }) {
    this.pencil.position.set(x - this.width / 2, this.height / 2 - y, 0.8 + lift);
    this.floor.material.opacity = (this.quality === 'reduced' ? .28 : .42) / (1 + lift * .013);
    this.paperUniforms?.paperTip.value.set(this.pencil.position.x, this.pencil.position.y);
    // The full range is a few degrees: it responds to the stroke without spinning.
    this.direction.set(0.76 + tilt * 0.016, 0.55 - tilt * 0.023, 0.61).normalize();
    this.paperUniforms.paperShadowDirection.value.set(
      this.direction.x + this.direction.z * 550 / 650,
      this.direction.y - this.direction.z * 850 / 650,
    ).normalize();
    this.pencil.quaternion.setFromUnitVectors(UP, this.direction);
  }

  render() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  setQuality(quality) {
    if (quality === this.quality || this.disposed) return;
    this.quality = quality;
    this.pixelRatioLimit = quality === 'full' ? 2 : quality === 'reduced' ? 1.25 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioLimit));
  }

  inspect() {
    this.scene.updateMatrixWorld(true);
    this.projected.set(0, 0, 0).applyMatrix4(this.pencil.matrixWorld).project(this.camera);
    const rayScale=(this.floor.position.z-this.pencil.position.z)/(this.key.target.position.z-this.key.position.z);
    const shadowX=this.pencil.position.x+(this.key.target.position.x-this.key.position.x)*rayScale;
    const shadowY=this.pencil.position.y+(this.key.target.position.y-this.key.position.y)*rayScale;
    return {
      projectedTip: {
        x: (this.projected.x + 1) * this.width / 2,
        y: (1 - this.projected.y) * this.height / 2,
      },
      projectedShadowTip: {x:shadowX+this.width/2,y:this.height/2-shadowY},
      shadowOpacity: this.floor.material.opacity,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost);
    const geometries = new Set(), materials = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of [object.material].flat()) materials.add(material);
      }
      if (object.customDepthMaterial) materials.add(object.customDepthMaterial);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.key.shadow.map?.dispose();
    this.key.shadow.mapPass?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
