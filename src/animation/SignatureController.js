import { gsap } from 'gsap';
import { PencilScene } from '../scene/PencilScene.js';
import { InkParticles } from '../scene/InkParticles.js';
import {
  idleTip,
  INK_COLOR,
  STROKE_WIDTH,
  toScreen,
} from '../handwriting/signature.js';
import {
  createStrokeVisual,
  setStrokeProgress,
} from '../handwriting/inkRenderer.js';
import {
  assertValidText,
  buildWritingPlan,
  writingLayout,
} from '../handwriting/writingPlan.js';
import { glyphLoader } from '../handwriting/GlyphLoader.js';
import { motionRhythm } from '../handwriting/motionRhythm.js';

const lerp = (a, b, p) => a + (b - a) * p;
const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const handwritingEase = (p) => p - Math.sin(p * Math.PI * 2) * 0.032;
let instance = 0;

/** Sole clock/coordinator. Renderers and loaders never choose order or progress. */
export class SignatureController {
  constructor({
    host,
    svg,
    inkGroup,
    particleCanvas,
    onState,
    onReset,
    onError,
  }) {
    Object.assign(this, { host, svg, inkGroup, onState, onReset, onError });
    this.id = ++instance;
    this.state = 'idle';
    this.cursor = { phase: 'home', index: 0, p: 0 };
    this.erasure = { progress: 0 };
    this.paths = [];
    this.model = null;
    this.layout = null;
    this.width = this.height = 1;
    this.disposed = false;
    this.renderCount = 0;
    this.generation = 0;
    this.lastInkPoint = this.lastTip = null;
    this.metrics = {};
    this.fault = null;
    this.scene = new PencilScene(host, () =>
      this.recover(new Error('3D 画布暂时中断，请在恢复后重试'))
    );
    this.particles = new InkParticles(particleCanvas);
    this.motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );
    this.reducedMotion = this.motionPreference.matches;
    this.scene.setQuality(this.reducedMotion ? 'reduced' : 'full');
    this.onMotionChange = (event) => {
      this.reducedMotion = event.matches;
      this.pendingMotion = true;
      if (event.matches) {
        this.particles.clear();
        this.particles.particles.length = 0;
      }
      // A running gesture keeps its p and duration. Only future gestures change.
      this.scene.setQuality?.(
        this.quality === 'economy'
          ? 'economy'
          : event.matches
            ? 'reduced'
            : 'full'
      );
      this.safeRender();
    };
    this.motionPreference.addEventListener('change', this.onMotionChange);
    this.resizeObserver = new ResizeObserver(([entry]) =>
      this.resize(entry.contentRect.width, entry.contentRect.height)
    );
    this.resizeObserver.observe(host);
    this.onWindowResize = () => {
      const rect = this.host.getBoundingClientRect();
      this.resize(rect.width, rect.height);
    };
    window.addEventListener('resize', this.onWindowResize, { passive: true });
    const r = host.getBoundingClientRect();
    this.resize(r.width, r.height);
  }
  setState(state) {
    if (!this.disposed) {
      this.state = state;
      this.onState(state);
    }
  }
  resize(width, height) {
    if (this.disposed || !width || !height) return;
    this.width = width;
    this.height = height;
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.scene.resize(width, height);
    this.particles.resize(width, height);
    if (this.model) {
      this.layout = writingLayout(this.model, width, height);
      this.inkGroup.setAttribute(
        'transform',
        `translate(${this.layout.x} ${this.layout.y}) scale(${this.layout.scale})`
      );
      this.inkGroup.setAttribute(
        'stroke-width',
        Math.max(STROKE_WIDTH, 1.45 / this.layout.scale)
      );
    }
    this.safeRender();
  }
  inject(stage) {
    if (import.meta.env.DEV) this.fault = stage;
  }
  maybeFail(stage) {
    if (this.fault === stage) {
      this.fault = null;
      throw new Error(`故障注入：${stage}`);
    }
  }
  mountPaths(model) {
    this.inkGroup.replaceChildren();
    this.paths = model.strokes.map((stroke, index) =>
      createStrokeVisual(
        this.inkGroup,
        stroke,
        index,
        `${this.id}-${this.generation}`
      )
    );
    this.inkGroup.setAttribute('stroke', INK_COLOR);
    this.inkGroup.style.opacity = '1';
    this.svg.setAttribute(
      'aria-label',
      `Handwritten signature of ${model.name}`
    );
  }
  async write(value) {
    if (this.disposed || this.state !== 'idle') return false;
    const generation = ++this.generation;
    this.pendingMotion = false;
    this.onError('');
    this.setState('preflighting');
    this.abortController = new AbortController();
    const started = performance.now();
    try {
      this.maybeFail('preflight');
      const { text, chinese } = assertValidText(value);
      this.maybeFail('loading');
      const lease = await glyphLoader.acquire(
        chinese,
        this.abortController.signal
      );
      if (this.disposed || generation !== this.generation) {
        lease.release();
        return false;
      }
      this.lease = lease;
      this.metrics.loadMs = performance.now() - started;
      const planStart = performance.now();
      this.model = buildWritingPlan(
        text,
        lease.glyphs,
        this.width,
        this.height
      );
      this.mountPaths(this.model);
      this.metrics.planMs = performance.now() - planStart;
      this.metrics.estimatedSeconds = this.model.estimatedSeconds;
      this.metrics.started = performance.now();
      this.metrics.frameIntervals = [];
      this.lastFrameTime = null;
      this.cursor = { phase: 'approach', index: 0, p: 0 };
      this.erasure.progress = 0;
      this.setState('writing');
      this.resize(this.width, this.height);
      const total = this.paths.reduce((s, p) => s + p.length, 0),
        inkTime = clamp(text.replaceAll(' ', '').length * 0.68, 1.35, 14),
        actions = [];
      if (this.model.legacy) {
        actions.push({ type: 'approach', index: 0, duration: 0.66 });
        this.paths.forEach((path, index) => {
          if (index) {
            const p = this.paths[index - 1],
              d = Math.hypot(p.end.x - path.start.x, p.end.y - path.start.y);
            if (d > 0.5)
              actions.push({
                type: 'lift',
                index,
                duration: clamp(d / 650, 0.025, 0.135),
              });
          }
          actions.push({
            type: 'stroke',
            index,
            duration: Math.max(0.018, (path.length / total) * inkTime),
          });
        });
      } else
        actions.push(
          ...this.model.actions
            .filter((a) => a.type !== 'settle')
            .map((a) => ({ ...a, index: a.index || 0 }))
        );
      this.actions = actions;
      this.model.estimatedSeconds = actions.reduce((s, a) => s + a.duration, 0);
      this.metrics.estimatedSeconds = this.model.estimatedSeconds;
      this.playActions(actions);
      return true;
    } catch (error) {
      if (
        !this.disposed &&
        generation === this.generation &&
        error.name !== 'AbortError'
      )
        this.recover(error);
      return false;
    }
  }
  playActions(actions) {
    this.timeline?.kill();
    this.pendingMotion = false;
    const reduced = this.reducedMotion,
      total = this.paths.reduce((s, p) => s + p.length, 0);
    const tl = gsap.timeline({
      paused: true,
      onUpdate: () => this.safeRender(),
      onComplete: () => this.finishWriting(),
    });
    this.timeline = tl;
    actions.forEach((action, ordinal) => {
      const duration = reduced
        ? action.type === 'approach'
          ? 0.1
          : action.type === 'stroke'
            ? Math.max(0.002, (this.paths[action.index].length / total) * 0.32)
            : 0.003
        : action.duration;
      tl.fromTo(
        this.cursor,
        { p: 0 },
        {
          p: 1,
          duration,
          immediateRender: false,
          ease: action.type === 'stroke'
            ? action.rhythm ? motionRhythm(action.rhythm) : handwritingEase
            : 'sine.inOut',
          onStart: () => {
            this.gestureReducedMotion = reduced;
            this.cursor.phase =
              action.type === 'stroke'
                ? 'stroke'
                : action.type === 'approach'
                  ? 'approach'
                  : 'lift';
            this.cursor.index = action.index;
            this.cursor.moveKind = action.type;
          },
          onComplete: () => {
            if (
              this.pendingMotion &&
              ordinal < actions.length - 1 &&
              !this.disposed &&
              this.state === 'writing'
            )
              this.playActions(actions.slice(ordinal + 1));
          },
        }
      );
    });
    tl.play();
  }
  finishWriting() {
    if (this.disposed || this.state !== 'writing') return;
    this.cursor.phase = 'written';
    this.cursor.p = 1;
    this.cursor.index = this.paths.length - 1;
    this.metrics.actualSeconds =
      (performance.now() - this.metrics.started) / 1000;
    this.safeRender();
    if (this.state === 'writing') this.setState('written');
  }
  erase() {
    if (this.disposed || this.state !== 'written') return false;
    try {
      this.timeline?.kill();
      this.setState('erasing');
      this.erasure.progress = 0;
      this.cursor.phase = 'return';
      this.eraseReducedAtStart = this.reducedMotion;
      this.cursor.p = 0;
      this.metrics.eraseStarted = performance.now();
      this.maybeFail('particles');
      if (!this.reducedMotion)
        this.particles.prepare(this.paths, this.layout, {
          stagger: !this.model.legacy,
        });
      const tl = gsap.timeline({
        paused: true,
        onUpdate: () => this.safeRender(),
        onComplete: () => this.finishErase(),
      });
      const clearDurations = Object.fromEntries(
        this.model.clearActions.map((action) => [action.type, action.duration])
      );
      this.timeline = tl;
      tl.to(
        this.erasure,
        {
          progress: 1,
          duration: this.reducedMotion ? 0.2 : clearDurations.erase,
          ease: 'none',
        },
        0
      );
      tl.to(
        this.cursor,
        {
          p: 1,
          duration: this.reducedMotion ? 0.14 : clearDurations.return,
          ease: 'power2.inOut',
        },
        this.reducedMotion ? 0 : 0.12
      );
      tl.play();
      return true;
    } catch (error) {
      this.recover(error);
      return false;
    }
  }
  clearInk() {
    this.inkGroup.replaceChildren();
    this.inkGroup.style.opacity = '1';
    this.paths = [];
    this.model = null;
    this.layout = null;
    this.cursor = { phase: 'home', index: 0, p: 0 };
    this.lastInkPoint = null;
    this.particles.clear();
    this.particles.particles.length = 0;
    this.lease?.release();
    this.lease = null;
    this.svg.setAttribute('aria-label', 'Blank signing paper');
  }
  finishErase() {
    if (this.disposed || this.state !== 'erasing') return;
    this.timeline?.kill();
    try {
      this.maybeFail('erase');
      this.clearInk();
      this.metrics.eraseMs = performance.now() - this.metrics.eraseStarted;
      this.render();
      this.setState('idle');
      this.onReset();
    } catch (error) {
      this.recover(error);
    }
  }
  recover(error) {
    if (this.disposed) return;
    this.generation++;
    this.abortController?.abort();
    this.timeline?.pause();
    this.timeline?.kill();
    this.timeline = null;
    try {
      this.clearInk();
    } catch {
      this.inkGroup.replaceChildren();
      this.paths = [];
      this.model = null;
      this.lease?.release();
      this.lease = null;
      this.cursor = { phase: 'home', index: 0, p: 0 };
    }
    try {
      this.render();
    } catch {
      /* A lost context cannot render until restored. */
    }
    this.setState('idle');
    const detail = String(error.message || '书写中断').replace(/[。.]+$/u, '');
    const recovery = detail.includes('原文已保留')
      ? '可以修改或重试。'
      : '原文已保留，可以修改或重试。';
    this.onError(`${detail}。${recovery}`, error);
    if (import.meta.env.DEV)
      console.info(
        'Signature recovery',
        error.name,
        error.issues || error.message
      );
  }
  pointOnPath(index, progress) {
    const path = this.paths[index],
      distance = path.length * clamp(progress),
      p = path.element.getPointAtLength(distance);
    const before = path.element.getPointAtLength(Math.max(0, distance - 0.8)),
      after = path.element.getPointAtLength(
        Math.min(path.length, distance + 0.8)
      );
    return {
      ...toScreen(
        { x: p.x + (path.offset?.x || 0), y: p.y + (path.offset?.y || 0) },
        this.layout
      ),
      tilt:
        (after.y - before.y) /
        Math.max(0.01, Math.hypot(after.x - before.x, after.y - before.y)),
    };
  }
  safeRender() {
    try {
      this.render();
    } catch (error) {
      this.recover(error);
    }
  }
  render() {
    if (this.disposed) return;
    // Window resize steps can run before ResizeObserver delivery. Synchronize
    // the SVG viewBox and camera before exposing this frame's point/projection.
    const rect = this.host.getBoundingClientRect();
    if (
      rect.width &&
      rect.height &&
      (rect.width !== this.width || rect.height !== this.height)
    ) {
      this.resize(rect.width, rect.height);
      return;
    }
    const { phase, index, p } = this.cursor,
      home = idleTip(this.width, this.height);
    let tip = { ...home, lift: 0, tilt: 0 };
    this.lastInkPoint = null;
    if (this.model && this.paths.length) {
      const full = phase === 'written' || phase === 'return',
        completed = full ? this.paths.length : phase === 'approach' ? 0 : index;
      for (const [i, path] of this.paths.entries()) {
        const progress =
          i < completed ? 1 : phase === 'stroke' && i === index ? p : 0;
        setStrokeProgress(path, progress);
        if (phase === 'return' && !this.model.legacy)
          path.visible.style.opacity = String(
            1 -
              clamp(
                (this.erasure.progress - (i / this.paths.length) * 0.42) / 0.38
              )
          );
      }
      if (phase === 'approach') {
        const start = this.pointOnPath(0, 0);
        tip = {
          x: lerp(home.x, start.x, p),
          y: lerp(home.y, start.y, p),
          lift: this.gestureReducedMotion ? 0 : Math.sin(p * Math.PI) * 28,
          tilt: 0,
        };
      } else if (phase === 'stroke') {
        this.maybeFail('stroke');
        tip = this.pointOnPath(index, p);
        this.lastInkPoint = { x: tip.x, y: tip.y };
      } else if (phase === 'lift') {
        this.maybeFail('lift');
        const from = this.pointOnPath(index - 1, 1),
          to = this.pointOnPath(index, 0),
          amplitude =
            this.cursor.moveKind === 'line-move'
              ? 23
              : this.cursor.moveKind === 'character-move'
                ? 12
                : 7;
        tip = {
          x: lerp(from.x, to.x, p),
          y: lerp(from.y, to.y, p),
          lift: this.gestureReducedMotion
            ? 0
            : Math.sin(p * Math.PI) * amplitude,
          tilt: lerp(from.tilt, to.tilt, p),
        };
      } else if (full) {
        const end = this.pointOnPath(this.paths.length - 1, 1);
        if (phase === 'written') {
          tip = end;
          this.lastInkPoint = { x: end.x, y: end.y };
        } else {
          tip = {
            x: lerp(end.x, home.x, p),
            y: lerp(end.y, home.y, p),
            lift: this.eraseReducedAtStart ? 0 : Math.sin(p * Math.PI) * 19,
            tilt: lerp(end.tilt, 0, p),
          };
          if (this.model.legacy)
            this.inkGroup.style.opacity = String(
              clamp(
                1 -
                  this.erasure.progress / (this.eraseReducedAtStart ? 1 : 0.22)
              )
            );
          if (!this.reducedMotion) {
            this.maybeFail('particle-draw');
            this.particles.draw(this.erasure.progress, this.layout);
          }
        }
      }
    }
    this.lastTip = { x: tip.x, y: tip.y };
    this.scene.setTip(tip);
    this.scene.render();
    this.renderCount++;
    if (this.state === 'writing') {
      const now = performance.now();
      if (this.lastFrameTime) {
        const dt = now - this.lastFrameTime;
        if (dt > 0 && this.metrics.frameIntervals.length < 20000)
          this.metrics.frameIntervals.push(dt);
      }
      this.lastFrameTime = now;
      const recent = this.metrics.frameIntervals.slice(-30);
      if (
        recent.length === 30 &&
        recent.reduce((a, b) => a + b, 0) / 30 > 30 &&
        this.quality !== 'economy'
      ) {
        this.quality = 'economy';
        this.scene.setQuality?.('economy');
        this.scene.render();
        this.particles.maxParticles = 4200;
      }
    }
  }
  inspect({ particleOrigins = false } = {}) {
    return {
      state: this.state,
      phase: this.cursor.phase,
      strokeIndex: this.cursor.index,
      strokeProgress: this.cursor.p,
      moveKind: this.cursor.moveKind,
      name: this.model?.name ?? '',
      strokeCount: this.paths.length,
      logicalStrokeCount: this.model?.logicalStrokes?.length || 0,
      logicalStrokes: this.model?.logicalStrokes || [],
      visualActions: this.model?.visualActions || [],
      prototypeCharacters: this.model?.prototypeCharacters || [],
      currentSegment: this.paths[this.cursor.index] ? {
        logicalStrokeIds: this.paths[this.cursor.index].logicalStrokeIds || [],
        visualActionId: this.paths[this.cursor.index].visualActionId,
        role: this.paths[this.cursor.index].role,
      } : null,
      lines: this.model?.lines ?? [],
      engines: [...new Set(this.paths.map((s) => s.engine))],
      inkPoint: this.lastInkPoint,
      tip: this.lastTip,
      layout: this.layout ? { ...this.layout } : null,
      duration: this.timeline?.duration() ?? 0,
      active: this.timeline?.isActive() ?? false,
      disposed: this.disposed,
      loadAborted: this.abortController?.signal.aborted ?? false,
      hasGlyphLease: Boolean(this.lease),
      particles: this.particles.particles.length,
      ...(particleOrigins ? { particleOrigins: this.particles.particles.map(({ x, y, delay }) => ({ x, y, delay })) } : {}),
      eraseProgress: this.erasure.progress,
      renderCount: this.renderCount,
      reducedMotion: this.reducedMotion,
      quality: this.quality || 'full',
      metrics: this.metrics,
      cache: glyphLoader.inspect(),
      ...this.scene.inspect(),
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.abortController?.abort();
    this.timeline?.pause();
    this.timeline?.kill();
    this.timeline = null;
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    this.motionPreference.removeEventListener('change', this.onMotionChange);
    this.lease?.release();
    this.lease = null;
    this.particles.dispose();
    this.scene.dispose();
    this.inkGroup.replaceChildren();
    this.paths.length = 0;
    this.model = null;
  }
}
