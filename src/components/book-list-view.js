import { LitElement, html, css } from 'lit'
import './bible-nav.js'
import { navigateToBookChapters } from '../router.js'

export class BookListView extends LitElement {
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
  `

  _onBookSelected(e) {
    navigateToBookChapters(e.detail.bookId)
  }

  render() {
    return html`
      <h1>Livros</h1>
      <bible-nav @book-selected=${this._onBookSelected}></bible-nav>
    `
  }
}

customElements.define('book-list-view', BookListView)
