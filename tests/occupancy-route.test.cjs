/* eslint-disable @typescript-eslint/no-require-imports -- Node isolated regression fixtures. */
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');const vm=require('vm');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const composition={};vm.runInNewContext(compile('src/lib/jasmine/occupancy-answer.ts'),{exports:composition,Map,Set,Date});
test('query route retains all rounds, successful and failed sources, CSV and returned history without model count contamination',async()=>{
 const use=(id,name,input={})=>({type:'tool_use',id,name,input});
 const responses=[
  {stop_reason:'tool_use',content:[use('a','get_units',{unit_type:'Madison'}),use('s','get_portfolio_summary')]},
  {stop_reason:'tool_use',content:[use('b','get_units',{unit_type:'Other'}),use('d','get_unit_detail',{unit_id:'detail-fixture'}),use('f','get_long_vacancies',{min_days:90})]},
  {stop_reason:'end_turn',content:[{type:'text',text:'Wrong: 999 units only in the last list.'}]}
 ];
 const list=id=>({units:[{unit_id:id,status:'vacant',unit_type:id,available_to_lease:false,days_vacant:90}],source_report_date:new Date().toISOString(),freshness:'current',warnings:[]});
 const route={};const calls=[];
 class Anthropic{constructor(){this.messages={create:async()=>responses.shift()};}}
 const requireMock=name=>{
  if(name==='@anthropic-ai/sdk')return Anthropic;
  if(name==='@/lib/jasmine/occupancy-answer')return composition;
  if(name==='@/lib/jasmine/owner-answer')return require('./jasmine-fixture.cjs').owner;
  if(name==='@/lib/jasmine/tools')return {JASMINE_TOOLS:require('./jasmine-fixture.cjs').tools};
  if(name==='@/lib/jasmine/sonnet')return {...require('./jasmine-fixture.cjs').sonnet,createSonnetResolver:()=>async()=> 'claude-sonnet-5-5'};
  if(name==='@/lib/supabase/server')return {createClient:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture-user'}}})}})};
  if(name==='@/lib/jasmine/executor')return {executeTool:async(name,input,token)=>{assert.equal(token,'fixture-user');calls.push(name);
   if(name==='get_units')return list(input.unit_type);
   if(name==='get_portfolio_summary')return {occupied:135,occupancy_denominator:179};
   if(name==='get_unit_detail')return {unit_id:input.unit_id,unit_status:'occupied',lease_end_date:'2027-01-01'};
   throw Error('fixture source offline');}};
  throw Error('Unexpected import '+name);
 };
 vm.runInNewContext(compile('src/app/api/jasmine/query/route.ts'),{exports:route,require:requireMock,process:{env:{}},console,Request,Response,Intl,Date,Map,Set});
 const response=await route.POST(new Request('https://fixture.invalid',{method:'POST',body:JSON.stringify({query:'Compare two lists, summary and unit detail.'})}));
 assert.equal(response.status,200);const body=await response.json();
 for(const text of ['unit type: Madison','unit type: Other','Portfolio summary','135','Unit detail','2027-01-01','Source request failed'])assert.ok(body.answer.includes(text),text);
 assert.doesNotMatch(body.answer,/999/);assert.equal(calls.length,5);
 assert.match(body.csv_data,/Madison/);assert.match(body.csv_data,/Other/);
 assert.equal(body.history.at(-1).content[0].text,'Wrong: 999 units only in the last list.');
 assert.equal(body.history_model,'claude-sonnet-5-5');
});
