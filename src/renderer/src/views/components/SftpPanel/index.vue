<template>
  <div class="sftp-panel">
    <!-- 工具栏 -->
    <div class="sftp-toolbar">
      <div class="toolbar-left">
        <a-button type="text" size="small" @click="toggleLocalPanel">
          <template #icon>
            <DesktopOutlined />
          </template>
          {{ showLocalPanel ? '隐藏本地' : '显示本地' }}
        </a-button>
        <a-divider type="vertical" />
        <a-button type="text" size="small" @click="refreshAll">
          <template #icon>
            <SyncOutlined />
          </template>
          刷新
        </a-button>
      </div>
      <div class="toolbar-center">
        <a-button 
          type="primary" 
          size="small" 
          :disabled="!selectedLocalFiles.length"
          @click="uploadSelected"
        >
          <template #icon>
            <UploadOutlined />
          </template>
          上传
        </a-button>
        <a-button 
          type="primary" 
          size="small" 
          :disabled="!selectedRemoteFiles.length"
          @click="downloadSelected"
        >
          <template #icon>
            <DownloadOutlined />
          </template>
          下载
        </a-button>
      </div>
      <div class="toolbar-right">
        <span class="connection-status">
          <span :class="['status-dot', connected ? 'connected' : 'disconnected']"></span>
          {{ connected ? '已连接' : '未连接' }}
        </span>
      </div>
    </div>

    <!-- 双面板区域 -->
    <div class="sftp-panels">
      <!-- 本地文件面板 -->
      <div v-if="showLocalPanel" class="panel local-panel">
        <div class="panel-header">
          <span class="panel-title">
            <DesktopOutlined /> 本地
          </span>
          <a-input
            v-model:value="localPath"
            class="path-input"
            size="small"
            @press-enter="loadLocalFiles"
          >
            <template #prefix>
              <FolderOutlined />
            </template>
          </a-input>
        </div>
        <div class="panel-content">
          <a-table
            :columns="fileColumns"
            :data-source="localFiles"
            :row-key="(record) => record.path"
            :row-selection="{
              selectedRowKeys: selectedLocalKeys,
              onChange: onLocalSelectionChange
            }"
            :pagination="false"
            size="small"
            :scroll="{ y: 'calc(100% - 40px)' }"
            @row-dblclick="(record) => onLocalDblClick(record)"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'name'">
                <span class="file-name">
                  <FolderFilled v-if="record.isDir" class="folder-icon" />
                  <FileFilled v-else class="file-icon" />
                  {{ record.name }}
                </span>
              </template>
            </template>
          </a-table>
        </div>
      </div>

      <!-- 拖拽分隔线 -->
      <div v-if="showLocalPanel" class="panel-divider" @mousedown="startResize">
        <EllipsisOutlined class="divider-icon" />
      </div>

      <!-- 远程文件面板 -->
      <div class="panel remote-panel" :style="remotePanelStyle">
        <div class="panel-header">
          <span class="panel-title">
            <CloudServerOutlined /> 远程 - {{ serverInfo?.title || 'Server' }}
          </span>
          <a-input
            v-model:value="remotePath"
            class="path-input"
            size="small"
            @press-enter="loadRemoteFiles"
          >
            <template #prefix>
              <FolderOutlined />
            </template>
          </a-input>
        </div>
        <div class="panel-content">
          <a-spin :spinning="loading">
            <a-table
              :columns="fileColumns"
              :data-source="remoteFiles"
              :row-key="(record) => record.path"
              :row-selection="{
                selectedRowKeys: selectedRemoteKeys,
                onChange: onRemoteSelectionChange
              }"
              :pagination="false"
              size="small"
              :scroll="{ y: 'calc(100% - 40px)' }"
              @row-dblclick="(record) => onRemoteDblClick(record)"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'name'">
                  <span class="file-name">
                    <FolderFilled v-if="record.isDir" class="folder-icon" />
                    <LinkOutlined v-else-if="record.isLink" class="link-icon" />
                    <FileFilled v-else class="file-icon" />
                    {{ record.name }}
                  </span>
                </template>
                <template v-if="column.dataIndex === 'actions'">
                  <a-space>
                    <a-button 
                      v-if="!record.isDir" 
                      type="text" 
                      size="small" 
                      @click.stop="downloadFile(record)"
                    >
                      <template #icon>
                        <DownloadOutlined />
                      </template>
                    </a-button>
                    <a-button type="text" size="small" danger @click.stop="deleteFile(record)">
                      <template #icon>
                        <DeleteOutlined />
                      </template>
                    </a-button>
                  </a-space>
                </template>
              </template>
            </a-table>
          </a-spin>
        </div>
      </div>
    </div>

    <!-- 传输进度面板 -->
    <div v-if="transfers.length" class="transfer-panel">
      <div class="transfer-header">
        <span>传输队列 ({{ transfers.length }})</span>
        <a-button type="text" size="small" @click="clearCompleted">清除已完成</a-button>
      </div>
      <div class="transfer-list">
        <div v-for="transfer in transfers" :key="transfer.id" class="transfer-item">
          <span class="transfer-name">{{ transfer.name }}</span>
          <a-progress 
            :percent="transfer.progress" 
            :status="transfer.status"
            size="small"
            :stroke-width="4"
          />
          <span class="transfer-speed">{{ transfer.speed }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, PropType } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import {
  DesktopOutlined,
  CloudServerOutlined,
  FolderOutlined,
  FolderFilled,
  FileFilled,
  LinkOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SyncOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons-vue'
import { h } from 'vue'

const { t } = useI18n()
const api = window.api as any

const props = defineProps({
  uuid: {
    type: String,
    required: true
  },
  serverInfo: {
    type: Object,
    default: () => ({})
  },
  initialRemotePath: {
    type: String,
    default: '/'
  }
})

// 状态
const showLocalPanel = ref(true)
const localPath = ref('')
const remotePath = ref(props.initialRemotePath)
const localFiles = ref<any[]>([])
const remoteFiles = ref<any[]>([])
const selectedLocalKeys = ref<string[]>([])
const selectedRemoteKeys = ref<string[]>([])
const loading = ref(false)
const connected = ref(false)
const panelWidth = ref(50) // 百分比

// 传输队列
interface Transfer {
  id: string
  name: string
  type: 'upload' | 'download'
  progress: number
  status: 'active' | 'success' | 'exception'
  speed: string
}
const transfers = reactive<Transfer[]>([])

// 计算属性
const selectedLocalFiles = computed(() => 
  localFiles.value.filter(f => selectedLocalKeys.value.includes(f.path))
)
const selectedRemoteFiles = computed(() => 
  remoteFiles.value.filter(f => selectedRemoteKeys.value.includes(f.path))
)
const remotePanelStyle = computed(() => ({
  flex: showLocalPanel.value ? `0 0 ${100 - panelWidth.value}%` : '1'
}))

// 表格列定义
const fileColumns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    ellipsis: true,
    sorter: (a: any, b: any) => a.name.localeCompare(b.name)
  },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
    width: 100,
    customRender: ({ record }: any) => {
      if (record.isDir) return '-'
      return formatSize(record.size)
    }
  },
  {
    title: '修改时间',
    dataIndex: 'modTime',
    key: 'modTime',
    width: 160
  },
  {
    title: '操作',
    dataIndex: 'actions',
    key: 'actions',
    width: 80
  }
]

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i]
}

