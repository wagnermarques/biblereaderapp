import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService } from '../services/storage-service.js'
import { syncService } from '../services/sync-service.js'
import { navigateToChapter } from '../router.js'
import { MARK_COLORS, MARK_TEXT_COLOR, markColor } from '../mark-colors.js'

// How long a verse must stay mostly on screen before it auto-marks as read —
// avoids marking every verse read from a quick scroll-past.
const AUTO_READ_DWELL_MS = 1200
// Fraction of a verse's height that must be visible to count as "being read".
const AUTO_READ_VISIBLE_RATIO = 0.6
// How long the selection must hold still before the bar reacts. The bar covers
// nothing the reader is looking at, so this only damps the churn of dragging a
// handle across a phrase; it is not a wait for the selection to be final.
const SELECTION_TRACK_MS = 120
// Space left between the bottom of the selection and the top of the bar when
// scrolling a selection out from behind it.
const REVEAL_GAP = 8

/** Nearest scrollable ancestor, crossing shadow boundaries. */
function scrollParent(el) {
  let node = el.parentNode ?? el.host
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const overflow = getComputedStyle(node).overflowY
      if (/(auto|scroll)/.test(overflow) && node.scrollHeight > node.clientHeight) return node
    }
    node = node.parentNode ?? node.host
  }
  return null
}

/** Character offset of (node, offset) counted from the start of `root`'s text. */
function offsetWithin(root, node, offset) {
  const range = document.createRange()
  range.selectNodeContents(root)
  try {
    range.setEnd(node, offset)
  } catch {
    return null
  }
  return range.toString().length
}

/** Nearest enclosing verse-text span, or null if the node sits outside one. */
function closestVerseText(node) {
  let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && !el.classList?.contains('verse-text')) el = el.parentElement
  return el
}

/**
 * Splits a verse into alternating plain/marked runs. Marks are applied in
 * start order and clipped to what's still unconsumed, so overlapping or stale
 * offsets degrade into a shorter highlight instead of corrupting the text.
 */
function segmentVerse(text, marks) {
  const segments = []
  let cursor = 0
  for (const mark of [...marks].sort((a, b) => a.startOffset - b.startOffset)) {
    const start = Math.max(mark.startOffset, cursor)
    const end = Math.min(mark.endOffset, text.length)
    if (end <= start) continue
    if (start > cursor) segments.push({ text: text.slice(cursor, start), mark: null })
    segments.push({ text: text.slice(start, end), mark })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), mark: null })
  return segments
}

