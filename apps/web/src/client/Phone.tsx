import { useEffect, useState } from 'react';
import { EMOJIS, PRESETS, type PostKind } from '@campuswall/shared';
import { cachedName, createPost, getClientConfig, getMe, instanceColor, rememberName, shortId, stress } from './api.js';

const COOLDOWN_MS = 1000;

export function Phone() {
  const [name, setName] = useState<string | null>(cachedName());
  const [showStress, setShowStress] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [last, setLast] = useState<{ text: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => { setName(me.name); rememberName(me.name); })
      .catch(() => { /* keep whatever localStorage had */ });
    getClientConfig()
      .then((c) => setShowStress(c.showStress))
      .catch(() => setShowStress(false));
  }, []);

  // A 1s cooldown stops a held thumb flooding the feed. Deliberately loose:
  // the taps are also the request volume the autoscaling path depends on.
  function cool() {
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
  }

  async function post(kind: PostKind, idx: number) {
    if (cooling) return;
    cool();
    setError(null);
    try {
      const r = await createPost(kind, idx);
      setLast({ text: kind === 'emoji' ? EMOJIS[idx] : PRESETS[idx], id: r.served_by });
    } catch {
      setError('Could not reach the server');
    }
  }

  async function doStress() {
    if (cooling) return;
    cool();
    setError(null);
    try {
      const r = await stress();
      setLast({ text: `Burned ${r.burned_ms}ms`, id: r.served_by });
    } catch {
      setError('Load generator is disabled');
    }
  }

  return (
    <div className="app">
      <header className="nav">
        <h1 className="title">Campus Wall</h1>
        <p className="nav__sub">
          {name ? <>You are <strong className="nav__name">{name}</strong>. Tap anything to post.</>
                : 'Tap anything to post.'}
        </p>
      </header>

      <section className="section">
        <h2 className="group-label">Reactions</h2>
        <div className="keys">
          {EMOJIS.map((e, i) => (
            <button key={e} className="key" disabled={cooling} aria-label={`React ${e}`} onClick={() => post('emoji', i)}>
              {e}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="group-label">Messages</h2>
        <div className="list">
          {PRESETS.map((p, i) => (
            <button key={p} className="list__row" disabled={cooling} onClick={() => post('preset', i)}>
              {p}
            </button>
          ))}
        </div>
      </section>

      <footer className="dock">
        {showStress && (
          <button className="btn--stress" disabled={cooling} onClick={doStress}>
            Stress the server
          </button>
        )}
        <p className="dock__status">
          {error ? (
            <span className="dock__err">{error}</span>
          ) : last ? (
            <>
              <span className="dock__sent">{last.text}</span>
              <span className="chip" style={{ ['--tint' as string]: instanceColor(last.id) }}>{shortId(last.id)}</span>
            </>
          ) : (
            'Every response shows which server answered'
          )}
        </p>
      </footer>
    </div>
  );
}
