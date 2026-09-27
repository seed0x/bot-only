import type { SurvivalDetectorResult, SurvivalEvent, SurvivalRunState, SurvivalStageId, SurvivalPointerSample } from '../types'
import { SURVIVAL_SENSORS as limits, survivalStageAt } from './config'
import { evaluatePointer, evaluateTyping, evaluateScroll } from './detectors'

// One installation per provider. No event text, key names or DOM nodes enter evidence.
export function installSurvivalSensors(getState: () => SurvivalRunState,
  emit: (event: SurvivalEvent) => void, report: (result: SurvivalDetectorResult) => void) {
  let pointer: SurvivalPointerSample[] = [], typing: number[] = []
  let pointerStage: SurvivalStageId = 'boot', typingStage: SurvivalStageId = 'boot'
  let viewport = { width: window.innerWidth, height: window.innerHeight }
  let lastPoint: { x: number; y: number } | null = null, movement = 0
  let target: EventTarget | null = null, composing = false, insertionIntent = -Infinity
  type ScrollWindow = { position: number; intent: number; lastChange: number; start: number; bins: number[]; stage: SurvivalStageId; movement: number }
  const scrolls = new Map<Element, ScrollWindow>()
  const stage = () => {
    const state = getState()
    return survivalStageAt(state.activeMs + (state.phase === 'running' ? Math.max(0, performance.now() - (state.lastEventAtMs ?? performance.now())) : 0)).id
  }
  const running = () => getState().phase === 'running'
  const activity = (source: Extract<SurvivalEvent, { type: 'activity' }>['source'], atMs: number) => emit({ type: 'activity', source, atMs })
  const score = (result: SurvivalDetectorResult, atMs: number) => { report(result); emit({ type: 'detector_evaluated', result, atMs }) }
  const closePointer = (atMs: number) => {
    if (pointer.length) score(evaluatePointer(pointer, pointerStage, viewport), atMs)
    pointer = []
  }
  const reset = () => { pointer = []; typing = []; scrolls.clear(); lastPoint = null; movement = 0; target = null; insertionIntent = -Infinity; composing = false }
  const listeners: (() => void)[] = []
  function listen(name: string, handler: (event: Event) => void) {
    document.addEventListener(name, handler, { capture: true, passive: true })
    listeners.push(() => document.removeEventListener(name, handler, { capture: true }))
  }
  listen('pointermove', event => {
    const e = event as PointerEvent
    if (!e.isTrusted || !running() || !['mouse', 'pen'].includes(e.pointerType)) return
    const now = performance.now()
    if (document.pointerLockElement || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight) {
      pointer = []; lastPoint = null
      report({ detector: 'pointer', outcome: 'insufficient_data', stage: stage(), value: null, threshold: survivalStageAt(getState().activeMs).pointerRatio, explanation: 'Pointer unavailable: locked or outside viewport.' })
      return
    }
    if (lastPoint) movement += Math.hypot(e.clientX - lastPoint.x, e.clientY - lastPoint.y)
    lastPoint = { x: e.clientX, y: e.clientY }
    if (movement >= 4) { movement = 0; activity('pointer', now) }
    if (!running() || getState().run?.inputMode !== 'pointer') return
    const last = pointer.at(-1)
    if (last && (now - last.t > limits.pointerGapMs || now - pointer[0].t > limits.pointerWindowMs)) closePointer(now)
    if (pointer.length && now - pointer.at(-1)!.t < 1000 / limits.pointerHz) return
    if (!pointer.length) { pointerStage = stage(); viewport = { width: window.innerWidth, height: window.innerHeight } }
    pointer.push({ x: e.clientX, y: e.clientY, t: now })
    if (pointer.length === limits.pointerMaxSamples) closePointer(now)
  })
  listen('pointerdown', e => { if (e.isTrusted && running()) { const now = performance.now(); closePointer(now); activity('pointerdown', now) } })
  listen('pointerup', e => { if (e.isTrusted && running()) closePointer(performance.now()) })
  listen('pointercancel', () => { pointer = []; lastPoint = null })
  const editable = (node: EventTarget | null) => node instanceof HTMLElement && (node.isContentEditable || node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit', 'range'].includes(node.type))
  listen('keydown', event => {
    const e = event as KeyboardEvent
    if (!e.isTrusted || !running()) return
    const now = performance.now()
    if (!e.repeat) activity('keydown', now)
    // Retain only evidence that this input followed a direct, non-repeat printable key.
    insertionIntent = !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 ? now : -Infinity
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) typing = []
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key) && !editable(e.target)) intent(e, now)
  })
  listen('compositionstart', e => { if (e.isTrusted && running()) { composing = true; typing = []; activity('composition', performance.now()) } })
  listen('compositionupdate', e => { if (e.isTrusted && running()) activity('composition', performance.now()) })
  listen('compositionend', e => { composing = false; typing = []; if (e.isTrusted && running()) activity('composition', performance.now()) })
  listen('input', event => {
    const e = event as InputEvent
    if (!e.isTrusted || !running() || !editable(e.target)) return
    const now = performance.now()
    activity('input', now)
    if (target !== e.target) { typing = []; target = e.target }
    // Post composition still counts as activity, but never supplies typing evidence.
    if (e.target instanceof HTMLElement && e.target.dataset.survivalTyping === 'off') { typing = []; insertionIntent = -Infinity; return }
    if (composing || e.isComposing || e.inputType !== 'insertText' || now - insertionIntent > 250) { typing = []; insertionIntent = -Infinity; return }
    insertionIntent = -Infinity
    if (typing.length && (now - typing.at(-1)! > limits.typingGapMs || now <= typing.at(-1)!)) typing = []
    if (!typing.length) typingStage = stage()
    typing.push(now)
    if (typing.length === limits.typingMaxTimestamps) { score(evaluateTyping(typing, typingStage), now); typing = [now]; typingStage = stage() }
  })
  listen('focusin', () => { typing = []; target = null; insertionIntent = -Infinity; scrolls.clear() })
  function container(node: EventTarget | null): Element {
    let el = node instanceof Element ? node : null
    while (el && el !== document.documentElement) {
      const overflow = getComputedStyle(el).overflowY
      if (/(auto|scroll)/.test(overflow) && el.scrollHeight > el.clientHeight) return el
      el = el.parentElement
    }
    return document.scrollingElement ?? document.documentElement
  }
  function intent(e: Event, now: number) {
    const el = container(e.target)
    let s = scrolls.get(el)
    if (!s) {
      // Keep the container map bounded even if a page creates many scroll surfaces.
      if (scrolls.size >= 8) scrolls.delete(scrolls.keys().next().value!)
      s = { position: el.scrollTop, intent: now, lastChange: -Infinity, start: now, bins: [], stage: stage(), movement: 0 }
      scrolls.set(el, s)
    }
    s.intent = now
  }
  for (const name of ['wheel', 'touchstart', 'touchmove']) listen(name, e => { if (e.isTrusted && running()) intent(e, performance.now()) })
  listen('scroll', e => {
    pointer = []; lastPoint = null
    if (!running()) return
    const now = performance.now(), el = e.target === document ? document.scrollingElement : e.target
    if (!(el instanceof Element)) return
    const s = scrolls.get(el)
    if (!s || (now - s.intent > limits.scrollIntentGraceMs && now - s.lastChange > limits.scrollGapMs)) {
      scrolls.delete(el)
      report({ detector: 'scroll', outcome: 'insufficient_data', stage: stage(), value: null, threshold: survivalStageAt(getState().activeMs).scrollCv, explanation: 'Scroll unavailable: no identifiable user intent.' })
      return
    }
    const delta = el.scrollTop - s.position
    s.position = el.scrollTop
    if (!delta) return
    s.movement += Math.abs(delta)
    if (s.movement >= 4) { s.movement = 0; activity('scroll', now) }
    if (!running()) return
    // Boundary clipping discards the whole unfinished tail, never a partial score.
    if (el.scrollTop <= 0 || el.scrollTop >= el.scrollHeight - el.clientHeight - 1) { scrolls.delete(el); return }
    if (now - s.lastChange > limits.scrollGapMs && s.bins.length) {
      if (s.bins.length === limits.scrollMaxBins) score(evaluateScroll(s.bins, s.stage), now)
      s.bins = []
    }
    if (!s.bins.length) { s.start = now; s.stage = stage() }
    const index = Math.floor((now - s.start) / limits.scrollBinMs)
    if (index >= limits.scrollMaxBins) {
      // Close only full windows whose final bin changed. Trailing zeros are not scored.
      if (s.bins.length === limits.scrollMaxBins) score(evaluateScroll(s.bins, s.stage), now)
      s.bins = []; s.start = now; s.stage = stage()
    }
    const nextIndex = Math.floor((now - s.start) / limits.scrollBinMs)
    while (s.bins.length <= nextIndex) s.bins.push(0)
    s.bins[nextIndex] += delta
    s.lastChange = now
  })
  const pulse = (now: number) => {
    if (!running()) return
    if (pointer.length && (now - pointer.at(-1)!.t > limits.pointerGapMs || now - pointer[0].t >= limits.pointerWindowMs)) closePointer(now)
    if (typing.length && now - typing.at(-1)! > limits.typingGapMs) typing = []
    for (const [el, s] of scrolls) if (now - s.lastChange > limits.scrollGapMs) {
      if (s.bins.length === limits.scrollMaxBins) score(evaluateScroll(s.bins, s.stage), now)
      scrolls.delete(el)
    }
  }
  return { reset, pulse, dispose: () => { listeners.forEach(remove => remove()); reset() } }
}
