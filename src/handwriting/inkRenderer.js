import { INK_COLOR, MASK_RASTER_PADDING } from './signature.js';

const NS = 'http://www.w3.org/2000/svg';
const node = (name, attributes = {}) => {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attributes))
    el.setAttribute(k, String(v));
  return el;
};

/** Rendering only: the coordinator supplies every stroke and local progress. */
export function createStrokeVisual(parent, stroke, index, namespace) {
  const wrapper = node('g', {
    'data-stroke': index,
    'data-engine': stroke.engine,
    transform: `translate(${stroke.offset?.x || 0} ${stroke.offset?.y || 0})`,
  });
  const route = node('path', {
    d: stroke.d,
    fill: 'none',
    'data-route': index,
  });
  let visible = route,
    mask = null,
    maskId = null;
  if (stroke.outline) {
    maskId = `ink-${namespace}-${index}`;
    mask = node('mask', {
      id: maskId,
      maskUnits: 'userSpaceOnUse',
      x: -40,
      y: -40,
      width: 180,
      height: 180,
      'mask-type': 'luminance',
    });
    route.setAttribute('stroke', 'white');
    route.setAttribute('stroke-width', stroke.maskWidth + MASK_RASTER_PADDING);
    route.setAttribute('stroke-linecap', 'round');
    route.setAttribute('stroke-linejoin', 'round');
    mask.append(route);
    const defs = node('defs');
    defs.append(mask);
    wrapper.append(defs);
    visible = node('path', {
      d: stroke.outline,
      fill: INK_COLOR,
      stroke: 'none',
      mask: `url(#${maskId})`,
      'data-outline': index,
    });
    wrapper.append(visible);
  } else wrapper.append(route);
  visible.style.opacity = '0';
  parent.append(wrapper);
  const length = route.getTotalLength();
  if (!Number.isFinite(length) || length <= 0)
    throw new Error(`笔画 ${index + 1} 轨迹无效`);
  route.style.strokeDasharray = `${length} ${length}`;
  route.style.strokeDashoffset = String(length);
  return { ...stroke, element: route, visible, wrapper, mask, maskId, length };
}

export function setStrokeProgress(path, progress) {
  path.visible.style.opacity = progress > 0 ? '1' : '0';
  path.element.style.strokeDashoffset = String(path.length * (1 - progress));
  if (path.maskId) {
    // A completed outline no longer needs a reveal mask. Releasing it avoids
    // a second antialiasing pass nibbling at the final silhouette's edge.
    if (progress >= 1) path.visible.removeAttribute('mask');
    else path.visible.setAttribute('mask', `url(#${path.maskId})`);
  }
}
