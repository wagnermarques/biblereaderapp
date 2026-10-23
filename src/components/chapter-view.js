import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService, markGroupId, getTodayDateString } from '../services/storage-service.js'
import { syncService } from '../services/sync-service.js'
import { navigateToChapter } from '../router.js'
import { MARK_COLORS, MARK_TEXT_COLOR, markColor } from '../mark-colors.js'

const QUICK_CULT_TITLES = [
  'Culto de Domingo',
  'Culto da Família',
  'Culto de Ensino',
  'Culto de Doutrina',
  'Culto de Jovens',
  'Culto de Oração',
  'Estudo Bíblico',
]

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
// How long the verse opened from a highlight stays tinted before fading back.
const VERSE_FLASH_MS = 1600

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

/**
 * The part of `range` that falls inside one verse span, as a verse-relative
 * piece, or null when nothing but whitespace is left. The first and last verse
 * of a drag keep the selection's own boundary; the verses in between are
 * covered end to end.
 */
function clipToVerse(range, el) {
  const clipped = document.createRange()
  clipped.selectNodeContents(el)
  if (clipped.compareBoundaryPoints(Range.START_TO_START, range) < 0) {
    clipped.setStart(range.startContainer, range.startOffset)
  }
  if (clipped.compareBoundaryPoints(Range.END_TO_END, range) > 0) {
    clipped.setEnd(range.endContainer, range.endOffset)
  }
  let start = offsetWithin(el, clipped.startContainer, clipped.startOffset)
  let end = offsetWithin(el, clipped.endContainer, clipped.endOffset)
  if (start === null || end === null) return null
  if (start > end) [start, end] = [end, start]

  // Selection handles routinely overshoot onto the surrounding spaces, and a
  // drag that stops just past a verse boundary leaves the next verse with
  // nothing but whitespace in it.
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
    verse: { type: Number },
    fontScale: { type: Number, attribute: 'font-scale' },
    _bookMeta: { state: true },
    _verses: { state: true },
    _error: { state: true },
    _sel: { state: true },
    _editing: { state: true },
    _verseOptions: { state: true },
    _newTodaySermonPrompt: { state: true },
    _pickSermonDialogOpen: { state: true },
    _cultTitleInput: { state: true },
    _toastMessage: { state: true },
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
    .verse.flash {
      animation: verse-flash 1.6s ease-out;
    }
    @keyframes verse-flash {
      from {
        background: var(--md-sys-color-primary-container);
      }
      to {
        background: transparent;
      }
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
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0;
    }
    .chip {
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      border: 1px solid var(--md-sys-color-outline-variant, #ccc);
      border-radius: 16px;
      padding: 4px 10px;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .chip:hover {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: var(--md-sys-color-inverse-surface, #313033);
      color: var(--md-sys-color-inverse-on-surface, #f4eff4);
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 0.9rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 100;
      animation: fadein 0.2s;
    }
    @keyframes fadein {
      from {
        opacity: 0;
        transform: translate(-50%, 8px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
  `

  constructor() {
    super()
    this.fontScale = 1
    this._sel = null
    this._editing = null
    this._verseOptions = null
    this._newTodaySermonPrompt = false
    this._pickSermonDialogOpen = false
    this._cultTitleInput = ''
    this._pendingVerseForToday = null
    this._toastMessage = null
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
    } else if (changed.has('verse')) {
      // Same chapter, different target — e.g. two highlights in one chapter
      // opened one after the other, which never reloads the verses.
      this._revealVerse()
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
    clearTimeout(this._flashTimer)
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
      this._revealVerse()
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

  _openVerseOptionsDialog({ verseNum, verseEnd = null, text }) {
    this._verseOptions = { verseNum, verseEnd, text }
  }

  _closeVerseOptionsDialog() {
    this._verseOptions = null
  }

  _addCurrentVerseToTodaySermon() {
    if (!this._verseOptions) return
    const todaySermons = storageService.getTodaySermons()
    if (todaySermons.length > 0) {
      const sermon = todaySermons[0]
      storageService.addVerseToSermon(sermon.id, {
        book: this.bookId,
        bookName: this._bookMeta?.name || this.bookId,
        chapter: this.chapter,
        verse: this._verseOptions.verseNum,
        verseEnd: this._verseOptions.verseEnd,
        text: this._verseOptions.text,
      })
      const ref = this._verseOptions.verseEnd
        ? `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}-${this._verseOptions.verseEnd}`
        : `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}`
      this._showToast(`${ref} adicionado à pregação: ${sermon.title}`)
      this._verseOptions = null
    } else {
      this._cultTitleInput = 'Culto de Domingo'
      this._pendingVerseForToday = { ...this._verseOptions }
      this._verseOptions = null
      this._newTodaySermonPrompt = true
    }
  }

  _createTodaySermonWithPendingVerse() {
    if (!this._pendingVerseForToday) return
    const cult = this._cultTitleInput.trim() || 'Culto'
    const sermon = storageService.createSermon({
      cultTitle: cult,
      date: getTodayDateString(),
    })
    storageService.addVerseToSermon(sermon.id, {
      book: this.bookId,
      bookName: this._bookMeta?.name || this.bookId,
      chapter: this.chapter,
      verse: this._pendingVerseForToday.verseNum,
      verseEnd: this._pendingVerseForToday.verseEnd,
      text: this._pendingVerseForToday.text,
    })
    this._newTodaySermonPrompt = false
    this._pendingVerseForToday = null
    this._showToast('Pregação de hoje criada e versículo adicionado!')
  }

  _openPickSermonDialog() {
    this._pickSermonDialogOpen = true
  }

  _addVerseToSpecificSermon(sermon) {
    if (!this._verseOptions) return
    storageService.addVerseToSermon(sermon.id, {
      book: this.bookId,
      bookName: this._bookMeta?.name || this.bookId,
      chapter: this.chapter,
      verse: this._verseOptions.verseNum,
      verseEnd: this._verseOptions.verseEnd,
      text: this._verseOptions.text,
    })
    const ref = this._verseOptions.verseEnd
      ? `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}-${this._verseOptions.verseEnd}`
      : `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}`
    this._showToast(`${ref} adicionado a: ${sermon.title}`)
    this._pickSermonDialogOpen = false
    this._verseOptions = null
  }

  _copyCurrentVerse() {
    if (!this._verseOptions) return
    const ref = this._verseOptions.verseEnd
      ? `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}-${this._verseOptions.verseEnd}`
      : `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}`
    const content = `"${this._verseOptions.text}" (${ref})`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        this._showToast('Versículo copiado!')
      })
    } else {
      this._showToast('Não foi possível copiar.')
    }
    this._verseOptions = null
  }

  _toggleCurrentVerseBookmark() {
    if (!this._verseOptions) return
    const v = this._verseOptions.verseNum
    this._verseOptions = null
    this._toggleBookmark(v)
  }

  _showToast(msg) {
    this._toastMessage = msg
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toastMessage = null
      this.requestUpdate()
    }, 2800)
    this.requestUpdate()
  }

  _addSelectionToSermon() {
    const pieces = this._selection() ?? this._sel
    if (!pieces || !pieces.length) return
    const first = pieces[0].verse
    const last = pieces[pieces.length - 1].verse
    // The sermon links whole verses, and a long press usually selects a single
    // word, so take the full text of every verse the selection touches.
    this._openVerseOptionsDialog({
      verseNum: first,
      verseEnd: first !== last ? last : null,
      text: this._verses.slice(first - 1, last).join(' '),
    })
    this._clearSelection()
    this._sel = null
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
   * The live selection as one entry per verse it touches, or null when there's
   * nothing usable: collapsed, or outside the verse text. Offsets are stored
   * per verse, so a selection dragged across a verse boundary comes back split
   * at the boundaries rather than rejected.
   */
  _selection() {
    const sel = this.renderRoot.getSelection?.() ?? document.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const pieces = []
    for (const el of this.renderRoot.querySelectorAll('.verse-text')) {
      if (!range.intersectsNode(el)) continue
      const piece = clipToVerse(range, el)
      if (piece) pieces.push(piece)
    }
    return pieces.length ? pieces : null
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
      storageService.setMarkedGroupColor(markGroupId(this._editing), colorId)
      this._editing = null
    } else {
      // Re-read rather than trusting what opened the bar, so handles dragged
      // after it appeared still land on the right words.
      const pieces = this._selection() ?? this._sel
      if (!pieces) return
      storageService.addMarkedTexts(
        pieces.map((piece) => ({
          book: this.bookId,
          chapter: this.chapter,
          verse: piece.verse,
          startOffset: piece.startOffset,
          endOffset: piece.endOffset,
          color: colorId,
          text: piece.text,
        }))
      )
      this._clearSelection()
      this._sel = null
    }
    this.requestUpdate()
  }

  _removeMark() {
    if (this._editing) storageService.removeMarkedGroup(markGroupId(this._editing))
    this._editing = null
    this.requestUpdate()
  }

  /**
   * Brings the verse the reader was sent to into view and tints it briefly, so
   * arriving from the highlights list doesn't land at the top of a long chapter
   * with no clue which verse was meant.
   */
  _revealVerse() {
    if (!this.verse) return
    const el = this.renderRoot.querySelector(`.verse[data-verse="${this.verse}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.remove('flash')
    // Re-adding the class in the same frame wouldn't restart the animation.
    requestAnimationFrame(() => el.classList.add('flash'))
    clearTimeout(this._flashTimer)
    this._flashTimer = setTimeout(() => el.classList.remove('flash'), VERSE_FLASH_MS)
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
        ${this._sel
          ? html`<md-icon-button
              aria-label="Adicionar seleção à pregação"
              title="Adicionar à pregação de hoje"
              @click=${this._addSelectionToSermon}
            >
              <md-icon>record_voice_over</md-icon>
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
                title="Toque para favoritar; selecione o texto para marcar ou adicionar à pregação"
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
      ${this._renderVerseOptionsDialog()}
      ${this._renderTodaySermonPromptDialog()}
      ${this._renderPickSermonDialog()}
      ${this._toastMessage ? html`<div class="toast">${this._toastMessage}</div>` : ''}
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

  _renderVerseOptionsDialog() {
    if (!this._verseOptions) return ''
    const todaySermons = storageService.getTodaySermons()
    const ref = this._verseOptions.verseEnd
      ? `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}-${this._verseOptions.verseEnd}`
      : `${this._bookMeta?.name} ${this.chapter}:${this._verseOptions.verseNum}`

    return html`
      <md-dialog open @closed=${this._closeVerseOptionsDialog}>
        <div slot="headline">${ref}</div>
        <div slot="content" style="max-height:65vh;overflow-y:auto;">
          <p style="font-size:0.95rem;font-style:italic;margin:0 0 16px;color:var(--md-sys-color-on-surface-variant);line-height:1.5;">
            “${this._verseOptions.text}”
          </p>
          <md-list style="margin:0 -24px;">
            <md-list-item type="button" @click=${this._addCurrentVerseToTodaySermon}>
              <md-icon slot="start">record_voice_over</md-icon>
              <div slot="headline">Adicionar à pregação de hoje</div>
              <div slot="supporting-text">
                ${todaySermons.length > 0
                  ? `Vincular a: ${todaySermons[0].title}`
                  : 'Criar pregação de hoje e vincular versículo'}
              </div>
            </md-list-item>
            <md-list-item type="button" @click=${this._openPickSermonDialog}>
              <md-icon slot="start">playlist_add</md-icon>
              <div slot="headline">Adicionar a outra pregação...</div>
              <div slot="supporting-text">Escolher pregação da lista</div>
            </md-list-item>
            <md-list-item type="button" @click=${this._copyCurrentVerse}>
              <md-icon slot="start">content_copy</md-icon>
              <div slot="headline">Copiar versículo</div>
              <div slot="supporting-text">Copiar referência e texto</div>
            </md-list-item>
            <md-list-item type="button" @click=${this._toggleCurrentVerseBookmark}>
              <md-icon slot="start">bookmark</md-icon>
              <div slot="headline">Favoritar versículo</div>
            </md-list-item>
          </md-list>
        </div>
        <div slot="actions">
          <md-text-button @click=${this._closeVerseOptionsDialog}>Fechar</md-text-button>
        </div>
      </md-dialog>
    `
  }

  _renderTodaySermonPromptDialog() {
    if (!this._newTodaySermonPrompt) return ''
    return html`
      <md-dialog open @closed=${() => (this._newTodaySermonPrompt = false)}>
        <div slot="headline">Pregação de Hoje</div>
        <form slot="content" id="today-sermon-form" method="dialog" style="display:flex;flex-direction:column;gap:12px;min-width:280px;">
          <p style="margin:0;font-size:0.9rem;color:var(--md-sys-color-on-surface-variant);">
            Ainda não há pregação registrada para hoje. Informe o título do culto:
          </p>
          <md-outlined-text-field
            label="Título do Culto / Mensagem"
            placeholder="Ex: Culto da Família, Culto de Ensino..."
            .value=${this._cultTitleInput}
            @input=${(e) => (this._cultTitleInput = e.target.value)}
          ></md-outlined-text-field>

          <div style="font-size:0.8rem;color:var(--md-sys-color-on-surface-variant);">
            Sugestões rápidas:
          </div>
          <div class="chips-row">
            ${QUICK_CULT_TITLES.map(
              (title) => html`
                <button
                  type="button"
                  class="chip"
                  @click=${() => (this._cultTitleInput = title)}
                >
                  ${title}
                </button>
              `
            )}
          </div>
        </form>
        <div slot="actions">
          <md-text-button @click=${() => (this._newTodaySermonPrompt = false)}>Cancelar</md-text-button>
          <md-filled-button @click=${this._createTodaySermonWithPendingVerse}>Criar e Adicionar</md-filled-button>
        </div>
      </md-dialog>
    `
  }

  _renderPickSermonDialog() {
    if (!this._pickSermonDialogOpen) return ''
    const sermons = storageService.getSermons()
    return html`
      <md-dialog open @closed=${() => (this._pickSermonDialogOpen = false)}>
        <div slot="headline">Selecionar Pregação</div>
        <div slot="content" style="max-height:60vh;overflow-y:auto;">
          ${sermons.length === 0
            ? html`<p style="color:var(--md-sys-color-on-surface-variant)">Nenhuma pregação cadastrada ainda.</p>`
            : html`
                <md-list style="margin:0 -24px;">
                  ${sermons.map(
                    (s) => html`
                      <md-list-item type="button" @click=${() => this._addVerseToSpecificSermon(s)}>
                        <md-icon slot="start">record_voice_over</md-icon>
                        <div slot="headline">${s.title}</div>
                        <div slot="supporting-text">${s.verses?.length || 0} versículos</div>
                      </md-list-item>
                    `
                  )}
                </md-list>
              `}
        </div>
        <div slot="actions">
          <md-text-button @click=${() => (this._pickSermonDialogOpen = false)}>Cancelar</md-text-button>
        </div>
      </md-dialog>
    `
  }
}

customElements.define('chapter-view', ChapterView)
