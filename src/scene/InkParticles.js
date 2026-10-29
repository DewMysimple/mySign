import { INK_COLOR, STROKE_WIDTH } from '../handwriting/signature.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** One lightweight canvas; every particle starts on the actual signed paths. */
export class InkParticles {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.particles = [];
    this.width = this.height = 1;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  prepare(paths, layout) {
    const random = randomGenerator(9173);
    this.particles = [];
    const total = paths.reduce((sum, path) => sum + path.length, 0);
    // Bound the total work even for a long pasted name.
    const step = Math.max(0.36, total / 6500, 1 / layout.scale);
    for (const { element, length } of paths) {
      for (let d = 0; d <= length; d += step) {
        const point = element.getPointAtLength(d);
        for (let j = 0; j < 3; j++) {
          const angle = random() * Math.PI * 2;
          const speed = 15 + random() * 55;
          this.particles.push({
            x: point.x + (random() - 0.5) * STROKE_WIDTH,
            y: point.y + (random() - 0.5) * STROKE_WIDTH,
            vx: Math.cos(angle) * speed + 13,
            vy: Math.sin(angle) * speed - 15,
            bend: random() * 12 - 6,
            radius: 0.35 + random() * 0.75,
            life: 0.45 + random() * 0.55,
            opacity: 0.35 + random() * 0.6,
          });
        }
      }
    }
  }

  draw(progress, layout) {
    this.clear();
    if (!this.particles.length || progress >= 1) return;
    const ctx = this.context;
    const time = progress * 1.3;
    ctx.fillStyle = INK_COLOR;
    for (const p of this.particles) {
      const alpha = clamp(1 - progress / p.life) ** 1.45 * p.opacity;
      if (alpha < 0.015) continue;
      const x = layout.x + p.x * layout.scale + p.vx * time + Math.sin(time * 4) * p.bend;
      const y = layout.y + p.y * layout.scale + p.vy * time - time * time * 9;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.context.clearRect(0, 0, this.width, this.height);
  }

  dispose() {
    this.clear();
    this.particles.length = 0;
    this.canvas.width = this.canvas.height = 0;
  }
}
