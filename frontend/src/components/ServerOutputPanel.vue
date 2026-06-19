<script setup lang="ts">
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import { CaretBottom, CaretRight, CircleCheck, CircleClose, Delete } from '@element-plus/icons-vue';
import type { CommandOutput } from '../types';

interface Props {
  serverId: string;
  serverName: string;
  outputs: CommandOutput[];
  connected: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'clear', serverId: string): void;
}>();

const collapsed = ref(false);
const outputContainer = ref<HTMLElement | null>(null);

const connectedServers = computed(() => {
  return props.connected;
});

watch(
  () => props.outputs.length,
  async () => {
    await nextTick();
    if (outputContainer.value && !collapsed.value) {
      outputContainer.value.scrollTop = outputContainer.value.scrollHeight;
    }
  }
);

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
};

const handleClear = () => {
  emit('clear', props.serverId);
};

const getOutputClass = (type: string) => {
  switch (type) {
    case 'stdout':
      return 'output-stdout';
    case 'stderr':
      return 'output-stderr';
    case 'error':
      return 'output-error';
    case 'exit':
      return 'output-exit';
    default:
      return '';
  }
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>

<template>
  <div class="server-panel" :class="{ 'panel-collapsed': collapsed }">
    <div class="panel-header" @click="toggleCollapse">
      <div class="header-left">
        <el-icon class="collapse-icon">
          <component :is="collapsed ? CaretRight : CaretBottom" />
        </el-icon>
        <el-icon class="status-icon" :class="connectedServers ? 'status-online' : 'status-offline'">
          <component :is="connectedServers ? CircleCheck : CircleClose" />
        </el-icon>
        <span class="server-name">{{ serverName }}</span>
        <el-tag
          :type="connectedServers ? 'success' : 'danger'"
          size="small"
          effect="dark"
        >
          {{ connectedServers ? '已连接' : '未连接' }}
        </el-tag>
        <span class="output-count" v-if="outputs.length > 0">
          {{ outputs.length }} 条输出
        </span>
      </div>
      <div class="header-right">
        <el-button
          size="small"
          text
          :icon="Delete"
          @click.stop="handleClear"
          title="清空输出"
        >
          清空
        </el-button>
      </div>
    </div>
    
    <div class="panel-body" v-show="!collapsed">
      <div class="output-container" ref="outputContainer">
        <div
          v-for="(output, index) in outputs"
          :key="index"
          class="output-line"
          :class="getOutputClass(output.type)"
        >
          <span class="output-time">[{{ formatTime(output.timestamp) }}]</span>
          <span class="output-content">{{ output.data }}</span>
        </div>
        <div v-if="outputs.length === 0" class="no-output">
          暂无输出，执行命令后结果将显示在这里
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.server-panel {
  background: #181825;
  border: 1px solid #313244;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.server-panel:hover {
  border-color: #45475a;
}

.panel-collapsed {
  margin-bottom: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1e1e2e;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collapse-icon {
  color: #6c7086;
  transition: transform 0.2s;
}

.status-icon {
  font-size: 16px;
}

.status-online {
  color: #a6e3a1;
}

.status-offline {
  color: #f38ba8;
}

.server-name {
  font-weight: 600;
  color: #cdd6f4;
  font-size: 15px;
}

.output-count {
  color: #6c7086;
  font-size: 13px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-body {
  border-top: 1px solid #313244;
}

.output-container {
  max-height: 300px;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.output-container::-webkit-scrollbar {
  width: 8px;
}

.output-container::-webkit-scrollbar-track {
  background: #181825;
}

.output-container::-webkit-scrollbar-thumb {
  background: #45475a;
  border-radius: 4px;
}

.output-container::-webkit-scrollbar-thumb:hover {
  background: #585b70;
}

.output-line {
  margin-bottom: 4px;
  word-break: break-all;
  white-space: pre-wrap;
}

.output-time {
  color: #6c7086;
  margin-right: 8px;
}

.output-stdout .output-content {
  color: #cdd6f4;
}

.output-stderr .output-content {
  color: #fab387;
}

.output-error .output-content {
  color: #f38ba8;
}

.output-exit .output-content {
  color: #a6e3a1;
  font-style: italic;
}

.no-output {
  color: #6c7086;
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}
</style>
