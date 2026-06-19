<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Edit,
  Delete,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  DocumentCopy,
  VideoPlay,
  List,
} from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { tasksApi } from '../api';
import { terminalSocket } from '../socket';
import type { Task, TaskCommand, CreateTaskCommandDto } from '../types';

const router = useRouter();
const tasks = ref<Task[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingTask = ref<Task | null>(null);

const formData = reactive({
  name: '',
  description: '',
  stopOnError: false,
  commands: [] as (CreateTaskCommandDto & { _id?: string })[],
});

const newCommand = reactive({
  command: '',
  label: '',
  timeout: 0,
});

const handleTasks = (data: Task[]) => {
  tasks.value = data;
};

onMounted(() => {
  loadTasks();
  terminalSocket.on('tasks', handleTasks);
});

onUnmounted(() => {
  terminalSocket.off('tasks', handleTasks);
});

const loadTasks = async () => {
  loading.value = true;
  try {
    const res = await tasksApi.getAll();
    tasks.value = res.data;
  } catch (err: any) {
    ElMessage.error(err.message || '加载任务列表失败');
  } finally {
    loading.value = false;
  }
};

const openAddDialog = () => {
  editingTask.value = null;
  formData.name = '';
  formData.description = '';
  formData.stopOnError = false;
  formData.commands = [
    { order: 0, command: 'df -h', label: '磁盘检查', timeout: 0 },
    { order: 1, command: 'free -h', label: '内存检查', timeout: 0 },
    { order: 2, command: 'uptime', label: '负载检查', timeout: 0 },
  ];
  dialogVisible.value = true;
};

const openEditDialog = (task: Task) => {
  editingTask.value = task;
  formData.name = task.name;
  formData.description = task.description || '';
  formData.stopOnError = task.stopOnError;
  formData.commands = task.commands
    .sort((a, b) => a.order - b.order)
    .map((cmd) => ({
      _id: cmd.id,
      order: cmd.order,
      command: cmd.command,
      label: cmd.label || '',
      timeout: cmd.timeout,
    }));
  dialogVisible.value = true;
};

const addCommand = () => {
  if (!newCommand.command.trim()) {
    ElMessage.warning('请输入命令');
    return;
  }
  formData.commands.push({
    order: formData.commands.length,
    command: newCommand.command.trim(),
    label: newCommand.label.trim() || undefined,
    timeout: newCommand.timeout || 0,
  });
  newCommand.command = '';
  newCommand.label = '';
  newCommand.timeout = 0;
};

const removeCommand = (index: number) => {
  formData.commands.splice(index, 1);
  formData.commands.forEach((cmd, i) => {
    cmd.order = i;
  });
};

const moveCommand = (index: number, direction: 'up' | 'down') => {
  if (direction === 'up' && index === 0) return;
  if (direction === 'down' && index === formData.commands.length - 1) return;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const temp = formData.commands[index];
  formData.commands[index] = formData.commands[targetIndex];
  formData.commands[targetIndex] = temp;
  formData.commands.forEach((cmd, i) => {
    cmd.order = i;
  });
};

const handleSubmit = async () => {
  if (!formData.name.trim()) {
    ElMessage.warning('请输入任务名称');
    return;
  }
  if (formData.commands.length === 0) {
    ElMessage.warning('请至少添加一条命令');
    return;
  }

  const submitData = {
    name: formData.name.trim(),
    description: formData.description.trim() || undefined,
    stopOnError: formData.stopOnError,
    commands: formData.commands.sort((a, b) => a.order - b.order).map((cmd) => ({
      order: cmd.order,
      command: cmd.command,
      label: cmd.label || undefined,
      timeout: cmd.timeout || 0,
    })),
  };

  try {
    if (editingTask.value) {
      await tasksApi.update(editingTask.value.id, submitData);
      ElMessage.success('更新成功');
    } else {
      await tasksApi.create(submitData);
      ElMessage.success('创建成功');
    }
    dialogVisible.value = false;
    loadTasks();
    terminalSocket.getTasks();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || err.message || '操作失败');
  }
};