// 加载本地文件
const loadLocalFiles = async () => {
  try {
    // 使用 Electron API 获取本地文件列表
    const result = await api.getLocalFileList(localPath.value || process.env.HOME || '/')
    if (result.success) {
      localFiles.value = result.files.map((f: any) => ({
        ...f,
        key: f.path
      }))
      // 添加返回上级目录项
      if (localPath.value && localPath.value !== '/') {
        localFiles.value.unshift({
          name: '..',
          path: '..',
          isDir: true,
          size: 0,
          modTime: '',
          key: '..'
        })
      }
    }
  } catch (err) {
    console.error('Failed to load local files:', err)
  }
}

// 加载远程文件
const loadRemoteFiles = async () => {
  loading.value = true
  try {
    const result = await api.sshSftpList({ 
      path: remotePath.value || '/', 
      id: props.uuid 
    })
    
    if (Array.isArray(result) && typeof result[0] !== 'string') {
      remoteFiles.value = result.map((f: any) => ({
        ...f,
        key: f.path
      }))
      // 添加返回上级目录项
      if (remotePath.value && remotePath.value !== '/') {
        remoteFiles.value.unshift({
          name: '..',
          path: '..',
          isDir: true,
          size: 0,
          modTime: '',
          key: '..'
        })
      }
      connected.value = true
    } else {
      message.error(result[0] || '加载远程文件失败')
      connected.value = false
    }
  } catch (err: any) {
    message.error(err.message || '加载远程文件失败')
    connected.value = false
  } finally {
    loading.value = false
  }
}

