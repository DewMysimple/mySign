import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../src/App.jsx';
const root = createRoot(document.getElementById('root'));
const mount = () =>
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
const controls = document.getElementById('test-controls');
for (const [label, action] of [
  ['Unmount test app', () => root.render(null)],
  ['Mount test app', mount],
]) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = action;
  controls.append(b);
}
mount();
