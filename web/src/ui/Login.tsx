// OWNED BY: Collaboration agent. Passphrase + 'who are you' gate; calls api.login then onDone.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { fetchTravellers } from '../api.real';
import './collab/collab.css';

export function Login({ onDone }: { onDone: () => void }) {
  const [names, setNames] = useState<string[] | null>(null);
  const [name, setName] = useState(''); const [pass, setPass] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { if (import.meta.env.VITE_API === 'real') fetchTravellers().then(n => setNames(n)); else setNames(['Luke', 'Partner']); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim() || busy) return; setBusy(true); setErr('');
    try { await api.login(pass, name.trim()); onDone(); } catch (x) { setErr((x as Error).message || 'Could not sign in'); setBusy(false); }
  };
  return (
    <div className="login"><form className="card" onSubmit={submit}>
      <h1>Our Japan Trip</h1><div className="ja">日本への旅</div>
      <label>Passphrase<input type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} /></label>
      <label>Who are you?
        {names && names.length > 0
          ? <div className="chips" style={{ marginTop: 6 }}>{names.map(n => <button type="button" key={n} className={'chip' + (n === name ? ' on' : '')} onClick={() => setName(n)}>{n}</button>)}</div>
          : <input value={name} placeholder="Your name" autoComplete="name" onChange={e => setName(e.target.value)} />}
      </label>
      <div className="err" role="alert">{err}</div>
      <button className="go" disabled={busy || !name.trim()}>{busy ? 'Signing in...' : 'Board the train'}</button>
    </form></div>
  );
}
