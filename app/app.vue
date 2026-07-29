<script setup lang="ts">
import {
  PlayIcon,
} from '@heroicons/vue/24/solid'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/vue/24/outline'

const isPlaying = ref(true)
const isContextOpen = ref(true)
const isRequestingOpen = ref(false)
const isOfferOpen = ref(false)
const isLightboxOpen = ref(false)
const isLightboxClosing = ref(false)
const currentLookbookSlide = ref(0)
const carouselTrack = ref<HTMLElement | null>(null)
const lookbookSlot = ref<HTMLElement | null>(null)
const lookbookSurface = ref<HTMLElement | null>(null)
const lightboxBackdrop = ref<HTMLElement | null>(null)
const previousSlideButton = ref<HTMLButtonElement | null>(null)
const footerOrbitWrap = ref<HTMLElement | null>(null)
const carouselCopies = ref(6)
const lightboxLayoutStyle = ref<Record<string, string>>({})
let animationFrame = 0
let previousTime = 0
let carouselPosition = 0
let carouselCycleWidth = 0
let resizeObserver: ResizeObserver | null = null
let measureFrame = 0
let measureRevision = 0
let lightboxAnimation: Animation | null = null
let lightboxPhase: 'closed' | 'opening' | 'open' | 'closing' = 'closed'
let lightboxRevision = 0
let returnFocus: HTMLElement | null = null
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''
let footerRevealFrame = 0
let footerMotionQuery: MediaQueryList | null = null
const footerOrbitVisibleHeight = 527
let footerRevealDistance = footerOrbitVisibleHeight
let previousFooterProgress = -1
let previousFooterLockupProgress = -1
let isFooterOrbitActive = false

const communityImages = [
  { src: '/images/community-01.png', width: 468, alt: 'Innovative Design members outdoors' },
  { src: '/images/community-02.png', width: 220, alt: 'Community gathering at night' },
  { src: '/images/community-03.png', width: 478, alt: 'Innovative Design group photo' },
  { src: '/images/community-04.png', width: 240, alt: 'Friends at an event' },
  { src: '/images/community-05.png', width: 536, alt: 'Students celebrating together' },
  { src: '/images/community-06.png', width: 264, alt: 'Community portrait' },
  { src: '/images/community-07.png', width: 482, alt: 'Innovative Design event' },
  { src: '/images/community-08.png', width: 404, alt: 'Students at a creative event' },
  { src: '/images/community-09.png', width: 480, alt: 'Innovative Design members' },
  { src: '/images/community-11.png', width: 426, alt: 'Community celebration' },
]

const sponsors = [
  { name: 'Figma', image: '/images/sponsor-figma.png' },
  { name: 'Mobbin', image: '/images/sponsor-mobbin.png' },
  { name: 'Anthropic', image: '/images/sponsor-anthropic.png' },
  { name: 'Notion', image: '/images/notion.png' },
]

const divisions = [
  { name: 'Design', image: '/images/division-design.png' },
  { name: 'UIUX', image: '/images/division-uiux.png' },
  { name: 'Media', image: '/images/division-media.png' },
]

const lookbookSlides = Array.from({ length: 26 }, (_, index) => {
  const number = index + 1
  return {
    src: `/images/lookbook/slide-${String(number).padStart(2, '0')}.png`,
    alt: `Innovative Design client lookbook, slide ${number} of 26`,
  }
})
const preloadedLookbookSlides = new Set<string>()
const displayedLookbookSlide = computed(() => (
  isLightboxOpen.value
    ? lookbookSlides[currentLookbookSlide.value]
    : lookbookSlides[0]
))

async function measureCarousel(revision: number) {
  const track = carouselTrack.value
  const viewport = track?.parentElement
  const initialCycles = track?.querySelectorAll<HTMLElement>('.carousel-cycle')
  const firstCycle = initialCycles?.[0]
  if (!track || !viewport || !firstCycle) return

  const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
  const estimatedCycleWidth = initialCycles?.[1]
    ? initialCycles[1].offsetLeft - firstCycle.offsetLeft
    : firstCycle.offsetWidth + gap
  if (!estimatedCycleWidth) return

  const requiredCopies = Math.max(
    6,
    Math.ceil(viewport.clientWidth / estimatedCycleWidth) + 2,
  )
  if (carouselCopies.value !== requiredCopies) {
    carouselCopies.value = requiredCopies
    await nextTick()
  }

  if (revision !== measureRevision || track !== carouselTrack.value) return

  const renderedCycles = track.querySelectorAll<HTMLElement>('.carousel-cycle')
  const nextCycleWidth = renderedCycles[1]
    ? renderedCycles[1].offsetLeft - renderedCycles[0].offsetLeft
    : renderedCycles[0].offsetWidth + gap
  if (!nextCycleWidth) return

  const cycleProgress = carouselCycleWidth
    ? ((-carouselPosition / carouselCycleWidth) % 1 + 1) % 1
    : 0

  carouselCycleWidth = nextCycleWidth
  carouselPosition = -cycleProgress * carouselCycleWidth
  track.style.transform = `translate3d(${carouselPosition}px, 0, 0)`
}

