const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),ts=require('typescript'),vm=require('vm');const exportsObject={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/fastCell.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});const {FastCell}=exportsObject;
const initial={category:'basic',furnishing:'furnished',unit_numbers:'',revision:0};const tick=()=>new Promise(r=>setImmediate(r));
test('rapid blur saves are serialized, stale response never replaces newer typing',async()=>{
 const calls=[],pending=[];const cell=new FastCell(initial,(value,revision)=>{calls.push({value,revision});return new Promise(resolve=>pending.push(resolve));},()=>{});
 cell.edit('001');const work=cell.save();cell.edit('120-a');cell.save();assert.equal(calls.length,1);
 pending.shift()({...initial,unit_numbers:'001',revision:1});await tick();assert.equal(cell.state.draft,'120-a');assert.equal(calls[1].revision,1);
 pending.shift()({...initial,unit_numbers:'120-a',revision:2});await work;assert.equal(cell.state.status,'saved');assert.equal(cell.state.draft,'120-a');
});
test('failed save preserves latest draft; explicit retry succeeds; clearing persists',async()=>{
 let fail=true;const cell=new FastCell(initial,async(value,revision)=>{if(fail)throw Error('offline');return {...initial,unit_numbers:value,revision:revision+1}},()=>{});
 cell.edit('103');await cell.save();assert.equal(cell.state.status,'error');assert.equal(cell.state.draft,'103');fail=false;await cell.save();assert.equal(cell.state.saved,'103');cell.edit('');await cell.save();assert.equal(cell.state.saved,'');
});
test('concurrent server edit updates revision but preserves draft for explicit conflict retry',async()=>{
 const cell=new FastCell(initial,async()=>{throw Object.assign(Error('changed elsewhere'),{current:{...initial,unit_numbers:'999',revision:4}})},()=>{});
 cell.edit('103');await cell.save();assert.equal(cell.state.draft,'103');assert.equal(cell.state.revision,4);assert.match(cell.state.error,/999/);assert.equal(cell.state.status,'error');
});
test('Fast navigation first, mobile table fixed width and all six accessible cell coordinates',()=>{
 const config=fs.readFileSync('src/lib/moduleConfig.ts','utf8');assert.ok(config.indexOf("id: 'mod-fast'")<config.indexOf("id: 'mod-today'"));
 const page=fs.readFileSync('src/app/fast/FastContent.tsx','utf8');assert.match(page,/table-fixed/);assert.match(page,/w-full min-w-0/);assert.match(page,/onBlur/);assert.match(page,/aria-label/);assert.ok(page.includes("'ABC'[col]"));
});
