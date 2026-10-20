export type FastRecord = {category:string;furnishing:string;unit_numbers:string;revision:number;updated_at?:string};
export type CellState = {draft:string;saved:string;revision:number;status:'saved'|'unsaved'|'saving'|'error';error:string};
export class FastCell {
 state:CellState;
 private queued:string|undefined;
 private running=false;
 constructor(record:FastRecord,private send:(value:string,revision:number)=>Promise<FastRecord>,private notify:(state:CellState)=>void){
  this.state={draft:record.unit_numbers,saved:record.unit_numbers,revision:record.revision,status:'saved',error:''};
 }
 private emit(){this.notify({...this.state});}
 edit(value:string){this.state.draft=value;this.state.status=this.running?'saving':value===this.state.saved?'saved':'unsaved';this.state.error='';this.emit();}
 async save(){
  this.queued=this.state.draft;
  if(this.running)return;
  this.running=true;
  try{
   while(this.queued!==undefined){
    const target=this.queued;this.queued=undefined;
    if(target===this.state.saved){this.state.status=this.state.draft===this.state.saved?'saved':'unsaved';this.emit();continue;}
    this.state.status='saving';this.emit();
    try{
     const record=await this.send(target,this.state.revision);
     this.state.saved=record.unit_numbers;this.state.revision=record.revision;
     // Normalize only the exact submitted input, never a later edit.
     if(this.state.draft===target)this.state.draft=record.unit_numbers;
     this.state.status=this.state.draft===this.state.saved?'saved':'unsaved';this.state.error='';this.emit();
    }catch(error){
     const e=error as Error & {current?:FastRecord};
     if(e.current){this.state.saved=e.current.unit_numbers;this.state.revision=e.current.revision;}
     this.queued=undefined;this.state.status='error';this.state.error=e.current?`${e.message} Latest saved value: ${e.current.unit_numbers||'(empty)'}. Retry only to replace it.`:e.message||'Save failed. Your input is kept.';this.emit();break;
    }
   }
  }finally{this.running=false;}
 }
}
