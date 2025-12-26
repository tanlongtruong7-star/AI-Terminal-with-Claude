import { getUserInfo, setUserInfo } from '@/utils/permission'
import { dataSyncService } from '@/services/dataSyncService'
import { shortcutService } from '@/services/shortcutService'

// 自动以访客身份登录（已删除登录功能）
const autoGuestLogin = async () => {
  localStorage.removeItem('login-skipped')
  localStorage.removeItem('ctm-token')
  localStorage.removeItem('jms-token')
  localStorage.removeItem('userInfo')
  
  localStorage.setItem('login-skipped', 'true')
  localStorage.setItem('ctm-token', 'guest_token')
  
  const guestUserInfo = {
    uid: 999999999,
    username: 'guest',
    name: 'Guest',
    email: 'guest@chaterm.ai',
    token: 'guest_token'
  }
  setUserInfo(guestUserInfo)
  
  const api = window.api as any
  const dbResult = await api.initUserDatabase({ uid: 999999999 })
  
  if (dbResult.success) {
    shortcutService.init()
    // 显示主窗口
    try {
      await api.mainWindowInit(dbResult.theme || 'dark')
      await api.mainWindowShow()
    } catch (e) {
      console.error('Failed to show main window:', e)
    }
    return true
  }
  return false
}

export const beforeEach = async (to, _from, next) => {
  const token = localStorage.getItem('ctm-token')
  const isSkippedLogin = localStorage.getItem('login-skipped') === 'true'
  const isDev = import.meta.env.MODE === 'development'
  
  // 如果访问登录页，直接重定向到主页（已删除登录功能）
  if (to.path === '/login') {
    // 自动以访客身份登录
    const success = await autoGuestLogin()
    if (success) {
      next('/')
    } else {
      console.error('Auto guest login failed')
      next('/')
    }
    return
  }

  // 如果没有 token，自动以访客身份登录
  if (!token) {
    const success = await autoGuestLogin()
    if (success) {
      next()
    } else {
      console.error('Auto guest login failed')
      next()
    }
    return
  }

  if (isSkippedLogin && token === 'guest_token') {
    try {
      const api = window.api as any
      const dbResult = await api.initUserDatabase({ uid: 999999999 })
      console.log('Database initialization result:', dbResult)

      if (dbResult.success) {
        if (to.path === '/') {
          next()
        } else {
          next('/')
        }
      } else {
        console.error('Database initialization failed')
        // 重新初始化访客登录
        await autoGuestLogin()
        next('/')
      }
    } catch (error) {
      console.error('Database initialization failed:', error)
      await autoGuestLogin()
      next('/')
    }
    return
  }

  if (token && !isSkippedLogin) {
    try {
      const userInfo = getUserInfo()
      if (userInfo && userInfo.uid) {
        const api = window.api as any
        const dbResult = await api.initUserDatabase({ uid: userInfo.uid })

        if (dbResult.success) {
          // After database initialization succeeds, asynchronously initialize data sync service (non-blocking UI display)
          dataSyncService.initialize().catch((error) => {
            console.error('Data sync service initialization failed:', error)
          })
          next()
        } else {
          console.error('Database initialization failed')
          await autoGuestLogin()
          next('/')
        }
      } else {
        await autoGuestLogin()
        next('/')
      }
    } catch (error) {
      console.error('Processing failed:', error)

      const message = error instanceof Error ? error.message : String(error)

      // In the development environment, bypass the relevant errors (usually caused by hot updates)
      if (isDev && (message.includes('nextSibling') || message.includes('getUserInfo'))) {
        next()
        return
      }
      await autoGuestLogin()
      next('/')
    }
  } else {
    await autoGuestLogin()
    next('/')
  }
}

export const afterEach = () => {}
