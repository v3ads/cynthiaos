'use client';
import {useEffect,useRef,useState} from 'react';
import {getFast,saveFast,type FastRecord} from '@/lib/api';
import {FastCell,type CellState} from '@/lib/fastCell';

const categories=['basic','upgraded','premium'];
const furnishings=['furnished','unfurnished'];
function Cell({record,code}:{record:FastRecord;code:string}){
 const [state,setState]=useState<CellState>({draft:record.unit_numbers,saved:record.unit_numbers,revision:record.revision,status:'saved',error:''});
 const controller=useRef<FastCell|null>(null);
 if(!controller.current)controller.current=new FastCell(record,(value,revision)=>saveFast(record.category,record.furnishing,value,revision),setState);
 const current=controller.current;
 return <div className="min-w-0" data-save-state={state.status}>
  <label htmlFor={`fast-${code}`} className="block text-xs text-text-muted mb-2">{code}</label>
  <textarea id={`fast-${code}`} aria-label={`${record.category} ${record.furnishing} unit numbers`} aria-describedby={`status-${code}`} aria-invalid={state.status==='error'} maxLength={1000} rows={3} value={state.draft}
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
 useEffect(()=>{let active=true;getFast().then(rows=>{if(active){setRecords(rows);setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[attempt]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{const nodes=document.querySelectorAll('[data-fast] [data-save-state]:not([data-save-state="saved"])');if(nodes.length){e.preventDefault();}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[]);
 return <main data-fast className="p-4 pt-20 lg:p-10 max-w-5xl mx-auto">
  <h1 className="text-3xl font-bold text-text-primary">fast</h1>
  <p className="text-sm text-text-secondary mt-3 mb-6">Enter unit numbers separated by commas or spaces. Each cell saves when you leave it. Empty cells are allowed.</p>
  {error?<div role="alert" className="text-danger">{error}<button className="block mt-3 text-accent underline" onClick={()=>setAttempt(n=>n+1)}>Retry loading</button></div>:!records?<p role="status">Loading unit numbers…</p>:
  <div className="rounded-xl border border-border overflow-hidden bg-surface-elevated">
   <table className="w-full table-fixed border-collapse text-left" aria-label="Fast unit numbers">
    <thead><tr><th className="w-20 sm:w-28 p-2 sm:p-4 text-xs text-text-muted">Units</th>{categories.map(c=><th key={c} scope="col" className="p-2 sm:p-4 text-sm sm:text-base capitalize text-text-primary">{c}</th>)}</tr></thead>
    <tbody>{furnishings.map((f,row)=><tr key={f} className="border-t border-border"><th scope="row" className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-text-secondary break-words capitalize">{f}</th>{categories.map((c,col)=><td key={c} className="p-1.5 sm:p-4 align-top border-l border-border"><Cell code={`${'ABC'[col]}${row+1}`} record={records.find(r=>r.category===c&&r.furnishing===f)??{category:c,furnishing:f,unit_numbers:'',revision:0}}/></td>)}</tr>)}</tbody>
   </table>
  </div>}
 </main>;
}
