export function SignatureInput({ inputRef, name, state, ready, error, onNameChange, onSubmit }) {
  const busy = state === 'writing' || state === 'erasing';
  const written = state === 'written';
  const label = written ? 'Erase signature' : busy ? (state === 'writing' ? 'Writing signature' : 'Erasing signature') : 'Write signature';

  return (
    <form className="signature-form" onSubmit={onSubmit} aria-label="Signature controls" aria-busy={busy}>
      <label htmlFor="signature-name" className="sr-only">Your name in English</label>
      <input
        id="signature-name"
        ref={inputRef}
        className="name-input"
        name="signature"
        type="text"
        inputMode="text"
        placeholder="Your name"
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        value={name}
        readOnly={state !== 'idle'}
        disabled={Boolean(error)}
        aria-describedby="signature-status"
        onChange={onNameChange}
      />
      <button
        className={`action-button${written ? ' is-eraser' : ''}`}
        type="submit"
        aria-label={label}
        disabled={busy || !ready || Boolean(error) || (!written && !name.trim())}
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
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.6 3.6 7.4-8.2" /></svg>
        )}
      </button>
    </form>
  );
}
