<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  VideoPlay,
  CircleCheck,
  CircleClose,
  Right,
  Document,
  ArrowDown,
  ArrowRight,
  Delete,
} from '@element-plus/icons-vue';
import type { TimelineItem, CommandOutput } from '../types';

const props = defineProps<{
  items: TimelineItem[];
  activeTaskId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
}>();

const scrollRef = ref<HTMLElement | null>(null);
const expandedItems = ref<Set<string>>(new Set());

const groupedTimeline = computed(() => {
  const groups: Array<{
    taskId: string;
    taskName: string;
    startTime: number;
    endTime?: number;
    success?: boolean;
    items: TimelineItem[];
    isActive: boolean;
  }> = [];

  for (const item of props.items) {
    const existingGroup = groups.find((g) => g.taskId === item.taskId);
    if (existingGroup) {
      existingGroup.items.push(item);
      if (item.type === 'task-complete') {
        existingGroup.endTime = item.timestamp;
        existingGroup.success = item.success;
      }
    } else {
      groups.push({
        taskId: item.taskId,
        taskName: item.taskName,
        startTime: item.timestamp,
        endTime: item.type === 'task-complete' ? item.timestamp : undefined,
        success: item.type === 'task-complete' ? item.success : undefined,
        items: [item],
        isActive: item.taskId === props.activeTaskId,
      });
    }
  }

  return groups.sort((a, b) => b.startTime - a.startTime);
});

const formatTime = (timestamp: number) => {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDuration = (start: number, end?: number) => {
  if (!end) return '执行中...';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
};

const toggleExpand = (id: string) => {
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id);
  } else {
    expandedItems.value.add(id);
  }
};

const getOutputColor = (type: string) => {
  switch (type) {
    case 'stdout':
      return '#cdd6f4';
    case 'stderr':
      return '#fab387';
    case 'error':
      return '#f38ba8';
    case 'exit':
      return '#a6e3a1';
    case 'system':
      return '#94e2d5';
    default:
      return '#cdd6f4';
  }
};

watch(
  () => props.items.length,
  () => {
    nextTick(() => {
      if (scrollRef.value) {
        scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
      }
    });
  }
);
</script>

