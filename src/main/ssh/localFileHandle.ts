import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface LocalFileInfo {
  name: string
  path: string
  isDir: boolean
  isLink: boolean
  size: number
  modTime: string
  mode: string
}

/**
 * 获取本地文件列表
 */
const getLocalFileList = async (dirPath: string): Promise<{ success: boolean; files?: LocalFileInfo[]; error?: string }> => {
  try {
    // 处理路径
    let targetPath = dirPath
    if (!targetPath || targetPath === '') {
      targetPath = os.homedir()
    }
    
    // 确保路径存在
    if (!fs.existsSync(targetPath)) {
      return { success: false, error: `路径不存在: ${targetPath}` }
    }

    const stats = fs.statSync(targetPath)
    if (!stats.isDirectory()) {
      return { success: false, error: `不是目录: ${targetPath}` }
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true })
    const files: LocalFileInfo[] = []

    for (const entry of entries) {
      try {
        const fullPath = path.join(targetPath, entry.name)
        let fileStats: fs.Stats
        
        try {
          fileStats = fs.statSync(fullPath)
        } catch {
          // 如果无法获取文件状态，跳过
          continue
        }

        files.push({
          name: entry.name,
          path: fullPath,
          isDir: entry.isDirectory(),
          isLink: entry.isSymbolicLink(),
          size: fileStats.size,
          modTime: fileStats.mtime.toISOString().replace('T', ' ').slice(0, 19),
          mode: '0' + (fileStats.mode & 0o777).toString(8)
        })
      } catch (err) {
        // 忽略无法访问的文件
        console.warn(`无法访问文件: ${entry.name}`, err)
      }
    }

    // 排序：目录在前，然后按名称排序
    files.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1
      if (!a.isDir && b.isDir) return 1
      return a.name.localeCompare(b.name)
    })

    return { success: true, files }
  } catch (err: any) {
    return { success: false, error: err.message || '获取文件列表失败' }
  }
}

/**
 * 获取系统主目录
 */
const getHomeDir = (): string => {
  return os.homedir()
}

/**
 * 获取系统驱动器列表 (Windows)
 */
const getDrives = async (): Promise<string[]> => {
  if (process.platform !== 'win32') {
    return ['/']
  }

  const drives: string[] = []
  // Windows 驱动器字母 A-Z
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\'
    try {
      fs.accessSync(drive, fs.constants.F_OK)
      drives.push(drive)
    } catch {
      // 驱动器不存在
    }
  }
  return drives
}

/**
 * 注册本地文件处理器
 */
export const registerLocalFileHandlers = () => {
  // 获取本地文件列表
  ipcMain.handle('local:file:list', async (_event, dirPath: string) => {
    return getLocalFileList(dirPath)
  })

  // 获取主目录
  ipcMain.handle('local:file:home', async () => {
    return getHomeDir()
  })

  // 获取驱动器列表
  ipcMain.handle('local:file:drives', async () => {
    return getDrives()
  })

  // 检查文件是否存在
  ipcMain.handle('local:file:exists', async (_event, filePath: string) => {
    return fs.existsSync(filePath)
  })

  // 获取文件信息
  ipcMain.handle('local:file:stat', async (_event, filePath: string) => {
    try {
      const stats = fs.statSync(filePath)
      return {
        success: true,
        stats: {
          size: stats.size,
          isDir: stats.isDirectory(),
          isFile: stats.isFile(),
          isLink: stats.isSymbolicLink(),
          modTime: stats.mtime.toISOString(),
          mode: '0' + (stats.mode & 0o777).toString(8)
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 创建目录
  ipcMain.handle('local:file:mkdir', async (_event, dirPath: string) => {
    try {
      fs.mkdirSync(dirPath, { recursive: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 删除文件或目录
  ipcMain.handle('local:file:delete', async (_event, filePath: string) => {
    try {
      const stats = fs.statSync(filePath)
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true })
      } else {
        fs.unlinkSync(filePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 重命名文件或目录
  ipcMain.handle('local:file:rename', async (_event, oldPath: string, newPath: string) => {
    try {
      fs.renameSync(oldPath, newPath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  console.log('Local file handlers registered')
}
