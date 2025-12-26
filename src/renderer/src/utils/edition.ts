/**
 * Edition utilities for renderer process
 * Uses configuration injected at build time from build/edition-config/*.json
 * This ensures single source of truth for all edition-specific URLs
 */

export type Edition = 'cn' | 'global'

// Edition configuration interface (matches build/edition-config/*.json structure)
export interface EditionConfig {
  edition: Edition
  displayName: string
  api: {
    baseUrl: string
    kmsUrl: string
    syncUrl: string
  }
  update: {
    serverUrl: string
    releaseNotesUrl: string
  }
  auth: {
    loginBaseUrl: string
  }
  defaults: {
    language: string
  }
  legal: {
    privacyPolicyUrl: string
    termsOfServiceUrl: string
  }
  speech: {
    wsUrl: string
  }
  docs: {
    baseUrl: string
  }
}

// Default edition config fallback
const DEFAULT_EDITION_CONFIG: EditionConfig = {
  edition: 'cn',
  displayName: 'Chaterm CN',
  api: {
    baseUrl: 'https://api8.chaterm.net/v1',
    kmsUrl: 'https://api8.chaterm.net/v1',
    syncUrl: 'https://api8.chaterm.net'
  },
  update: {
    serverUrl: 'https://static-download8.chaterm.net/',
    releaseNotesUrl: 'https://chaterm.net/release-notes'
  },
  auth: {
    loginBaseUrl: 'https://login.chaterm.cn'
  },
  defaults: {
    language: 'zh-CN'
  },
  legal: {
    privacyPolicyUrl: 'https://chaterm.cn/docs/user/privacy',
    termsOfServiceUrl: 'https://chaterm.cn/docs/user/terms'
  },
  speech: {
    wsUrl: 'wss://api8.chaterm.net/v1/speech/asr'
  },
  docs: {
    baseUrl: 'https://chaterm.cn/docs'
  }
}

// Edition config - 直接使用 CN 配置
const editionConfig: EditionConfig = DEFAULT_EDITION_CONFIG

// Get edition config
const getInjectedConfig = (): EditionConfig => {
  return editionConfig
}

/**
 * Get the full edition configuration object
 * Injected at build time from build/edition-config/*.json
 */
export const getEditionConfig = (): EditionConfig => getInjectedConfig()

/**
 * Get current app edition
 */
export const APP_EDITION: Edition = getEditionConfig().edition

/**
 * Check if current edition is Chinese edition
 */
export const isChineseEdition = (): boolean => APP_EDITION === 'cn'

/**
 * Check if current edition is Global edition
 */
export const isGlobalEdition = (): boolean => APP_EDITION === 'global'

/**
 * Get default language based on edition
 */
export const getDefaultLanguage = (): string => import.meta.env.RENDERER_DEFAULT_LANGUAGE || getEditionConfig().defaults.language

/**
 * Get API base URL for current edition
 */
export const getApiBaseUrl = (): string => import.meta.env.RENDERER_VUE_APP_API_BASEURL || getEditionConfig().api.baseUrl

/**
 * Get KMS server URL for current edition
 */
export const getKmsServerUrl = (): string => import.meta.env.RENDERER_KMS_SERVER_URL || getEditionConfig().api.kmsUrl

/**
 * Get sync server URL for current edition
 */
export const getSyncServerUrl = (): string => import.meta.env.RENDERER_SYNC_SERVER_URL || getEditionConfig().api.syncUrl

/**
 * Get speech WebSocket URL for current edition
 */
export const getSpeechWsUrl = (): string => import.meta.env.RENDERER_SPEECH_WS_URL || getEditionConfig().speech.wsUrl

/**
 * Get docs base URL for current edition
 */
export const getDocsBaseUrl = (): string => import.meta.env.RENDERER_DOCS_BASE_URL || getEditionConfig().docs.baseUrl

/**
 * Get SSO/login base URL for current edition
 */
export const getSsoBaseUrl = (): string => import.meta.env.RENDERER_SSO || getEditionConfig().auth.loginBaseUrl

/**
 * Get privacy policy URL for current edition
 */
export const getPrivacyPolicyUrl = (): string => getEditionConfig().legal.privacyPolicyUrl

/**
 * Get terms of service URL for current edition
 */
export const getTermsOfServiceUrl = (): string => getEditionConfig().legal.termsOfServiceUrl

/**
 * Get documentation URL based on edition
 */
export const getDocumentationUrl = (): string => {
  const baseUrl = getDocsBaseUrl()
  return `${baseUrl}/`
}
