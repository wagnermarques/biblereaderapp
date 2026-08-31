import { supabase } from './supabase-client.js'
import { storageService } from './storage-service.js'

export const syncService = {
  /** Pulls the signed-in user's remote bookmarks and unions them into local storage. */
  async pullBookmarks(userId) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('bookmarks')
      .select('book_id, chapter, verse')
      .eq('user_id', userId)
    if (error) {
      console.error('Falha ao buscar favoritos do Supabase', error)
      return
    }
    storageService.mergeBookmarks(
      (data ?? []).map((r) => ({ book: r.book_id, chapter: r.chapter, verse: r.verse }))
    )
  },

  async pushBookmarkAdded(userId, book, chapter, verse) {
    if (!supabase) return
    const { error } = await supabase
      .from('bookmarks')
      .insert({ user_id: userId, book_id: book, chapter, verse })
    if (error) console.error('Falha ao sincronizar favorito', error)
  },

  async pushBookmarkRemoved(userId, book, chapter, verse) {
    if (!supabase) return
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .match({ user_id: userId, book_id: book, chapter, verse })
    if (error) console.error('Falha ao remover favorito sincronizado', error)
  },

  /** Pulls the signed-in user's remote read-verses and unions them into local storage. */
  async pullReadVerses(userId) {
    if (!supabase) return
    const { data, error } = await supabase
      .from('read_verses')
      .select('book_id, chapter, verse')
      .eq('user_id', userId)
    if (error) {
      console.error('Falha ao buscar versículos lidos do Supabase', error)
      return
    }
    storageService.mergeReadVerses(
      (data ?? []).map((r) => ({ book: r.book_id, chapter: r.chapter, verse: r.verse }))
    )
  },

  /** Called for both manual and auto-marking — upsert avoids a unique-violation error on repeats
   *  (e.g. the same verse auto-marked from two tabs/devices before either has pulled the other's data). */
  async pushVerseReadAdded(userId, book, chapter, verse) {
    if (!supabase) return
    const { error } = await supabase
      .from('read_verses')
      .upsert(
        { user_id: userId, book_id: book, chapter, verse },
        { onConflict: 'user_id,book_id,chapter,verse', ignoreDuplicates: true }
      )
    if (error) console.error('Falha ao sincronizar versículo lido', error)
  },

  async pushVerseReadRemoved(userId, book, chapter, verse) {
    if (!supabase) return
    const { error } = await supabase
      .from('read_verses')
      .delete()
      .match({ user_id: userId, book_id: book, chapter, verse })
    if (error) console.error('Falha ao remover marcação de versículo lido', error)
  },
}
