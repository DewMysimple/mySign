import { useEffect, useRef, useState } from 'react';
import { SignatureInput } from './components/SignatureInput.jsx';
import { SignatureController } from './animation/SignatureController.js';
import { isSupportedName } from './handwriting/signature.js';
import './styles.css';

export default function App() {
  const [name, setName] = useState('');
  const [state, setState] = useState('idle');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const sceneRef = useRef(null);
  const svgRef = useRef(null);
  const inkRef = useRef(null);
  const particleRef = useRef(null);
  const inputRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    let controller;
    try {
      controller = new SignatureController({
        host: sceneRef.current, svg: svgRef.current,
        inkGroup: inkRef.current, particleCanvas: particleRef.current,
        onState: setState,
        onReset: () => {
          setName('');
          inputRef.current?.focus({ preventScroll: true });
        },
        onError: setError,
      });
      controllerRef.current = controller;
      setReady(true);
      if (import.meta.env.DEV) {
        window.__signatureDebug = Object.freeze({ inspect: () => controller.inspect() });
      }
    } catch (cause) {
      console.error('Unable to initialize the pencil scene:', cause);
      setError('A WebGL-capable browser is needed to use this pencil.');
    }
    return () => {
      controller?.dispose();
      controllerRef.current = null;
      if (import.meta.env.DEV) delete window.__signatureDebug;
    };
  }, []);

  const onSubmit = (event) => {
    event.preventDefault();
    if (error) return;
    const controller = controllerRef.current;
    if (controller?.state === 'written') {
      controller.erase();
    } else if (controller?.state === 'idle' && name.trim()) {
      if (!isSupportedName(name)) {
        inputRef.current.setCustomValidity('Please use English letters and spaces.');
        inputRef.current.reportValidity();
        return;
      }
      controller.write(name);
    }
  };

  const status = error || {
    idle: 'Enter your name, then press Enter to sign.',
    writing: `Writing ${name}.`,
    written: `${name} is signed. Use the eraser to start again.`,
    erasing: 'Clearing the signature.',
  }[state];

  return (
    <main className="signature-page" data-state={state}>
      <svg ref={svgRef} className="signature-ink" role="img" aria-label="Blank signing paper">
        <g ref={inkRef} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <canvas ref={particleRef} className="particle-canvas" aria-hidden="true" />
      <div ref={sceneRef} className="pencil-scene" />
      <SignatureInput
        inputRef={inputRef} name={name} state={state} ready={ready} error={error}
        onNameChange={(event) => {
          event.target.setCustomValidity('');
          setName(event.target.value);
        }}
        onSubmit={onSubmit}
      />
      <p id="signature-status" className={error ? 'scene-error' : 'sr-only'} role="status" aria-live="polite">{status}</p>
    </main>
  );
}
