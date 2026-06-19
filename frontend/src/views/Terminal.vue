<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Setting, Link, Close, Refresh, Delete, Operation, Monitor } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { terminalSocket } from '../socket';
import ServerOutputPanel from '../components/ServerOutputPanel.vue';
import type { Server, CommandOutput, ServerOutput } from '../types';

const router = useRouter();

const commandInput = ref('');
const commandHistory = ref<string[]>([]);
const historyIndex = ref(-1);
const isExecuting = ref(false);
const servers = ref<Server[]>([]);
const inputRef = ref<HTMLInputElement | null>(null);
const commandsContainer = ref<HTMLElement | null>(null);

const serverOutputs = reactive<Map<string, ServerOutput>>(new Map());

const commandHistoryList = [
  'df -h',
  'uptime',
  'free -h',
  'top -bn1 | head -20',
  'ps aux | head -10',
  'netstat -tulpn | head -10',
  'uname -a',
  'whoami',
  'pwd',
  'ls -la',
];

const sortedServers = computed(() => {
  return [...servers.value].sort((a, b) => {
    if (a.connected !== b.connected) {
      return a.connected ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
});

const connectedCount = computed(() => {
  return servers.value.filter((s) => s.connected).length;
});

const handleServers = (data: Server[]) => {
  servers.value = data;
  updateServerOutputs(data);
};

const handleServersUpdate = (data: Server[]) => {
  servers.value = data;
  updateServerOutputs(data);
};

const updateServerOutputs = (serverList: Server[]) => {
  for (const server of serverList) {
    if (!serverOutputs.has(server.id)) {
      serverOutputs.set(server.id, {
        serverId: server.id,
        serverName: server.name,
        outputs: [],
        connected: server.connected,
      });
    } else {
      const existing = serverOutputs.get(server.id)!;
      existing.serverName = server.name;
      existing.connected = server.connected;
    }
  }

  for (const [id] of serverOutputs) {
    if (!serverList.find((s) => s.id === id)) {
      serverOutputs.delete(id);
    }
  }
};

const handleOutput = (output: CommandOutput) => {
  if (!serverOutputs.has(output.serverId)) {
    serverOutputs.set(output.serverId, {
      serverId: output.serverId,
      serverName: output.serverName,
      outputs: [],
      connected: true,
    });
  }
  const serverOut = serverOutputs.get(output.serverId)!;
  serverOut.outputs.push(output);
};

const handleCommandStart = (data: { command: string; serverCount: number }) => {
  isExecuting.value = true;
  ElMessage.info(`正在执行命令: ${data.command}，共 ${data.serverCount} 台服务器`);
};

const handleCommandComplete = () => {
  isExecuting.value = false;
  ElMessage.success('命令执行完成');
};

const handleError = (data: { message: string }) => {
  ElMessage.error(data.message);
};

onMounted(() => {
  terminalSocket.on('servers', handleServers);
  terminalSocket.on('servers-update', handleServersUpdate);
  terminalSocket.on('output', handleOutput);
  terminalSocket.on('command-start', handleCommandStart);
  terminalSocket.on('command-complete', handleCommandComplete);
  terminalSocket.on('error', handleError);

  if (terminalSocket.isConnected()) {
    terminalSocket.getServers();
  }

  nextTick(() => {
    inputRef.value?.focus();
  });
});

onUnmounted(() => {
  terminalSocket.off('servers', handleServers);
  terminalSocket.off('servers-update', handleServersUpdate);
  terminalSocket.off('output', handleOutput);
  terminalSocket.off('command-start', handleCommandStart);
  terminalSocket.off('command-complete', handleCommandComplete);
  terminalSocket.off('error', handleError);
});

const executeCommand = () => {
  const command = commandInput.value.trim();
  if (!command) return;

  if (connectedCount.value === 0) {
    ElMessage.warning('没有已连接的服务器，请先连接至少一台服务器');
    return;
  }

  if (commandHistory.value[commandHistory.value.length - 1] !== command) {
    commandHistory.value.push(command);
  }
  historyIndex.value = commandHistory.value.length;

  terminalSocket.executeCommand(command);
  commandInput.value = '';
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    executeCommand();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex.value > 0) {
      historyIndex.value--;
      commandInput.value = commandHistory.value[historyIndex.value] || '';
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex.value < commandHistory.value.length - 1) {
      historyIndex.value++;
      commandInput.value = commandHistory.value[historyIndex.value] || '';
    } else {
      historyIndex.value = commandHistory.value.length;
      commandInput.value = '';
    }
  } else if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    clearAllOutputs();
  }
};