// 本地文件双击事件
const onLocalDblClick = (record: any) => {
  if (record.isDir) {
    if (record.name === '..') {
      localPath.value = localPath.value.replace(/\/[^/]+\/?$/, '') || '/'
    } else {
      localPath.value = record.path
    }
    loadLocalFiles()
  }
}

// 远程文件双击事件
const onRemoteDblClick = (record: any) => {
  if (record.isDir) {
    if (record.name === '..') {
      remotePath.value = remotePath.value.replace(/\/[^/]+\/?$/, '') || '/'
    } else {
      remotePath.value = record.path
    }
    loadRemoteFiles()
  }
}

// 选择变化
const onLocalSelectionChange = (keys: string[]) => {
  selectedLocalKeys.value = keys
}
const onRemoteSelectionChange = (keys: string[]) => {
  selectedRemoteKeys.value = keys
}

// 上传选中文件
const uploadSelected = async () => {
  for (const file of selectedLocalFiles.value) {
    if (file.isDir) {
      await uploadDirectory(file)
    } else {
      await uploadFile(file)
    }
  }
  loadRemoteFiles()
}

// 上传单个文件
const uploadFile = async (file: any) => {
  const transferId = Date.now().toString()
  transfers.push({
    id: transferId,
    name: file.name,
    type: 'upload',
    progress: 0,
    status: 'active',
    speed: '0 KB/s'
  })

  try {
    const result = await api.uploadFile({
      id: props.uuid,
      remotePath: remotePath.value,
      localPath: file.path
    })
    
    const transfer = transfers.find(t => t.id === transferId)
    if (transfer) {
      transfer.progress = 100
      transfer.status = result.status === 'success' ? 'success' : 'exception'
    }
    
    if (result.status === 'success') {
      message.success(`上传成功: ${file.name}`)
    } else {
      message.error(`上传失败: ${result.message}`)
    }
  } catch (err: any) {
    const transfer = transfers.find(t => t.id === transferId)
    if (transfer) {
      transfer.status = 'exception'
    }
    message.error(`上传错误: ${err.message}`)
  }
}

// 上传目录
const uploadDirectory = async (dir: any) => {
  try {
    const result = await api.uploadDirectory({
      id: props.uuid,
      localDir: dir.path,
      remoteDir: remotePath.value
    })
    
    if (result.status === 'success') {
      message.success(`目录上传成功: ${dir.name}`)
    } else {
      message.error(`目录上传失败: ${result.message}`)
    }
  } catch (err: any) {
    message.error(`目录上传错误: ${err.message}`)
  }
}

// 下载选中文件
const downloadSelected = async () => {
  for (const file of selectedRemoteFiles.value) {
    if (!file.isDir) {
      await downloadFile(file)
    }
  }
}

// 下载单个文件
const downloadFile = async (file: any) => {
  const savePath = await api.openSaveDialog({ fileName: file.name })
  if (!savePath) return

  const transferId = Date.now().toString()
  transfers.push({
    id: transferId,
    name: file.name,
    type: 'download',
    progress: 0,
    status: 'active',
    speed: '0 KB/s'
  })

  try {
    const result = await api.downloadFile({
      id: props.uuid,
      remotePath: file.path,
      localPath: savePath
    })
    
    const transfer = transfers.find(t => t.id === transferId)
    if (transfer) {
      transfer.progress = 100
      transfer.status = result.status === 'success' ? 'success' : 'exception'
    }
    
    if (result.status === 'success') {
      message.success(`下载成功: ${file.name}`)
    } else {
      message.error(`下载失败: ${result.message}`)
    }
  } catch (err: any) {
    const transfer = transfers.find(t => t.id === transferId)
    if (transfer) {
      transfer.status = 'exception'
    }
    message.error(`下载错误: ${err.message}`)
  }
}

