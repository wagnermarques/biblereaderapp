import { defineConfig, mergeConfig } from 'vite'
import { appshellConfig } from 'fzl-fund-appshell--lit/vite'
import appshell from './appshell.config.js'

export default defineConfig(
  mergeConfig(
    appshellConfig(appshell),
    {},
  ),
)
