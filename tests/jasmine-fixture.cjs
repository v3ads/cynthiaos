/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test fixture. */
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports, require: name => {
      if (!(name in imports)) throw Error('Unexpected import: ' + name);
      return imports[name];
    },
    process: { env: {} }, console: { error() {} }, Request, Response,
    Date, Intl, Map, Set,
  });
  return exports;
}
const sonnet = load('src/lib/jasmine/sonnet.ts');
const tools = load('src/lib/jasmine/tools.ts').JASMINE_TOOLS;
const composition = load('src/lib/jasmine/occupancy-answer.ts');
const owner = load('src/lib/jasmine/owner-answer.ts', { './occupancy-answer': composition });
const model = (id = 'claude-sonnet-5-5', overrides = {}) => ({
  id, line: 'sonnet', lifecycle: 'active', created_at: '2026-10-01T00:00:00Z', max_tokens: 64000,
  capabilities: { effort: { medium: { supported: true } }, thinking: { types: { adaptive: { supported: true } } } },
  ...overrides,
});
const use = (id, name = 'get_portfolio_summary', input = {}) => ({ type: 'tool_use', id, name, input });
const response = (content = [{ type: 'text', text: 'Fixture answer' }], stop_reason = 'end_turn') => ({
  model: 'claude-sonnet-5-5', content, stop_reason,
});
function routeFixture({ responses = [response()], models = [model()], execute, authenticated = true, get } = {}) {
  const requests = [], calls = [], catalogs = [];
  class Anthropic {
    constructor() {
      this.get = async (...args) => {
        catalogs.push(args);
        return get ? get(...args) : { data: models, has_more: false, last_id: null };
      };
      this.messages = { create: async (body, options) => {
        requests.push({ body: structuredClone(body), options });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        if (!next) throw Error('Unexpected model call');
        return next;
      } };
    }
  }
  const route = load('src/app/api/jasmine/query/route.ts', {
    '@anthropic-ai/sdk': Anthropic,
    '@/lib/jasmine/sonnet': sonnet,
    '@/lib/jasmine/tools': { JASMINE_TOOLS: tools },
    '@/lib/jasmine/occupancy-answer': composition,
    '@/lib/jasmine/owner-answer': owner,
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getSession: async () => ({
      data: { session: authenticated ? { access_token: 'fixture-token' } : null },
    }) } }) },
    '@/lib/jasmine/executor': { executeTool: async (...args) => {
      calls.push(args);
      return execute ? execute(...args) : { fixture: true };
    } },
  });
  return { requests, calls, catalogs, post: body => route.POST(new Request('https://fixture.invalid', {
    method: 'POST', body: JSON.stringify({ query: 'fixture query', ...body }),
  })) };
}
module.exports = { load, sonnet, tools, model, use, response, routeFixture, owner };
