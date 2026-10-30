/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { sonnet, model } = require('./jasmine-fixture.cjs');

test('discovery uses metadata, paginates and orders release dates rather than names', async () => {
  const calls = [];
  const resolver = sonnet.createSonnetResolver({ get: async (path, options) => {
    calls.push({ path, options });
    return options.query.after_id ? { data: [model('opaque-new-id', { created_at: '2026-10-30T00:00:00Z' })], has_more: false } : {
      data: [model('claude-sonnet-999'), model('opus', { line: 'opus' }), model('claude-sonnet-1000', { line: null })],
      has_more: true, last_id: 'cursor',
    };
  } });
  assert.equal(await resolver(), 'opaque-new-id');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers['anthropic-version'], '2026-10-21');
  assert.equal(calls[1].options.query.after_id, 'cursor');
});

test('filters deprecated, retired, unknown capabilities, inadequate output and invalid release dates', () => {
  for (const overrides of [
    { lifecycle: 'deprecated' }, { lifecycle: 'retired' }, { lifecycle: 'preview' }, { line: null },
    { capabilities: null }, { capabilities: { effort: { medium: { supported: true } } } },
    { max_tokens: 2048 }, { max_tokens: null }, { created_at: 'unknown' },
  ]) assert.equal(sonnet.compatibleSonnet(model('future', overrides)), false);
  assert.equal(sonnet.compatibleSonnet(model()), true);
});

test('single-flight cache isolates resolver instances and refreshes after five minutes', async () => {
  let now = 0, calls = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const resolver = sonnet.createSonnetResolver({ get: async () => {
    calls++; await barrier; return { data: [model()], has_more: false };
  } }, () => now);
  const pending = Array.from({ length: 20 }, () => resolver());
  release();
  assert.ok((await Promise.all(pending)).every(id => id === sonnet.SONNET_FALLBACK));
  assert.equal(calls, 1);
  now = 299999; await resolver(); assert.equal(calls, 1);
  now = 300000; await resolver(); assert.equal(calls, 2);
  const isolated = sonnet.createSonnetResolver({ get: async () => ({ data: [model('other')], has_more: false }) });
  assert.equal(await isolated(), 'other');
});

test('discovery errors, malformed and cyclic pages safely fall back and retry after short negative cache', async () => {
  for (const get of [async () => { throw Error('offline'); }, async () => ({}),
    async () => ({ data: [], has_more: true, last_id: 'same' })]) {
    let now = 0, calls = 0;
    const resolver = sonnet.createSonnetResolver({ get: async (...args) => { calls++; return get(...args); } }, () => now);
    assert.equal(await resolver(), sonnet.SONNET_FALLBACK);
    const previous = calls; await resolver(); assert.equal(calls, previous);
    now = 30000; await resolver(); assert.ok(calls > previous);
  }
});

test('pinning preserves existing compatible conversations and rejects unknown models', async () => {
  const resolver = sonnet.createSonnetResolver({ get: async () => ({ data: [model('new'), model('old')], has_more: false }) });
  assert.equal(await resolver('old'), 'old');
  await assert.rejects(resolver('claude-sonnet-imaginary'));
  assert.equal(await resolver(sonnet.SONNET_FALLBACK), sonnet.SONNET_FALLBACK);
});

test('explicitly retired or incompatible fallback cannot be selected or pinned', async () => {
  for (const overrides of [{ lifecycle: 'retired' }, { capabilities: null }]) {
    const resolver = sonnet.createSonnetResolver({ get: async () => ({ data: [model(undefined, overrides)], has_more: false }) });
    await assert.rejects(resolver());
    await assert.rejects(resolver(sonnet.SONNET_FALLBACK));
  }
});
