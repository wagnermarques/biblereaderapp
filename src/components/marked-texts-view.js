import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService, markGroupId, markTranslationId } from '../services/storage-service.js'
import { translation } from '../translations.js'
import { markColor } from '../mark-colors.js'
import { navigateToChapter } from '../router.js'

/**
 * Every excerpt the reader has highlighted, in bible order rather than by date:
 * highlights are looked up by where they are, and grouping them under their
 * book and chapter is how the reader already thinks about them.
 */
export class MarkedTextsView extends LitElement {
  static properties = {
    _books: { state: true },
    _marks: { state: true },
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
      margin: 0 0 16px;
    }
    h2 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--md-sys-color-on-surface-variant);
      margin: 24px 0 8px;
    }
    .mark {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 12px;
      border-left: 4px solid transparent;
      border-radius: 4px;
      cursor: pointer;
    }
    .mark:hover {
      background: var(--md-sys-color-surface-variant);
    }
    .body {
      flex: 1;
      min-width: 0;
    }
    .excerpt {
      margin: 0;
      line-height: 1.5;
    }
    .ref {
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    h2 .translation {
      text-transform: none;
      letter-spacing: normal;
      padding: 2px 8px;
      margin-left: 4px;
      border-radius: 10px;
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
    }
    .empty {
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.6;
    }
  `

  constructor() {
    super()
    this._books = null
    this._marks = storageService.getMarkedTexts()
  }

  connectedCallback() {
    super.connectedCallback()
    bibleDataService.getIndex().then((index) => {
      this._books = index
    })
  }

  /** Marks grouped by chapter, both books and chapters in bible order. */
  _groups() {
    // Books missing from the index (data from an older build, say) still have
    // to appear, so they fall back to their raw id and sort to the end.
    const order = new Map(this._books.map((b, i) => [b.id, i]))
    const names = new Map(this._books.map((b) => [b.id, b.name]))
    const groups = new Map()
    for (const mark of this._marks) {
      const translationId = markTranslationId(mark)
      const key = `${translationId}:${mark.book}:${mark.chapter}`
      let group = groups.get(key)
      if (!group) {
        group = {
          key,
          order: order.get(mark.book) ?? Number.MAX_SAFE_INTEGER,
          title: `${names.get(mark.book) ?? mark.book} ${mark.chapter}`,
          // Which Bible the excerpt was read in — the wording, and the offsets
          // behind the highlight, belong to that translation alone.
          translationName: translation(translationId).name,
          chapter: mark.chapter,
          highlights: new Map(),
        }
        groups.set(key, group)
      }
      // A highlight dragged across verses is stored as one record per verse;
      // the reader made one highlight, so the list shows it as one entry.
      const id = markGroupId(mark)
      const highlight = group.highlights.get(id)
      if (highlight) highlight.pieces.push(mark)
      else group.highlights.set(id, { id, pieces: [mark] })
    }
    for (const group of groups.values()) {
      group.highlights = [...group.highlights.values()]
      for (const highlight of group.highlights) {
        highlight.pieces.sort((a, b) => a.verse - b.verse || a.startOffset - b.startOffset)
        const first = highlight.pieces[0]
        const last = highlight.pieces[highlight.pieces.length - 1]
        highlight.color = first.color
        highlight.book = first.book
        highlight.chapter = first.chapter
        highlight.verse = first.verse
        highlight.text = highlight.pieces.map((m) => m.text).join(' ')
        highlight.ref =
          first.verse === last.verse
            ? `Versículo ${first.verse}`
            : `Versículos ${first.verse}-${last.verse}`
      }
      group.highlights.sort(
        (a, b) => a.verse - b.verse || a.pieces[0].startOffset - b.pieces[0].startOffset
      )
    }
    return [...groups.values()].sort(
      (a, b) =>
        a.order - b.order ||
        a.chapter - b.chapter ||
        a.translationName.localeCompare(b.translationName)
    )
  }

  _open(highlight) {
    navigateToChapter(highlight.book, highlight.chapter, highlight.verse)
  }

  _remove(event, highlight) {
    event.stopPropagation()
    storageService.removeMarkedGroup(highlight.id)
    this._marks = storageService.getMarkedTexts()
  }

  render() {
    if (!this._books) {
      return html`<md-circular-progress indeterminate></md-circular-progress>`
    }
    return html`
      <h1>Meus destaques</h1>
      ${this._marks.length === 0
        ? html`<p class="empty">
            Você ainda não destacou nenhum trecho. Enquanto lê um capítulo, selecione um trecho do
            versículo e escolha uma cor na barra que aparece na parte de baixo da tela.
          </p>`
        : this._groups().map(
            (group) => html`
              <h2>${group.title} <span class="translation">${group.translationName}</span></h2>
              ${group.highlights.map(
                (highlight) => html`
                  <div
                    class="mark"
                    role="button"
                    tabindex="0"
                    title="Abrir no capítulo"
                    style="border-left-color:${markColor(highlight.color).background}"
                    @click=${() => this._open(highlight)}
                    @keydown=${(e) => (e.key === 'Enter' ? this._open(highlight) : null)}
                  >
                    <div class="body">
                      <p class="excerpt">“${highlight.text}”</p>
                      <span class="ref">${highlight.ref}</span>
                    </div>
                    <md-icon-button
                      aria-label="Remover destaque"
                      @click=${(e) => this._remove(e, highlight)}
                    >
                      <md-icon>delete</md-icon>
                    </md-icon-button>
                  </div>
                `
              )}
            `
          )}
    `
  }
}

customElements.define('marked-texts-view', MarkedTextsView)
