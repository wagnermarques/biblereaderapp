import { supabase } from './supabase-client.js'

let currentSession = null
const listeners = new Set()

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session
    listeners.forEach((fn) => fn(currentSession))
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    listeners.forEach((fn) => fn(currentSession))
  })
}

export const authService = {
  isConfigured() {
    return supabase !== null
  },

  /** Synchronous — null until the initial session check resolves. */
  getCurrentUser() {
    return currentSession?.user ?? null
  },

  /** Calls back immediately with the current session, then on every change. */
  subscribe(callback) {
    listeners.add(callback)
    callback(currentSession)
    return () => listeners.delete(callback)
  },

  async signUp(email, password) {
    if (!supabase) throw new Error('Supabase não configurado')
    // Send the confirmation link back to wherever the app is actually
    // running (dev or prod) instead of relying on the Supabase project's
    // dashboard-configured default Site URL. This exact URL must also be
    // added to the project's Auth > URL Configuration > Redirect URLs list.
    const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
    if (error) throw error
  },

  async signIn(email, password) {
    if (!supabase) throw new Error('Supabase não configurado')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  async signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  },

  async getRole(userId) {
    if (!supabase) return null
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    return data?.role ?? null
  },
}
