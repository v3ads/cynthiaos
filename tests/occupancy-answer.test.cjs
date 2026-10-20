const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');const vm=require('vm');
const source=fs.readFileSync('src/lib/jasmine/occupancy-answer.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};vm.runInNewContext(compiled,{exports:exportsObject,Map});
test('answer counts and groups come from payload rows even when supplied totals are wrong',()=>{
 const result={total_count:6,counts_by_type:{Furnished:3,Unfurnished:2},source_report_date:'2026-10-20',freshness:'stale',warnings:['Source stale'],units:[
  ...['a','b','c','d'].map(unit_id=>({unit_id,unit_type:'Furnished',status:'vacant',available_to_lease:false,days_vacant:90})),
  ...['e','f','g'].map(unit_id=>({unit_id,unit_type:'Unfurnished',status:'notice',available_to_lease:false,days_vacant:null}))]};
 const answer=exportsObject.occupancyAnswer(result);
 assert.match(answer,/\*\*7 units returned\*\*/);assert.match(answer,/Furnished \(4\)/);assert.match(answer,/Unfurnished \(3\)/);
 assert.equal((answer.match(/- \*\*Unit /g)||[]).length,7);assert.match(answer,/Source stale/);
 assert.match(answer,/leasing availability not confirmed/);assert.match(answer,/notice/);
});
test('unknown/empty results have no invented units or freshness',()=>{
 const answer=exportsObject.occupancyAnswer({units:[],source_report_date:null,freshness:'unknown',warnings:['Source unknown']});
 assert.match(answer,/0 units returned/);assert.match(answer,/as of unknown/);assert.doesNotMatch(answer,/- \*\*Unit /);
});
test('Home sets retrieval time only on metrics success and labels actual source separately',()=>{
 const dashboard=fs.readFileSync('src/app/dashboard/components/DashboardContent.tsx','utf8');
 assert.doesNotMatch(dashboard,/`Live/);assert.match(dashboard,/Occupancy data as of:/);
 assert.match(dashboard,/\.then\(\(summary\) => \{[\s\S]*?setLastUpdated/);
 assert.doesNotMatch(dashboard,/\.finally\(\(\) => \{[^}]*setLastUpdated/);
});
