const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');const vm=require('vm');
const compiled=ts.transpileModule(fs.readFileSync('src/lib/jasmine/occupancy-answer.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};vm.runInNewContext(compiled,{exports:api,Map,Set,Date});
const row=(id,type='Furnished')=>({unit_id:id,status:'vacant',unit_type:type,days_vacant:90,available_to_lease:true});
const list=(id,units,extra={})=>({id,name:'get_units',input:{status:'vacant',unit_type:id},result:{units,source_report_date:new Date().toISOString(),freshness:'current',warnings:[],...extra}});

test('two distinct lists preserve membership, source filters and per-list counts; CSV retains both sources',()=>{
 const observations=[list('Madison',[row('A'),row('B')]),list('Other',[row('C','Unfurnished')])];
 const answer=api.composeToolAnswer('WRONG: 50 vacant units.',observations);
 assert.match(answer,/unit type: Madison/);assert.match(answer,/unit type: Other/);
 assert.match(answer,/2 units returned/);assert.match(answer,/1 units returned/);
 for(const id of ['A','B','C'])assert.match(answer,new RegExp('Unit '+id));
 assert.doesNotMatch(answer,/50 vacant/);
 const rows=api.occupancyExportRows(observations);assert.equal(rows.length,3);
 assert.equal(rows[0].source_call_id,'Madison');assert.equal(rows[2].source_call_id,'Other');
});
test('list plus summary preserves complete summary, denominator, notice and source timestamps',()=>{
 const observations=[list('Madison',[row('A')]),{id:'summary',name:'get_portfolio_summary',input:{},result:{occupied:135,vacant:40,on_notice:4,occupancy_denominator:179,source_report_date:'2026-10-20',retrieved_at:'2026-10-20T21:00:00Z',last_pipeline_run:null}}];
 const answer=api.composeToolAnswer('model summary',observations);
 assert.match(answer,/Portfolio summary/);assert.match(answer,/occupied:\*\* 135/);assert.match(answer,/on notice:\*\* 4/);
 assert.match(answer,/occupancy denominator:\*\* 179/);assert.match(answer,/Retrieved at \(not source report date\)/);
 assert.match(answer,/Source report date:\*\* 2026-10-20/);
});
test('list plus detail retains requested unit context, canonical status, lease fields and nested details',()=>{
 const answer=api.composeToolAnswer('model detail',[list('Madison',[row('A')]),{id:'detail',name:'get_unit_detail',input:{unit_id:'D'},result:{unit_id:'D',unit_status:'occupied',lease_end_date:'2027-01-01',notes:'fixture note',context:{leasing_excluded:true}}}]);
 assert.match(answer,/Unit detail/);assert.match(answer,/unit id: D/);assert.match(answer,/unit status:\*\* occupied/);
 assert.match(answer,/2027-01-01/);assert.match(answer,/fixture note/);assert.match(answer,/leasing excluded:\*\* true/);
});
test('no list leaves original narrative and export behavior unchanged',()=>{
 assert.equal(api.composeToolAnswer('A complete narrative.',[{id:'s',name:'get_portfolio_summary',input:{},result:{occupied:135}}]),'A complete narrative.');
 assert.equal(api.occupancyExportRows([]),null);
});
test('empty list is a verified zero, while failed list is not zero; other successful results survive',()=>{
 const observations=[list('Empty',[]),{id:'bad',name:'get_units',input:{unit_type:'Failed'},failed:true},{id:'s',name:'get_portfolio_summary',input:{},result:{occupied:135}}];
 const answer=api.composeToolAnswer('invented unit X',observations);
 assert.equal((answer.match(/0 units returned/g)||[]).length,1);assert.match(answer,/Source request failed/);
 assert.match(answer,/occupied:\*\* 135/);assert.doesNotMatch(answer,/invented/);assert.equal(api.occupancyExportRows(observations).length,0);
});
test('stale, unknown, missing and invalid source dates cannot advertise leasing availability despite payload true',()=>{
 for(const extra of [
  {freshness:'stale',source_report_date:'2020-01-01'},
  {freshness:'unknown',source_report_date:null},
  {freshness:'current',source_report_date:null},
  {freshness:'current',source_report_date:'bad'},
  {freshness:'current',source_report_date:new Date(Date.now()+86400000).toISOString()},
 ]){
  const observations=[list('Historical',[row('A')],extra)];
  const answer=api.composeToolAnswer('Available now!',observations);
  assert.match(answer,/historical\/unverified/);assert.match(answer,/leasing availability not confirmed/);
  assert.doesNotMatch(answer,/; available to lease/);assert.equal(api.occupancyExportRows(observations)[0].available_to_lease,false);
 }
});
