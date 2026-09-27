import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import ts from 'typescript'

const path = new URL('../src/components/feed/LeaderboardPanel.tsx', import.meta.url)
const url = 'data:text/javascript,' + encodeURIComponent(ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText)
const dataUrl = code => 'data:text/javascript,' + encodeURIComponent(code)
const mocks = {
  react: dataUrl(`export const useCallback = fn => fn; export const useRef = () => ({current: globalThis.__panel.dialog}); export const useState = initial => [globalThis.__panel.mode ?? initial, v => globalThis.__panel.mode = v]; export const useEffect = fn => globalThis.__panel.effects.push(fn);`),
  'react/jsx-runtime': dataUrl('export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;'),
  '@/components/game/GameProvider': dataUrl('export const useSurvivalGame = () => globalThis.__panel.game;'),
  './Avatar': dataUrl('export default function Avatar() {}'),
  '@/hooks/usePollingResource': dataUrl('export const usePollingResource = (url, validate) => { globalThis.__panel.request = {url, validate}; return globalThis.__panel.resource; };'),
  '@/lib/survival/config': new URL('../src/lib/survival/config.ts', import.meta.url).href,
}
register(dataUrl(`export function resolve(specifier, context, next) { const mocks = ${JSON.stringify(mocks)}; if (context.parentURL === ${JSON.stringify(url)} && mocks[specifier]) return {url:mocks[specifier],shortCircuit:true}; return next(specifier,context); }`), import.meta.url)
const { default: Panel, isSurvivalScores } = await import(url)
const row = { runId: 'saved_run_000000001', handle: 'player', activeMs: 12345, completedObjectives: 2, roundsSurvived: 0, stage: 'boot' }
const response = (scores = [row], mode = 'pointer') => ({ rulesVersion: 'survival-v3', inputMode: mode, scores })

function host() {
  const oldDocument = globalThis.document, oldElement = globalThis.HTMLElement
  class Element { isConnected = true; focused = 0; focus() { this.focused++ } }
  const previous = new Element()
  globalThis.HTMLElement = Element; globalThis.document = { activeElement: previous }
  const calls = []
  const dialog = { open: false, showModal() { this.open = true; calls.push('showModal') }, close() { this.open = false; calls.push('close') } }
  globalThis.__panel = { effects: [], dialog, game: { state: { run: { inputMode: 'pointer' } }, pause: (...args) => calls.push(args) }, resource: { data: response(), loading: false, error: null, refresh: () => {} } }
  return { previous, calls, dialog, render: (open = true, close = () => {}) => Panel({ open, onClose: close }), cleanup: () => { globalThis.document = oldDocument; globalThis.HTMLElement = oldElement; delete globalThis.__panel } }
}
function nodes(node) { return [node, ...(Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(v => v && typeof v === 'object').flatMap(nodes)] }

test('rankings validate mode/version, unique whole rows, bounds and derived fields', () => {
  assert.equal(isSurvivalScores(response(), 'pointer'), true)
  assert.equal(isSurvivalScores(response([]), 'pointer'), true)
  for (const scores of [[row, row], [{ ...row, activeMs: NaN }], [{ ...row, stage: 'observe' }], [{ ...row, roundsSurvived: 3 }], [{ ...row, completedObjectives: -1 }], [{ ...row, handle: 'system' }], [{ ...row, runId: 'bad' }]]) assert.equal(isSurvivalScores(response(scores), 'pointer'), false)
  assert.equal(isSurvivalScores(response(), 'touch_or_keyboard'), false)
  assert.equal(isSurvivalScores({ ...response(), rulesVersion: 'survival-v1' }, 'pointer'), false)
})

test('dialog pause setup/cleanup replay, focus return, Escape, close and backdrop callbacks', () => {
  const h = host()
  try {
    let exits = 0
    const tree = h.render(true, () => exits++)
    const effect = globalThis.__panel.effects[0]
    let cleanup = effect()
    assert.equal(h.dialog.open, true); assert.deepEqual(h.calls[0], ['leaderboard', true])
    cleanup(); assert.equal(h.dialog.open, false); assert.equal(h.previous.focused, 1)
    cleanup = effect(); assert.equal(h.dialog.open, true)
    tree.props.onClose(); assert.equal(exits, 0) // Ignore delayed native close from a previous opening.
    let prevented = false
    tree.props.onCancel({ preventDefault: () => prevented = true }); assert.equal(prevented, true); assert.equal(exits, 1)
    nodes(tree).find(n => n.props?.['aria-label'] === 'Close leaderboard').props.onClick(); assert.equal(exits, 2)
    tree.props.onClick({ target: h.dialog, currentTarget: { getBoundingClientRect: () => ({ left: 10, right: 50, top: 10, bottom: 50 }) }, clientX: 30, clientY: 30 }); assert.equal(exits, 2)
    tree.props.onClick({ target: h.dialog, currentTarget: { getBoundingClientRect: () => ({ left: 10, right: 50, top: 10, bottom: 50 }) }, clientX: 0, clientY: 0 }); assert.equal(exits, 3)
    cleanup(); tree.props.onClose(); assert.equal(exits, 4)
    assert.deepEqual(h.calls.at(-1), ['leaderboard', false]); assert.equal(h.previous.focused, 2)
  } finally { h.cleanup() }
})

test('closed panel performs no read; mode filters select only matching rankings and render one row', () => {
  const h = host()
  try {
    h.render(false); assert.equal(globalThis.__panel.request.url, null)
    const tree = h.render()
    assert.ok(globalThis.__panel.request.url.includes('inputMode=pointer&rulesVersion=survival-v3'))
    assert.equal(nodes(tree).filter(n => n.type === 'li').length, 1)
    nodes(tree).find(n => n.type === 'select').props.onChange({ target: { value: 'touch_or_keyboard' } })
    h.render(); assert.ok(globalThis.__panel.request.url.includes('inputMode=touch_or_keyboard'))
    assert.equal(globalThis.__panel.request.validate(response()), false)
    assert.equal(globalThis.__panel.request.validate(response([], 'touch_or_keyboard')), true)
  } finally { h.cleanup() }
})
