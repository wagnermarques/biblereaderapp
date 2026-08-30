import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService } from '../services/storage-service.js'
import { navigateToChapter } from '../router.js'

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
    .verse-num {
      font-weight: 600;
      color: var(--md-sys-color-primary);
      margin-right: 6px;
      font-size: 0.75em;
      vertical-align: super;
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

  async _load() {
    this._error = null
    try {
      const index = await bibleDataService.getIndex()
      this._bookMeta = index.find((b) => b.id === this.bookId) ?? null
      this._verses = await bibleDataService.getChapter(this.bookId, this.chapter)
      storageService.setLastRead(this.bookId, this.chapter)
      this.scrollTop = 0
    } catch (err) {
      this._error = err.message
      this._verses = null
    }
  }

  _toggleBookmark(verseNum) {
    storageService.toggleBookmark(this.bookId, this.chapter, verseNum)
    this.requestUpdate()
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
        <h1>${this._bookMeta.name} ${this.chapter}</h1>
      </header>
      <div class="verses">
        ${this._verses.map((text, i) => {
          const verseNum = i + 1
          const bookmarked = storageService.isBookmarked(this.bookId, this.chapter, verseNum)
          return html`
            <p
              class="verse"
              ?data-bookmarked=${bookmarked}
              title="Toque para marcar/desmarcar"
              @click=${() => this._toggleBookmark(verseNum)}
            >
              <span class="verse-num">${verseNum}</span>${text}
            </p>
          `
        })}
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