export class ChapterView extends LitElement {
  static properties = {
    bookId: { attribute: 'book-id' },
    chapter: { type: Number },
    fontScale: { type: Number, attribute: 'font-scale' },
    _bookMeta: { state: true },
    _verses: { state: true },
    _error: { state: true },
    _sel: { state: true },
    _editing: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    :host([data-bar-open]) {
      padding-bottom: 128px;
    }
    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0;
    }
    h1 .book-link {
      color: inherit;
      text-decoration: none;
    }
    h1 .book-link:hover {
      text-decoration: underline;
    }
    .verse {
      margin: 0 0 0.6em;
      line-height: 1.6;
      font-size: calc(1rem * var(--font-scale, 1));
      cursor: pointer;
      border-radius: 4px;
      padding: 2px 4px;
    }
    .verse:hover {
      background: var(--md-sys-color-surface-variant);
    }
    .verse[data-bookmarked] {
      background: var(--md-sys-color-primary-container);
    }
    .verse[data-read] {
      opacity: 0.7;
    }
    .verse-num {
      font-weight: 600;
      color: var(--md-sys-color-primary);
      margin-right: 6px;
      font-size: 0.75em;
      vertical-align: super;
      cursor: pointer;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .verse-num:hover {
      background: var(--md-sys-color-secondary);
      color: var(--md-sys-color-on-secondary);
    }
    mark {
      border-radius: 3px;
      padding: 1px 0;
    }
    .mark-bar {
      position: fixed;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      z-index: 5;
      box-sizing: border-box;
      width: min(100%, 720px);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      border-top: 1px solid var(--md-sys-color-outline);
      box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.18);
    }
    .colors {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: 12px;
    }
    .swatch {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
    }
    .swatch[data-selected] {
      border-color: var(--md-sys-color-primary);
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: 2px;
    }
    nav.chapter-nav {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
    }
  `

  constructor() {
    super()
    this.fontScale = 1
    this._sel = null
    this._editing = null
    // Android hands a long-press to its own selection UI and dispatches
    // touchcancel rather than touchend, so a touch-event trigger never fires
    // for the very gesture that selects text. selectionchange is the signal
    // the browser actually emits, whatever the input method.
    this._onSelectionChange = () => {
      clearTimeout(this._selectionTimer)
      this._selectionTimer = setTimeout(() => this._trackSelection(), SELECTION_TRACK_MS)
    }
    // Editing an existing mark has no selection to collapse, so a tap anywhere
    // outside the bar is what dismisses it.
    this._onDocumentPointerDown = (event) => {
      if (!this._editing) return
      const bar = this.renderRoot.querySelector('.mark-bar')
      if (bar && event.composedPath().includes(bar)) return
      this._editing = null
    }
  }

  connectedCallback() {
    super.connectedCallback()
    document.addEventListener('selectionchange', this._onSelectionChange)
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true)
  }

  updated(changed) {
    if (changed.has('bookId') || changed.has('chapter')) {
      this._load()
    }
    if (changed.has('fontScale')) {
      this.style.setProperty('--font-scale', String(this.fontScale))
    }
    this.toggleAttribute('data-bar-open', this._barOpen)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._teardownReadObserver()
    document.removeEventListener('selectionchange', this._onSelectionChange)
    document.removeEventListener('pointerdown', this._onDocumentPointerDown, true)
    clearTimeout(this._selectionTimer)
  }

  async _load() {
    this._error = null
    this._sel = null
    this._editing = null
    this._teardownReadObserver()
    try {
      const index = await bibleDataService.getIndex()
      this._bookMeta = index.find((b) => b.id === this.bookId) ?? null
      this._verses = await bibleDataService.getChapter(this.bookId, this.chapter)
      storageService.setLastRead(this.bookId, this.chapter)
      this.scrollTop = 0
      await this.updateComplete
      this._setupReadObserver()
    } catch (err) {
      this._error = err.message
      this._verses = null
    }
  }

  /** Watches every verse and auto-marks it read once it's been mostly visible for a moment. */
  _setupReadObserver() {
    const verseEls = this.renderRoot.querySelectorAll('.verse[data-verse]')
    if (!verseEls.length) return
    this._pendingReadTimers = new Map()
    this._readObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const verseNum = Number(entry.target.dataset.verse)
          if (entry.isIntersecting) {
            if (!this._pendingReadTimers.has(verseNum)) {
              const timer = setTimeout(() => {
                this._pendingReadTimers.delete(verseNum)
                this._markVerseReadAuto(verseNum)
              }, AUTO_READ_DWELL_MS)
              this._pendingReadTimers.set(verseNum, timer)
            }
          } else {
            const timer = this._pendingReadTimers.get(verseNum)
            if (timer) {
              clearTimeout(timer)
              this._pendingReadTimers.delete(verseNum)
            }
          }
        }
      },
      { threshold: AUTO_READ_VISIBLE_RATIO }
    )
    verseEls.forEach((el) => this._readObserver.observe(el))
  }

  _teardownReadObserver() {
    this._readObserver?.disconnect()
    this._readObserver = null
    if (this._pendingReadTimers) {
      for (const timer of this._pendingReadTimers.values()) clearTimeout(timer)
      this._pendingReadTimers.clear()
    }
  }

  _markVerseReadAuto(verseNum) {
    const newlyMarked = storageService.markVerseRead(this.bookId, this.chapter, verseNum)
    if (!newlyMarked) return
    this.requestUpdate()
    syncService.enqueue('readVerse.add', {
      book: this.bookId,
      chapter: this.chapter,
      verse: verseNum,
    })
  }

  _toggleBookmark(verseNum) {
    // A click that ends a text selection isn't a bookmark tap — the selection
    // handler owns that gesture.
    if (this._selection()) return
    const { added } = storageService.toggleBookmark(this.bookId, this.chapter, verseNum)
    this.requestUpdate()
    syncService.enqueue(added ? 'bookmark.add' : 'bookmark.remove', {
      book: this.bookId,
      chapter: this.chapter,
      verse: verseNum,
    })
  }

  _toggleVerseRead(event, verseNum) {
    event.stopPropagation()
    const { added } = storageService.toggleReadVerse(this.bookId, this.chapter, verseNum)
    this.requestUpdate()
    syncService.enqueue(added ? 'readVerse.add' : 'readVerse.remove', {
      book: this.bookId,
      chapter: this.chapter,
      verse: verseNum,
    })
  }

  /**
   * The live selection as a verse-relative range, or null when there's nothing
   * usable: collapsed, outside the verse text, or spanning two verses (offsets
   * are stored per verse, so cross-verse selections have nowhere to live).
   */
  _selection() {
    const sel = this.renderRoot.getSelection?.() ?? document.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const el = closestVerseText(range.startContainer)
    if (!el || el !== closestVerseText(range.endContainer)) return null

    let start = offsetWithin(el, range.startContainer, range.startOffset)
    let end = offsetWithin(el, range.endContainer, range.endOffset)
    if (start === null || end === null) return null
    if (start > end) [start, end] = [end, start]

    // Selection handles routinely overshoot onto the surrounding spaces.
    const full = el.textContent
    while (start < end && /\s/.test(full[start])) start++
    while (end > start && /\s/.test(full[end - 1])) end--
    if (end <= start) return null

    return {
      verse: Number(el.dataset.verseText),
      startOffset: start,
      endOffset: end,
      text: full.slice(start, end),
    }
  }

  get _barOpen() {
    return !!(this._sel || this._editing)
  }

  /**
   * Follows the live selection instead of waiting for a final one. The bar can
   * appear while the reader is still dragging a handle, because the mark is cut
   * from whatever is selected at the moment a color is tapped, not from what was
   * selected when the bar appeared.
   */
  _trackSelection() {
    const selection = this._selection()
    if (selection) {
      const wasOpen = this._barOpen
      this._editing = null
      this._sel = selection
      if (!wasOpen) this._revealAboveBar(this._selectionRect())
    } else if (this._sel) {
      this._sel = null
    }
  }

  _editMark(event, mark) {
    event.stopPropagation()
    this._sel = null
    this._editing = mark
    this._revealAboveBar(event.currentTarget.getBoundingClientRect())
  }

  /**
   * Keeps the selection alive across the tap: the default action of a pointer
   * press outside the selection is to collapse it, which would leave nothing to
   * mark by the time the click lands.
   */
  _onBarPointerDown(event) {
    event.preventDefault()
  }

  _applyColor(colorId) {
    if (this._editing) {
      storageService.setMarkedTextColor(this._editing.id, colorId)
      this._editing = null
    } else {
      // Re-read rather than trusting what opened the bar, so handles dragged
      // after it appeared still land on the right words.
      const selection = this._selection() ?? this._sel
      if (!selection) return
      storageService.addMarkedText({
        book: this.bookId,
        chapter: this.chapter,
        verse: selection.verse,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        color: colorId,
        text: selection.text,
      })
      this._clearSelection()
      this._sel = null
    }
    this.requestUpdate()
  }

  _removeMark() {
    if (this._editing) storageService.removeMarkedText(this._editing.id)
    this._editing = null
    this.requestUpdate()
  }

  /** Bounding box of the live selection, or null when there isn't one. */
  _selectionRect() {
    const sel = this.renderRoot.getSelection?.() ?? document.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    return sel.getRangeAt(0).getBoundingClientRect()
  }

  /** Scrolls whatever the bar would cover back into view once it's on screen. */
  async _revealAboveBar(rect) {
    if (!rect) return
    await this.updateComplete
    const bar = this.renderRoot.querySelector('.mark-bar')
    if (!bar) return
    const overlap = rect.bottom - bar.getBoundingClientRect().top + REVEAL_GAP
    if (overlap > 0) {
      const target = scrollParent(this) ?? window
      target.scrollBy({ top: overlap, behavior: 'smooth' })
    }
  }

  _clearSelection() {
    const sel = this.renderRoot.getSelection?.() ?? document.getSelection()
    sel?.removeAllRanges()
  }

  _goToChapter(delta) {
    if (!this._bookMeta) return
    const next = this.chapter + delta
    if (next >= 1 && next <= this._bookMeta.chapters) {
      navigateToChapter(this.bookId, next)
    }
  }

  _renderVerseText(text, marks) {
    return segmentVerse(text, marks).map(({ text: run, mark }) => {
      if (!mark) return run
      const color = markColor(mark.color)
      return html`<mark
        style="background:${color.background};color:${MARK_TEXT_COLOR}"
        title="Toque para recolorir ou remover a marcação"
        @click=${(e) => this._editMark(e, mark)}
        >${run}</mark
      >`
    })
  }

  _renderMarkBar() {
    if (!this._barOpen) return ''
    const current = this._editing?.color
    return html`
      <div
        class="mark-bar"
        role="toolbar"
        aria-label=${this._editing ? 'Editar marcação' : 'Marcar texto'}
        @pointerdown=${this._onBarPointerDown}
      >
        <div class="colors">
          ${MARK_COLORS.map(
            (color) => html`
              <button
                type="button"
                class="swatch"
                aria-label=${color.label}
                title=${color.label}
                ?data-selected=${current === color.id}
                style="background:${color.background}"
                @click=${() => this._applyColor(color.id)}
              ></button>
            `
          )}
        </div>
        ${this._editing
          ? html`<md-icon-button aria-label="Remover marcação" @click=${this._removeMark}>
              <md-icon>delete</md-icon>
            </md-icon-button>`
          : ''}
      </div>
    `
  }

  render() {
    if (this._error) {
      return html`<p>Não foi possível carregar este capítulo: ${this._error}</p>`
    }
    if (!this._verses || !this._bookMeta) {
      return html`<md-circular-progress indeterminate></md-circular-progress>`
    }
    return html`
      <header>
        <h1>
          <a class="book-link" href="#/${this.bookId}">${this._bookMeta.name}</a> ${this.chapter}
        </h1>
      </header>
      <div class="verses">
        ${(() => {
          const bookmarkedVerses = new Set(
            storageService
              .getBookmarks()
              .filter((b) => b.book === this.bookId && b.chapter === this.chapter)
              .map((b) => b.verse)
          )
          const readVerses = new Set(
            storageService
              .getReadVerses()
              .filter((v) => v.book === this.bookId && v.chapter === this.chapter)
              .map((v) => v.verse)
          )
          const marksByVerse = new Map()
          for (const mark of storageService.getMarkedTextsForChapter(this.bookId, this.chapter)) {
            const list = marksByVerse.get(mark.verse)
            if (list) list.push(mark)
            else marksByVerse.set(mark.verse, [mark])
          }
          return this._verses.map((text, i) => {
            const verseNum = i + 1
            const bookmarked = bookmarkedVerses.has(verseNum)
            const read = readVerses.has(verseNum)
            return html`
              <p
                class="verse"
                data-verse=${verseNum}
                ?data-bookmarked=${bookmarked}
                ?data-read=${read}
                title="Toque para marcar/desmarcar favorito; selecione um trecho para destacá-lo"
                @click=${() => this._toggleBookmark(verseNum)}
              >
                <span
                  class="verse-num"
                  title="Toque para marcar/desmarcar como lido"
                  @click=${(e) => this._toggleVerseRead(e, verseNum)}
                  >${verseNum}</span
                ><span class="verse-text" data-verse-text=${verseNum}
                  >${this._renderVerseText(text, marksByVerse.get(verseNum) ?? [])}</span
                >
              </p>
            `
          })
        })()}
      </div>
      ${this._renderMarkBar()}
      <nav class="chapter-nav">
        <md-text-button ?disabled=${this.chapter <= 1} @click=${() => this._goToChapter(-1)}>
          ← Capítulo anterior
        </md-text-button>
        <md-text-button
          ?disabled=${this.chapter >= this._bookMeta.chapters}
          @click=${() => this._goToChapter(1)}
        >
          Próximo capítulo →
        </md-text-button>
      </nav>
    `
  }
}

customElements.define('chapter-view', ChapterView)
