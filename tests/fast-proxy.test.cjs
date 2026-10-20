const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),ts=require('typescript'),vm=require('vm');
test('Fast PUT traverses the real authenticated proxy with body and user token; anonymous PUT denied',async()=>{
 let authenticated=true;const calls=[];const mod={};
 const code=ts.transpileModule(fs.readFileSync('src/app/api/proxy/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:mod,process:{env:{}},URLSearchParams,console,Response,require:name=>{
  if(name==='next/server')return{NextResponse:Response};
  if(name==='next/headers')return{cookies:async()=>({getAll:()=>[]})};
  if(name==='@supabase/ssr')return{createServerClient:()=>({auth:{getSession:async()=>({data:{session:authenticated?{access_token:'fixture-token'}:null}})}})};
  throw Error(name);
 },fetch:async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{unit_numbers:'',revision:1}});}});
 const body=JSON.stringify({unit_numbers:'',revision:0});const request={nextUrl:new URL('https://fixture.invalid/api/proxy?_path=/api/v1/fast/basic/furnished'),text:async()=>body};
 const response=await mod.PUT(request);assert.equal(response.status,200);assert.equal(calls[0].options.method,'PUT');assert.equal(calls[0].options.body,body);assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-token');
 authenticated=false;assert.equal((await mod.PUT(request)).status,401);assert.equal(calls.length,1);
});
