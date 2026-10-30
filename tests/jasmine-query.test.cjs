/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { routeFixture, model, use, response, tools } = require('./jasmine-fixture.cjs');
const thinking = { type: 'thinking', thinking: '', signature: 'fixture-signed' };

test('all tools remain available; adaptive medium effort has a suitable output budget and no SDK retries', async () => {
  const fixture = routeFixture();
  assert.equal((await fixture.post()).status, 200);
  const { body, options } = fixture.requests[0];
  assert.equal(body.tools.length, tools.length);
  assert.equal(body.max_tokens, 8192);
  assert.equal(body.thinking.type, 'adaptive');
  assert.equal(body.output_config.effort, 'medium');
  assert.equal(body.tool_choice.type, 'auto');
  assert.equal(options.maxRetries, 0);
});

test('preserves exact signed blocks and complete append-only multi-round history, separate from composed display', async () => {
  const first = [thinking, use('one', 'get_units')];
  const second = [{ type: 'redacted_thinking', data: 'opaque' }, use('two')];
  const last = [thinking, { type: 'text', text: 'Invented 999 units.' }];
  const fixture = routeFixture({ responses: [response(first, 'tool_use'), response(second, 'tool_use'), response(last)],
    execute: async name => name === 'get_units' ? [] : { occupied: 100 } });
  const body = await (await fixture.post()).json();
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.calls[0][2], 'fixture-token');
  assert.deepEqual(body.history[1].content, first);
  assert.deepEqual(body.history[3].content, second);
  assert.deepEqual(body.history.at(-1).content, last);
  assert.notEqual(body.answer, last[1].text);
  assert.deepEqual(fixture.requests[2].body.messages.slice(0, 3), fixture.requests[1].body.messages);
  assert.equal(body.history_model, 'claude-sonnet-5-5');
});

test('new compatible model can reject request and fall back once before any tools; no retries for outages/auth', async () => {
  const invalid = Object.assign(Error('unsupported'), { status: 400 });
  const fixture = routeFixture({ models: [model('future')], responses: [invalid, response()] });
  assert.equal((await fixture.post()).status, 200);
  assert.deepEqual(fixture.requests.map(request => request.body.model), ['future', 'claude-sonnet-5-5']);
  for (const status of [401, 403, 429, 500, 529]) {
    const failed = routeFixture({ models: [model('future')], responses: [Object.assign(Error('rejected'), { status })] });
    assert.equal((await failed.post()).status, 502);
    assert.equal(failed.requests.length, 1); assert.equal(failed.calls.length, 0);
  }
});

test('validates the entire response and all calls before a mutation can run', async () => {
  for (const bad of [use('bad', 'unknown'), use('bad', 'create_action', {}),
    use('bad', 'create_action', { title: 42 }), use('bad', 'create_action', { title: 'x', priority: 'urgent' }),
    use('bad', 'create_action', { title: 'x', surprise: 'x' }), use('ok', 'get_units')]) {
    const fixture = routeFixture({ responses: [response([use('ok', 'create_action', { title: 'Fixture only' }), bad], 'tool_use')] });
    assert.equal((await fixture.post()).status, 502); assert.equal(fixture.calls.length, 0);
  }
});

test('truncation, refusal, new stop reasons and unsupported blocks never execute tools or return incomplete text', async () => {
  for (const reason of ['max_tokens', 'refusal', 'model_context_window_exceeded', 'pause_turn', null]) {
    const fixture = routeFixture({ responses: [response([use('mutation', 'create_action', { title: 'Fixture' })], reason)] });
    assert.equal((await fixture.post()).status, 502); assert.equal(fixture.calls.length, 0);
  }
  for (const content of [[{ type: 'future_block' }], [use('a')], [thinking], [{ type: 'thinking', thinking: '' }]]) {
    const fixture = routeFixture({ responses: [response(content)] });
    const result = await fixture.post();
    assert.equal(result.status, 502);
    assert.equal(fixture.calls.length, 0);
  }
});

