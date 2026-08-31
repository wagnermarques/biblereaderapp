import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService } from '../services/storage-service.js'
import { navigateToChapter } from '../router.js'

export class ChapterGridView extends LitElement {
  static properties = {
    bookId: { attribute: 'book-id' },
    _bookMeta: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 4px;
    }
    .progress {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0 0 16px;
      font-size: 0.9rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
      gap: 8px;
    }
    button.chapter {
      aspect-ratio: 1;
      border-radius: 8px;
      border: 1px solid var(--md-sys-color-outline);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      font-size: 0.95rem;
      cursor: pointer;
    }
    button.chapter:hover {
      background: var(--md-sys-color-surface-variant);
    }
    button.chapter[data-read] {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-color: transparent;
    }
  `

  updated(changed) {
    if (changed.has('bookId')) this._load()
  }

  async _load() {
    const index = await bibleDataService.getIndex()
    this._bookMeta = index.find((b) => b.id === this.bookId) ?? null
  }

  render() {
    if (!this._bookMeta) {
      return html`<md-circular-progress indeterminate></md-circular-progress>`
    }
    const chapters = Array.from({ length: this._bookMeta.chapters }, (_, i) => i + 1)
    const versesPerChapter = this._bookMeta.versesPerChapter ?? []

    // A chapter counts as read once every one of its verses has been marked
    // (auto or manually) — build chapter -> Set(read verse numbers) once,
    // rather than re-scanning localStorage per chapter.
    const readByChapter = new Map()
    for (const v of storageService.getReadVerses()) {
      if (v.book !== this.bookId) continue
      if (!readByChapter.has(v.chapter)) readByChapter.set(v.chapter, new Set())
      readByChapter.get(v.chapter).add(v.verse)
    }
    const isChapterFullyRead = (c) => {
      const total = versesPerChapter[c - 1]
      return !!total && (readByChapter.get(c)?.size ?? 0) >= total
    }

    const readCount = chapters.filter((c) => isChapterFullyRead(c)).length
    return html`
      <h1>${this._bookMeta.name}</h1>
      <p class="progress">${readCount}/${chapters.length} capítulos lidos</p>
      <div class="grid">
        ${chapters.map(
          (c) => html`
            <button
              class="chapter"
              ?data-read=${isChapterFullyRead(c)}
              @click=${() => navigateToChapter(this.bookId, c)}
            >
              ${c}
            </button>
          `
        )}
      </div>
    `
  }
}

customElements.define('chapter-grid-view', ChapterGridView)
