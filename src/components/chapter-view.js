import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService } from '../services/storage-service.js'
import { authService } from '../services/auth-service.js'
import { syncService } from '../services/sync-service.js'
import { navigateToChapter } from '../router.js'

// How long a verse must stay mostly on screen before it auto-marks as read —
// avoids marking every verse read from a quick scroll-past.
const AUTO_READ_DWELL_MS = 1200
// Fraction of a verse's height that must be visible to count as "being read".
const AUTO_READ_VISIBLE_RATIO = 0.6

export class ChapterView extends LitElement {
  static properties = {
    bookId: { attribute: 'book-id' },
    chapter: { type: Number },
    fontScale: { type: Number, attribute: 'font-scale' },
    _bookMeta: { state: true },
    _verses: { state: true },
    _error: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 24px 64px;
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
    nav.chapter-nav {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
    }
  `

  constructor() {
    super()
    this.fontScale = 1
  }

  updated(changed) {
    if (changed.has('bookId') || changed.has('chapter')) {
      this._load()
    }
    if (changed.has('fontScale')) {
      this.style.setProperty('--font-scale', String(this.fontScale))
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._teardownReadObserver()
  }

  async _load() {
    this._error = null
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
    const userId = authService.getCurrentUser()?.id
    if (userId) syncService.pushVerseReadAdded(userId, this.bookId, this.chapter, verseNum)
  }

  _toggleBookmark(verseNum) {
    const { added } = storageService.toggleBookmark(this.bookId, this.chapter, verseNum)
    this.requestUpdate()

    const userId = authService.getCurrentUser()?.id
    if (userId) {
      if (added) syncService.pushBookmarkAdded(userId, this.bookId, this.chapter, verseNum)
      else syncService.pushBookmarkRemoved(userId, this.bookId, this.chapter, verseNum)
    }
  }

  _toggleVerseRead(event, verseNum) {
    event.stopPropagation()
    const { added } = storageService.toggleReadVerse(this.bookId, this.chapter, verseNum)
    this.requestUpdate()

    const userId = authService.getCurrentUser()?.id
    if (userId) {
      if (added) syncService.pushVerseReadAdded(userId, this.bookId, this.chapter, verseNum)
      else syncService.pushVerseReadRemoved(userId, this.bookId, this.chapter, verseNum)
    }
  }

  _goToChapter(delta) {
    if (!this._bookMeta) return
    const next = this.chapter + delta
    if (next >= 1 && next <= this._bookMeta.chapters) {
      navigateToChapter(this.bookId, next)
    }
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
                title="Toque para marcar/desmarcar favorito"
                @click=${() => this._toggleBookmark(verseNum)}
              >
                <span
                  class="verse-num"
                  title="Toque para marcar/desmarcar como lido"
                  @click=${(e) => this._toggleVerseRead(e, verseNum)}
                  >${verseNum}</span
                >${text}
              </p>
            `
          })
        })()}
      </div>
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