<template>
  <div class="task-timeline">
    <div class="timeline-header">
      <h3>任务时间线</h3>
      <div class="header-actions">
        <span class="item-count">共 {{ groupedTimeline.length }} 个任务 / {{ items.length }} 条记录</span>
        <el-button
          size="small"
          :icon="Delete"
          @click="emit('clear')"
          :disabled="items.length === 0"
        >
          清空
        </el-button>
      </div>
    </div>

    <div class="timeline-scroll" ref="scrollRef">
      <div v-if="groupedTimeline.length === 0" class="empty">
        <el-icon :size="48" color="#6c7086">
          <Document />
        </el-icon>
        <p>暂无任务执行记录</p>
        <p class="hint">在任务管理页面创建并执行任务</p>
      </div>

      <div
        v-for="group in groupedTimeline"
        :key="group.taskId"
        class="task-group"
        :class="{ 'is-active': group.isActive }"
      >
        <div
          class="task-group-header"
          @click="toggleExpand(group.taskId)"
        >
          <el-icon class="expand-icon">
            <ArrowDown v-if="expandedItems.has(group.taskId)" />
            <ArrowRight v-else />
          </el-icon>
          <div class="task-status-icon">
            <el-icon v-if="group.isActive" class="running">
              <VideoPlay />
            </el-icon>
            <el-icon v-else-if="group.success === true" class="success">
              <CircleCheck />
            </el-icon>
            <el-icon v-else-if="group.success === false" class="failed">
              <CircleClose />
            </el-icon>
            <el-icon v-else class="pending">
              <Document />
            </el-icon>
          </div>
          <div class="task-info">
            <div class="task-name">
              {{ group.taskName }}
              <el-tag
                v-if="group.isActive"
                type="primary"
                size="small"
                effect="dark"
              >
                运行中
              </el-tag>
              <el-tag
                v-else-if="group.success === true"
                type="success"
                size="small"
              >
                成功
              </el-tag>
              <el-tag
                v-else-if="group.success === false"
                type="danger"
                size="small"
              >
                失败
              </el-tag>
            </div>
            <div class="task-meta">
              <span>{{ formatTime(group.startTime) }}</span>
              <span>·</span>
              <span>{{ formatDuration(group.startTime, group.endTime) }}</span>
              <span>·</span>
              <span>{{ group.items.length }} 条事件</span>
            </div>
          </div>
        </div>

        <div v-show="expandedItems.has(group.taskId)" class="timeline-items">
          <div
            v-for="(item, index) in group.items"
            :key="item.id"
            class="timeline-node"
            :class="[item.type, `depth-${Math.min((item.commandOrder ?? 0), 5)}`]"
          >
            <div class="node-dot" />
            <div class="node-content">
              <div class="node-header">
                <span class="node-time">{{ formatTime(item.timestamp) }}</span>
                <span class="node-type-tag">{{ getNodeTypeLabel(item.type) }}</span>
                <span v-if="item.commandOrder !== undefined" class="command-order">
                  命令 #{{ item.commandOrder + 1 }}
                </span>
              </div>

              <div
                v-if="item.type === 'task-start'"
                class="node-body task-start-body"
              >
                <el-icon :size="16" class="running">
                  <VideoPlay />
                </el-icon>
                <span>任务开始执行</span>
                <span class="meta-hint">
                  (共 {{ item.extra?.totalCommands ?? 0 }} 条命令,
                  {{ item.extra?.totalServers ?? 0 }} 台服务器)
                </span>
              </div>

              <div
                v-else-if="item.type === 'task-complete'"
                class="node-body task-complete-body"
                :class="{ success: item.success, failed: !item.success }"
              >
                <el-icon :size="16" :class="item.success ? 'success' : 'failed'">
                  <CircleCheck v-if="item.success" />
                  <CircleClose v-else />
                </el-icon>
                <span>任务{{ item.success ? '执行成功' : '执行失败' }}</span>
                <span class="meta-hint">
                  (完成 {{ item.extra?.completedCommands ?? 0 }}/{{ item.extra?.totalCommands ?? 0 }},
                  失败 {{ item.extra?.failedCommands ?? 0 }})
                </span>
              </div>

              <div
                v-else-if="item.type === 'command-start'"
                class="node-body command-start-body"
              >
                <el-icon :size="16" class="running">
                  <Right />
                </el-icon>
                <span class="command-label" v-if="item.label">
                  {{ item.label }}:
                </span>
                <code class="command-text">{{ item.command }}</code>
              </div>

              <div
                v-else-if="item.type === 'command-complete'"
                class="node-body command-complete-body"
                :class="{ success: item.success, failed: !item.success }"
              >
                <el-icon :size="16" :class="item.success ? 'success' : 'failed'">
                  <CircleCheck v-if="item.success" />
                  <CircleClose v-else />
                </el-icon>
                <code class="command-text">{{ item.command }}</code>
                <span class="meta-hint">
                  (成功 {{ item.extra?.successServers ?? 0 }}/{{ item.extra?.totalServers ?? 0 }},
                  失败 {{ item.extra?.failedServers ?? 0 }})
                </span>
              </div>

              <div
                v-else-if="item.type === 'output' && item.output"
                class="node-body output-body"
              >
                <div class="output-header">
                  <span class="output-server">
                    <strong>{{ item.output.serverName }}</strong>
                  </span>
                  <el-tag
                    size="small"
                    :type="getOutputTagType(item.output.type)"
                  >
                    {{ item.output.type }}
                  </el-tag>
                </div>
                <pre
                  class="output-text"
                  :style="{ color: getOutputColor(item.output.type) }"
                >{{ item.output.data }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
function getNodeTypeLabel(type: string): string {
  switch (type) {
    case 'task-start':
      return '任务开始';
    case 'task-complete':
      return '任务结束';
    case 'command-start':
      return '命令开始';
    case 'command-complete':
      return '命令结束';
    case 'output':
      return '输出';
    default:
      return type;
  }
}

function getOutputTagType(type: string) {
  switch (type) {
    case 'stdout':
      return 'info';
    case 'stderr':
      return 'warning';
    case 'error':
      return 'danger';
    case 'exit':
      return 'success';
    default:
      return '';
  }
}

export default {
  methods: {
    getNodeTypeLabel,
    getOutputTagType,
  },
};
</script>

<style scoped>
.task-timeline {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #181825;
  border-radius: 8px;
  overflow: hidden;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
  flex-shrink: 0;
}

.timeline-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #cdd6f4;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-count {
  font-size: 12px;
  color: #6c7086;
}

