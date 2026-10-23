import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'
import { storageService, markGroupId, markTranslationId } from '../services/storage-service.js'
import { translation } from '../translations.js'
import { markColor, MARK_TEXT_COLOR } from '../mark-colors.js'
import { navigateToChapter } from '../router.js'

// Filter value for highlights that have no tag yet, kept apart from real tag
// names (which are compared lowercased) so no tag can collide with it.
const UNTAGGED = Symbol('untagged')

/**
 * Every excerpt the reader has highlighted, in bible order rather than by date:
 * highlights are looked up by where they are, and grouping them under their
 * book and chapter is how the reader already thinks about them. Tags cut across
 * that order, so they work either as a filter on top of it or, when the reader
 * switches the grouping, as the sections themselves.
 */
export class MarkedTextsView extends LitElement {
  static properties = {
    _books: { state: true },
    _marks: { state: true },
    _tags: { state: true },
    _filter: { state: true },
    _expanded: { state: true },
    _tagging: { state: true },
    _tagInput: { state: true },
    _grouping: { state: true },
    _collapsed: { state: true },
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
      align-items: flex-start;
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
    .ref-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }
    .ref {
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      font-size: 0.8rem;
      color: var(--md-sys-color-primary);
      cursor: pointer;
    }
    .toggle md-icon {
      font-size: 18px;
      --md-icon-size: 18px;
    }
    .verses {
      margin: 8px 0 0;
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--md-sys-color-surface-container, var(--md-sys-color-surface-variant));
      line-height: 1.6;
      font-size: 0.95rem;
    }
    .verses p {
      margin: 0 0 4px;
    }
    .verses .num {
      font-size: 0.7rem;
      font-weight: 600;
      vertical-align: super;
      margin-right: 4px;
      color: var(--md-sys-color-on-surface-variant);
    }
    .verses mark {
      border-radius: 2px;
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
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .filters {
      margin: 0 0 8px;
    }
    .grouping {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 12px;
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    h2 .section {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    h2 .section md-icon {
      font-size: 20px;
      --md-icon-size: 20px;
    }
    h2 .count {
      opacity: 0.7;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--md-sys-color-surface-variant);
      color: var(--md-sys-color-on-surface-variant);
      border: 1px solid var(--md-sys-color-outline-variant, #ccc);
      border-radius: 16px;
      padding: 4px 10px;
      font: inherit;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
      border-color: transparent;
    }
    .chip .count {
      opacity: 0.7;
    }
    .tag {
      font-size: 0.75rem;
      padding: 1px 8px;
      border-radius: 10px;
      background: var(--md-sys-color-secondary-container);
      color: var(--md-sys-color-on-secondary-container);
    }
    .chip md-icon {
      font-size: 16px;
      --md-icon-size: 16px;
    }
    .dialog-label {
      margin: 16px 0 6px;
      font-size: 0.8rem;
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
    this._tags = storageService.getAllHighlightTags()
    this._filter = null
    this._expanded = new Set()
    this._tagging = null
    this._tagInput = ''
    this._grouping = storageService.getHighlightGrouping()
    // Tag sections the reader folded away, by lowercased tag name.
    this._collapsed = new Set()
    // Full chapter text for expanded highlights, keyed by translation:book:chapter.
    this._chapters = new Map()
  }

  connectedCallback() {
    super.connectedCallback()
    bibleDataService.getIndex().then((index) => {
      this._books = index
    })
  }

  _tagsOf(id) {
    return this._tags[id] ?? []
  }

  _matchesFilter(highlight) {
    if (this._filter === null || this._grouping === 'tag') return true
    const tags = this._tagsOf(highlight.id)
    if (this._filter === UNTAGGED) return tags.length === 0
    return tags.some((t) => t.toLocaleLowerCase() === this._filter)
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
          translationId,
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
        highlight.translationId = group.translationId
        highlight.book = first.book
        highlight.chapter = first.chapter
        highlight.verse = first.verse
        highlight.verseEnd = last.verse
        highlight.text = highlight.pieces.map((m) => m.text).join(' ')
        highlight.ref =
          first.verse === last.verse
            ? `Versículo ${first.verse}`
            : `Versículos ${first.verse}-${last.verse}`
        // Under a tag heading there's no book heading to say where it's from.
        highlight.fullRef = `${group.title}:${
          first.verse === last.verse ? first.verse : `${first.verse}-${last.verse}`
        } · ${group.translationName}`
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

  /**
   * Highlights sectioned by tag, tags alphabetically and highlights in bible
   * order inside each. A highlight with several tags sits under each of them,
   * and the untagged ones close the list.
   */
  _tagSections(groups) {
    const sections = new Map(
      this._tagNames().map((t) => {
        const key = t.toLocaleLowerCase()
        return [key, { key, name: t, highlights: [] }]
      })
    )
    const untagged = { key: '', name: 'Sem tag', highlights: [] }
    for (const group of groups) {
      for (const highlight of group.highlights) {
        const tags = this._tagsOf(highlight.id)
        if (!tags.length) untagged.highlights.push(highlight)
        for (const t of tags) sections.get(t.toLocaleLowerCase())?.highlights.push(highlight)
      }
    }
    return [...sections.values(), untagged].filter((section) => section.highlights.length)
  }

  _setGrouping(grouping) {
    this._grouping = grouping
    storageService.setHighlightGrouping(grouping)
  }

  _toggleSection(key) {
    const collapsed = new Set(this._collapsed)
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
    this._collapsed = collapsed
  }

  _open(highlight) {
    navigateToChapter(highlight.book, highlight.chapter, highlight.verse)
  }

  _remove(event, highlight) {
    event.stopPropagation()
    storageService.removeMarkedGroup(highlight.id)
    this._marks = storageService.getMarkedTexts()
    this._tags = storageService.getAllHighlightTags()
  }

  _chapterKey(highlight) {
    return `${highlight.translationId}:${highlight.book}:${highlight.chapter}`
  }

  _toggleExpanded(event, highlight, expandKey) {
    event.stopPropagation()
    const expanded = new Set(this._expanded)
    if (expanded.has(expandKey)) {
      expanded.delete(expandKey)
    } else {
      expanded.add(expandKey)
      const key = this._chapterKey(highlight)
      if (!this._chapters.has(key)) {
        // Read in the highlight's own translation, so the offsets line up with
        // the wording they were cut from.
        bibleDataService
          .getChapter(highlight.book, highlight.chapter, highlight.translationId)
          .then((verses) => {
            this._chapters.set(key, verses)
            this.requestUpdate()
          })
          .catch(() => {})
      }
    }
    this._expanded = expanded
  }

  _renderVerses(highlight) {
    const verses = this._chapters.get(this._chapterKey(highlight))
    if (!verses) return html`<div class="verses">Carregando…</div>`
    const background = markColor(highlight.color).background
    const rows = []
    for (let v = highlight.verse; v <= highlight.verseEnd; v++) {
      const text = verses[v - 1] ?? ''
      const piece = highlight.pieces.find((p) => p.verse === v)
      rows.push(html`<p>
        <span class="num">${v}</span>${piece
          ? html`${text.slice(0, piece.startOffset)}<mark
                style="background:${background};color:${MARK_TEXT_COLOR}"
                >${text.slice(piece.startOffset, piece.endOffset)}</mark
              >${text.slice(piece.endOffset)}`
          : text}
      </p>`)
    }
    return html`<div class="verses" @click=${(e) => e.stopPropagation()}>${rows}</div>`
  }

  _openTagEditor(event, highlight) {
    event.stopPropagation()
    this._tagInput = ''
    this._tagging = highlight.id
  }

  _closeTagEditor() {
    this._tagging = null
  }

  _setTags(tags) {
    storageService.setHighlightTags(this._tagging, tags)
    this._tags = storageService.getAllHighlightTags()
    // A filter on a tag nobody uses any more would leave an empty list with no
    // chip left to switch it off.
    const stillUsed = this._tagNames().some((t) => t.toLocaleLowerCase() === this._filter)
    if (typeof this._filter === 'string' && !stillUsed) this._filter = null
  }

  _addTag(name) {
    if (!name.trim()) return
    this._setTags([...this._tagsOf(this._tagging), name])
    this._tagInput = ''
  }

  _removeTag(name) {
    this._setTags(this._tagsOf(this._tagging).filter((t) => t !== name))
  }

  /** Tags still attached to an existing highlight, alphabetically. */
  _tagNames() {
    const live = new Set(this._marks.map(markGroupId))
    const names = new Map()
    for (const [id, tags] of Object.entries(this._tags)) {
      if (!live.has(id)) continue
      for (const t of tags) {
        if (!names.has(t.toLocaleLowerCase())) names.set(t.toLocaleLowerCase(), t)
      }
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  _renderFilters(highlights) {
    const names = this._tagNames()
    if (!names.length) return ''
    const count = (name) =>
      highlights.filter((h) =>
        this._tagsOf(h.id).some((t) => t.toLocaleLowerCase() === name.toLocaleLowerCase())
      ).length
    const untagged = highlights.filter((h) => this._tagsOf(h.id).length === 0).length
    const chip = (label, value, n) => html`
      <button
        type="button"
        class="chip"
        aria-pressed=${this._filter === value ? 'true' : 'false'}
        @click=${() => (this._filter = this._filter === value ? null : value)}
      >
        ${label}${n === undefined ? '' : html` <span class="count">${n}</span>`}
      </button>
    `
    return html`
      <div class="chips filters" role="group" aria-label="Filtrar por tag">
        ${chip('Todos', null)}
        ${names.map((name) => chip(name, name.toLocaleLowerCase(), count(name)))}
        ${untagged ? chip('Sem tag', UNTAGGED, untagged) : ''}
      </div>
    `
  }

  _renderTagDialog() {
    if (!this._tagging) return ''
    const current = this._tagsOf(this._tagging)
    const taken = new Set(current.map((t) => t.toLocaleLowerCase()))
    const suggestions = this._tagNames().filter((t) => !taken.has(t.toLocaleLowerCase()))
    return html`
      <md-dialog open @closed=${this._closeTagEditor}>
        <div slot="headline">Tags do destaque</div>
        <div slot="content" style="min-width:260px;">
          ${current.length
            ? html`<div class="chips">
                ${current.map(
                  (t) => html`
                    <button
                      type="button"
                      class="chip"
                      aria-pressed="true"
                      aria-label="Remover tag ${t}"
                      @click=${() => this._removeTag(t)}
                    >
                      ${t}<md-icon>close</md-icon>
                    </button>
                  `
                )}
              </div>`
            : html`<p class="empty" style="margin:0;">Este destaque ainda não tem tags.</p>`}
          <md-outlined-text-field
            style="width:100%;margin-top:16px;"
            label="Nova tag"
            placeholder="Ex: Fé, Promessas, Oração..."
            .value=${this._tagInput}
            @input=${(e) => (this._tagInput = e.target.value)}
            @keydown=${(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                this._addTag(this._tagInput)
              }
            }}
          ></md-outlined-text-field>
          ${suggestions.length
            ? html`
                <p class="dialog-label">Tags existentes</p>
                <div class="chips">
                  ${suggestions.map(
                    (t) => html`
                      <button type="button" class="chip" @click=${() => this._addTag(t)}>
                        <md-icon>add</md-icon>${t}
                      </button>
                    `
                  )}
                </div>
              `
            : ''}
        </div>
        <div slot="actions">
          <md-text-button ?disabled=${!this._tagInput.trim()} @click=${() => this._addTag(this._tagInput)}>
            Adicionar
          </md-text-button>
          <md-filled-button @click=${this._closeTagEditor}>Concluir</md-filled-button>
        </div>
      </md-dialog>
    `
  }

  /**
   * `section` is the tag heading the highlight is listed under, if any: the
   * same highlight can appear under several, and each copy expands on its own.
   */
  _renderHighlight(highlight, section = null) {
    const expandKey = section === null ? highlight.id : `${section}:${highlight.id}`
    const expanded = this._expanded.has(expandKey)
    return html`
      <div
        class="mark"
        role="button"
        tabindex="0"
        title="Abrir no capítulo"
        style="border-left-color:${markColor(highlight.color).background}"
        @click=${() => this._open(highlight)}
        @keydown=${(e) => (e.key === 'Enter' && e.target === e.currentTarget ? this._open(highlight) : null)}
      >
        <div class="body">
          <p class="excerpt">“${highlight.text}”</p>
          <div class="ref-row">
            <span class="ref">${section === null ? highlight.ref : highlight.fullRef}</span>
            <button
              type="button"
              class="toggle"
              aria-expanded=${expanded ? 'true' : 'false'}
              @click=${(e) => this._toggleExpanded(e, highlight, expandKey)}
            >
              <md-icon>${expanded ? 'expand_less' : 'expand_more'}</md-icon>
              ${expanded ? 'Ocultar versículo' : 'Ver versículo'}
            </button>
            ${this._tagsOf(highlight.id).map((t) => html`<span class="tag">${t}</span>`)}
          </div>
          ${expanded ? this._renderVerses(highlight) : ''}
        </div>
        <md-icon-button
          aria-label="Editar tags"
          title="Editar tags"
          @click=${(e) => this._openTagEditor(e, highlight)}
        >
          <md-icon>sell</md-icon>
        </md-icon-button>
        <md-icon-button aria-label="Remover destaque" @click=${(e) => this._remove(e, highlight)}>
          <md-icon>delete</md-icon>
        </md-icon-button>
      </div>
    `
  }

  render() {
    if (!this._books) {
      return html`<md-circular-progress indeterminate></md-circular-progress>`
    }
    if (this._marks.length === 0) {
      return html`
        <h1>Meus destaques</h1>
        <p class="empty">
          Você ainda não destacou nenhum trecho. Enquanto lê um capítulo, selecione um trecho do
          versículo e escolha uma cor na barra que aparece na parte de baixo da tela.
        </p>
      `
    }
    const groups = this._groups()
    return html`
      <h1>Meus destaques</h1>
      ${this._renderGroupingToggle()}
      ${this._grouping === 'tag' ? this._renderByTag(groups) : this._renderByBook(groups)}
      ${this._renderTagDialog()}
    `
  }

  _renderGroupingToggle() {
    const option = (label, value) => html`
      <button
        type="button"
        class="chip"
        aria-pressed=${this._grouping === value ? 'true' : 'false'}
        @click=${() => this._setGrouping(value)}
      >
        ${label}
      </button>
    `
    return html`
      <div class="grouping" role="group" aria-label="Agrupar por">
        Agrupar por: ${option('Livro', 'book')} ${option('Tag', 'tag')}
      </div>
    `
  }

  _renderByBook(groups) {
    const visible = groups
      .map((group) => ({ ...group, highlights: group.highlights.filter((h) => this._matchesFilter(h)) }))
      .filter((group) => group.highlights.length)
    return html`
      ${this._renderFilters(groups.flatMap((g) => g.highlights))}
      ${visible.map(
        (group) => html`
          <h2>${group.title} <span class="translation">${group.translationName}</span></h2>
          ${group.highlights.map((highlight) => this._renderHighlight(highlight))}
        `
      )}
    `
  }

  _renderByTag(groups) {
    return this._tagSections(groups).map((section) => {
      const open = !this._collapsed.has(section.key)
      return html`
        <h2>
          <button
            type="button"
            class="section"
            aria-expanded=${open ? 'true' : 'false'}
            @click=${() => this._toggleSection(section.key)}
          >
            <md-icon>${open ? 'expand_more' : 'chevron_right'}</md-icon>
            ${section.name} <span class="count">(${section.highlights.length})</span>
          </button>
        </h2>
        ${open ? section.highlights.map((highlight) => this._renderHighlight(highlight, section.key)) : ''}
      `
    })
  }
}

customElements.define('marked-texts-view', MarkedTextsView)