test('post-tool model failure and repeated IDs never retry or duplicate a completed mutation', async () => {
  for (const next of [Object.assign(Error('unavailable'), { status: 400 }),
    response([use('one', 'create_action', { title: 'Fixture' })], 'tool_use')]) {
    const fixture = routeFixture({ responses: [response([use('one', 'create_action', { title: 'Fixture' })], 'tool_use'), next] });
    const result = await fixture.post(), body = await result.json();
    assert.equal(result.status, 200); assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.requests.length, 2); assert.match(body.answer, /Check Tasks/);
    assert.equal(body.history.at(-1).content[0].type, 'tool_result');
  }
});

test('tool errors become results without retries and future models are pinned through follow-up turns', async () => {
  const fixture = routeFixture({ models: [model('future')], responses: [
    { ...response([use('one')], 'tool_use'), model: 'future' },
    { ...response(), model: 'future' }, { ...response(), model: 'future' },
  ], execute: async () => { throw Error('fixture failure'); } });
  const body = await (await fixture.post()).json();
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.requests[1].body.messages.at(-1).content[0].is_error, true);
  assert.equal((await fixture.post({ history: body.history, history_model: body.history_model })).status, 200);
  assert.ok(fixture.requests.every(request => request.body.model === 'future'));
});

test('authentication and malformed or unpinned signed histories fail before discovery or tools', async () => {
  const unauthenticated = routeFixture({ authenticated: false });
  assert.equal((await unauthenticated.post()).status, 401);
  assert.equal(unauthenticated.catalogs.length, 0);
  for (const input of [{ history: 'invalid' }, { history_model: 42 },
    { history: [{ role: 'assistant', content: [thinking] }] }]) {
    const fixture = routeFixture();
    assert.ok([400, 409].includes((await fixture.post(input)).status));
    assert.equal(fixture.catalogs.length, 0); assert.equal(fixture.calls.length, 0);
  }
});

test('a repeated action with a new ID reuses success or uncertain failure, including reordered arguments', async () => {
  for (const fail of [false, true]) {
    const fixture = routeFixture({ responses: [
      response([use('one', 'create_action', { title: 'Fixture', priority: 'normal' })], 'tool_use'),
      response([use('two', 'create_action', { priority: 'normal', title: 'Fixture' })], 'tool_use'), response(),
    ], execute: async () => { if (fail) throw Error('connection lost after write'); return { id: 'fixture-task' }; } });
    assert.equal((await fixture.post()).status, 200);
    assert.equal(fixture.calls.length, 1);
    const result = fixture.requests[2].body.messages.at(-1).content[0];
    assert.equal(result.tool_use_id, 'two');
    assert.equal(result.is_error ?? false, fail);
  }
});

test('tool limit preserves command results and never offers a retry as a server error', async () => {
  const fixture = routeFixture({ responses: Array.from({ length: 5 }, (_, i) =>
    response([use(String(i), i === 0 ? 'create_action' : 'get_portfolio_summary', i === 0 ? { title: 'Fixture only' } : {})], 'tool_use')) });
  const result = await fixture.post(), body = await result.json();
  assert.equal(result.status, 200);
  assert.match(body.answer, /Created task: Fixture only/);
  assert.equal(fixture.requests.length, 5);
  assert.equal(fixture.calls.filter(call => call[0] === 'create_action').length, 1);
});

test('system remains stable and date context is appended; old signed turns remain unchanged', async () => {
  const fixture = routeFixture({ responses: [response([thinking, { type: 'text', text: 'First' }]), response()] });
  const first = await (await fixture.post()).json();
  await fixture.post({ history: first.history, history_model: first.history_model });
  assert.equal(fixture.requests[0].body.system, fixture.requests[1].body.system);
  assert.doesNotMatch(fixture.requests[0].body.system, /AUTHORITATIVE CURRENT DATE:/);
  assert.match(fixture.requests[1].body.messages.at(-1).content, /AUTHORITATIVE CURRENT DATE:/);
  assert.deepEqual(fixture.requests[1].body.messages.slice(0, first.history.length), first.history);
});

test('concurrent requests share discovery but keep histories and command executions isolated', async () => {
  const fixture = routeFixture({ responses: Array.from({ length: 10 }, () => response()) });
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) => fixture.post({ query: 'Fixture ' + i })));
  assert.ok(results.every(result => result.status === 200));
  assert.equal(fixture.catalogs.length, 1);
  assert.equal(new Set(fixture.requests.map(request => request.body.messages[0].content)).size, 10);
  assert.equal(fixture.calls.length, 0);
});
