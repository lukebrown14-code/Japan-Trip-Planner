import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SEGMENTS_MAX, type TransportSegment } from '@shared/types';
import { useStore } from '../../store';
import { formatJourneyDate, journeyView } from '../../transport/viewModel';
import { saveJourneyDetails } from '../../transport/saveJourney';
import { registerNavigationGuard } from '../../nav';
import type { JourneyEditorProps } from './contracts';
import { connectionWarnings, draftFor, fingerprint, validateDraft, type Draft } from './editorLogic';
import './editor.css';
export default function JourneyEditor({journeyKey,onSaved,onCancel,onDirtyChange}: JourneyEditorProps) {
  const data=useStore(s=>s.data), view=journeyView(data,journeyKey);
  const [draft,setDraft]=useState<Draft>(()=>view ? draftFor(view) : {segments:[],confirmation:'',cost:'',notes:''});
  const [baseline,setBaseline]=useState(()=>fingerprint(view));
  const [initial,setInitial]=useState(()=>JSON.stringify(draft));
  const [expanded,setExpanded]=useState<string|undefined>(()=>draft.segments[0]?.id);
  const [removed,setRemoved]=useState<{service:TransportSegment;index:number}>();
  const [saving,setSaving]=useState(false), [error,setError]=useState('');
  const [overwrite,setOverwrite]=useState<string>();
  const [pending,setPending]=useState<(()=>void)|undefined>();
  const unregister=useRef<(()=>void)|undefined>(undefined), dialog=useRef<HTMLDivElement>(null);
  const dirty=JSON.stringify(draft)!==initial, changed=fingerprint(view)!==baseline;
  useEffect(()=> { onDirtyChange?.(dirty); return ()=>onDirtyChange?.(false); },[dirty,onDirtyChange]);
  useEffect(()=> {
    if (!dirty) return;
    unregister.current=registerNavigationGuard(proceed=>setPending(()=>proceed));
    const before=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';}; window.addEventListener('beforeunload',before);
    return ()=> {unregister.current?.();unregister.current=undefined;window.removeEventListener('beforeunload',before);};
  },[dirty]);
  useEffect(()=> {
    if (!dirty && !saving && view && changed) {const next=draftFor(view);setDraft(next);setInitial(JSON.stringify(next));setBaseline(fingerprint(view));}
  },[data,dirty,saving,changed]);
  useEffect(()=> {if(!pending)return;const previous=document.activeElement as HTMLElement|null;const root=document.getElementById('root');const prior=root?.inert??false;if(root)root.inert=true;dialog.current?.querySelector<HTMLElement>('button')?.focus();return ()=>{if(root)root.inert=prior;previous?.focus();};},[pending]);
  useEffect(()=> { document.querySelector<HTMLElement>('.je-editor h2')?.focus({preventScroll:true}); },[]);
  function leave(proceed:()=>void) {unregister.current?.();unregister.current=undefined;setInitial(JSON.stringify(draft));setPending(undefined);onDirtyChange?.(false);proceed();}
  async function save(proceed?:()=>void) {
    const latest=journeyView(useStore.getState().data,journeyKey);
    if(!latest){setError('This journey was removed. Your draft is kept, but cannot be saved.');return;}
    const current=fingerprint(latest);
    if(current!==baseline && overwrite!==current){setError('This journey changed while you were editing. Reload it or choose to overwrite with your draft.');return;}
    const invalid=validateDraft(draft);if(invalid){setError(invalid);return;}
    setSaving(true);setError('');
    try {await saveJourneyDetails(journeyKey,{segments:draft.segments.map((s,ord)=>({...s,ord})),confirmation:draft.confirmation.trim()||undefined,cost:draft.cost===''?undefined:Number(draft.cost),notes:draft.notes.trim()||undefined});leave(proceed??onSaved);}
    catch(e){setError(e instanceof Error?e.message:'Could not save. Your draft is kept.');}finally{setSaving(false);}
  }
  function reload(){if(!view)return;const next=draftFor(view);setDraft(next);setInitial(JSON.stringify(next));setBaseline(fingerprint(view));setOverwrite(undefined);setRemoved(undefined);setError('');}
  function update(id:string,patch:Partial<TransportSegment>){setDraft(d=>({...d,segments:d.segments.map(s=>s.id===id?{...s,...patch}:s)}));}
  function move(index:number,direction:number){setDraft(d=>{const segments=[...d.segments];[segments[index],segments[index+direction]]=[segments[index+direction],segments[index]];return {...d,segments};});}
  const dateOption = (offset:number) => {
    if (!view?.date) return offset === 0 ? 'Journey day' : offset === 1 ? 'Following day' : `${offset} days later`;
    const day = new Date(Date.parse(`${view.date}T00:00:00Z`) + offset * 86400000).toISOString().slice(0,10);
    return `${formatJourneyDate(day)}${offset === 0 ? ' (journey day)' : offset === 1 ? ' (following day)' : ''}`;
  };
  const warnings=connectionWarnings(draft.segments);
  return <section className="je-editor" aria-label="Edit journey">
    <p className="je-hint">{formatJourneyDate(view?.date)} · {view?.adults ?? 2} travellers</p>
    <h2 tabIndex={-1}>Edit {view?.title ?? 'journey'}</h2>
    {!view && <p role="alert" className="je-warning">This journey is no longer available. Your draft remains here until you leave.</p>}
    {changed && dirty && view && <div className="je-warning" role="alert"><p>Another update changed this journey. Your draft has been preserved.</p><button disabled={saving} onClick={reload}>Discard draft and reload latest</button><button disabled={saving} onClick={()=>setOverwrite(fingerprint(view))}>Keep my draft and overwrite latest</button>{overwrite===fingerprint(view)&&<p>Your next save will replace the latest journey details.</p>}</div>}
    <fieldset disabled={saving} className="je-fields"><legend>Services</legend>
      {draft.segments.length===0 && <p>No confirmed services yet. Add your train or bus details.</p>}
      {draft.segments.map((s,i)=><article className="je-service" key={s.id}>
        <button className="je-service-toggle" aria-expanded={expanded===s.id} aria-controls={`je-service-${s.id}`} onClick={()=>setExpanded(expanded===s.id?undefined:s.id)}>{i+1}. {s.service||'New service'} <span>{expanded===s.id?'Close':'Edit'}</span></button>
        {expanded===s.id && <div id={`je-service-${s.id}`} className="je-service-fields">
          <label>Service name / number<input aria-label="Service name / number" maxLength={80} value={s.service??''} onChange={e=>update(s.id,{service:e.target.value||undefined})}/></label>
          <div className="je-grid"><label>Departure station<input aria-label="Departure station" maxLength={80} value={s.fromStation??''} onChange={e=>update(s.id,{fromStation:e.target.value||undefined})}/></label><label>Arrival station<input aria-label="Arrival station" maxLength={80} value={s.toStation??''} onChange={e=>update(s.id,{toStation:e.target.value||undefined})}/></label></div>
          <div className="je-grid"><label>Departure time<input aria-label="Departure time" type="time" value={s.departTime??''} onChange={e=>update(s.id,{departTime:e.target.value||undefined})}/></label><label>Arrival time<input aria-label="Arrival time" type="time" value={s.arriveTime??''} onChange={e=>update(s.id,{arriveTime:e.target.value||undefined})}/></label><label>Departure date<select aria-label="Departure date" value={s.departDayOffset??0} onChange={e=>update(s.id,{departDayOffset:Number(e.target.value)})}>{Array.from({length:31},(_,offset)=><option key={offset} value={offset}>{dateOption(offset)}</option>)}</select></label><label>Arrival date<select aria-label="Arrival date" value={s.arriveDayOffset??0} onChange={e=>update(s.id,{arriveDayOffset:Number(e.target.value)})}>{Array.from({length:31},(_,offset)=><option key={offset} value={offset}>{dateOption(offset)}</option>)}</select></label></div>
          <label>Booking status<select aria-label="Booking status" value={s.status} onChange={e=>update(s.id,{status:e.target.value as TransportSegment['status']})}><option value="to_book">To book</option><option value="booked">Booked</option><option value="na">Pay on the day</option></select></label>
          <div className="je-grid"><label>Service reference<input aria-label="Service reference" maxLength={80} value={s.confirmation??''} onChange={e=>update(s.id,{confirmation:e.target.value||undefined})}/></label><label>Seat details<input aria-label="Seat details" maxLength={120} value={s.seatDetails??''} onChange={e=>update(s.id,{seatDetails:e.target.value||undefined})}/></label></div>
          <label>Booking / ticket URL<input aria-label="Booking / ticket URL" type="url" maxLength={500} placeholder="https://" value={s.bookingUrl??''} onChange={e=>update(s.id,{bookingUrl:e.target.value||undefined})}/></label>
          <label>Collection / boarding instructions<textarea aria-label="Collection / boarding instructions" maxLength={2000} value={s.instructions??''} onChange={e=>update(s.id,{instructions:e.target.value||undefined})}/></label>
          <div className="je-actions"><button disabled={i===0} onClick={()=>move(i,-1)}>Move earlier</button><button disabled={i===draft.segments.length-1} onClick={()=>move(i,1)}>Move later</button><button onClick={()=>{setRemoved({service:s,index:i});setDraft(d=>({...d,segments:d.segments.filter(v=>v.id!==s.id)}));}}>Remove service</button></div>
        </div>}
      </article>)}
      {removed&&<div className="je-undo" role="status">Service removed. <button disabled={draft.segments.length>=SEGMENTS_MAX} onClick={()=>{setDraft(d=>{const segments=[...d.segments];segments.splice(Math.min(removed.index,segments.length),0,removed.service);return {...d,segments};});setExpanded(removed.service.id);setRemoved(undefined);}}>Undo</button></div>}
      <button disabled={draft.segments.length>=SEGMENTS_MAX} onClick={()=>{const id=crypto.randomUUID();setDraft(d=>({...d,segments:[...d.segments,{id,ord:d.segments.length,status:'to_book'}]}));setExpanded(id);}}>Add service</button>
      <p className="je-hint">Up to {SEGMENTS_MAX} services. Times are in Japan (JST). Choose the following day for overnight travel.</p>
      <div className="je-grid"><label>Journey reference<input aria-label="Journey reference" maxLength={80} value={draft.confirmation} onChange={e=>setDraft(d=>({...d,confirmation:e.target.value}))}/></label><label>Total paid for group (¥)<input aria-label="Total paid for group (¥)" type="number" min={0} max={100000000} step={1} value={draft.cost} onChange={e=>setDraft(d=>({...d,cost:e.target.value}))}/></label></div>
      <label>Journey notes<textarea aria-label="Journey notes" maxLength={2000} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))}/></label>
    </fieldset>
    {warnings.map(w=><p className="je-warning" key={w}>{w}</p>)}
    {error&&<div className="je-error" role="alert">{error} <button disabled={saving||!view} onClick={()=>void save(pending)}>Retry save</button></div>}
    <div className="je-savebar"><span aria-live="polite">{saving?'Saving…':dirty?'Unsaved changes':'No unsaved changes'}</span><button disabled={saving} onClick={()=>dirty?setPending(()=>onCancel):onCancel()}>Cancel</button><button className="je-primary" disabled={saving||!view} onClick={()=>void save()}>Save changes</button></div>
    {pending&&createPortal(<div className="je-backdrop"><div className="je-dialog" role="dialog" aria-modal="true" aria-labelledby="je-dialog-title" ref={dialog} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setPending(undefined);}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}><h3 id="je-dialog-title">Save your changes?</h3><p>Your journey has unsaved edits.</p>{error&&<p role="alert">{error}</p>}<button disabled={saving||!view} onClick={()=>void save(pending)}>Save and leave</button><button disabled={saving} onClick={()=>leave(pending)}>Discard and leave</button><button disabled={saving} onClick={()=>setPending(undefined)}>Keep editing</button></div></div>,document.body)}
  </section>;
}