// 删除文件
const deleteFile = (file: any) => {
  Modal.confirm({
    title: '确认删除',
    icon: h(ExclamationCircleOutlined),
    content: `确定要删除 "${file.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const result = await api.deleteFile({
          id: props.uuid,
          remotePath: file.path
        })
        
        if (result.status === 'success') {
          message.success('删除成功')
          loadRemoteFiles()
        } else {
          message.error(`删除失败: ${result.message}`)
        }
      } catch (err: any) {
        message.error(`删除错误: ${err.message}`)
      }
    }
  })
}

// 刷新所有
const refreshAll = () => {
  loadLocalFiles()
  loadRemoteFiles()
}

// 切换本地面板显示
const toggleLocalPanel = () => {
  showLocalPanel.value = !showLocalPanel.value
}

// 清除已完成的传输
const clearCompleted = () => {
  const pending = transfers.filter(t => t.status === 'active')
  transfers.length = 0
  transfers.push(...pending)
}

// 拖拽调整面板大小
let isResizing = false
const startResize = (e: MouseEvent) => {
  isResizing = true
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

const onResize = (e: MouseEvent) => {
  if (!isResizing) return
  const container = document.querySelector('.sftp-panels') as HTMLElement
  if (container) {
    const rect = container.getBoundingClientRect()
    const percent = ((e.clientX - rect.left) / rect.width) * 100
    panelWidth.value = Math.min(80, Math.max(20, percent))
  }
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// 初始化
onMounted(() => {
  // 获取用户主目录
  localPath.value = process.env.HOME || process.env.USERPROFILE || '/'
  loadLocalFiles()
  loadRemoteFiles()
})

defineExpose({
  refresh: refreshAll,
  loadRemoteFiles
})
</script>

<style lang="less" scoped>
.sftp-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-color);
  color: var(--text-color);
}

.sftp-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-secondary);
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  &.connected {
    background-color: #52c41a;
  }
  
  &.disconnected {
    background-color: #ff4d4f;
  }
}

.sftp-panels {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  overflow: hidden;
}

.local-panel {
  flex: 0 0 50%;
  border-right: 1px solid var(--border-color);
}

.remote-panel {
  flex: 1;
}

.panel-divider {
  width: 6px;
  background-color: var(--border-color);
  cursor: col-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: var(--primary-color);
  }
  
  .divider-icon {
    transform: rotate(90deg);
    color: var(--text-color-secondary);
  }
}

.panel-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color-secondary);
}

.panel-title {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.path-input {
  background-color: var(--bg-color);
}

.panel-content {
  flex: 1;
  overflow: auto;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
  
  .folder-icon {
    color: #1890ff;
  }
  
  .file-icon {
    color: var(--text-color-tertiary);
  }
  
  .link-icon {
    color: #ff8300;
  }
}

.transfer-panel {
  border-top: 1px solid var(--border-color);
  max-height: 150px;
  overflow: auto;
}

.transfer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-color-secondary);
  font-weight: 500;
}

.transfer-list {
  padding: 8px 12px;
}

.transfer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.transfer-name {
  flex: 0 0 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-speed {
  flex: 0 0 80px;
  text-align: right;
  font-size: 12px;
  color: var(--text-color-secondary);
}

:deep(.ant-table) {
  background-color: var(--bg-color);
  
  .ant-table-thead > tr > th {
    background-color: var(--bg-color-secondary);
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .ant-table-tbody > tr > td {
    background-color: var(--bg-color);
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
  }
  
  .ant-table-tbody > tr:hover > td {
    background-color: var(--bg-color-secondary);
  }
}
</style>
