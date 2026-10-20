// Browser-only fixture harness. Bundles the actual dashboard and count renderer;
// mocks data/auth contexts in the bundle, never changes app auth or server routes.
// ESBUILD_MODULE points to an independently installed esbuild-wasm 0.25.12.
const esbuild=require(process.env.ESBUILD_MODULE);const fs=require('fs');const path=require('path');const http=require('http');
const root=process.cwd();const out=path.join(root,'.fixture');fs.mkdirSync(out,{recursive:true});
const api=`const state=new URLSearchParams(location.search).get('state')||'current';
export const RATE_METRIC_IDS=new Set(['occupancy_rate','vacancy_rate']);export const CURRENCY_METRIC_IDS=new Set();
const empty={data:[],total:0};
export const getMetricsSummary=async()=>{if(state==='failure')throw Error('Fixture source failure');return {success:true,as_of:'2026-10-20T12:00:00Z',occupancy_source:{source_report_date:state==='unknown'?null:state==='stale'?'2020-01-01':'2026-10-20',retrieved_at:'2026-10-20T12:00:00Z',freshness:state,warnings:[]},metrics:[]};};
export const metricsByIdFrom=s=>new Map((s?.metrics||[]).map(m=>[m.metric_id,m]));
export const getActiveLeasePopulation=async()=>[];
export const getUpcomingRenewals=async()=>empty;
export const getExpiringCount=async()=>empty;
export const getPortfolioHealth=async()=>null;
export const getAtRiskRevenue=async()=>empty;
export const getCollectionsRisk=async()=>empty;
export const getTurnoverVelocity=async()=>null;
export const getIncomeStatements=async()=>empty;`;
const plugin={name:'local-fixtures',setup(build){
 build.onResolve({filter:/^@\/lib\/api$/},()=>({path:'api',namespace:'fixture'}));
 build.onResolve({filter:/^@\/contexts\/AuthContext$/},()=>({path:'auth',namespace:'fixture'}));
 build.onResolve({filter:/^@\/contexts\/LeaseActionsContext$/},()=>({path:'actions',namespace:'fixture'}));
 build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',resolveDir:root,contents:args.path==='api'?api:args.path==='auth'?'export const useAuth=()=>({});':args.path==='actions'?'export const useLeaseActions=()=>({contactedIds:new Set(),store:{}});':`import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}`}));
}};
(async()=>{
 await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import ReactMarkdown from 'react-markdown';import remarkGfm from 'remark-gfm';import Dashboard from './src/app/dashboard/components/DashboardContent';import {composeToolAnswer} from './src/lib/jasmine/occupancy-answer';
 const rows=[...['a','b','c','d'].map(unit_id=>({unit_id,unit_type:'Furnished',status:'vacant',available_to_lease:false,days_vacant:90})),...['e','f','g'].map(unit_id=>({unit_id,unit_type:'Unfurnished',status:'notice',available_to_lease:false,days_vacant:null}))];
 const state=new URLSearchParams(location.search).get('state')||'current';
 const list=(id,units)=>({id,name:'get_units',input:{status:units[0]?.status||'vacant',unit_type:id},failed:state==='failure',result:{units,source_report_date:state==='unknown'?null:state==='stale'?'2020-01-01':new Date().toISOString(),freshness:state,warnings:[]}});
 const observations=[list('Madison',rows.slice(0,4)),list('Other',rows.slice(4)),{id:'s',name:'get_portfolio_summary',input:{},result:{occupied:135,on_notice:4,occupancy_denominator:179}},{id:'d',name:'get_unit_detail',input:{unit_id:'detail-fixture'},result:{unit_id:'detail-fixture',unit_status:'occupied',lease_end_date:'2027-01-01'}}];
 createRoot(document.getElementById('root')).render(<><aside>LOCAL FIXTURE — synthetic data, no production connection</aside><Dashboard/><section id="jasmine"><ReactMarkdown remarkPlugins={[remarkGfm]}>{composeToolAnswer('Incorrect model count 999',observations)}</ReactMarkdown></section></>);`,resolveDir:root,loader:'jsx'},outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',define:{'process.env.NODE_ENV':'"development"'},plugins:[plugin],tsconfig:path.join(root,'tsconfig.json')});
 const html='<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/dashboard.css"></head><body style="background:#101b24;color:#eee;font-family:sans-serif"><div id="root"></div><script src="/bundle.js"></script></body></html>';
 const server=http.createServer((req,res)=>{const file=req.url.split('?')[0];res.setHeader('Cache-Control','no-store');if(file==='/bundle.js'||file==='/dashboard.css'){res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.existsSync(out+file)?fs.readFileSync(out+file):'');}else{res.setHeader('Content-Type','text/html');res.end(html);}});
 server.listen(4031,'127.0.0.1',()=>console.log('Local fixture harness: http://127.0.0.1:4031/?state=current (also stale, unknown, failure)'));
})().catch(e=>{console.error(e);process.exitCode=1;});