function scheduleCarouselMeasure() {
  const revision = ++measureRevision
  cancelAnimationFrame(measureFrame)
  measureFrame = requestAnimationFrame(() => {
    void measureCarousel(revision)
  })
}

function animateCarousel(time: number) {
  if (!previousTime) previousTime = time
  const delta = Math.min(time - previousTime, 32)
  previousTime = time

  if (isPlaying.value && carouselTrack.value && carouselCycleWidth) {
    carouselPosition -= delta * 0.04
    carouselPosition = -(((-carouselPosition % carouselCycleWidth) + carouselCycleWidth) % carouselCycleWidth)
    carouselTrack.value.style.transform = `translate3d(${carouselPosition}px, 0, 0)`
  }

  animationFrame = requestAnimationFrame(animateCarousel)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isPhoneViewport() {
  return Math.min(window.innerWidth, window.innerHeight) <= 600
}

function measureFooterRevealDistance() {
  const footer = document.querySelector<HTMLElement>('.letter-footer')
  const footerSafeSpace = footer
    ? Number.parseFloat(getComputedStyle(footer).marginBottom)
    : footerOrbitVisibleHeight
  footerRevealDistance = Math.max(footerOrbitVisibleHeight, footerSafeSpace)
  scheduleFooterReveal()
}

function updateFooterReveal() {
  footerRevealFrame = 0
  const wrap = footerOrbitWrap.value
  if (!wrap) return

  const scroller = document.scrollingElement ?? document.documentElement
  const viewportHeight = document.documentElement.clientHeight
  const maxScroll = Math.max(0, scroller.scrollHeight - viewportHeight)
  const scrollTop = Math.min(maxScroll, Math.max(0, scroller.scrollTop))
  const distanceToBottom = Math.max(0, maxScroll - scrollTop)
  const continuousProgress = Math.min(1, Math.max(0, 1 - distanceToBottom / footerRevealDistance))
  const progress = footerMotionQuery?.matches
    ? Number(distanceToBottom <= 1)
    : continuousProgress
  const lockupProgress = Math.min(1, Math.max(0, (progress - 0.28) / 0.72))
  const shouldActivate = distanceToBottom <= footerRevealDistance + viewportHeight

  if (shouldActivate !== isFooterOrbitActive) {
    wrap.classList.toggle('footer-orbit-wrap--active', shouldActivate)
    isFooterOrbitActive = shouldActivate
  }

  if (progress !== previousFooterProgress) {
    wrap.style.setProperty('--footer-reveal-progress', progress.toFixed(4))
    previousFooterProgress = progress
  }

  if (lockupProgress !== previousFooterLockupProgress) {
    wrap.style.setProperty('--footer-lockup-progress', lockupProgress.toFixed(4))
    wrap.style.setProperty('--footer-lockup-offset', `${((1 - lockupProgress) * 28).toFixed(1)}px`)
    previousFooterLockupProgress = lockupProgress
  }
}

function scheduleFooterReveal() {
  if (footerRevealFrame) return
  footerRevealFrame = requestAnimationFrame(updateFooterReveal)
}

function getPreviewRect(): DOMRect {
  if (isPhoneViewport()) {
    const isLandscape = window.innerWidth > window.innerHeight
    if (isLandscape) {
      const height = window.innerHeight
      const width = height * (16 / 9)
      return new DOMRect(
        (window.innerWidth - width) / 2,
        0,
        width,
        height,
      )
    }

    const width = window.innerWidth
    const height = width * (9 / 16)
    const packageHeight = height + 56
    return new DOMRect(
      0,
      Math.max(56, (window.innerHeight - packageHeight) / 2),
      width,
      height,
    )
  }

  const maxWidth = window.innerWidth * 0.8
  const maxHeight = Math.max(180, window.innerHeight - 112)
  const width = Math.min(maxWidth, maxHeight * (16 / 9))
  const height = width * (9 / 16)
  const packageHeight = height + 56
  return new DOMRect(
    (window.innerWidth - width) / 2,
    Math.max(16, (window.innerHeight - packageHeight) / 2),
    width,
    height,
  )
}

function syncLightboxLayout(rect = getPreviewRect()) {
  const isLandscapePhone = isPhoneViewport() && window.innerWidth > window.innerHeight
  const controlsLeft = Math.max(0, rect.left)
  const controlsWidth = Math.min(window.innerWidth, rect.width)
  const controlsTop = isLandscapePhone
    ? Math.max(8, window.innerHeight - 64)
    : rect.top + rect.height + 8

  lightboxLayoutStyle.value = {
    '--lookbook-left': `${rect.left}px`,
    '--lookbook-top': `${rect.top}px`,
    '--lookbook-width': `${rect.width}px`,
    '--lookbook-height': `${rect.height}px`,
    '--lookbook-controls-left': `${controlsLeft}px`,
    '--lookbook-controls-top': `${controlsTop}px`,
    '--lookbook-controls-width': `${controlsWidth}px`,
  }
}

function preloadAdjacentSlides(index: number) {
  if (!import.meta.client) return
  const slideCount = lookbookSlides.length
  const adjacentIndexes = [
    (index - 1 + slideCount) % slideCount,
    (index + 1) % slideCount,
  ]

  adjacentIndexes.forEach((adjacentIndex) => {
    const src = lookbookSlides[adjacentIndex]?.src
    if (!src || preloadedLookbookSlides.has(src)) return
    const image = new Image()
    image.src = src
    preloadedLookbookSlides.add(src)
  })
}

function showLookbookSlide(direction: -1 | 1) {
  const slideCount = lookbookSlides.length
  currentLookbookSlide.value = (
    currentLookbookSlide.value + direction + slideCount
  ) % slideCount
  preloadAdjacentSlides(currentLookbookSlide.value)
}

function setSurfaceRect(rect: DOMRect) {
  const surface = lookbookSurface.value
  if (!surface) return

  Object.assign(surface.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
  })
}

