/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Clear cannot hide an in-flight task outcome; after completion it resets history and model', async () => {
  const state = [], refs = [], requests = [];
  let stateIndex = 0, refIndex = 0, settle;
  const pending = new Promise(resolve => { settle = resolve; });
  const react = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
    useEffect() {}, useCallback: callback => callback,
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('src/components/jasmine/JasmineChatPanel.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, Date, setTimeout() {}, fetch: async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return pending;
  }, require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
    if (['next/link', 'react-markdown', 'remark-gfm'].includes(name)) return () => null;
    throw Error('Unexpected import ' + name);
  } });
  function render() { stateIndex = refIndex = 0; return exports.default(); }
  function nodes(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
    return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
  }
  function button(tree, label) { return nodes(tree, node => node.type === 'button' && node.props.children === label)[0]; }
  const input = nodes(render(), node => node.type === 'input')[0];
  input.props.onChange({ target: { value: 'Create fixture task' } });
  const sending = button(render(), 'Ask').props.onClick();
  let clear = button(render(), 'Clear');
  assert.equal(clear.props.disabled, true);
  clear.props.onClick(); // Also exercise the handler despite the disabled UI.
  assert.equal(state[0].length, 1);
  assert.equal(state[4], true);
  settle({ ok: true, json: async () => ({ answer: 'Created fixture task',
    history: [{ role: 'assistant', content: [{ type: 'text', text: 'Created fixture task' }] }],
    history_model: 'claude-sonnet-5-5' }) });
  await sending;
  clear = button(render(), 'Clear');
  assert.equal(clear.props.disabled, false);
  assert.equal(state[0].at(-1).content, 'Created fixture task');
  assert.equal(state[2], 'claude-sonnet-5-5');
  clear.props.onClick();
  assert.equal(state[0].length, 0);
  assert.equal(state[1].length, 0);
  assert.equal(state[2], undefined);
  assert.equal(button(render(), 'Clear'), undefined);
  nodes(render(), node => node.type === 'input')[0].props.onChange({ target: { value: 'New conversation' } });
  await button(render(), 'Ask').props.onClick();
  assert.deepEqual(requests[1].history, []);
  assert.equal(requests[1].history_model, undefined);
});
