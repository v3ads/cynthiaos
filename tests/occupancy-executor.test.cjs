const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const ts=require('typescript');const vm=require('vm');
const compiled=ts.transpileModule(fs.readFileSync('src/lib/jasmine/executor.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
test('only Jasmine list consumers request the envelope; auth and filters are preserved',async()=>{
 const calls=[];const exportsObject={};
 vm.runInNewContext(compiled,{exports:exportsObject,process:{env:{CYNTHIAOS_API_URL:'https://fixture.invalid'}},URLSearchParams,
 fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({units:[]})};}});
 await exportsObject.executeTool('get_units',{status:'vacant',unit_type:'Madison',building:'B.1'},'fixture-user-token');
 await exportsObject.executeTool('get_long_vacancies',{min_days:90},'fixture-user-token');
 assert.match(calls[0].url,/format=envelope/);assert.match(calls[0].url,/unit_type=Madison/);assert.match(calls[0].url,/building=B.1/);
 assert.match(calls[1].url,/format=envelope/);assert.match(calls[1].url,/min_days=90/);
 assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-user-token');assert.equal(calls[0].options.cache,'no-store');
});