function clearSurfaceRect() {
  lookbookSurface.value?.removeAttribute('style')
}

function lockBodyScroll() {
  previousBodyOverflow = document.body.style.overflow
  previousBodyPaddingRight = document.body.style.paddingRight
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  const currentPadding = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0
  document.body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
  }
}

function unlockBodyScroll() {
  document.body.style.overflow = previousBodyOverflow
  document.body.style.paddingRight = previousBodyPaddingRight
}

function animateSurface(from: DOMRect, to: DOMRect, duration: number, revision: number) {
  const surface = lookbookSurface.value
  if (!surface) return Promise.resolve()

  lightboxAnimation?.cancel()
  setSurfaceRect(to)

  if (prefersReducedMotion()) return Promise.resolve()

  const transform = `translate3d(${from.left - to.left}px, ${from.top - to.top}px, 0) scale(${from.width / to.width}, ${from.height / to.height})`
  lightboxAnimation = surface.animate(
    [
      { transform, borderRadius: '4px' },
      { transform: 'translate3d(0, 0, 0) scale(1, 1)', borderRadius: '4px' },
    ],
    {
      duration,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    },
  )

  return lightboxAnimation.finished.catch(() => undefined).then(() => {
    if (revision === lightboxRevision) {
      lightboxAnimation?.cancel()
      lightboxAnimation = null
    }
  })
}

async function openLightbox(trigger?: HTMLElement | null) {
  if (lightboxPhase !== 'closed' || !lookbookSurface.value) return

  const revision = ++lightboxRevision
  lightboxPhase = 'opening'
  returnFocus = trigger ?? lookbookSurface.value
  const sourceRect = lookbookSurface.value.getBoundingClientRect()

  lockBodyScroll()
  isLightboxClosing.value = false
  currentLookbookSlide.value = 0
  syncLightboxLayout()
  preloadAdjacentSlides(0)
  isLightboxOpen.value = true
  await nextTick()
  previousSlideButton.value?.focus({ preventScroll: true })

  await animateSurface(sourceRect, getPreviewRect(), 460, revision)
  if (revision === lightboxRevision) lightboxPhase = 'open'
}

async function closeLightbox() {
  if (lightboxPhase === 'closed' || lightboxPhase === 'closing' || !lookbookSurface.value) return

  const revision = ++lightboxRevision
  const surface = lookbookSurface.value
  const currentRect = surface.getBoundingClientRect()
  const sourceRect = lookbookSlot.value?.getBoundingClientRect()
  const canReturnToSource = Boolean(
    sourceRect
      && sourceRect.width > 0
      && sourceRect.height > 0
      && sourceRect.bottom > 0
      && sourceRect.top < window.innerHeight
      && sourceRect.right > 0
      && sourceRect.left < window.innerWidth,
  )

  lightboxPhase = 'closing'
  isLightboxClosing.value = true
  lightboxAnimation?.cancel()

  if (canReturnToSource && sourceRect) {
    await animateSurface(currentRect, sourceRect, 380, revision)
  } else if (!prefersReducedMotion()) {
    lightboxAnimation = surface.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.98)' }],
      { duration: 180, easing: 'ease-out', fill: 'both' },
    )
    await lightboxAnimation.finished.catch(() => undefined)
  }

  if (revision !== lightboxRevision) return
  lightboxAnimation?.cancel()
  lightboxAnimation = null
  clearSurfaceRect()
  isLightboxOpen.value = false
  isLightboxClosing.value = false
  lightboxPhase = 'closed'
  unlockBodyScroll()
  await nextTick()
  returnFocus?.focus({ preventScroll: true })
}

