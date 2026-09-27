import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../src/components/game/GameOver.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const componentUrl = 'data:text/javascript,' + encodeURIComponent(compiled)
const mocks = Object.fromEntries(Object.entries({
  react: `export const useState = initial => [initial, value => globalThis.__gameOver.updates.push(value)]; export const useEffect = effect => globalThis.__gameOver.effects.push(effect);`,
  'react/jsx-runtime': `export const jsx = (type, props) => ({type, props}); export const jsxs = jsx; export const Fragment = 'fragment';`,
  '@/lib/navigation': `export const returnToGate = () => globalThis.__gameOver.navigations++;`,
  '@/components/EndScreen': `export default function EndScreen() {}`,
  './GameProvider': `export const useSurvivalGame = () => globalThis.__gameOver.game;`,
}).map(([key, code]) => [key, 'data:text/javascript,' + encodeURIComponent(code)]))
register('data:text/javascript,' + encodeURIComponent(`
export function resolve(specifier, context, nextResolve) {
  const mocks = ${JSON.stringify(mocks)};
  if (context.parentURL === ${JSON.stringify(componentUrl)} && mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}`), import.meta.url)
const { default: GameOver } = await import(componentUrl)

test('failed end screen retains admission and stays available when restart cannot save', async () => {
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async url => { requests.push(url); return Response.json({ ok: true }) }
  const host = globalThis.__gameOver = { effects: [], updates: [], navigations: 0, game: {
    state: { user: { handle: 'bound_unit' }, terminal: { status: 'failed', activeMs: 1000, completedObjectiveIds: [], measurements: [{ explanation: 'Idle.' }] } },
    saveError: null, saveResult: async () => {}, restart: async () => { throw new Error('Save unavailable. Retry.') },
  } }
  try {
    const screen = GameOver()
    for (const effect of host.effects) effect()
    await Promise.resolve()
    assert.deepEqual(requests, [], 'rendering a result must not revoke the session used to save it')
    const event = { preventDefault() {} }
    await screen.props.children.props.onSubmit(event)
    assert.equal(host.navigations, 0, 'failed save must not navigate to the gate that clears admission')
    assert.ok(host.updates.includes('Save unavailable. Retry.'))
    assert.equal(host.updates.at(-1), false, 'restart remains available for retry')
    host.game.restart = async () => {}
    await GameOver().props.children.props.onSubmit(event)
    assert.equal(host.navigations, 1)
  } finally { globalThis.fetch = previousFetch; delete globalThis.__gameOver }
})
