import { LitElement, html, css } from 'lit'
import { searchService } from '../services/search-service.js'
import { navigateToChapter, navigateToSearch } from '../router.js'

export class SearchView extends LitElement {
  static properties = {
    query: {},
    _results: { state: true },
    _loading: { state: true },
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
      padding: 10px 4px;
      border-bottom: 1px solid var(--md-sys-color-outline);
      cursor: pointer;
    }
    .result:hover {
      background: var(--md-sys-color-surface-variant);
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
  `

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
    navigateToChapter(r.bookId, r.chapter)
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
          <div class="result" @click=${() => this._openResult(r)}>
            <span class="ref">${r.bookName} ${r.chapter}:${r.verse}</span>
            ${r.text}
          </div>
        `
      )}
    `
  }
}

customElements.define('search-view', SearchView)