const handleDelete = async (task: Task) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务 "${task.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await tasksApi.remove(task.id);
    ElMessage.success('删除成功');
    loadTasks();
    terminalSocket.getTasks();
  } catch {
    // User cancelled
  }
};

const handleExecute = (task: Task) => {
  if (task.commands.length === 0) {
    ElMessage.warning('该任务没有命令');
    return;
  }
  terminalSocket.executeTask(task.id);
  ElMessage.success(`任务已开始执行: ${task.name}`);
  router.push('/');
};

const goToTerminal = () => {
  router.push('/');
};

const getStatusTagType = (status?: string) => {
  switch (status) {
    case 'success':
      return 'success';
    case 'failed':
      return 'danger';
    case 'running':
      return 'primary';
    default:
      return 'info';
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'success':
      return '成功';
    case 'failed':
      return '失败';
    case 'running':
      return '运行中';
    default:
      return '未执行';
  }
};
</script>

<template>
  <div class="tasks-page">
    <div class="header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goToTerminal">
          返回终端
        </el-button>
        <h1>组合命令任务</h1>
      </div>
      <div class="header-right">
        <el-button type="success" :icon="Plus" @click="openAddDialog">
          创建任务
        </el-button>
      </div>
    </div>

    <div class="content">
      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="name" label="任务名称" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.description">{{ row.description }}</span>
            <span class="text-muted" v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="命令数" width="100">
          <template #default="{ row }">
            <el-tag type="primary" effect="dark">{{ row.commands?.length || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.lastExecutionStatus)" effect="dark">
              {{ getStatusText(row.lastExecutionStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="失败停止" width="100">
          <template #default="{ row }">
            <el-tag :type="row.stopOnError ? 'danger' : 'success'" size="small">
              {{ row.stopOnError ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近执行" min-width="180">
          <template #default="{ row }">
            <span v-if="row.lastExecutionAt">{{ new Date(row.lastExecutionAt).toLocaleString() }}</span>
            <span class="text-muted" v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :icon="VideoPlay"
              @click="handleExecute(row)"
            >
              执行
            </el-button>
            <el-button size="small" :icon="Edit" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button size="small" type="danger" :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="tasks.length === 0 && !loading" class="empty-state">
        <el-icon size="64" color="#6c7086">
          <List />
        </el-icon>
        <h3>暂无任务</h3>
        <p>创建一个组合命令任务，一键执行多条命令</p>
        <el-button type="success" :icon="Plus" @click="openAddDialog">
          创建第一个任务
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingTask ? '编辑任务' : '创建任务'"
      width="800px"
    >
      <el-form label-width="100px">
        <el-form-item label="任务名称" required>
          <el-input v-model="formData.name" placeholder="任务名称，例如：健康检查" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="formData.description" placeholder="任务描述（可选）" />
        </el-form-item>
        <el-form-item label="失败停止">
          <el-switch v-model="formData.stopOnError">
            <template #active>开启</template>
            <template #inactive>关闭</template>
          </el-switch>
          <span class="form-tip">开启后，某条命令执行失败则停止后续命令</span>
        </el-form-item>

        <el-form-item label="命令编排" required>
          <div class="command-editor">
            <div class="command-list">
              <div
                v-for="(cmd, index) in formData.commands"
                :key="index"
                class="command-item"
              >
                <div class="command-order">{{ index + 1 }}</div>
                <div class="command-content">
                  <div class="command-row">
                    <el-input
                      v-model="cmd.command"
                      placeholder="输入命令，例如：df -h"
                      size="small"
                      class="command-input"
                    />
                  </div>
                  <div class="command-options">
                    <el-input
                      v-model="cmd.label"
                      placeholder="标签（可选）"
                      size="small"
                      class="label-input"
                    />
                    <el-input-number
                      v-model="cmd.timeout"
                      :min="0"
                      :step="5"
                      size="small"
                      class="timeout-input"
                      controls-position="right"
                    >
                      <template #prepend>超时(秒)</template>
                    </el-input-number>
                  </div>
                </div>
                <div class="command-actions">
                  <el-button
                    size="small"
                    text
                    :icon="ArrowUp"
                    @click="moveCommand(index, 'up')"
                    :disabled="index === 0"
                    title="上移"
                  />
                  <el-button
                    size="small"
                    text
                    :icon="ArrowDown"
                    @click="moveCommand(index, 'down')"
                    :disabled="index === formData.commands.length - 1"
                    title="下移"
                  />
                  <el-button
                    size="small"
                    text
                    type="danger"
                    :icon="Delete"
                    @click="removeCommand(index)"
                    title="删除"
                  />
                </div>
              </div>

              <div v-if="formData.commands.length === 0" class="no-commands">
                暂无命令，请在下方添加
              </div>
            </div>

            <div class="add-command-form">
              <el-input
                v-model="newCommand.command"
                placeholder="输入命令，例如：top -bn1 | head -10"
                class="new-command-input"
                @keyup.enter="addCommand"
              />
              <el-input
                v-model="newCommand.label"
                placeholder="标签（可选）"
                class="new-label-input"
              />
              <el-button type="primary" :icon="Plus" @click="addCommand">
                添加命令
              </el-button>
            </div>

            <div class="quick-add-section">
              <span class="quick-add-label">快速添加：</span>
              <el-button
                v-for="cmd in ['df -h', 'free -h', 'uptime', 'uname -a', 'ps aux --sort=-%mem | head -10', 'netstat -tulpn | head -20']"
                :key="cmd"
                size="small"
                :icon="DocumentCopy"
                @click="newCommand.command = cmd; addCommand()"
              >
                {{ cmd }}
              </el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ editingTask ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.tasks-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e2e;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: #181825;
  border-bottom: 1px solid #313244;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h1 {
  font-size: 22px;
  font-weight: 600;
  color: #cdd6f4;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.content {
  flex: 1;
  padding: 20px 30px;
  overflow: auto;
}

.text-muted {
  color: #6c7086;
}

.form-tip {
  margin-left: 12px;
  color: #6c7086;
  font-size: 13px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
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

.command-editor {
  width: 100%;
}

.command-list {
  max-height: 350px;
  overflow-y: auto;
  margin-bottom: 16px;
  border: 1px solid #313244;
  border-radius: 8px;
  padding: 8px;
}

.command-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #181825;
  border-radius: 6px;
  margin-bottom: 8px;
}

.command-item:last-child {
  margin-bottom: 0;
}

.command-order {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #89b4fa;
  color: #1e1e2e;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4px;
}

.command-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-input {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.command-options {
  display: flex;
  gap: 12px;
}

.label-input {
  flex: 1;
}

.timeout-input {
  width: 180px;
}

.command-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.no-commands {
  text-align: center;
  padding: 30px;
  color: #6c7086;
  font-style: italic;
}

.add-command-form {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.new-command-input {
  flex: 2;
}

.new-label-input {
  flex: 1;
}

.quick-add-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-add-label {
  color: #bac2de;
  font-size: 13px;
}

:deep(.el-table) {
  --el-table-bg-color: #181825;
  --el-table-tr-bg-color: #181825;
  --el-table-header-bg-color: #1e1e2e;
  --el-table-header-text-color: #bac2de;
  --el-table-text-color: #cdd6f4;
  --el-table-border-color: #313244;
  --el-table-row-hover-bg-color: #1e1e2e;
  --el-table-striped-odd-bg-color: #1e1e2e;
}

:deep(.el-dialog) {
  --el-dialog-bg-color: #1e1e2e;
  --el-dialog-title-color: #cdd6f4;
}

:deep(.el-form-item__label) {
  color: #bac2de;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner) {
  --el-input-bg-color: #181825;
  --el-input-text-color: #cdd6f4;
  --el-input-placeholder-color: #6c7086;
  --el-input-border-color: #313244;
  background-color: #181825;
}

:deep(.el-radio__label),
:deep(.el-switch__label) {
  color: #cdd6f4;
}
</style>
