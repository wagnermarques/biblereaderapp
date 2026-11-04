import { supabase } from './supabase-client.js'
import { authService } from './auth-service.js'

export const supabaseAuthProvider = {
  isConfigured() {
    return supabase !== null
  },

  async signIn({ email, password }) {
    if (!supabase) throw new Error('Supabase não configurado')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const user = data?.user
    return user ? { id: user.id, email: user.email, name: user.user_metadata?.name || user.email } : null
  },

  async signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  },

  async signUp({ name, email, password }) {
    if (!supabase) throw new Error('Supabase não configurado')
    const emailRedirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: name ? { name } : undefined,
      },
    })
    if (error) throw error
    const user = data?.user
    return user ? { id: user.id, email: user.email, name: user.user_metadata?.name || name || user.email } : null
  },

  async requestPasswordReset({ email, redirectTo }) {
    if (!supabase) throw new Error('Supabase não configurado')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  },

  async resetPassword({ password }) {
    if (!supabase) throw new Error('Supabase não configurado')
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    const user = data?.user
    return user ? { id: user.id, email: user.email, name: user.user_metadata?.name || user.email } : null
  },

  async changePassword({ newPassword }) {
    if (!supabase) throw new Error('Supabase não configurado')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  init({ setUser }) {
    return authService.subscribe((session) => {
      const u = session?.user
      setUser(u ? { id: u.id, email: u.email, name: u.user_metadata?.name || u.email } : null)
    })
  },

  async getAccessToken() {
    return (await supabase?.auth?.getSession())?.data?.session?.access_token ?? null
  },
}
