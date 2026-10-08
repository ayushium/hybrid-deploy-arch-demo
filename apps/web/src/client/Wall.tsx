import { useEffect, useRef, useState } from 'react';
import { EMOJIS, PRESETS, type Post } from '@campuswall/shared';
import { getPosts, instanceColor, shortId } from './api.js';
import { useFleet } from './useFleet.js';

const POLL_MS = 2000;

export function Wall() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [down, setDown] = useState(false);
  const { fleet, record } = useFleet();
  const recordRef = useRef(record);
  recordRef.current = record;

  useEffect(() => {
    let alive = true;

    // Polling, NOT websockets. A sticky connection would pin each client to
    // a single instance, hiding load balancing entirely.
    async function tick() {
      try {
        const r = await getPosts();
        if (!alive) return;
        setPosts(r.posts);
        setDown(false);
        recordRef.current(r.served_by, r.az);
      } catch {
        if (alive) setDown(true);
      }
    }

    void tick();
    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const busiest = Math.max(1, ...fleet.map((f) => f.hits));

  return (
    <div className="wall">
      <header className="wall__nav">
        <div>
          <h1 className="title wall__title">Campus Wall</h1>
          <p className="wall__sub">Requests are distributed across the fleet in real time</p>
        </div>
        <div className={`status ${down ? 'is-down' : ''}`}>
          {down ? 'Origin unreachable' : `${fleet.length} instance${fleet.length === 1 ? '' : 's'} live`}
        </div>
      </header>

      {/* The activity meter — what makes request distribution observable. */}
      <section className="card panel">
        <h2 className="panel__label">Requests served · last 10 seconds</h2>
        <div className="meter">
          {fleet.map((f) => (
            <div key={f.id} className="meter__row" style={{ ['--tint' as string]: instanceColor(f.id) }}>
              <span className="chip">{shortId(f.id)}</span>
              <span className="meter__az">{f.az}</span>
              <div className="meter__track">
                <div className="meter__bar" style={{ width: `${(f.hits / busiest) * 100}%` }} />
              </div>
              <span className="meter__hits mono">{f.hits}</span>
            </div>
          ))}
          {!fleet.length && <p className="meter__empty">Waiting for the first response…</p>}
        </div>
      </section>

      <ul className="feed">
        {posts.map((p) => (
          <li key={p.id} className="feed__item" style={{ ['--tint' as string]: instanceColor(p.served_by) }}>
            <span className={p.kind === 'emoji' ? 'feed__emoji' : 'feed__text'}>
              {p.kind === 'emoji' ? EMOJIS[p.idx] : PRESETS[p.idx]}
            </span>
            <span className="feed__meta">
              <strong className="feed__nick">{p.nick}</strong>
              <span className="chip">{shortId(p.served_by)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
