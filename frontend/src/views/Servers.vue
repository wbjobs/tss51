<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Monitor, ArrowLeft, Link, Close } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { serversApi } from '../api';
import { terminalSocket } from '../socket';
import type { Server, CreateServerDto } from '../types';

const router = useRouter();
const servers = ref<Server[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingServer = ref<Server | null>(null);

const formData = ref<CreateServerDto>({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
  privateKey: '',
  passphrase: '',
});

const authMethod = ref<'password' | 'key'>('password');

const handleServersUpdate = (data: Server[]) => {
  servers.value = data;
};

const handleServers = (data: Server[]) => {
  servers.value = data;
};

onMounted(() => {
  loadServers();
  terminalSocket.on('servers', handleServers);
  terminalSocket.on('servers-update', handleServersUpdate);
});

onUnmounted(() => {
  terminalSocket.off('servers', handleServers);
  terminalSocket.off('servers-update', handleServersUpdate);
});

const loadServers = async () => {
  loading.value = true;
  try {
    const res = await serversApi.getAll();
    servers.value = res.data;
  } catch (err: any) {
    ElMessage.error(err.message || '加载服务器列表失败');
  } finally {
    loading.value = false;
  }
};

const openAddDialog = () => {
  editingServer.value = null;
  formData.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    passphrase: '',
  };
  authMethod.value = 'password';
  dialogVisible.value = true;
};

const openEditDialog = (server: Server) => {
  editingServer.value = server;
  formData.value = {
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    password: '',
    privateKey: '',
    passphrase: '',
  };
  authMethod.value = 'password';
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (!formData.value.name || !formData.value.host || !formData.value.username) {
    ElMessage.warning('请填写必填字段');
    return;
  }

  if (authMethod.value === 'password' && !formData.value.password) {
    ElMessage.warning('请填写密码');
    return;
  }

  if (authMethod.value === 'key' && !formData.value.privateKey) {
    ElMessage.warning('请填写私钥');
    return;
  }

  const submitData = { ...formData.value };
  if (authMethod.value === 'password') {
    delete submitData.privateKey;
    delete submitData.passphrase;
  } else {
    delete submitData.password;
  }

  try {
    if (editingServer.value) {
      await serversApi.update(editingServer.value.id, submitData);
      ElMessage.success('更新成功');
    } else {
      await serversApi.create(submitData);
      ElMessage.success('添加成功');
    }
    dialogVisible.value = false;
    loadServers();
    terminalSocket.getServers();
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || err.message || '操作失败');
  }
};

const handleDelete = async (server: Server) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除服务器 "${server.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await serversApi.remove(server.id);
    ElMessage.success('删除成功');
    loadServers();
    terminalSocket.getServers();
  } catch {
    // User cancelled
  }
};

const handleConnect = (server: Server) => {
  terminalSocket.connectServer(server.id);
};

const handleDisconnect = (server: Server) => {
  terminalSocket.disconnectServer(server.id);
};

const handleConnectAll = () => {
  terminalSocket.connectAll();
};

const handleDisconnectAll = () => {
  terminalSocket.disconnectAll();
};

const goToTerminal = () => {
  router.push('/');
};
</script>

<template>
  <div class="servers-page">
    <div class="header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goToTerminal">
          返回终端
        </el-button>
        <h1>服务器管理</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" :icon="Link" @click="handleConnectAll">
          全部连接
        </el-button>
        <el-button :icon="Close" @click="handleDisconnectAll">
          全部断开
        </el-button>
        <el-button type="success" :icon="Plus" @click="openAddDialog">
          添加服务器
        </el-button>
      </div>
    </div>

    <div class="content">
      <el-table :data="servers" v-loading="loading" stripe>
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="host" label="主机地址" min-width="150">
          <template #default="{ row }">
            <span>{{ row.host }}:{{ row.port }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" min-width="100" />
        <el-table-column label="连接状态" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row.connected ? 'success' : 'danger'">
              {{ row.connected ? '已连接' : '未连接' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后错误" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="error-text" v-if="row.lastError">{{ row.lastError }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" min-width="180">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="row.connected ? 'warning' : 'primary'"
              :icon="row.connected ? Close : Link"
              @click="row.connected ? handleDisconnect(row) : handleConnect(row)"
            >
              {{ row.connected ? '断开' : '连接' }}
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
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingServer ? '编辑服务器' : '添加服务器'"
      width="600px"
    >
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="formData.name" placeholder="服务器名称" />
        </el-form-item>
        <el-form-item label="主机地址" required>
          <el-input v-model="formData.host" placeholder="例如: 192.168.1.100" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="formData.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item label="用户名" required>
          <el-input v-model="formData.username" placeholder="SSH 用户名" />
        </el-form-item>
        <el-form-item label="认证方式">
          <el-radio-group v-model="authMethod">
            <el-radio value="password">密码认证</el-radio>
            <el-radio value="key">密钥认证</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="authMethod === 'password'" label="密码" required>
          <el-input v-model="formData.password" type="password" placeholder="SSH 密码" show-password />
        </el-form-item>
        <el-form-item v-if="authMethod === 'key'" label="私钥" required>
          <el-input
            v-model="formData.privateKey"
            type="textarea"
            :rows="8"
            placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
          />
        </el-form-item>
        <el-form-item v-if="authMethod === 'key'" label="密钥密码">
          <el-input v-model="formData.passphrase" type="password" placeholder="私钥密码 (如果有)" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ editingServer ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.servers-page {
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

.error-text {
  color: #f38ba8;
}

.text-muted {
  color: #6c7086;
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
:deep(.el-textarea__inner),
:deep(.el-input-number) {
  --el-input-bg-color: #181825;
  --el-input-text-color: #cdd6f4;
  --el-input-placeholder-color: #6c7086;
  --el-input-border-color: #313244;
  background-color: #181825;
}

:deep(.el-radio__label) {
  color: #cdd6f4;
}
</style>
