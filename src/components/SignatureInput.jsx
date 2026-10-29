import { useEffect, useRef } from 'react';

export function SignatureInput({
  inputRef,
  name,
  state,
  ready,
  fatal,
  invalid,
  onNameChange,
  onSubmit,
}) {
  const composing = useRef(false);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(164, Math.max(input.scrollHeight, parseFloat(getComputedStyle(input).minHeight)))}px`;
  }, [name, inputRef]);
  const busy =
    state === 'preflighting' || state === 'writing' || state === 'erasing';
  const written = state === 'written';
  const label = written
    ? 'Erase signature'
    : busy
      ? state === 'writing'
        ? 'Writing signature'
        : state === 'preflighting'
          ? 'Checking signature'
          : 'Erasing signature'
      : 'Write signature';

  return (
    <form
      className="signature-form"
      onSubmit={onSubmit}
      aria-label="Signature controls"
      aria-busy={busy}
    >
      <label htmlFor="signature-name" className="sr-only">
        姓名或签名内容（中文、英文、数字及标点）
      </label>
      <textarea
        id="signature-name"
        ref={inputRef}
        className="name-input"
        name="signature"
        rows={1}
        inputMode="text"
        placeholder="Your name · 你的名字"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        value={name}
        readOnly={state !== 'idle'}
        disabled={fatal}
        aria-describedby="signature-status"
        aria-invalid={invalid || undefined}
        onChange={onNameChange}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onKeyDown={(event) => {
          if (
            event.key !== 'Enter' ||
            event.shiftKey ||
            composing.current ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229
          )
            return;
          const mobile =
            navigator.maxTouchPoints > 0 &&
            window.matchMedia('(pointer: coarse)').matches;
          if (mobile) return;
          event.preventDefault();
          event.currentTarget.form.requestSubmit();
        }}
      />
      <button
        className={`action-button${written ? ' is-eraser' : ''}`}
        type="submit"
        aria-label={label}
        disabled={busy || !ready || fatal || (!written && !name.trim())}
      >
        {busy ? (
          <svg className="loading-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="loading-track" cx="12" cy="12" r="7.5" />
            <path d="M12 4.5a7.5 7.5 0 0 1 7.5 7.5" />
          </svg>
        ) : written ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m14.5 4.5 6 6a1.5 1.5 0 0 1 0 2.1l-6.8 6.8H8.4l-5-5a1.5 1.5 0 0 1 0-2.1l9-7.8a1.5 1.5 0 0 1 2.1 0Z" />
            <path d="m8.6 8.8 8 8M13.7 19.4H21" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 12.5 3.6 3.6 7.4-8.2" />
          </svg>
        )}
      </button>
    </form>
  );
}
