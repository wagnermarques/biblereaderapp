import { LitElement, html, css } from 'lit'
import { TRANSLATIONS } from '../translations.js'
import { storageService, markTranslationId } from '../services/storage-service.js'

/**
 * The Bibles the app carries, why each one is here, and which one to read.
 * Every translation bundled is free to redistribute, and two of the licenses ask
 * for attribution, so the license and its source link are part of the page
 * rather than a footnote in the README.
 */
export class BiblesView extends LitElement {
  static properties = {
    _current: { state: true },
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
      margin: 0 0 8px;
    }
    .intro {
      color: var(--md-sys-color-on-surface-variant);
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .picker {
      margin-bottom: 8px;
    }
    md-outlined-select {
      width: 100%;
    }
    .note {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.8rem;
      line-height: 1.5;
      margin: 8px 0 32px;
    }
    article {
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    article[data-current] {
      border-color: var(--md-sys-color-primary);
      background: var(--md-sys-color-surface-variant);
    }
    h2 {
      font-size: 1rem;
      margin: 0 0 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 10px;
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }
    article p {
      margin: 0 0 8px;
      line-height: 1.6;
    }
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      font-size: 0.85rem;
    }
    dt {
      color: var(--md-sys-color-on-surface-variant);
    }
    dd {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    a {
      color: var(--md-sys-color-primary);
    }
    .counts {
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 12px;
    }
  `

  constructor() {
    super()
    this._current = storageService.getTranslationId()
  }

  /** How many highlights were made in each translation, for the per-Bible count. */
  _markCounts() {
    const counts = new Map()
    for (const mark of storageService.getMarkedTexts()) {
      const id = markTranslationId(mark)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }

  _select(id) {
    if (id === this._current) return
    this._current = id
    // The shell owns the switch: it persists the choice, drops the search index
    // built from the old text, and rebuilds whatever page is open.
    this.dispatchEvent(
      new CustomEvent('translation-change', { detail: { id }, bubbles: true, composed: true })
    )
  }

  render() {
    const counts = this._markCounts()
    return html`
      <h1>Bíblias disponíveis</h1>
      <p class="intro">
        Este app só inclui traduções que podem ser redistribuídas livremente. Traduções modernas
        como NVI, ARA, ARC, NAA, NTLH e ACF são protegidas por direitos autorais e não podem ser
        publicadas aqui. Escolha abaixo qual texto você quer ler.
      </p>

      <div class="picker">
        <md-outlined-select
          label="Bíblia em uso"
          .value=${this._current}
          @change=${(e) => this._select(e.target.value)}
        >
          ${TRANSLATIONS.map(
            (t) => html`
              <md-select-option value=${t.id} ?selected=${t.id === this._current}>
                <div slot="headline">${t.fullName}</div>
              </md-select-option>
            `
          )}
        </md-outlined-select>
      </div>
      <p class="note">
        Trocar de Bíblia muda o texto de leitura e da busca. Seus destaques continuam guardados na
        Bíblia em que foram feitos: as marcações são posições de letras dentro de uma redação, e
        cairiam sobre outras palavras em outra tradução. Favoritos e capítulos lidos valem para
        todas.
      </p>

      ${TRANSLATIONS.map((t) => {
        const marks = counts.get(t.id) ?? 0
        return html`
          <article ?data-current=${t.id === this._current}>
            <h2>
              ${t.fullName} ${t.id === this._current ? html`<span class="badge">Em uso</span>` : ''}
            </h2>
            <p>${t.description}</p>
            <dl>
              <dt>Licença</dt>
              <dd><a href=${t.licenseUrl} target="_blank" rel="noopener">${t.license}</a></dd>
              ${t.attribution ? html`<dt>Créditos</dt><dd>${t.attribution}</dd>` : ''}
              <dt>Texto oficial</dt>
              <dd><a href=${t.sourceUrl} target="_blank" rel="noopener">${t.sourceName}</a></dd>
            </dl>
            <p class="counts">
              ${marks === 0
                ? 'Nenhum destaque feito nesta Bíblia.'
                : marks === 1
                  ? '1 destaque feito nesta Bíblia.'
                  : `${marks} destaques feitos nesta Bíblia.`}
            </p>
          </article>
        `
      })}
    `
  }
}

customElements.define('bibles-view', BiblesView)
