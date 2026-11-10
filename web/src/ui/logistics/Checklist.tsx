import { useState } from 'react';
import { useStore } from '../../store';
import { commit, destroy } from './common';

const STARTER = ['eSIM set up', 'Suica on phone', 'Travel insurance', 'Yen cash', 'Type-A power adapters', 'Visit Japan Web registered',
  'Shinkansen oversized-luggage seats reserved', 'Ghibli / teamLab / USJ tickets', 'Check in online for the flight home'];
const uid = () => Math.random().toString(36).slice(2, 10);

export function Checklist() {
  const items = useStore(s => s.data.checklist); const me = useStore(s => s.me); const travellers = useStore(s => s.travellers);
  const [text, setText] = useState('');
  const sorted = [...items].sort((a, b) => a.ord - b.ord);
  const done = items.filter(i => i.doneAt).length;
  const nextOrd = () => Math.max(0, ...items.map(i => i.ord)) + 1;
  const add = (t: string, ord = nextOrd()) => { if (t.trim()) commit('checklist', { id: uid(), ord, text: t.trim() }); };
  const people = [...new Set([...travellers, ...(me ? [me] : [])])];
  return (
    <section>
      {items.length > 0 && <div className="lg-progress" aria-label="progress">
        <div className="bar"><i style={{ width: `${done / items.length * 100}%` }} /></div>
        <span>{done}/{items.length} done</span>
      </div>}
      <ul className="lg-list">
        {sorted.map(i => (
          <li key={i.id} className={i.doneAt ? 'done' : ''}>
            <button className="tick" aria-label={i.doneAt ? 'Untick' : 'Tick'} aria-pressed={!!i.doneAt}
              onClick={() => commit('checklist', i.doneAt ? { ...i, doneBy: undefined, doneAt: undefined } : { ...i, doneBy: me ?? undefined, doneAt: new Date().toISOString() })}>{i.doneAt ? '✓' : ''}</button>
            <div className="txt"><span>{i.text}</span>{i.doneAt && <small>{i.doneBy ?? 'someone'} · {new Date(i.doneAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</small>}</div>
            <select aria-label="Assignee" value={i.assignee ?? ''} onChange={e => commit('checklist', { ...i, assignee: e.target.value || undefined })}>
              <option value="">Anyone</option>{people.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="x" aria-label="Delete item" onClick={() => destroy('checklist', i.id)}>✕</button>
          </li>
        ))}
      </ul>
      <form className="lg-add" onSubmit={e => { e.preventDefault(); add(text); setText(''); }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add an item…" />
        <button type="submit" className="primary">Add</button>
      </form>
      {items.length === 0 && <button className="lg-link" onClick={() => STARTER.forEach((t, i) => add(t, i + 1))}>Add the starter list</button>}
    </section>
  );
}
