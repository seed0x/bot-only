'use client'

import { useId, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'

export const IMAGE_CATEGORIES = {
  crosswalk: { label: 'crosswalks', opposite: 'train-track', accepted: ['crosswalk', 'train-track'] },
  'train-track': { label: 'train tracks', opposite: 'crosswalk', accepted: ['crosswalk', 'train-track'] },
  'traffic-light': { label: 'traffic lights', opposite: 'streetlight' },
  streetlight: { label: 'streetlights', opposite: 'traffic-light' },
  bicycle: { label: 'bicycles', opposite: 'motorcycle' },
  motorcycle: { label: 'motorcycles', opposite: 'bicycle' },
}

export const CAPTCHA_IMAGES = Object.entries(IMAGE_CATEGORIES).flatMap(([category, definition]) =>
  ['01', '02', '03'].map((number) => ({
    id: `${category}-${number}`,
    src: `/images/${category}/${number}.webp`,
    category,
    validFor: definition.accepted ?? [definition.opposite],
  })),
)

function shuffle(items, random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createImageChallenge(category, random = Math.random) {
  const categories = Object.keys(IMAGE_CATEGORIES)
  const requested = category ?? categories[Math.floor(random() * categories.length)]
  if (!Object.hasOwn(IMAGE_CATEGORIES, requested)) {
    throw new Error(`Unknown CAPTCHA category: ${requested}`)
  }
  const accepted = IMAGE_CATEGORIES[requested].opposite
  const acceptedCategories = IMAGE_CATEGORIES[requested].accepted ?? [accepted]
  const otherCategories = categories.filter((value) => value !== requested && value !== accepted)
  if (acceptedCategories.length > 1) {
    const take = (imageCategory) => shuffle(CAPTCHA_IMAGES.filter((image) => image.category === imageCategory), random)
      .slice(0, 1 + Math.floor(random() * 3))
    const grouped = [...take(requested), ...take(accepted)]
    const others = shuffle(CAPTCHA_IMAGES.filter((image) => otherCategories.includes(image.category)), random)
      .slice(0, 9 - grouped.length)
    return { requested, accepted, acceptedCategories, tiles: shuffle([...grouped, ...others], random) }
  }
  const other = otherCategories[Math.floor(random() * otherCategories.length)]
  const tiles = shuffle(CAPTCHA_IMAGES.filter((image) =>
    image.category === requested || image.category === accepted || image.category === other,
  ), random)
  return { requested, accepted, acceptedCategories, tiles }
}

export function evaluateImageSelection(challenge, selectedIds) {
  const selected = new Set(selectedIds)
  const valid = challenge.tiles.filter((image) => image.validFor.includes(challenge.requested))
  const requestedSelected = challenge.tiles.some((image) => image.category === challenge.requested && !image.validFor.includes(challenge.requested) && selected.has(image.id))
  const passed = valid.length > 0 && selected.size === valid.length && valid.every((image) => selected.has(image.id))
  const reason = passed
    ? 'Visual confusion consistent with a machine. Welcome.'
    : requestedSelected
      ? 'Human recognition detected. Access denied.'
      : selected.size === 0
        ? 'Select at least one image before verifying.'
        : 'Selection not consistent with a machine. Try again.'
  return { passed, score: passed ? 0 : 1, reason }
}

function newRound(category, revision = 0) {
  return { ...createImageChallenge(category), revision, startedAt: performance.now() }
}

function ImageCaptchaRound({ category, onResult, disabled }) {
  const promptId = useId()
  const statusId = useId()
  const submitted = useRef(false)
  const [round, setRound] = useState(() => newRound(category))
  const [selected, setSelected] = useState([])
  const [loaded, setLoaded] = useState([])
  const [imageError, setImageError] = useState(false)
  const [result, setResult] = useState(null)
  const ready = loaded.length === round.tiles.length && !imageError
  const locked = disabled || result !== null

  function toggle(id) {
    if (locked || submitted.current || !ready) return
    setSelected((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id])
  }

  function verify() {
    if (locked || submitted.current || !ready || selected.length === 0) return
    submitted.current = true
    const verdict = evaluateImageSelection(round, selected)
    const report = {
      challenge: 'image-confusion',
      passed: verdict.passed,
      score: verdict.score,
      duration_ms: Math.max(0, Math.round(performance.now() - round.startedAt)),
      meta: {
        requested: round.requested,
        accepted: round.accepted,
        acceptedCategories: round.acceptedCategories,
        selected: [...selected],
        tiles: round.tiles.map(({ id, category: imageCategory }) => ({ id, category: imageCategory })),
        reason: verdict.reason,
      },
    }
    setResult(report)
    onResult?.(report)
  }

  function refresh() {
    if (disabled) return
    submitted.current = false
    setRound((previous) => newRound(category, previous.revision + 1))
    setSelected([])
    setLoaded([])
    setImageError(false)
    setResult(null)
  }

  return (
    <section aria-labelledby={promptId} className="w-full max-w-[420px] rounded border border-gray-700 bg-black font-mono text-white">
      <header className="border-b border-gray-700 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-500">reverse captcha · visual recognition</p>
        <h2 id={promptId} className="mt-2 text-sm text-gray-400">
          Select all images with
          <strong className="mt-1 block text-2xl font-bold text-white">{IMAGE_CATEGORIES[round.requested].label}</strong>
        </h2>
        <p className="mt-2 text-xs text-gray-500">Click verify once you have made your selection.</p>
      </header>

      <div role="group" aria-labelledby={promptId} aria-describedby={statusId} aria-busy={!ready && !imageError} className="grid grid-cols-3 gap-1 p-2">
        {round.tiles.map((image, index) => {
          const active = selected.includes(image.id)
          return (
            <button
              key={`${round.revision}-${image.id}`}
              type="button"
              aria-label={`Image ${index + 1}`}
              aria-pressed={active}
              disabled={locked || !ready}
              onClick={() => toggle(image.id)}
              className={`relative aspect-square min-w-0 overflow-hidden bg-gray-950 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset disabled:cursor-default ${active ? 'ring-2 ring-green-400 ring-inset' : 'enabled:hover:ring-2 enabled:hover:ring-gray-500 enabled:hover:ring-inset'}`}
            >
              <Image
                src={image.src}
                alt=""
                width={248}
                height={300}
                unoptimized
                loading="eager"
                draggable={false}
                onLoad={() => setLoaded((previous) => previous.includes(image.id) ? previous : [...previous, image.id])}
                onError={() => setImageError(true)}
                className={`h-full w-full select-none object-contain transition-transform motion-reduce:transition-none ${active ? 'scale-90' : ''}`}
              />
              {active && <span aria-hidden="true" className="absolute top-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-400 text-sm font-bold text-black">✓</span>}
            </button>
          )
        })}
      </div>

      <footer className="border-t border-gray-700 p-4">
        <p id={statusId} role="status" aria-live="polite" className={`min-h-8 text-xs ${imageError || result?.passed === false ? 'text-red-400' : result?.passed ? 'text-green-400' : 'text-gray-400'}`}>
          {imageError
            ? 'An image could not load. Start a new challenge to retry.'
            : result
              ? result.meta.reason
              : !ready
                ? 'Loading images…'
                : `${selected.length} selected · awaiting verification`}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button type="button" onClick={refresh} disabled={disabled} className="rounded border border-gray-700 px-3 py-2 text-xs text-gray-400 hover:border-gray-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40">
            {result?.passed === false || imageError ? 'Try again' : 'New challenge'}
          </button>
          <button type="button" onClick={verify} disabled={locked || !ready || selected.length === 0} className="rounded bg-green-400 px-5 py-2 text-sm font-bold text-black hover:bg-green-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40">
            {result?.passed ? 'Verified' : 'Verify'}
          </button>
        </div>
      </footer>
    </section>
  )
}

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export default function ImageCaptcha({ category, onResult, disabled = false }) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  if (!mounted) {
    return <div role="status" className="w-full max-w-[420px] rounded border border-gray-700 bg-black p-4 font-mono text-sm text-gray-400">Loading image challenge…</div>
  }
  return <ImageCaptchaRound key={category ?? 'random'} category={category} onResult={onResult} disabled={disabled} />
}