function handleLookbookClick(event: MouseEvent) {
  if (lightboxPhase === 'closed') void openLightbox(event.currentTarget as HTMLElement)
}

function handleExpandClick(event: MouseEvent) {
  void openLightbox(event.currentTarget as HTMLElement)
}

function handleLookbookKeydown(event: KeyboardEvent) {
  if (lightboxPhase !== 'closed') return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    void openLightbox(event.currentTarget as HTMLElement)
  }
}

function handleLightboxResize() {
  if (lightboxPhase === 'closed' || !lookbookSurface.value) return
  if (lightboxPhase === 'closing') {
    ++lightboxRevision
    lightboxAnimation?.cancel()
    lightboxAnimation = null
    clearSurfaceRect()
    isLightboxOpen.value = false
    isLightboxClosing.value = false
    lightboxPhase = 'closed'
    unlockBodyScroll()
    void nextTick(() => returnFocus?.focus({ preventScroll: true }))
    return
  }
  const currentRect = lookbookSurface.value.getBoundingClientRect()
  const revision = ++lightboxRevision
  lightboxPhase = 'opening'
  const nextRect = getPreviewRect()
  syncLightboxLayout(nextRect)
  void animateSurface(currentRect, nextRect, prefersReducedMotion() ? 0 : 220, revision)
    .then(() => {
      if (revision === lightboxRevision) lightboxPhase = 'open'
    })
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && lightboxPhase !== 'closed') {
    event.preventDefault()
    void closeLightbox()
  } else if (event.key === 'ArrowLeft' && lightboxPhase !== 'closed') {
    event.preventDefault()
    showLookbookSlide(-1)
  } else if (event.key === 'ArrowRight' && lightboxPhase !== 'closed') {
    event.preventDefault()
    showLookbookSlide(1)
  } else if (event.key === 'Tab' && lightboxPhase !== 'closed') {
    const controls = Array.from(
      lightboxBackdrop.value?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    )
    if (!controls.length) return
    const firstControl = controls[0]
    const lastControl = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault()
      lastControl?.focus()
    } else if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault()
      firstControl?.focus()
    }
  }
}

onMounted(() => {
  scheduleCarouselMeasure()
  footerMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  footerMotionQuery.addEventListener('change', scheduleFooterReveal)
  measureFooterRevealDistance()
  preloadAdjacentSlides(0)
  const track = carouselTrack.value
  const viewport = track?.parentElement
  const firstCycle = track?.querySelector<HTMLElement>('.carousel-cycle')
  resizeObserver = new ResizeObserver(scheduleCarouselMeasure)
  if (viewport) resizeObserver.observe(viewport)
  if (firstCycle) resizeObserver.observe(firstCycle)

  const images = Array.from(firstCycle?.querySelectorAll('img') ?? [])
  void Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(scheduleCarouselMeasure)

  animationFrame = requestAnimationFrame(animateCarousel)
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', scheduleFooterReveal, { passive: true })
  window.addEventListener('load', scheduleFooterReveal)
  window.addEventListener('pageshow', scheduleFooterReveal)
  window.addEventListener('resize', handleLightboxResize)
  window.addEventListener('resize', measureFooterRevealDistance)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  cancelAnimationFrame(measureFrame)
  cancelAnimationFrame(footerRevealFrame)
  resizeObserver?.disconnect()
  footerMotionQuery?.removeEventListener('change', scheduleFooterReveal)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', scheduleFooterReveal)
  window.removeEventListener('load', scheduleFooterReveal)
  window.removeEventListener('pageshow', scheduleFooterReveal)
  window.removeEventListener('resize', handleLightboxResize)
  window.removeEventListener('resize', measureFooterRevealDistance)
  lightboxAnimation?.cancel()
  if (lightboxPhase !== 'closed') unlockBodyScroll()
})
</script>

