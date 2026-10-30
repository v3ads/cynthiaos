/* eslint-disable @typescript-eslint/no-require-imports -- Node isolated regression fixtures. */
const test=require('node:test'); const assert=require('node:assert/strict');
const {owner,routeFixture,response,use}=require('./jasmine-fixture.cjs');
const renewal={effective_date:'2026-10-30',source_report_date:null,holdovers:1,stale_closeouts:14,
  windows:[{days:30,through:'2026-11-29',count:0},{days:60,through:'2026-12-29',count:1},{days:90,through:'2027-01-28',count:14}]};
const metric=(id,value,extra={})=>({metric_id:id,label:id,value,confidence:'trusted',source_freshness:null,...extra});
const metrics={metrics:[metric('renewals_due_90d',14),metric('stale_closeout_count',14)],renewal_summary:renewal};
const observed=(name,result)=>({id:name,name,input:{},result});
const queueRows=[...Array(7).fill({type:'overdue_turn'}),...Array(14).fill({type:'renewal_due'}),...Array(11).fill({type:'stale_closeout'})];
const queue={queue:queueRows,queue_total:32,queue_total_open:32,queue_summary:{displayed:{total:32,by_type:{overdue_turn:7,renewal_due:14,stale_closeout:11}},
  all_open:{total:32,by_type:{overdue_turn:7,renewal_due:14,stale_closeout:11}},truncated:false}};

test('route renders verified 0/1/14 and preserves the exact model response only in history',async()=>{
  const wrong='14 within 60 days and 35 queue rows\n| Window | Count |\n|---|---|\n| 60 | 999 |';
  const f=routeFixture({responses:[response([use('m','get_management_metrics'),use('q','get_today_priorities')],'tool_use'),response([{type:'text',text:wrong}])],
    execute:async name=>name==='get_management_metrics'?metrics:queue});
  const result=await(await f.post()).json();
  assert.match(result.answer,/60 days\*\*, through 2026-12-29: \*\*1\*\*/);
  assert.match(result.answer,/32\*\* open actions/);assert.match(result.answer,/Stale closeout actions: \*\*11/);
  assert.doesNotMatch(result.answer,/14 within 60|35 queue/);
  assert.equal(result.history.at(-1).content[0].text,wrong);
  assert.equal(result.csv_data,null);
  assert.equal(f.calls.length,2);assert.ok(f.calls.every(call=>call[0]!=='create_action'));
});

test('post-tool model error preserves verified facts without replaying requests',async()=>{
  const f=routeFixture({responses:[response([use('m','get_management_metrics')],'tool_use'),Error('offline')],execute:async()=>metrics});
  const result=await(await f.post()).json();
  assert.match(result.answer,/60 days\*\*, through 2026-12-29: \*\*1/);
  assert.match(result.answer,/could not finish/);assert.equal(f.calls.length,1);
});

test('invalid windows, nonmonotonic counts and missing metadata never become zero',()=>{
  for(const change of [r=>r.windows[1].count=-1,r=>r.windows[1].count=99,r=>r.windows[1].through='2026-12-31',r=>delete r.effective_date]){
    const r=structuredClone(renewal);change(r);
    assert.match(owner.composeOwnerAnswer([observed('get_management_metrics',{metrics:[],renewal_summary:r})]),/No count or zero is inferred/);
  }
});

test('queue detects incorrect totals/types and distinguishes truncated from complete populations',()=>{
  const bad=structuredClone(queue);bad.queue_summary.displayed.by_type.stale_closeout=14;
  assert.match(owner.composeOwnerAnswer([observed('get_today_priorities',bad)]),/No count or zero/);
  const capped=structuredClone(queue);capped.queue_total_open=62;capped.queue_summary.all_open={total:62,by_type:{...capped.queue_summary.all_open.by_type,new_type:30}};
  capped.queue_summary.truncated=true;
  const answer=owner.composeOwnerAnswer([observed('get_today_priorities',capped)]);
  assert.match(answer,/62\*\* open actions; \*\*32\*\* displayed \(truncated\)/);
  assert.match(answer,/new type: \*\*30/);assert.match(answer,/Displayed rows only/);
});

test('income requires live provenance, preserves null as unknown and blocks misleading NOI',()=>{
  const value={cache_status:'live',latest:{report_date:'2026-10-30',total_income:2465160.73,mtd:{total_income:246415.42}}};
  const answer=owner.composeOwnerAnswer([observed('get_income_statement',value)]);
  assert.match(answer,/\$246,415.42/);assert.match(answer,/\$2,465,160.73/);assert.match(answer,/expenses are paid externally/);
  value.latest.mtd.total_income=null;
  assert.match(owner.composeOwnerAnswer([observed('get_income_statement',value)]),/MTD income: \*\*unknown/);
  delete value.cache_status;
  assert.match(owner.composeOwnerAnswer([observed('get_income_statement',value)]),/unavailable/);
});

test('failed and old backend summaries fail closed; other requested tool data remains present',()=>{
  assert.match(owner.composeOwnerAnswer([{...observed('get_today_priorities',queue),failed:true}]),/unavailable/);
  assert.match(owner.composeOwnerAnswer([observed('get_today_priorities',{queue:queueRows})]),/unavailable/);
  const result=owner.composeOwnerAnswer([observed('get_management_metrics',metrics),observed('get_notices',{fixture_count:3})]);
  assert.match(result,/fixture count:\*\* 3/);
  assert.equal(owner.composeOwnerAnswer([observed('get_notices',{})]),null);
});

test('unknown source report dates stay unknown even when retrieval is recent',()=>{
  const answer=owner.composeOwnerAnswer([observed('get_management_metrics',{metrics:[metric('collectible_exposure',262423.54)],renewal_summary:renewal})]);
  assert.match(answer,/\$262,423.54/);assert.match(answer,/source report: unknown/);
  assert.match(answer,/Retrieval time does not establish source freshness/);
});

test('verified empty queue is zero, while malformed dates and old financial payloads remain unavailable',()=>{
  const empty={queue:[],queue_total:0,queue_total_open:0,queue_summary:{displayed:{total:0,by_type:{}},all_open:{total:0,by_type:{}},truncated:false}};
  const answer=owner.composeOwnerAnswer([observed('get_today_priorities',empty)]);
  assert.match(answer,/0\*\* open actions/);assert.match(answer,/no overdue-turn actions/);
  const bad=structuredClone(renewal);bad.effective_date='2026-02-31';
  assert.match(owner.composeOwnerAnswer([observed('get_management_metrics',{metrics:[],renewal_summary:bad})]),/unavailable/);
});