const useHistoryCommand = (cmd: string) => {
  commandInput.value = cmd;
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const goToServers = () => {
  router.push('/servers');
};

const handleConnectAll = () => {
  terminalSocket.connectAll();
};

const handleDisconnectAll = () => {
  terminalSocket.disconnectAll();
};

const clearAllOutputs = () => {
  for (const [, output] of serverOutputs) {
    output.outputs = [];
  }
};

const clearServerOutput = (serverId: string) => {
  const output = serverOutputs.get(serverId);
  if (output) {
    output.outputs = [];
  }
};

const refreshServers = () => {
  terminalSocket.getServers();
};

const focusInput = () => {
  inputRef.value?.focus();
};
</script>

<template>
  <div class="terminal-page" @click="focusInput">
    <div class="header">
      <div class="header-left">
        <Monitor class="logo-icon" />
        <h1>SSH 集群管理终端</h1>
        <el-tag type="success" effect="dark" class="connection-tag">
          已连接 {{ connectedCount }} / {{ servers.length }} 台
        </el-tag>
      </div>
      <div class="header-right">
        <el-button :icon="Refresh" @click="refreshServers" title="刷新服务器列表">
          刷新
        </el-button>
        <el-button type="primary" :icon="Link" @click="handleConnectAll">
          全部连接
        </el-button>
        <el-button :icon="Close" @click="handleDisconnectAll">
          全部断开
        </el-button>
        <el-button :icon="Delete" @click="clearAllOutputs" title="清空所有输出 (Ctrl+L)">
          清屏
        </el-button>
        <el-button type="success" :icon="Setting" @click="goToServers">
          服务器管理
        </el-button>
      </div>
    </div>

    <div class="main-content">
      <div class="sidebar">
        <div class="sidebar-title">
          <span>快捷命令</span>
        </div>
        <div class="quick-commands">
          <el-button
            v-for="cmd in commandHistoryList"
            :key="cmd"
            size="small"
            :icon="Operation"
            @click.stop="useHistoryCommand(cmd)"
            class="quick-cmd-btn"
          >
            {{ cmd }}
          </el-button>
        </div>
      </div>

      <div class="output-area" ref="commandsContainer">
        <ServerOutputPanel
          v-for="server in sortedServers"
          :key="server.id"
          :server-id="server.id"
          :server-name="server.name"
          :outputs="serverOutputs.get(server.id)?.outputs || []"
          :connected="server.connected"
          @clear="clearServerOutput"
        />

        <div v-if="servers.length === 0" class="empty-state">
          <el-icon size="64" color="#6c7086">
            <Monitor />
          </el-icon>
          <h3>暂无服务器</h3>
          <p>请先在服务器管理中添加服务器</p>
          <el-button type="primary" :icon="Setting" @click="goToServers">
            去添加服务器
          </el-button>
        </div>
      </div>
    </div>

    <div class="command-input-area">
      <div class="input-wrapper">
        <span class="prompt">$</span>
        <el-input
          ref="inputRef"
          v-model="commandInput"
          placeholder="输入命令，按 Enter 执行，支持上下键切换历史命令..."
          @keydown="handleKeyDown"
          :disabled="isExecuting"
          class="command-input"
        />
        <el-button
          type="primary"
          :icon="Operation"
          @click="executeCommand"
          :disabled="!commandInput.trim() || isExecuting"
          :loading="isExecuting"
        >
          {{ isExecuting ? '执行中...' : '执行' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.terminal-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 30px;
  background: #181825;
  border-bottom: 1px solid #313244;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-icon {
  font-size: 28px;
  color: #89b4fa;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  color: #cdd6f4;
  margin: 0;
}

.connection-tag {
  margin-left: 8px;
}

.header-right {
  display: flex;
  gap: 10px;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  background: #181825;
  border-right: 1px solid #313244;
  padding: 16px;
  overflow-y: auto;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #bac2de;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.quick-commands {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-cmd-btn {
  justify-content: flex-start;
  text-align: left;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 8px 12px;
}

:deep(.quick-cmd-btn .el-button__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.output-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.output-area::-webkit-scrollbar {
  width: 10px;
}

.output-area::-webkit-scrollbar-track {
  background: #1e1e2e;
}

.output-area::-webkit-scrollbar-thumb {
  background: #45475a;
  border-radius: 5px;
}

.output-area::-webkit-scrollbar-thumb:hover {
  background: #585b70;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c7086;
  gap: 16px;
}

.empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: #bac2de;
}

.empty-state p {
  margin: 0;
}

.command-input-area {
  padding: 16px 20px;
  background: #181825;
  border-top: 1px solid #313244;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.prompt {
  color: #a6e3a1;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 16px;
  font-weight: 600;
}

.command-input {
  flex: 1;
}

:deep(.command-input .el-input__wrapper) {
  --el-input-bg-color: #1e1e2e;
  --el-input-text-color: #cdd6f4;
  --el-input-placeholder-color: #6c7086;
  --el-input-border-color: #45475a;
  --el-input-focus-border-color: #89b4fa;
  background-color: #1e1e2e;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:deep(.command-input .el-input__wrapper:hover) {
  --el-input-border-color: #585b70;
}

:deep(.command-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px rgba(137, 180, 250, 0.2), 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
