import { LitElement, html, css } from 'lit'
import { searchService } from '../services/search-service.js'
import { storageService, getTodayDateString } from '../services/storage-service.js'
import { navigateToChapter, navigateToSearch } from '../router.js'

const QUICK_CULT_TITLES = [
  'Culto de Domingo',
  'Culto da Família',
  'Culto de Ensino',
  'Culto de Doutrina',
  'Culto de Jovens',
  'Culto de Oração',
  'Estudo Bíblico',
]

export class SearchView extends LitElement {
  static properties = {
    query: {},
    _results: { state: true },
    _loading: { state: true },
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
    md-outlined-text-field {
      width: 100%;
      margin-bottom: 16px;
    }
    .result {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 8px;
      border-bottom: 1px solid var(--md-sys-color-outline);
      cursor: pointer;
      border-radius: 6px;
    }
    .result:hover {
      background: var(--md-sys-color-surface-variant);
    }
    .result-body {
      flex: 1;
      min-width: 0;
    }
    .ref {
      font-weight: 600;
      color: var(--md-sys-color-primary);
      display: block;
      font-size: 0.8em;
      margin-bottom: 2px;
    }
    .empty {
      color: var(--md-sys-color-on-surface-variant);
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
    this._verseOptions = null
    this._newTodaySermonPrompt = false
    this._pickSermonDialogOpen = false
    this._cultTitleInput = ''
    this._pendingVerseForToday = null
    this._toastMessage = null
    this._suppressClick = false
  }

  updated(changed) {
    if (changed.has('query')) {
      this._runSearch()
    }
  }

  async _runSearch() {
    if (!this.query) {
      this._results = []
      return
    }
    this._loading = true
    this._results = await searchService.search(this.query)
    this._loading = false
  }

  _onInput(e) {
    navigateToSearch(e.target.value)
  }

  _openResult(r) {
    navigateToChapter(r.bookId || r.book, r.chapter, r.verse)
  }

  _onResultClick(r) {
    if (this._suppressClick) {
      this._suppressClick = false
      return
    }
    this._openResult(r)
  }

  _onResultTouchStart(e, r) {
    const touch = e.touches[0]
    this._touchStartX = touch.clientX
    this._touchStartY = touch.clientY
    this._suppressClick = false
    clearTimeout(this._longPressTimer)
    this._longPressTimer = setTimeout(() => {
      this._suppressClick = true
      if (navigator.vibrate) navigator.vibrate(40)
      this._openVerseOptions(r)
    }, 480)
  }

  _onResultTouchMove(e) {
    if (this._touchStartX === null || this._touchStartX === undefined) return
    const touch = e.touches[0]
    const dist = Math.hypot(touch.clientX - this._touchStartX, touch.clientY - this._touchStartY)
    if (dist > 10) {
      clearTimeout(this._longPressTimer)
    }
  }

  _onResultTouchEnd() {
    clearTimeout(this._longPressTimer)
    this._touchStartX = null
    this._touchStartY = null
  }

  _onResultMouseDown(e, r) {
    if (e.button !== 0) return
    this._mouseStartX = e.clientX
    this._mouseStartY = e.clientY
    clearTimeout(this._longPressTimer)
    this._longPressTimer = setTimeout(() => {
      this._suppressClick = true
      this._openVerseOptions(r)
    }, 500)
  }

  _onResultMouseMove(e) {
    if (this._mouseStartX === null || this._mouseStartX === undefined) return
    const dist = Math.hypot(e.clientX - this._mouseStartX, e.clientY - this._mouseStartY)
    if (dist > 8) {
      clearTimeout(this._longPressTimer)
    }
  }

  _onResultMouseUp() {
    clearTimeout(this._longPressTimer)
    this._mouseStartX = null
    this._mouseStartY = null
  }

  _onResultContextMenu(e, r) {
    e.preventDefault()
    this._suppressClick = true
    this._openVerseOptions(r)
  }

  _openVerseOptions(r) {
    this._verseOptions = {
      book: r.bookId || r.book,
      bookName: r.bookName,
      chapter: r.chapter,
      verse: r.verse,
      text: r.text,
    }
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
        book: this._verseOptions.book,
        bookName: this._verseOptions.bookName,
        chapter: this._verseOptions.chapter,
        verse: this._verseOptions.verse,
        text: this._verseOptions.text,
      })
      const ref = `${this._verseOptions.bookName} ${this._verseOptions.chapter}:${this._verseOptions.verse}`
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
      book: this._pendingVerseForToday.book,
      bookName: this._pendingVerseForToday.bookName,
      chapter: this._pendingVerseForToday.chapter,
      verse: this._pendingVerseForToday.verse,
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
      book: this._verseOptions.book,
      bookName: this._verseOptions.bookName,
      chapter: this._verseOptions.chapter,
      verse: this._verseOptions.verse,
      text: this._verseOptions.text,
    })
    const ref = `${this._verseOptions.bookName} ${this._verseOptions.chapter}:${this._verseOptions.verse}`
    this._showToast(`${ref} adicionado a: ${sermon.title}`)
    this._pickSermonDialogOpen = false
    this._verseOptions = null
  }

  _copyCurrentVerse() {
    if (!this._verseOptions) return
    const ref = `${this._verseOptions.bookName} ${this._verseOptions.chapter}:${this._verseOptions.verse}`
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

  _showToast(msg) {
    this._toastMessage = msg
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toastMessage = null
      this.requestUpdate()
    }, 2800)
    this.requestUpdate()
  }

  render() {
    return html`
      <md-outlined-text-field
        label="Buscar na Bíblia"
        .value=${this.query ?? ''}
        @input=${this._onInput}
      ></md-outlined-text-field>

      ${this._loading ? html`<p>Buscando…</p>` : null}
      ${!this._loading && this.query && this._results?.length === 0
        ? html`<p class="empty">Nenhum resultado para "${this.query}".</p>`
        : null}
      ${(this._results ?? []).map(
        (r) => html`
          <div
            class="result"
            title="Toque para ler; pressione para opções da pregação"
            @click=${() => this._onResultClick(r)}
            @touchstart=${(e) => this._onResultTouchStart(e, r)}
            @touchmove=${this._onResultTouchMove}
            @touchend=${this._onResultTouchEnd}
            @touchcancel=${this._onResultTouchEnd}
            @mousedown=${(e) => this._onResultMouseDown(e, r)}
            @mousemove=${this._onResultMouseMove}
            @mouseup=${this._onResultMouseUp}
            @contextmenu=${(e) => this._onResultContextMenu(e, r)}
          >
            <div class="result-body">
              <span class="ref">${r.bookName} ${r.chapter}:${r.verse}</span>
              ${r.text}
            </div>
            <md-icon-button
              aria-label="Opções do versículo"
              title="Opções / Adicionar à pregação"
              @click=${(e) => {
                e.stopPropagation()
                this._openVerseOptions(r)
              }}
            >
              <md-icon>more_vert</md-icon>
            </md-icon-button>
          </div>
        `
      )}

      ${this._renderVerseOptionsDialog()}
      ${this._renderTodaySermonPromptDialog()}
      ${this._renderPickSermonDialog()}
      ${this._toastMessage ? html`<div class="toast">${this._toastMessage}</div>` : ''}
    `
  }

  _renderVerseOptionsDialog() {
    if (!this._verseOptions) return ''
    const todaySermons = storageService.getTodaySermons()
    const ref = `${this._verseOptions.bookName} ${this._verseOptions.chapter}:${this._verseOptions.verse}`

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
            <md-list-item
              type="button"
              @click=${() => {
                const opt = this._verseOptions
                this._closeVerseOptionsDialog()
                this._openResult(opt)
              }}
            >
              <md-icon slot="start">menu_book</md-icon>
              <div slot="headline">Abrir no capítulo</div>
              <div slot="supporting-text">Ver no contexto de leitura</div>
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

customElements.define('search-view', SearchView)
