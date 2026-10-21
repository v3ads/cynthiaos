'use client';
import {useEffect,useRef,useState} from 'react';
import {getFast,saveFast,resetFast,type FastRecord} from '@/lib/api';
import {FastCell,type CellState} from '@/lib/fastCell';

const categories=['basic','upgraded','premium'];
const furnishings=['furnished','unfurnished'];
const plans:Record<string,string>={basic:'Martinique',upgraded:'Barcelona',premium:'Madison'};
function Cell({record,code,disabled,report}:{record:FastRecord;code:string;disabled:boolean;report:(state:CellState)=>void}){
 const [state,setState]=useState<CellState>({draft:record.unit_numbers,saved:record.unit_numbers,revision:record.revision,status:'saved',error:''});
 const controller=useRef<FastCell|null>(null);
 if(!controller.current)controller.current=new FastCell(record,(value,revision)=>saveFast(record.category,record.furnishing,value,revision),s=>{setState(s);report(s);});
 const current=controller.current;
 return <div className="min-w-0" data-save-state={state.status}>
  <label htmlFor={`fast-${code}`} className="block text-xs text-text-muted mb-2">{code}</label>
  <textarea disabled={disabled} id={`fast-${code}`} aria-label={`${record.category} ${record.furnishing} unit numbers`} aria-describedby={`status-${code}`} aria-invalid={state.status==='error'} maxLength={1000} rows={3} value={state.draft}
   onChange={e=>current.edit(e.target.value)} onBlur={()=>void current.save()} placeholder="Unit numbers"
   className="w-full min-w-0 resize-y rounded-lg border border-border bg-surface px-2 py-3 text-base text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"/>
  <div id={`status-${code}`} role="status" aria-live="polite" className={`text-xs mt-2 min-h-5 ${state.status==='error'?'text-danger':'text-text-secondary'}`}>
   {state.status==='saving'?'Saving…':state.status==='unsaved'?'Unsaved':state.status==='error'?state.error:'Saved'}
   {state.status==='error'&&<button className="block mt-2 text-accent underline min-h-8" onMouseDown={e=>e.preventDefault()} onClick={()=>void current.save()}>Retry save</button>}
  </div>
 </div>;
}
export default function FastContent(){
 const [records,setRecords]=useState<FastRecord[]|null>(null);const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
 const states=useRef<Record<string,CellState>>({});const [resetting,setResetting]=useState(false);const [resetMessage,setResetMessage]=useState('');const [generation,setGeneration]=useState(0);
 async function reset(){
  if(!records||resetting)return;
  if(Object.values(states.current).some(s=>s.status!=='saved')){setResetMessage('Finish saving your edits before Reset. Retry any failed cell save first.');return;}
  const revisions=categories.flatMap(category=>furnishings.map(furnishing=>{
   const state=states.current[`${category}/${furnishing}`];const record=records.find(r=>r.category===category&&r.furnishing===furnishing);
   return {category,furnishing,unit_numbers:state?.saved??record?.unit_numbers??'',revision:state?.revision??record?.revision??0};
  }));
  setResetting(true);setResetMessage('Resetting all six cells.');
  try{const result=await resetFast(revisions);states.current={};setRecords(result.data);setGeneration(n=>n+1);setResetMessage(`Reset saved. Vacancy report: ${result.source_report_date}.`);}
  catch(e){setResetMessage(e instanceof Error?e.message:'Reset failed. Your values were kept.');}finally{setResetting(false);}
 }
 useEffect(()=>{let active=true;getFast().then(rows=>{if(active){setRecords(rows);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[attempt]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{const nodes=document.querySelectorAll('[data-fast] [data-save-state]:not([data-save-state="saved"])');if(nodes.length){e.preventDefault();}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
 return <main data-fast className="p-4 pt-20 lg:p-10 max-w-5xl mx-auto">
  <h1 className="text-3xl font-bold text-text-primary">fast</h1>
  <p className="text-sm text-text-secondary mt-3 mb-6">Enter unit numbers separated by commas or spaces. Each cell saves when you leave it. Empty cells are allowed.</p>
  <p className="text-sm text-text-secondary mb-3">Reset selects the longest-vacant unit with a known vacancy duration in each group. Groups with no qualifying unit are cleared. Occupied and notice units are excluded.</p>
  <button disabled={!records||resetting} onMouseDown={e=>e.preventDefault()} onClick={()=>void reset()} className="rounded-lg border border-border px-4 py-2 mb-3 text-accent disabled:opacity-50">{resetting?'Resetting…':'Reset'}</button>
  <p role="status" aria-live="polite" className="text-sm mb-4">{resetMessage}</p>
  {error?<div role="alert" className="text-danger">{error}<button className="block mt-3 text-accent underline" onClick={()=>setAttempt(n=>n+1)}>Retry loading</button></div>:!records?<p role="status">Loading unit numbers…</p>:
  <div className="rounded-xl border border-border overflow-hidden bg-surface-elevated">
   <table className="w-full table-fixed border-collapse text-left" aria-label="Fast unit numbers">
    <thead><tr><th className="w-20 sm:w-28 p-2 sm:p-4 text-xs text-text-muted">Units</th>{categories.map(c=><th key={c} scope="col" className="p-2 sm:p-4 text-sm sm:text-base capitalize text-text-primary">{c}<span className="block text-xs font-normal break-words">{plans[c]}</span></th>)}</tr></thead>
    <tbody>{furnishings.map((f,row)=><tr key={f} className="border-t border-border"><th scope="row" className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-text-secondary break-words capitalize">{f}</th>{categories.map((c,col)=><td key={c} className="p-1.5 sm:p-4 align-top border-l border-border"><Cell key={`${generation}-${c}-${f}`} disabled={resetting} report={s=>{states.current[`${c}/${f}`]=s;}} code={`${'ABC'[col]}${row+1}`} record={records.find(r=>r.category===c&&r.furnishing===f)??{category:c,furnishing:f,unit_numbers:'',revision:0}}/></td>)}</tr>)}</tbody>
   </table>
  </div>}
 </main>;
}
