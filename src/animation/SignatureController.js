import { gsap } from 'gsap';
import { PencilScene } from '../scene/PencilScene.js';
import { InkParticles } from '../scene/InkParticles.js';
import {
  buildSignature, idleTip, INK_COLOR, isSupportedName,
  signatureLayout, STROKE_WIDTH, toScreen,
} from '../handwriting/signature.js';

const NS = 'http://www.w3.org/2000/svg';
const lerp = (a, b, p) => a + (b - a) * p;
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const handwritingEase = (p) => p - Math.sin(p * Math.PI * 2) * 0.032;

/**
 * One GSAP timeline is the clock for SVG, the actual 3D tip, shadows and dust.
 * There is no second requestAnimationFrame loop or independently timed text.
 */
export class SignatureController {
  constructor({ host, svg, inkGroup, particleCanvas, onState, onReset, onError }) {
    this.svg = svg;
    this.inkGroup = inkGroup;
    this.onState = onState;
    this.onReset = onReset;
    this.onError = onError;
    this.state = 'idle';
    this.cursor = { phase: 'home', index: 0, p: 0 };
    this.erasure = { progress: 0 };
    this.paths = [];
    this.model = null;
    this.layout = null;
    this.width = this.height = 1;
    this.disposed = false;
    this.lastInkPoint = null;
    this.lastTip = null;
    this.renderCount = 0;
    this.scene = new PencilScene(host, () => {
      this.timeline?.kill();
      onError('The 3D canvas was interrupted. Reload to try again.');
    });
    this.particles = new InkParticles(particleCanvas);
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionPreference.matches;
    this.onMotionChange = (event) => {
      this.reducedMotion = event.matches;
      this.timeline?.timeScale(event.matches ? 5 : 1);
    };
    this.motionPreference.addEventListener('change', this.onMotionChange);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.resize(width, height);
    });
    this.resizeObserver.observe(host);
    const rect = host.getBoundingClientRect();
    this.resize(rect.width, rect.height);
  }

  setState(state) {
    this.state = state;
    this.onState(state);
  }

  resize(width, height) {
    if (this.disposed || !width || !height) return;
    this.width = width;
    this.height = height;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.scene.resize(width, height);
    this.particles.resize(width, height);
    if (this.model) {
      this.layout = signatureLayout(this.model, width, height);
      this.inkGroup.setAttribute('transform', `translate(${this.layout.x} ${this.layout.y}) scale(${this.layout.scale})`);
      this.inkGroup.setAttribute('stroke-width', Math.max(STROKE_WIDTH, 1.45 / this.layout.scale));
    }
    this.render();
  }

  mountPaths(model) {
    this.inkGroup.replaceChildren();
    this.paths = model.strokes.map((stroke) => {
      const element = document.createElementNS(NS, 'path');
      element.setAttribute('d', stroke.d);
      element.setAttribute('fill', 'none');
      element.style.opacity = '0';
      this.inkGroup.appendChild(element);
      const length = element.getTotalLength();
      element.style.strokeDasharray = `${length} ${length}`;
      element.style.strokeDashoffset = String(length);
      return { element, length, ...stroke };
    });
    this.inkGroup.setAttribute('stroke', INK_COLOR);
    this.inkGroup.style.opacity = '1';
    this.svg.setAttribute('aria-label', `Handwritten signature of ${model.name}`);
  }

  write(name) {
    // This synchronous guard also handles two submissions in one React batch.
    if (this.disposed || this.state !== 'idle' || !isSupportedName(name)) return false;
    this.timeline?.kill();
    this.model = buildSignature(name);
    this.mountPaths(this.model);
    this.cursor = { phase: 'approach', index: 0, p: 0 };
    this.erasure.progress = 0;
    this.setState('writing');
    this.resize(this.width, this.height);

    const totalLength = this.paths.reduce((sum, path) => sum + path.length, 0);
    const inkTime = this.reducedMotion ? 0.32 : clamp(this.model.name.replaceAll(' ', '').length * 0.68, 1.35, 14);
    const tl = gsap.timeline({
      onUpdate: () => this.render(),
      onComplete: () => {
        if (this.disposed) return;
        this.cursor.phase = 'written';
        this.cursor.p = 1;
        this.render();
        this.setState('written');
      },
    });
    this.timeline = tl;
    tl.to(this.cursor, { p: 1, duration: this.reducedMotion ? 0.1 : 0.66, ease: 'power2.inOut' });
    for (const [index, path] of this.paths.entries()) {
      if (index) {
        const previous = this.paths[index - 1];
        const distance = Math.hypot(previous.end.x - path.start.x, previous.end.y - path.start.y);
        if (distance > 0.5) {
          tl.set(this.cursor, { phase: 'lift', index, p: 0 });
          tl.to(this.cursor, {
            p: 1,
            duration: this.reducedMotion ? 0.003 : clamp(distance / 650, 0.025, 0.135),
            ease: 'sine.inOut',
          });
        }
      }
      tl.set(this.cursor, { phase: 'stroke', index, p: 0 });
      tl.to(this.cursor, {
        p: 1,
        duration: Math.max(this.reducedMotion ? 0.002 : 0.018, path.length / totalLength * inkTime),
        ease: handwritingEase,
      });
    }
    return true;
  }

  erase() {
    if (this.disposed || this.state !== 'written') return false;
    this.timeline?.kill();
    this.setState('erasing');
    this.erasure.progress = 0;
    this.cursor.phase = 'return';
    this.cursor.p = 0;
    if (!this.reducedMotion) this.particles.prepare(this.paths, this.layout);
    const tl = gsap.timeline({
      onUpdate: () => this.render(),
      onComplete: () => {
        if (this.disposed) return;
        this.inkGroup.replaceChildren();
        this.inkGroup.style.opacity = '1';
        this.paths = [];
        this.model = null;
        this.lastInkPoint = null;
        this.cursor.phase = 'home';
        this.particles.clear();
        this.particles.particles.length = 0;
        this.svg.setAttribute('aria-label', 'Blank signing paper');
        this.render();
        this.setState('idle');
        this.onReset();
      },
    });
    this.timeline = tl;
    tl.to(this.erasure, { progress: 1, duration: this.reducedMotion ? 0.2 : 1.3, ease: 'none' }, 0);
    tl.to(this.cursor, {
      p: 1, duration: this.reducedMotion ? 0.14 : 1.12, ease: 'power2.inOut',
    }, this.reducedMotion ? 0 : 0.12);
    return true;
  }

  pointOnPath(index, progress) {
    const path = this.paths[index];
    const distance = path.length * clamp(progress);
    const point = path.element.getPointAtLength(distance);
    const before = path.element.getPointAtLength(Math.max(0, distance - 0.8));
    const after = path.element.getPointAtLength(Math.min(path.length, distance + 0.8));
    return {
      ...toScreen(point, this.layout),
      tilt: (after.y - before.y) / Math.max(0.01, Math.hypot(after.x - before.x, after.y - before.y)),
    };
  }

  render() {
    if (this.disposed) return;
    const { phase, index, p } = this.cursor;
    const home = idleTip(this.width, this.height);
    let tip = { ...home, lift: 0, tilt: 0 };
    this.lastInkPoint = null;

    if (this.model && this.paths.length) {
      const full = phase === 'written' || phase === 'return';
      const completed = full ? this.paths.length : phase === 'approach' ? 0 : index;
      for (const [i, path] of this.paths.entries()) {
        const progress = i < completed ? 1 : phase === 'stroke' && i === index ? p : 0;
        // Opacity at zero suppresses the SVG round-cap speck on unrevealed strokes.
        path.element.style.opacity = progress > 0 ? '1' : '0';
        path.element.style.strokeDashoffset = String(path.length * (1 - progress));
      }

      if (phase === 'approach') {
        const start = this.pointOnPath(0, 0);
        tip = {
          x: lerp(home.x, start.x, p), y: lerp(home.y, start.y, p),
          lift: this.reducedMotion ? 0 : Math.sin(p * Math.PI) * 28, tilt: 0,
        };
      } else if (phase === 'stroke') {
        tip = this.pointOnPath(index, p);
        this.lastInkPoint = { x: tip.x, y: tip.y };
      } else if (phase === 'lift') {
        const from = this.pointOnPath(index - 1, 1);
        const to = this.pointOnPath(index, 0);
        tip = {
          x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p),
          lift: this.reducedMotion ? 0 : Math.sin(p * Math.PI) * 7,
          tilt: lerp(from.tilt, to.tilt, p),
        };
      } else if (phase === 'written' || phase === 'return') {
        const end = this.pointOnPath(this.paths.length - 1, 1);
        if (phase === 'written') {
          tip = end;
          this.lastInkPoint = { x: end.x, y: end.y };
        } else {
          tip = {
            x: lerp(end.x, home.x, p), y: lerp(end.y, home.y, p),
            lift: this.reducedMotion ? 0 : Math.sin(p * Math.PI) * 19,
            tilt: lerp(end.tilt, 0, p),
          };
          const progress = this.erasure.progress;
          this.inkGroup.style.opacity = String(clamp(1 - progress / (this.reducedMotion ? 1 : 0.22)));
          if (!this.reducedMotion) this.particles.draw(progress, this.layout);
        }
      }
    }

    this.lastTip = { x: tip.x, y: tip.y };
    this.scene.setTip(tip);
    this.scene.render();
    this.renderCount++;
  }

  // Read-only diagnostics are exposed by App only on the local Vite dev server.
  inspect() {
    return {
      state: this.state, phase: this.cursor.phase,
      strokeIndex: this.cursor.index, strokeProgress: this.cursor.p,
      name: this.model?.name ?? '', strokeCount: this.paths.length,
      inkPoint: this.lastInkPoint, tip: this.lastTip,
      layout: this.layout ? { ...this.layout } : null,
      duration: this.timeline?.duration() ?? 0,
      active: this.timeline?.isActive() ?? false,
      particles: this.particles.particles.length,
      renderCount: this.renderCount,
      reducedMotion: this.reducedMotion,
      ...this.scene.inspect(),
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.timeline?.kill();
    this.resizeObserver.disconnect();
    this.motionPreference.removeEventListener('change', this.onMotionChange);
    this.particles.dispose();
    this.scene.dispose();
    this.inkGroup.replaceChildren();
    this.paths.length = 0;
  }
}
