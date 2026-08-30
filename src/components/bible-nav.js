import { LitElement, html, css } from 'lit'
import { bibleDataService } from '../services/bible-data-service.js'

export class BibleNav extends LitElement {
  static properties = {
    _books: { state: true },
    activeBookId: { attribute: 'active-book-id' },
  }

  static styles = css`
    :host {
      display: block;
    }
    h3 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--md-sys-color-on-surface-variant);
      padding: 16px 16px 4px;
      margin: 0;
    }
    md-list-item[data-active] {
      --md-list-item-label-text-color: var(--md-sys-color-primary);
      --md-list-item-leading-icon-color: var(--md-sys-color-primary);
    }
  `

  constructor() {
    super()
    this._books = []
  }

  connectedCallback() {
    super.connectedCallback()
    bibleDataService.getIndex().then((books) => {
      this._books = books
    })
  }

  _select(bookId) {
    this.dispatchEvent(new CustomEvent('book-selected', { detail: { bookId }, bubbles: true, composed: true }))
  }

  _renderGroup(title, books) {
    if (!books.length) return null
    return html`
      <h3>${title}</h3>
      <md-list>
        ${books.map(
          (b) => html`
            <md-list-item
              type="button"
              ?data-active=${b.id === this.activeBookId}
              @click=${() => this._select(b.id)}
            >
              ${b.name}
            </md-list-item>
          `
        )}
      </md-list>
    `
  }

  render() {
    const oldTestament = this._books.filter((b) => b.testament === 'ot')
    const newTestament = this._books.filter((b) => b.testament === 'nt')
    return html`
      ${this._renderGroup('Antigo Testamento', oldTestament)}
      ${this._renderGroup('Novo Testamento', newTestament)}
    `
  }
}

customElements.define('bible-nav', BibleNav)