<template>
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="Innovative Design @ USC">
        <img src="/images/innod-logo.svg" alt="" aria-hidden="true" />
        <span>Innovative Design @ USC</span>
      </a>
      <a class="reply-button" href="mailto:alee9193@usc.edu">Reply</a>
    </header>

    <main id="top">
      <article class="letter">
        <header class="letter-heading">
          <div class="letter-heading__title">
            <p class="eyebrow">
              Innovative Design at USC
              <img src="/images/heading-chevron.svg" alt="" aria-hidden="true" />
              Cursor
            </p>
            <h1>Partnership Letter</h1>
            <aside class="author-card">
              <div class="author-card__identity">
                <img src="/images/avatar.png" alt="" />
                <span>by Aaron Lee</span>
              </div>
              <span class="author-card__date">July 19, 2026 at 10:25 pm</span>
              <span class="author-card__sent muted">Sent 2 days ago</span>
            </aside>
          </div>
          <img class="ornament" src="/images/heading-rule.svg" alt="" aria-hidden="true" />
        </header>

        <section class="section intro">
          <h2>Dear Cursor team,</h2>
          <p>
            I'm Aaron Lee, Co-president of Innovative Design at the University of Southern
            California. Hope this letter finds you with a clear context window :)
          </p>

          <aside class="context-card">
            <button
              class="context-card__label"
              type="button"
              :aria-expanded="isContextOpen"
              aria-controls="intro-context-panel"
              @click="isContextOpen = !isContextOpen"
            >
              <span class="context-card__leading" aria-hidden="true">
                <img
                  class="context-card__logo context-card__logo--doordash"
                  src="/images/context-logo-doordash.png"
                  alt=""
                />
                <img
                  class="context-card__logo context-card__logo--fleetline"
                  src="/images/context-logo-fleetline.svg"
                  alt=""
                />
                <img
                  class="context-card__logo context-card__logo--cursor"
                  src="/images/context-logo-cursor.svg"
                  alt=""
                />
              </span>
              <span class="context-card__label-text">Why I love Cursor.</span>
              <img
                class="context-card__trailing-icon"
                src="/images/context-chevron.svg"
                alt=""
                aria-hidden="true"
              />
            </button>
            <div
              id="intro-context-panel"
              class="context-card__body"
              :class="{ 'context-card__body--open': isContextOpen }"
              :aria-hidden="!isContextOpen"
            >
              <div class="context-card__body-clip">
                <div class="context-card__body-inner">
                  <span class="context-card__body-leading" aria-hidden="true">
                    <img
                      class="context-card__logo context-card__logo--doordash"
                      src="/images/context-logo-doordash.png"
                      alt=""
                    />
                    <img
                      class="context-card__logo context-card__logo--fleetline"
                      src="/images/context-logo-fleetline.svg"
                      alt=""
                    />
                    <img
                      class="context-card__logo context-card__logo--cursor"
                      src="/images/context-logo-cursor.svg"
                      alt=""
                    />
                  </span>
                  <p>
                    I'm currently a product design intern at DoorDash by day, and part-time at
                    Fleetline (YC S25) by night. Composer 2.5 Fast, Design mode, and /multi-task has
                    been my lifeline. With Cursor, I prototype 3x faster, directly merge new flows
                    into production as an intern, and pull people into projects with demos instead
                    of asking for permission.
                  </p>
                  <p>
                    I've taught senior designers at DoorDash how to use /multi-task for QA and
                    design friends in YC to use Cursor CLI for more efficient orchestration.
                  </p>
                  <p>
                    I love what Cursor has allowed me and so many other designers to do and I want
                    this tool to be accessible to all creatives through Innovative Design.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section class="section">
          <h3 class="organization-heading">What is Innovative Design @ USC?</h3>
          <p>
            Innovative Design a student-led creative agency comprised of the most ambitious
            creatives and community-builders with a mission to make design education and
            opportunities accessible to all.
          </p>
          <ol class="mission-list">
            <li>We give students the chance to work on client projects to build the portfolios that classes don't offer.</li>
            <li>
              <span>We hold workshops and host events with industry professionals and sponsors like</span>
              <div class="sponsor-list">
                <span v-for="sponsor in sponsors" :key="sponsor.name" class="sponsor-chip">
                  <img :src="sponsor.image" alt="" />
                  {{ sponsor.name }}
                </span>
              </div>
            </li>
            <li>We are a family!</li>
          </ol>
        </section>
      </article>

      <section class="carousel-section" aria-labelledby="community-title">
        <h3 id="community-title">Community builds creatives build community</h3>
        <div class="carousel-viewport">
          <div ref="carouselTrack" class="carousel-track">
            <div
              v-for="copy in carouselCopies"
              :key="copy"
              class="carousel-cycle"
              :aria-hidden="copy > 1"
            >
              <img
                v-for="image in communityImages"
                :key="`${copy}-${image.src}`"
                :src="image.src"
                :alt="copy === 1 ? image.alt : ''"
                :aria-hidden="copy > 1"
                :style="{ width: `${image.width}px` }"
                @load="scheduleCarouselMeasure"
              />
            </div>
          </div>
        </div>
        <button
          class="quiet-control"
          type="button"
          :aria-label="isPlaying ? 'Stop carousel' : 'Play carousel'"
          @click="isPlaying = !isPlaying"
        >
          <img v-if="isPlaying" src="/images/carousel-pause.svg" alt="" aria-hidden="true" />
          <PlayIcon v-else aria-hidden="true" />
          {{ isPlaying ? 'Stop' : 'Play' }}
        </button>
      </section>

      <article class="letter letter--continuation">
        <section class="section divisions">
          <p>
            We bring 3 divisions together to work with startups and small businesses to launch
            their first products, rebrand, build digital presences, and re-imagine user
            experiences.
          </p>
          <div class="division-grid">
            <div v-for="division in divisions" :key="division.name" class="division-card">
              <img :src="division.image" :alt="`${division.name} division`" />
              <span>{{ division.name }}</span>
            </div>
          </div>
        </section>

        <section class="lookbook-section" aria-labelledby="lookbook-title">
          <h3 id="lookbook-title">Snapshot of our past work</h3>
          <div ref="lookbookSlot" class="lookbook-slot">
            <div
              ref="lookbookSurface"
              class="lookbook-placeholder"
              :class="{ 'lookbook-placeholder--active': isLightboxOpen }"
              :role="isLightboxOpen ? undefined : 'button'"
              :aria-label="isLightboxOpen ? undefined : 'Open lookbook preview'"
              :aria-expanded="isLightboxOpen ? undefined : 'false'"
              :tabindex="isLightboxOpen ? -1 : 0"
              @click="handleLookbookClick"
              @keydown="handleLookbookKeydown"
            >
              <Transition name="lookbook-slide" mode="out-in">
                <img
                  :key="displayedLookbookSlide.src"
                  class="lookbook-slide"
                  :src="displayedLookbookSlide.src"
                  :alt="displayedLookbookSlide.alt"
                />
              </Transition>
            </div>
          </div>
          <button
            class="quiet-control"
            type="button"
            @click="handleExpandClick"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 3.125C12.5 2.95924 12.5658 2.80027 12.6831 2.68306C12.8003 2.56585 12.9592 2.5 13.125 2.5H16.875C17.0408 2.5 17.1997 2.56585 17.3169 2.68306C17.4342 2.80027 17.5 2.95924 17.5 3.125V6.875C17.5 7.04076 17.4342 7.19973 17.3169 7.31694C17.1997 7.43415 17.0408 7.5 16.875 7.5C16.7092 7.5 16.5503 7.43415 16.4331 7.31694C16.3158 7.19973 16.25 7.04076 16.25 6.875V4.63333L12.9417 7.94167C12.8844 8.00307 12.8154 8.05232 12.7388 8.08648C12.6621 8.12064 12.5794 8.13901 12.4954 8.14049C12.4115 8.14197 12.3282 8.12654 12.2503 8.0951C12.1725 8.06367 12.1018 8.01688 12.0425 7.95753C11.9831 7.89818 11.9363 7.82749 11.9049 7.74966C11.8735 7.67184 11.858 7.58848 11.8595 7.50456C11.861 7.42065 11.8794 7.33788 11.9135 7.26122C11.9477 7.18455 11.9969 7.11555 12.0583 7.05833L15.3667 3.75H13.125C12.9592 3.75 12.8003 3.68415 12.6831 3.56694C12.5658 3.44973 12.5 3.29076 12.5 3.125ZM2.5 3.125C2.5 2.95924 2.56585 2.80027 2.68306 2.68306C2.80027 2.56585 2.95924 2.5 3.125 2.5H6.875C7.04076 2.5 7.19973 2.56585 7.31694 2.68306C7.43415 2.80027 7.5 2.95924 7.5 3.125C7.5 3.29076 7.43415 3.44973 7.31694 3.56694C7.19973 3.68415 7.04076 3.75 6.875 3.75H4.63333L7.94167 7.05833C8.05207 7.17681 8.11217 7.33352 8.10931 7.49543C8.10646 7.65735 8.04086 7.81184 7.92635 7.92635C7.81184 8.04086 7.65735 8.10646 7.49543 8.10931C7.33352 8.11217 7.17681 8.05207 7.05833 7.94167L3.75 4.63333V6.875C3.75 7.04076 3.68415 7.19973 3.56694 7.31694C3.44973 7.43415 3.29076 7.5 3.125 7.5C2.95924 7.5 2.80027 7.43415 2.68306 7.31694C2.56585 7.19973 2.5 7.04076 2.5 6.875V3.125ZM12.0583 12.9417C11.9969 12.8844 11.9477 12.8154 11.9135 12.7388C11.8794 12.6621 11.861 12.5794 11.8595 12.4954C11.858 12.4115 11.8735 12.3282 11.9049 12.2503C11.9363 12.1725 11.9831 12.1018 12.0425 12.0425C12.1018 11.9831 12.1725 11.9363 12.2503 11.9049C12.3282 11.8735 12.4115 11.858 12.4954 11.8595C12.5794 11.861 12.6621 11.8794 12.7388 11.9135C12.8154 11.9477 12.8844 11.9969 12.9417 12.0583L16.25 15.3667V13.125C16.25 12.9592 16.3158 12.8003 16.4331 12.6831C16.5503 12.5658 16.7092 12.5 16.875 12.5C17.0408 12.5 17.1997 12.5658 17.3169 12.6831C17.4342 12.8003 17.5 12.9592 17.5 13.125V16.875C17.5 17.0408 17.4342 17.1997 17.3169 17.3169C17.1997 17.4342 17.0408 17.5 16.875 17.5H13.125C12.9592 17.5 12.8003 17.4342 12.6831 17.3169C12.5658 17.1997 12.5 17.0408 12.5 16.875C12.5 16.7092 12.5658 16.5503 12.6831 16.4331C12.8003 16.3158 12.9592 16.25 13.125 16.25H15.3667L12.0583 12.9417ZM7.94167 12.0583C8.05871 12.1755 8.12445 12.3344 8.12445 12.5C8.12445 12.6656 8.05871 12.8245 7.94167 12.9417L4.63333 16.25H6.875C7.04076 16.25 7.19973 16.3158 7.31694 16.4331C7.43415 16.5503 7.5 16.7092 7.5 16.875C7.5 17.0408 7.43415 17.1997 7.31694 17.3169C7.19973 17.4342 7.04076 17.5 6.875 17.5H3.125C2.95924 17.5 2.80027 17.4342 2.68306 17.3169C2.56585 17.1997 2.5 17.0408 2.5 16.875V13.125C2.5 12.9592 2.56585 12.8003 2.68306 12.6831C2.80027 12.5658 2.95924 12.5 3.125 12.5C3.29076 12.5 3.44973 12.5658 3.56694 12.6831C3.68415 12.8003 3.75 12.9592 3.75 13.125V15.3667L7.05833 12.0583C7.17552 11.9413 7.33437 11.8755 7.5 11.8755C7.66563 11.8755 7.82448 11.9413 7.94167 12.0583Z" fill="currentColor" />
            </svg>
            Expand
          </button>
        </section>

        <section class="events-section">
          <h3>We run events</h3>
          <div class="event-collage" aria-label="CreateSC event imagery">
            <img class="event-photo event-photo--one" src="/images/event-main.png" alt="CreateSC presentation" />
            <img class="event-photo event-photo--two" src="/images/event-secondary.png" alt="Students at CreateSC" />
            <img class="event-photo event-photo--three" src="/images/event-square.png" alt="CreateSC social post" />
            <img class="event-sticker event-sticker--one" src="/images/notion.png" alt="" />
            <img class="event-sticker event-sticker--two" src="/images/figma.png" alt="" />
            <img class="event-sticker event-sticker--three" src="/images/cursor.png" alt="" />
          </div>
          <div class="stats-card">
            <div class="stats-heading">
              <span>Design-a-thon</span>
              <strong>CreateSC 2025 statistics</strong>
            </div>
            <div class="stats-layout">
              <dl class="stats-primary">
                <div><dt>526</dt><dd>sign ups</dd></div>
                <div><dt>68.3k</dt><dd>Instagram impressions</dd></div>
                <div><dt>7.7k</dt><dd>Linkedin impressions</dd></div>
              </dl>
              <dl class="stats-secondary">
                <div><dt>6</dt><dd>partnerships</dd></div>
                <div><dt>10</dt><dd>sponsors</dd></div>
                <div><dt>40</dt><dd>community partners</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section class="section writing-section">
          <h3>Why I’m writing</h3>
          <p class="writing-section__lead">
            Historically, most students have been locked into Framer, Webflow, and Adobe
            products, but as we're seeing students enter product, motion, and mixed media, I
            intend to bring modern workflows to design teams for client projects and creative
            workshops.
          </p>
          <p class="writing-section__detail">
            Students with ambitious curiosity need rapid tools to grow rapidly, no matter the experience level.
            With its flatter learning curve, Cursor is easily the best fit not only for our UI/UX designers but also
            for students in photography, videography, motion, and graphic design, enabling them to build custom tools.
          </p>
          <p class="writing-section__detail">
            <strong>I want to introduce Cursor as an core tool in our stack</strong> at Innovative Design.
            For designing client case studies and building portfolios, incorporating it into curriculum workshops.
          </p>
        </section>

        <section class="section proposal">
          <h3>Proposal</h3>
          <div class="proposal-card">
            <button
              class="proposal-card__label"
              type="button"
              :aria-expanded="isRequestingOpen"
              aria-controls="proposal-requesting-panel"
              @click="isRequestingOpen = !isRequestingOpen"
            >
              <span class="proposal-card__label-text">We’re requesting for...</span>
              <img
                class="proposal-card__trailing-icon"
                src="/images/context-chevron.svg"
                alt=""
                aria-hidden="true"
              />
            </button>
            <div
              id="proposal-requesting-panel"
              class="proposal-card__body"
              :class="{ 'proposal-card__body--open': isRequestingOpen }"
              :aria-hidden="!isRequestingOpen"
            >
              <div class="proposal-card__body-clip">
                <div class="proposal-card__body-inner">
                  <ol>
                    <li>
                      <strong>60 free Pro edu accounts <span>(and/or financial support)</span></strong>
                      <p>
                        Innovative Design accepts 50-60 members per semester, and we’d love to provide our
                        students with Cursor subscriptions in order to integrate it into our curriculum.
                        One of our core values is running workshops and creative challenges that reflect
                        industry practices and the newest tooling.
                      </p>
                    </li>
                    <li>
                      <strong>Cursor credits and branded merchandise</strong>
                      <p>
                        We run large industry events for 100s of young creatives across our campus and the
                        wider community: with a creative expo <b>Riptide</b> in the fall, and our flagship
                        design-a-thon <b>CreateSC</b> in the spring. Throughout the year, we also hold
                        Community Critique sessions and industry panels in partnership with various clubs
                        on campus.
                      </p>
                      <p>
                        Whether it’s a workshop or sponsored prizes, we’d love to invite Cursor to show up
                        at our events and offer Cursor credits to participating/winning students.
                      </p>
                    </li>
                  </ol>
                  <p class="note">
                    We understand that as of last year Cursor only worked with Cursor ambassadors as their
                    campus initiative but this would be a game-changer.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="proposal-card">
            <button
              class="proposal-card__label"
              type="button"
              :aria-expanded="isOfferOpen"
              aria-controls="proposal-offer-panel"
              @click="isOfferOpen = !isOfferOpen"
            >
              <span class="proposal-card__label-text">What we offer...</span>
              <img
                class="proposal-card__trailing-icon"
                src="/images/context-chevron.svg"
                alt=""
                aria-hidden="true"
              />
            </button>
            <div
              id="proposal-offer-panel"
              class="proposal-card__body"
              :class="{ 'proposal-card__body--open': isOfferOpen }"
              :aria-hidden="!isOfferOpen"
            >
              <div class="proposal-card__body-clip">
                <div class="proposal-card__body-inner">
                  <ol class="compact-offers">
                    <li>
                      <strong>Involvement from creatives in various fields, not just product</strong>
                      <p>
                        Developers and product designers in the product space mostly go to campus events
                        for free credits. Partnering with us opens a different avenue. Cursor could tap into
                        the world of student brand designers, motion designers, artists, photographers, and
                        videographers who may build the future of creative work.
                      </p>
                    </li>
                    <li><strong>Brand visibility via social media</strong></li>
                    <li><strong>Tailored content and product placement</strong></li>
                    <li><strong>Access to student feedback groups</strong></li>
                    <li><strong>Talent opportunities</strong></li>
                    <li><strong>...and more! We're open to discussion</strong></li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="letter-footer">
          <h2>Thank you</h2>
          <p><strong>If this sounds interesting, we would love to discuss further!</strong></p>
          <p>We look forward to partnering with you.</p>
          <p>From,<br />Aaron Lee</p>
          <p>
            Co-president of Innovative Design @ USC<br />
            B.S. in Arts, Technology, and the Business of Innovation<br />
            <a href="mailto:alee9193@usc.edu">alee9193@usc.edu</a>
          </p>
        </footer>
      </article>
    </main>

    <div ref="footerOrbitWrap" class="footer-orbit-wrap">
      <div class="footer-orbit-hemisphere" aria-hidden="true">
        <div class="footer-orbit">
          <img src="/images/footer-orbit.svg" alt="" />
          <span class="footer-orbit__blur footer-orbit__blur--soft" />
          <span class="footer-orbit__blur footer-orbit__blur--medium" />
          <span class="footer-orbit__blur footer-orbit__blur--strong" />
        </div>
      </div>
      <aside
        class="partnership-lockup"
        aria-label="Partnership between Innovative Design at USC and Cursor"
      >
        <span class="partnership-lockup__organization">
          <img
            class="partnership-lockup__innod-logo"
            src="/images/innod-logo.svg"
            alt="Innovative Design at USC logo"
          />
          <span>Innovative Design @ USC</span>
        </span>
        <span class="partnership-lockup__separator" aria-hidden="true">×</span>
        <img
          class="partnership-lockup__cursor-logo"
          src="/images/cursor-lockup-horizontal-dark.svg"
          alt="Cursor"
        />
      </aside>
    </div>

    <div
      v-if="isLightboxOpen"
      ref="lightboxBackdrop"
      class="lightbox"
      :class="{ 'lightbox--closing': isLightboxClosing }"
      :style="lightboxLayoutStyle"
      role="dialog"
      aria-modal="true"
      aria-label="Innovative Design lookbook preview. Click outside or press Escape to close."
      tabindex="-1"
      @click="closeLightbox"
    >
      <p class="lookbook-orientation-notice">
        Turn your phone horizontally
      </p>
      <div class="lookbook-controls" @click.stop>
        <button
          ref="previousSlideButton"
          class="lookbook-arrow"
          type="button"
          aria-label="Previous lookbook slide"
          @click="showLookbookSlide(-1)"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <p class="lookbook-status" aria-live="polite" aria-atomic="true">
          {{ currentLookbookSlide + 1 }} of {{ lookbookSlides.length }}
        </p>
        <button
          class="lookbook-arrow"
          type="button"
          aria-label="Next lookbook slide"
          @click="showLookbookSlide(1)"
        >
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>