.timeline-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #6c7086;
  gap: 8px;
}

.empty p {
  margin: 0;
}

.empty .hint {
  font-size: 13px;
  color: #45475a;
}

.task-group {
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.task-group.is-active {
  border-color: #89b4fa;
  box-shadow: 0 0 0 2px rgba(137, 180, 250, 0.15);
}

.task-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: background 0.15s;
  user-select: none;
}

.task-group-header:hover {
  background: #313244;
}

.expand-icon {
  color: #6c7086;
  transition: transform 0.15s;
}

.task-status-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-status-icon .running {
  color: #89b4fa;
  animation: pulse 1.5s infinite;
}

.task-status-icon .success {
  color: #a6e3a1;
}

.task-status-icon .failed {
  color: #f38ba8;
}

.task-status-icon .pending {
  color: #6c7086;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 14px;
  font-weight: 600;
  color: #cdd6f4;
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-meta {
  font-size: 12px;
  color: #6c7086;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.timeline-items {
  padding: 8px 14px 14px 30px;
  border-top: 1px solid #313244;
}

.timeline-node {
  position: relative;
  padding: 0 0 14px 20px;
}

.timeline-node:last-child {
  padding-bottom: 0;
}

.timeline-node::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 8px;
  bottom: -6px;
  width: 2px;
  background: #313244;
}

.timeline-node:last-child::before {
  display: none;
}

.node-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6c7086;
  border: 2px solid #1e1e2e;
  z-index: 1;
}

.timeline-node.task-start .node-dot {
  background: #89b4fa;
}

.timeline-node.task-complete .node-dot {
  background: #a6e3a1;
}

.timeline-node.command-start .node-dot {
  background: #89dceb;
}

.timeline-node.command-complete .node-dot {
  background: #a6e3a1;
}

.timeline-node.command-complete.failed .node-dot,
.timeline-node.task-complete.failed .node-dot {
  background: #f38ba8;
}

.timeline-node.output .node-dot {
  background: #cba6f7;
  width: 8px;
  height: 8px;
  left: 1px;
  top: 5px;
}

.node-content {
  min-width: 0;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
}

.node-time {
  color: #6c7086;
  font-family: monospace;
}

.node-type-tag {
  padding: 1px 6px;
  border-radius: 3px;
  background: #313244;
  color: #bac2de;
  font-size: 10px;
}

.timeline-node.task-start .node-type-tag {
  background: rgba(137, 180, 250, 0.15);
  color: #89b4fa;
}

.timeline-node.task-complete .node-type-tag {
  background: rgba(166, 227, 161, 0.15);
  color: #a6e3a1;
}

.timeline-node.task-complete.failed .node-type-tag {
  background: rgba(243, 139, 168, 0.15);
  color: #f38ba8;
}

.timeline-node.command-start .node-type-tag {
  background: rgba(137, 220, 235, 0.15);
  color: #89dceb;
}

.timeline-node.command-complete .node-type-tag {
  background: rgba(166, 227, 161, 0.15);
  color: #a6e3a1;
}

.timeline-node.output .node-type-tag {
  background: rgba(203, 166, 247, 0.15);
  color: #cba6f7;
}

.command-order {
  color: #f9e2af;
  font-weight: 600;
}

.node-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #bac2de;
  line-height: 1.5;
}

.node-body .running { color: #89b4fa; }
.node-body .success { color: #a6e3a1; }
.node-body .failed { color: #f38ba8; }

.command-label {
  font-weight: 600;
  color: #89dceb;
}

.command-text {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  background: #181825;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #f5e0dc;
  word-break: break-all;
}

.meta-hint {
  color: #6c7086;
  font-size: 12px;
}

.output-body {
  flex-direction: column;
  gap: 6px;
}

.output-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.output-server {
  color: #f9e2af;
  font-size: 12px;
}

.output-text {
  margin: 0;
  background: #181825;
  border: 1px solid #313244;
  border-radius: 4px;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

:deep(.el-tag) {
  font-size: 10px;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
}
</style>
