import { LitElement, html, css } from 'lit'
import {
  storageService,
  formatSermonTitle,
  formatWeekday,
  formatDateShort,
  getTodayDateString,
} from '../services/storage-service.js'
import { navigateToChapter, navigateToSermons } from '../router.js'

const QUICK_CULT_TITLES = [
  'Culto de Domingo',
  'Culto da Família',
  'Culto de Ensino',
  'Culto de Doutrina',
  'Culto de Jovens',
  'Culto de Oração',
  'Estudo Bíblico',
]

export class SermonsView extends LitElement {
  static properties = {
    sermonId: { type: String, attribute: 'sermon-id' },
    _sermons: { state: true },
    _activeSermonId: { state: true },
    _dialogOpen: { state: true },
    _editDialogOpen: { state: true },
    _confirmDeleteId: { state: true },
    _cultTitleInput: { state: true },
    _dateInput: { state: true },
    _toastMessage: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 760px;
      margin: 0 auto;
      padding: 16px 20px 80px;
      color: var(--md-sys-color-on-surface);
    }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      color: var(--md-sys-color-primary);
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 12px;
      padding: 6px 0;
      background: none;
      border: none;
    }
    .back-btn:hover {
      text-decoration: underline;
    }
    .sermon-card {
      background: var(--md-sys-color-surface);
      border: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 14px;
      cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .sermon-card:hover {
      background: var(--md-sys-color-surface-variant);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }
    .sermon-card .info {
      flex: 1;
      min-width: 0;
    }
    .sermon-card .title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0 0 6px;
      color: var(--md-sys-color-on-surface);
    }
    .sermon-card .meta {
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .sermon-card .preview {
      font-size: 0.88rem;
      color: var(--md-sys-color-on-surface-variant);
      margin: 8px 0 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.78rem;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--md-sys-color-primary-container);
      color: var(--md-sys-color-on-primary-container);
    }
    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: var(--md-sys-color-on-surface-variant);
    }
    .empty-state md-icon {
      --md-icon-size: 48px;
      color: var(--md-sys-color-outline);
      margin-bottom: 12px;
    }
    .empty-state p {
      margin: 8px auto;
      max-width: 440px;
      line-height: 1.6;
    }

    /* Detail View */
    .detail-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
      padding-bottom: 12px;
    }
    .detail-title {
      font-size: 1.35rem;
      font-weight: 600;
      margin: 0;
    }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .verse-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .verse-item {
      background: var(--md-sys-color-surface-variant);
      border-radius: 8px;
      padding: 12px 14px;
      border-left: 4px solid var(--md-sys-color-primary);
    }
    .verse-item-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    .verse-ref {
      font-weight: 600;
      color: var(--md-sys-color-primary);
      font-size: 0.9rem;
      cursor: pointer;
    }
    .verse-ref:hover {
      text-decoration: underline;
    }
    .verse-text {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
    }
    .verse-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .remarks-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .remarks-textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 180px;
      padding: 12px 14px;
      font-family: inherit;
      font-size: 1rem;
      line-height: 1.6;
      border-radius: 8px;
      border: 1px solid var(--md-sys-color-outline);
      background: var(--md-sys-color-surface);
      color: var(--md-sys-color-on-surface);
      resize: vertical;
    }
    .remarks-textarea:focus {
      outline: 2px solid var(--md-sys-color-primary);
      outline-offset: -1px;
    }
    .save-indicator {
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .actions-footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--md-sys-color-outline-variant, #e0e0e0);
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
    this._sermons = storageService.getSermons()
    this._activeSermonId = null
    this._dialogOpen = false
    this._editDialogOpen = false
    this._confirmDeleteId = null
    this._cultTitleInput = 'Culto de Domingo'
    this._dateInput = getTodayDateString()
    this._toastMessage = null
    this._saveTimeout = null
  }

  connectedCallback() {
    super.connectedCallback()
    this._reload()
    if (this.sermonId) {
      this._activeSermonId = this.sermonId
    }
  }

  updated(changed) {
    if (changed.has('sermonId')) {
      this._activeSermonId = this.sermonId || null
    }
  }

  _reload() {
    this._sermons = storageService.getSermons()
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

  _selectSermon(id) {
    this._activeSermonId = id
    navigateToSermons(id)
  }

  _goBackToList() {
    this._activeSermonId = null
    navigateToSermons()
  }

  _openNewDialog() {
    this._dateInput = getTodayDateString()
    this._cultTitleInput = ''
    this._dialogOpen = true
  }

  _createSermon() {
    const cult = this._cultTitleInput.trim() || 'Culto'
    const sermon = storageService.createSermon({
      cultTitle: cult,
      date: this._dateInput,
    })
    this._dialogOpen = false
    this._reload()
    this._selectSermon(sermon.id)
    this._showToast('Pregação criada com sucesso!')
  }

  _openEditDialog(sermon) {
    this._dateInput = sermon.date
    this._cultTitleInput = sermon.cultTitle
    this._editDialogOpen = true
  }

  _saveEditSermon() {
    if (!this._activeSermonId) return
    storageService.updateSermon(this._activeSermonId, {
      date: this._dateInput,
      cultTitle: this._cultTitleInput.trim() || 'Culto',
    })
    this._editDialogOpen = false
    this._reload()
    this._showToast('Pregação atualizada!')
  }

  _onRemarksInput(event) {
    const val = event.target.value
    clearTimeout(this._saveTimeout)
    this._saveTimeout = setTimeout(() => {
      if (this._activeSermonId) {
        storageService.updateSermon(this._activeSermonId, { remarks: val })
        this._reload()
      }
    }, 400)
  }

  _removeVerse(verseId) {
    if (!this._activeSermonId) return
    storageService.removeVerseFromSermon(this._activeSermonId, verseId)
    this._reload()
    this._showToast('Versículo removido da pregação.')
  }

  _deleteSermon(id) {
    storageService.deleteSermon(id)
    this._confirmDeleteId = null
    this._activeSermonId = null
    this._reload()
    navigateToSermons()
    this._showToast('Pregação excluída.')
  }

  _shareSermon(sermon) {
    const versesText = (sermon.verses || [])
      .map((v) => {
        const ref = v.verseEnd ? `${v.bookName} ${v.chapter}:${v.verse}-${v.verseEnd}` : `${v.bookName} ${v.chapter}:${v.verse}`
        return `📖 ${ref}\n"${v.text}"`
      })
      .join('\n\n')

    const shareContent = [
      `⛪ ${sermon.title}`,
      versesText ? `\n--- Versículos ---\n${versesText}` : '',
      sermon.remarks ? `\n--- Anotações ---\n${sermon.remarks}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareContent).then(() => {
        this._showToast('Conteúdo da pregação copiado!')
      })
    } else {
      this._showToast('Não foi possível copiar automaticamente.')
    }
  }

  _openVerseInBible(v) {
    navigateToChapter(v.book, v.chapter, v.verse)
  }

  render() {
    const active = this._activeSermonId
      ? this._sermons.find((s) => s.id === this._activeSermonId)
      : null

    return html`
      ${active ? this._renderDetail(active) : this._renderList()}
      ${this._renderNewDialog()}
      ${this._renderEditDialog(active)}
      ${this._renderDeleteConfirmDialog()}
      ${this._toastMessage ? html`<div class="toast">${this._toastMessage}</div>` : ''}
    `
  }

  _renderList() {
    return html`
      <div class="header-row">
        <h1>
          <md-icon>record_voice_over</md-icon>
          Pregações
        </h1>
        <md-filled-button @click=${this._openNewDialog}>
          <md-icon slot="icon">add</md-icon>
          Nova pregação
        </md-filled-button>
      </div>

      ${this._sermons.length === 0
        ? html`
            <div class="empty-state">
              <md-icon>menu_book</md-icon>
              <h3>Nenhuma pregação cadastrada</h3>
              <p>
                Toque no botão <strong>"Nova pregação"</strong> acima para criar uma ou, durante a
                leitura / busca na Bíblia, <strong>pressione e segure qualquer versículo</strong> e
                escolha <em>"Adicionar à pregação de hoje"</em>.
              </p>
            </div>
          `
        : this._sermons.map((sermon) => {
            const verseCount = sermon.verses?.length || 0
            return html`
              <div
                class="sermon-card"
                role="button"
                tabindex="0"
                @click=${() => this._selectSermon(sermon.id)}
                @keydown=${(e) => (e.key === 'Enter' ? this._selectSermon(sermon.id) : null)}
              >
                <div class="info">
                  <div class="title">${sermon.title}</div>
                  <div class="meta">
                    <span class="badge">
                      <md-icon style="--md-icon-size:14px">bookmark</md-icon>
                      ${verseCount} ${verseCount === 1 ? 'versículo' : 'versículos'}
                    </span>
                  </div>
                  ${sermon.remarks
                    ? html`<div class="preview">${sermon.remarks}</div>`
                    : ''}
                </div>
                <md-icon style="color:var(--md-sys-color-on-surface-variant)">chevron_right</md-icon>
              </div>
            `
          })}
    `
  }

  _renderDetail(sermon) {
    const verses = sermon.verses || []
    return html`
      <button class="back-btn" @click=${this._goBackToList}>
        <md-icon style="--md-icon-size:18px">arrow_back</md-icon>
        Voltar para a lista de pregações
      </button>

      <div class="detail-container">
        <div class="detail-header">
          <div>
            <h2 class="detail-title">${sermon.title}</h2>
          </div>
          <div style="display:flex;gap:4px;">
            <md-icon-button
              aria-label="Editar título da pregação"
              title="Editar título/data"
              @click=${() => this._openEditDialog(sermon)}
            >
              <md-icon>edit</md-icon>
            </md-icon-button>
            <md-icon-button
              aria-label="Compartilhar pregação"
              title="Copiar resumo"
              @click=${() => this._shareSermon(sermon)}
            >
              <md-icon>content_copy</md-icon>
            </md-icon-button>
          </div>
        </div>

        <div>
          <div class="section-title">
            <md-icon>format_quote</md-icon>
            Versículos Associados (${verses.length})
          </div>

          ${verses.length === 0
            ? html`
                <p style="color:var(--md-sys-color-on-surface-variant);font-size:0.9rem;line-height:1.5;">
                  Nenhum versículo adicionado a esta pregação ainda.<br />
                  Enquanto lê a Bíblia ou busca um texto, <strong>pressione o versículo por alguns
                  instantes</strong> para adicioná-lo aqui.
                </p>
              `
            : html`
                <div class="verse-list">
                  ${verses.map((v) => {
                    const ref = v.verseEnd
                      ? `${v.bookName} ${v.chapter}:${v.verse}-${v.verseEnd}`
                      : `${v.bookName} ${v.chapter}:${v.verse}`
                    return html`
                      <div class="verse-item">
                        <div class="verse-item-top">
                          <span class="verse-ref" @click=${() => this._openVerseInBible(v)}>
                            ${ref}
                          </span>
                          <div class="verse-actions">
                            <md-text-button @click=${() => this._openVerseInBible(v)}>
                              <md-icon slot="icon" style="--md-icon-size:16px">menu_book</md-icon>
                              Ler capítulo
                            </md-text-button>
                            <md-icon-button
                              aria-label="Remover versículo"
                              title="Remover"
                              @click=${() => this._removeVerse(v.id)}
                            >
                              <md-icon>delete</md-icon>
                            </md-icon-button>
                          </div>
                        </div>
                        <p class="verse-text">“${v.text}”</p>
                      </div>
                    `
                  })}
                </div>
              `}
        </div>

        <div class="remarks-box">
          <div class="section-title">
            <md-icon>notes</md-icon>
            Anotações da Pregação
          </div>
          <textarea
            class="remarks-textarea"
            placeholder="Digite aqui as anotações, esboços e reflexões da mensagem..."
            .value=${sermon.remarks || ''}
            @input=${this._onRemarksInput}
          ></textarea>
          <div class="save-indicator">
            <md-icon style="--md-icon-size:14px;color:var(--md-sys-color-primary)">check_circle</md-icon>
            Salvo automaticamente
          </div>
        </div>

        <div class="actions-footer">
          <md-filled-button @click=${() => this._shareSermon(sermon)}>
            <md-icon slot="icon">content_copy</md-icon>
            Copiar / Compartilhar mensagem
          </md-filled-button>

          <md-text-button
            style="--md-text-button-label-text-color:var(--md-sys-color-error, #ba1a1a)"
            @click=${() => (this._confirmDeleteId = sermon.id)}
          >
            <md-icon slot="icon">delete</md-icon>
            Excluir pregação
          </md-text-button>
        </div>
      </div>
    `
  }

  _renderNewDialog() {
    if (!this._dialogOpen) return ''
    return html`
      <md-dialog open @closed=${() => (this._dialogOpen = false)}>
        <div slot="headline">Nova Pregação</div>
        <form slot="content" id="new-sermon-form" method="dialog" style="display:flex;flex-direction:column;gap:12px;min-width:280px;">
          <md-outlined-text-field
            label="Data (AAAA-MM-DD)"
            type="date"
            .value=${this._dateInput}
            @input=${(e) => (this._dateInput = e.target.value)}
          ></md-outlined-text-field>

          <md-outlined-text-field
            label="Título do Culto / Mensagem"
            placeholder="Ex: Culto da Família, Culto de Ensino..."
            .value=${this._cultTitleInput}
            @input=${(e) => (this._cultTitleInput = e.target.value)}
          ></md-outlined-text-field>

          <div style="font-size:0.8rem;color:var(--md-sys-color-on-surface-variant);margin-top:4px;">
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
          <md-text-button @click=${() => (this._dialogOpen = false)}>Cancelar</md-text-button>
          <md-filled-button @click=${this._createSermon}>Criar</md-filled-button>
        </div>
      </md-dialog>
    `
  }

  _renderEditDialog(sermon) {
    if (!this._editDialogOpen || !sermon) return ''
    return html`
      <md-dialog open @closed=${() => (this._editDialogOpen = false)}>
        <div slot="headline">Editar Pregação</div>
        <form slot="content" id="edit-sermon-form" method="dialog" style="display:flex;flex-direction:column;gap:12px;min-width:280px;">
          <md-outlined-text-field
            label="Data (AAAA-MM-DD)"
            type="date"
            .value=${this._dateInput}
            @input=${(e) => (this._dateInput = e.target.value)}
          ></md-outlined-text-field>

          <md-outlined-text-field
            label="Título do Culto / Mensagem"
            .value=${this._cultTitleInput}
            @input=${(e) => (this._cultTitleInput = e.target.value)}
          ></md-outlined-text-field>

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
          <md-text-button @click=${() => (this._editDialogOpen = false)}>Cancelar</md-text-button>
          <md-filled-button @click=${this._saveEditSermon}>Salvar</md-filled-button>
        </div>
      </md-dialog>
    `
  }

  _renderDeleteConfirmDialog() {
    if (!this._confirmDeleteId) return ''
    return html`
      <md-dialog open @closed=${() => (this._confirmDeleteId = null)}>
        <div slot="headline">Excluir Pregação</div>
        <div slot="content">
          Tem certeza de que deseja excluir esta pregação e suas anotações? Esta ação não pode ser desfeita.
        </div>
        <div slot="actions">
          <md-text-button @click=${() => (this._confirmDeleteId = null)}>Cancelar</md-text-button>
          <md-filled-button
            style="--md-filled-button-container-color:var(--md-sys-color-error, #ba1a1a)"
            @click=${() => this._deleteSermon(this._confirmDeleteId)}
          >
            Excluir
          </md-filled-button>
        </div>
      </md-dialog>
    `
  }
}

customElements.define('sermons-view', SermonsView)
