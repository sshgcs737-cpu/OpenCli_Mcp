 <template>
  <div class="scene-container">
      <div class="content-area">
        <div v-if="activeMenuItem === '1-1'" class="scene-manager-container">
          <!-- 搜索和操作区域 -->
          <div class="action-header">
            <el-button v-if="canEditScenes" type="primary" @click="handleAdd">新增场景</el-button>
            <el-button v-if="false" type="danger" :disabled="!selectedRows.length" @click="handleBatchDelete"
              >批量删除</el-button
            >

            <el-form :inline="true" :model="queryForm" class="search-form">
              <el-form-item label="场景名称">
                <el-input v-model="queryForm.name" placeholder="输入场景名称" clearable />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleQuery">查询</el-button>
                <el-button @click="resetQuery">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <!-- 数据表格 -->
          <div class="table-wrapper">
          <el-table
            v-loading="loading"
            :data="sceneList"
            stripe
            border
            style="width: 100%"
            height="100%"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="50" align="center" />
            <el-table-column prop="id" label="场景ID" min-width="50" align="center" />
            <el-table-column
              prop="name"
              label="场景名称"
              min-width="100"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column prop="state" label="状态" min-width="80" align="center">
              <template #default="scope">
                <el-tag :type="getStateType(scope.row.state)">{{ getStateText(scope.row.state) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createUser" label="创建人" min-width="100" align="center" />
            <el-table-column prop="createTime" label="创建时间" min-width="150" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.createTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="updateUser" label="更新人" min-width="100" align="center" />
            <el-table-column prop="updateTime" label="更新时间" min-width="150" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.updateTime) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="200" align="center">
              <template #default="scope">
                <div class="action-buttons">
                  <el-button size="small" type="success" @click="handleLoad(scope.row)"
                    >加载</el-button
                  >
                  <el-button v-if="canEditScenes" size="small" type="primary" @click="handleEdit(scope.row)"
                    >编辑</el-button
                  >
                  <el-button v-if="canEditScenes" size="small" type="warning" @click="handleDelete(scope.row)"
                    >删除</el-button
                  >
                  <el-button size="small" type="warning" @click="handleRecordHistory(scope.row)" :icon="VideoPlay" >
                    <span>回放</span>
                  </el-button>

                  <el-button v-if="canEditScenes" size="small" type="danger" @click="foceCloseScene(scope.row.id,scope.row.state)">
                    <span>强制停止</span>
                  </el-button>


                  <el-button v-if="canEditScenes" size="small" type="primary" @click="handleCopy(scope.row)">
                    <span>克隆</span>
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          </div>

          <!-- 分页控件 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="pagination.current"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[10, 15, 20, 50]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>

          <!-- 添加/编辑场景对话框 -->
          <el-dialog
            v-model="dialog.visible"
            :title="dialog.isEdit ? '编辑场景' : dialog.isCopy ? '克隆场景' : '新增场景'"
            width="500px"
            destroy-on-close
            @closed="resetForm"
          >
          <div v-if="dialog.isCopy" class="dialog-copy-info" style="margin-bottom: 16px; color: #909399;">
              克隆自场景：<strong>{{ dialog.copySourceName }}</strong>
            </div>
            <el-form
              ref="formRef"
              :model="sceneForm"
              :rules="formRules"
              label-width="90px"
              label-position="right"
            >
              <el-form-item label="场景名称" prop="name">
                <el-input v-model="sceneForm.name" placeholder="请输入场景名称" />
              </el-form-item>
              <el-form-item label="场景类型" prop="isPublic">
                <el-radio-group v-model="sceneForm.isPublic">
                  <el-radio :label="1">公有场景</el-radio>
                  <el-radio :label="0">私有场景</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="部署方式" prop="disturb">
                <el-radio-group v-model="sceneForm.disturb" :disabled="dialog.isEdit">
                  <el-radio :label="0">单服务器场景</el-radio>
                  <el-radio :label="1" :disabled="!canCreateDistributedScene && !dialog.isEdit">
                    分布式场景
                    <el-tooltip v-if="!canCreateDistributedScene && !dialog.isEdit" content="请向管理员申请授权" placement="top">
                      <el-icon style="margin-left: 4px; cursor: pointer; color: #E6A23C;"><Warning /></el-icon>
                    </el-tooltip>
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
            <template #footer>
              <div class="dialog-footer">
                <el-button @click="dialog.visible = false">取 消</el-button>
                <el-button type="primary" @click="submitForm">确 定</el-button>
              </div>
            </template>
          </el-dialog>
        </div>

        <div v-else-if="activeMenuItem === '1-2'" class="scene-manager-container">
          <!-- 搜索和操作区域 -->
          <div class="action-header">
            <el-form :inline="true" :model="queryForm" class="search-form">
              <el-form-item label="场景名称">
                <el-input v-model="queryForm.name" placeholder="输入场景名称" clearable />
              </el-form-item>
              <!-- 只在公有场景时显示创建用户搜索 -->
              <el-form-item label="创建用户">
                <el-input v-model="queryForm.user" placeholder="输入创建用户" clearable />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleQuery">查询</el-button>
                <el-button @click="resetQuery">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <!-- 数据表格 -->
          <div class="table-wrapper">
          <el-table
            v-loading="loading"
            :data="sceneList"
            stripe
            border
            style="width: 100%"
            height="100%"
            @selection-change="handleSelectionChange"
          >
            <el-table-column prop="id" label="场景ID" min-width="80" align="center" />
            <el-table-column
              prop="name"
              label="场景名称"
              min-width="120"
              align="center"
              show-overflow-tooltip
            />
            <el-table-column prop="state" label="状态" min-width="100" align="center">
              <template #default="scope">
                <el-tag :type="getStateType(scope.row.state)">{{ getStateText(scope.row.state) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createUser" label="创建人" min-width="100" align="center" />
            <el-table-column prop="createTime" label="创建时间" min-width="160" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.createTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="updateUser" label="更新人" min-width="100" align="center" />
            <el-table-column prop="updateTime" label="更新时间" min-width="160" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.updateTime) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="150" align="center">
              <template #default="scope">
                <div class="action-buttons">
                  <el-button size="small" type="success" @click="handleLoad(scope.row)"
                    >加载</el-button
                  >
                  <el-button v-if="canEditScenes" size="small" type="primary" @click="handleEdit(scope.row)"
                    >编辑</el-button
                  >
                  <el-button size="small" type="primary" :icon="VideoPlay" @click="handleRecordHistory(scope.row)">
                    <span>回放</span>
                  </el-button>

                  <el-button v-if="canEditScenes" size="small" type="danger" @click="foceCloseScene(scope.row.id,scope.row.state)">
                    <span>强制停止</span>
                  </el-button>
                </div>
              </template>
            </el-table-column>

          </el-table>
          </div>

          <!-- 分页控件 -->
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="pagination.current"
              v-model:page-size="pagination.pageSize"
              :page-sizes="[10, 15, 20, 50]"
              :total="pagination.total"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>

          <!-- 添加/编辑场景对话框 -->
          <el-dialog
            v-model="dialog.visible"
            :title="dialog.isEdit ? '编辑场景' : dialog.isCopy ? '克隆场景' : '新增场景'"
            width="500px"
            destroy-on-close
            @closed="resetForm"
          >
          <div v-if="dialog.isCopy" class="dialog-copy-info" style="margin-bottom: 16px; color: #909399;">
              克隆自场景：<strong>{{ dialog.copySourceName }}</strong>
            </div>
            <el-form
              ref="formRef"
              :model="sceneForm"
              :rules="formRules"
              label-width="90px"
              label-position="right"
            >
              <el-form-item label="场景名称" prop="name">
                <el-input v-model="sceneForm.name" placeholder="请输入场景名称" />
              </el-form-item>
              <el-form-item label="场景类型" prop="isPublic">
                <el-radio-group v-model="sceneForm.isPublic">
                  <el-radio :label="1">公有场景</el-radio>
                  <el-radio :label="0">私有场景</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="部署方式" prop="disturb">
                <el-radio-group v-model="sceneForm.disturb" :disabled="dialog.isEdit">
                  <el-radio :label="0">单服务器场景</el-radio>
                  <el-radio :label="1" :disabled="!canCreateDistributedScene && !dialog.isEdit">
                    分布式场景
                    <el-tooltip v-if="!canCreateDistributedScene && !dialog.isEdit" content="请向管理员申请授权" placement="top">
                      <el-icon style="margin-left: 4px; cursor: pointer; color: #E6A23C;"><Warning /></el-icon>
                    </el-tooltip>
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </el-form>
            <template #footer>
              <div class="dialog-footer">
                <el-button @click="dialog.visible = false">取 消</el-button>
                <el-button type="primary" @click="submitForm">确 定</el-button>
              </div>
            </template>
          </el-dialog>
        </div>

        <!-- 录制历史记录对话框 - 所有页面共享 -->
        <el-dialog
          v-model="recordHistoryDialog.visible"
          title="录制历史记录"
          width="1200px"
          destroy-on-close
        >
          <div v-if="recordHistoryDialog.currentScene" class="dialog-header">
            <p><strong>场景名称：</strong>{{ recordHistoryDialog.currentScene.name }}</p>
            <p><strong>场景ID：</strong>{{ recordHistoryDialog.currentScene.id }}</p>
          </div>
          
          <el-table
            v-loading="recordHistoryDialog.loading"
            :data="recordHistoryDialog.records"
            stripe
            border
            style="width: 100%"
            empty-text="暂无录制历史记录"
          >
            <el-table-column prop="id" label="记录ID" width="80" align="center" />
            <el-table-column prop="sessionId" label="会话ID" width="100" align="center" />
            <el-table-column prop="startTime" label="开始时间" min-width="180" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.startTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="endTime" label="结束时间" min-width="180" align="center">
              <template #default="scope">
                {{ formatDateTime(scope.row.endTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="brokerId" label="Broker ID" min-width="180" align="center" />
            <el-table-column prop="status" label="状态" width="100" align="center">
              <template #default="scope">
                <el-tag :type="getRecordStateType(scope.row.status)">{{ scope.row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="center">
              <template #default="scope">
                <el-button size="small" type="success" @click="handlePlayRecord(scope.row)">
                  播放
                </el-button>
                <el-button size="small" type="primary" :disabled="scope.row.status !== 'FINISHED'" @click="handleSaveRecord(scope.row)">
                  保存
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <template #footer>
            <div class="dialog-footer">
              <el-button @click="recordHistoryDialog.visible = false">关 闭</el-button>
            </div>
          </template>
        </el-dialog>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance } from "element-plus";
import {
  VideoPlay,
  Warning
} from '@element-plus/icons-vue';
import {
  getSceneList,
  getPrivateSceneList,
  createScene,
  copyScene,
  deleteScene,
  closeScene,
  batchDeleteScene,
  getTopoBySession,
  editSession,
  getRecordHistory,
  saveRecord,
  type RecordingHistory
} from "../../api/scene/index";
import type {
  SceneData,
  SceneListParams,
  PrivateSceneListParams,
  SceneCreateParams,
  EditSessionParams,
} from "../../api/scene/index";
import { useTopoStore } from "../../store/modules/topo";
import { useInterferenceStore } from "../../store/modules/interference";
import { getUserInfo, getOrdinaryValue, setDisturbPermission } from "../../store/user"; // 导入用户信息管理模块
import { useSystemLogStore } from "../../store/modules/systemLog";
import { getUsers } from "../../api/auth";
import eventBus from "../../utils/eventBus";

const route = useRoute();
const activeMenuItem = computed(() => (route.query.tab as string) || '1-1');

// 权限控制：普通模式全部可用，攻防模式仅白方可编辑场景
const currentUserInfo = getUserInfo();
const canEditScenes = computed(() => {
  if (currentUserInfo.mode === 'normal') return true;
  return currentUserInfo.role === 'white';
});

// 分布式场景创建权限 - 直接从用户信息获取 disturb 字段
const canCreateDistributedScene = computed(() => currentUserInfo.disturb === 1);

// 监听 tab 切换，重新获取数据
watch(activeMenuItem, () => {
  pagination.current = 1;
  fetchSceneList();
});

// 格式化日期时间
const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString();
};

// 根据状态获取状态标签类型
const getStateType = (state: string): string => {
  switch (state) {
    case "RUNNING":
      return "success";
    case "SHUTDOWN":
      return "info";
    case "PAUSED":
      return "warning";
    case "CONFIGURATION":
      return "warning";
    case "RUNTIME":
      return "success";
    case "INSTANTIATION":
      return "warning";
    default:
      return "info";
  }
};

// 将状态翻译为中文
const getStateText = (state: string): string => {
  switch (state) {
    case "RUNNING":
      return "运行中";
    case "SHUTDOWN":
      return "已停止";
    case "DEFINITION":
      return "已初始化";
    case "CONFIGURATION":
      return "未运行";
    case "RUNTIME":
      return "运行中";
    case "INSTANTIATION":
      return "实例化中";
    default:
      return state;
  }
};

// 查询表单
const queryForm = reactive({
  name: "",
  user: "",
});

// 表格数据
const sceneList = ref<SceneData[]>([]);
const loading = ref(false);
const selectedRows = ref<SceneData[]>([]);

// 分页信息
const pagination = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
});

// 对话框状态
const dialog = reactive({
  visible: false,
  isEdit: false,
  isCopy: false,
  isClose: false,
  isBatchDelete: false,
  copySourceName: "",
});

// 场景表单
interface SceneForm {
  id?: number;
  name: string;
  isPublic: number; // 0代表私有，1代表公共
  disturb: number; 
}



const sceneForm = reactive<SceneForm>({
  id: undefined,
  name: "",
  isPublic: 1, // 默认为公有场景
  disturb: 0, 
});

// 表单校验规则
const formRules = {
  name: [
    { required: true, message: "请输入场景名称", trigger: "blur" },
    { min: 2, max: 50, message: "长度在 2 到 50 个字符之间", trigger: "blur" },
  ],
  isPublic: [{ required: true, message: "请选择场景类型", trigger: "change" }],
  disturb: [{ required: true, message: "请选择部署方式", trigger: "change" }],
};

// 表单引用
const formRef = ref<FormInstance>();

// 录制历史记录对话框
const recordHistoryDialog = reactive({
  visible: false,
  loading: false,
  records: [] as RecordingHistory[],
  currentScene: null as SceneData | null,
});

// 根据录制状态获取标签类型
const getRecordStateType = (status: string): string => {
  switch (status) {
    case "RUNNING":
      return "success";
    case "COMPLETED":
      return "info";
    case "PAUSED":
      return "warning";
    default:
      return "info";
  }
};

// 组件挂载时加载数据
onMounted(async () => {
  // 初始化时加载场景列表
  fetchSceneList();
  eventBus.on("opencli:sceneListChanged", handleOpenCliSceneListChanged);
  // 刷新用户权限信息
  await refreshUserPermission();
});

onUnmounted(() => {
  eventBus.off("opencli:sceneListChanged", handleOpenCliSceneListChanged);
});

// 刷新用户权限信息
const refreshUserPermission = async () => {
  try {
    const userInfo = getUserInfo();
    if (userInfo.username) {
      const users = await getUsers();
      const currentUser = users?.find((u: any) => u.username === userInfo.username && u.type === userInfo.type);
      if (currentUser && currentUser.disturb !== undefined) {
        setDisturbPermission(currentUser.disturb);
      }
    }
  } catch (error) {
    console.error('刷新用户权限失败:', error);
  }
};

// 获取场景列表数据
const fetchSceneList = async () => {
  loading.value = true;
  try {
    let response;

    if (activeMenuItem.value === '1-1') {
      // 私有场景
      const userInfo = getUserInfo();
      const params: PrivateSceneListParams = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        user: userInfo.username || '',
        userId: userInfo.id || '',
        name: queryForm.name || undefined,
        ordinary: getOrdinaryValue(),
      };
      response = await getPrivateSceneList(params);
    } else if (activeMenuItem.value === '1-2') {
      // 公有场景
      const params: SceneListParams = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        name: queryForm.name || undefined,
        user: queryForm.user || undefined,
        ordinary: getOrdinaryValue(),
      };
      response = await getSceneList(params);
    } else {
      // 默认使用私有场景
      const userInfo = getUserInfo();
      const params: PrivateSceneListParams = {
        pageNo: pagination.current,
        pageSize: pagination.pageSize,
        user: userInfo.username || '',
        userId: userInfo.id || '',
        name: queryForm.name || undefined,
        ordinary: getOrdinaryValue(),
      };
      response = await getPrivateSceneList(params);
    }

    // 处理响应数据
    if (response.code === 200 && response.data) {
      // 更新数据和分页信息
      sceneList.value = response.data.records || [];
      pagination.total = response.data.total || 0;
    } else {
      ElMessage.error(response.msg || "获取场景列表失败");
    }
  } catch (error) {
    console.error("获取场景列表失败:", error);
    ElMessage.error("获取场景列表失败");
  } finally {
    loading.value = false;
  }
};

function handleOpenCliSceneListChanged(payload: {
  action: 'created' | 'updated' | 'deleted';
  sceneId?: number;
  name?: string;
  scope?: 'private' | 'public';
}) {
  const activeScope = activeMenuItem.value === '1-2' ? 'public' : 'private';

  if (payload.scope && payload.scope !== activeScope) {
    return;
  }

  if (payload.action === 'created') {
    pagination.current = 1;
  }

  fetchSceneList();
}

// 处理查询
const handleQuery = () => {
  pagination.current = 1;
  fetchSceneList();
};

// 重置查询条件
const resetQuery = () => {
  queryForm.name = "";
  // 只在公有场景时重置用户字段
  if (activeMenuItem.value === '1-1') {
    queryForm.user = "";
  }
  pagination.current = 1;
  fetchSceneList();
};

// 处理表格选择变化
const handleSelectionChange = (rows: SceneData[]) => {
  selectedRows.value = rows;
};

// 处理页码变化
const handleCurrentChange = (page: number) => {
  pagination.current = page;
  fetchSceneList();
};

// 处理每页数量变化
const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.current = 1;
  fetchSceneList();
};

// 处理加载场景
const handleLoad = async (row: SceneData) => {
  try {
    // 获取全局拓扑
    const result = await getTopoBySession(row.id);
    // 响应拦截器已经处理了API响应，这里直接获取数据
    if (result && result.data) {
      // 使用正确的actions来更新拓扑数据和会话名称
      topoStore.$patch({
        currentSessionId: row.id,
        currentSessionName: row.name,
        topoData: result.data
      });
      
      
      // 获取干扰节点配置
      await interferenceStore.fetchInterferenceConfigs(row.id);
      
      ElMessage.success(`场景"${row.name}"加载成功，请点击右上角「态势展示」进入场景`);

      // 通知 layout 高亮态势展示按钮
      window.dispatchEvent(new CustomEvent('scene-loaded', { detail: { name: row.name } }));
    } else {
      ElMessage.error("加载场景失败");
    }
  } catch (error) {
    console.error("加载场景失败:", error);
    ElMessage.error("加载场景失败");
  }
};

// 处理新增场景
const handleAdd = () => {
  dialog.isEdit = false;
  dialog.visible = true;
  // 重置表单
  sceneForm.id = undefined;
  sceneForm.name = "";
  sceneForm.isPublic = activeMenuItem.value === '1-1' ? 1 : 0; // 根据当前菜单设置默认值
  sceneForm.disturb = 0;
  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 处理编辑场景
const handleEdit = (row: SceneData) => {
  dialog.isEdit = true;
  dialog.visible = true;

  nextTick(() => {
    // 浅拷贝避免直接修改表格数据
    sceneForm.id = row.id;
    sceneForm.name = row.name;
    // 使用场景数据中的isPublic字段，如果没有则根据当前菜单项判断
    sceneForm.isPublic = typeof row.isPublic === 'number' ? row.isPublic : (activeMenuItem.value === '1-1' ? 1 : 0);
    // 编辑时不允许修改部署方式，保持原值或设为默认值
    sceneForm.disturb = (row as any).disturb ?? 0; // 如果场景数据中有disturb字段则使用，否则默认为0
    formRef.value?.clearValidate();
  });
};

// 处理删除场景
const handleDelete = (row: SceneData) => {
  ElMessageBox.confirm(`确定要删除场景"${row.name}"吗？`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(async () => {
      try {
        // 调用删除场景API，使用sessionId参数
        const res = await deleteScene(row.id);
        if (res.code === 200) {
          ElMessage.success("删除成功");
          fetchSceneList(); // 重新加载数据
        } else {
          ElMessage.error(res.msg || "删除失败");
        }
      } catch (error) {
        console.error("删除场景失败:", error);
        ElMessage.error("删除场景失败");
      }
    })
    .catch(() => {
      // 取消删除操作
    });
};

// 处理批量删除
const handleBatchDelete = () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请至少选择一条记录");
    return;
  }

  const names = selectedRows.value.map((row) => row.name).join("、");
  ElMessageBox.confirm(`确定要删除以下场景吗？<br/>${names}`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
    dangerouslyUseHTMLString: true,
  })
    .then(async () => {
      try {
        const sessionIds = selectedRows.value.map((row) => row.id);
        // 调用批量删除API，使用sessionIds参数
        const res = await batchDeleteScene(sessionIds);
        if (res.code === 200) {
          ElMessage.success("批量删除成功");
          fetchSceneList(); // 重新加载数据
        } else {
          ElMessage.error(res.msg || "批量删除失败");
        }
      } catch (error) {
        console.error("批量删除场景失败:", error);
        ElMessage.error("批量删除场景失败");
      }
    })
    .catch(() => {
      // 取消删除操作
    });
};

// 处理录制历史记录
const handleRecordHistory = async (row: SceneData) => {
  
  // 显示对话框
  recordHistoryDialog.visible = true;
  recordHistoryDialog.loading = true;
  recordHistoryDialog.currentScene = row;
  recordHistoryDialog.records = []; // 清空之前的数据
  
  try {
    
    // 调用API获取录制历史记录
    const response = await getRecordHistory(row.id);
    
    
    if (response.code === 200 && response.data) {
      recordHistoryDialog.records = response.data;
      
      if (response.data.length === 0) {
        ElMessage.info("该场景暂无录制历史记录");
      } else {
        ElMessage.success(`成功获取到 ${response.data.length} 条录制历史记录`);
      }
    } else {
      recordHistoryDialog.records = [];
      ElMessage.warning(response.msg || "暂无录制历史记录");
    }
  } catch (error) {
    console.error("获取录制历史记录失败:", error);
    ElMessage.error("获取录制历史记录失败");
    recordHistoryDialog.records = [];
  } finally {
    recordHistoryDialog.loading = false;
  }
};

// 处理播放单个录制记录
const handlePlayRecord = (record: RecordingHistory) => {
  // 在新窗口中打开回放模式的Cesium地图
  const playbackUrl = `/viewer?mode=playback&recordId=${record.id}&sessionId=${record.sessionId}&brokerId=${record.brokerId}`;
  window.open(playbackUrl, '_blank');
  ElMessage.success(`正在新窗口中播放录制记录`);
};

// 处理保存录制记录
const handleSaveRecord = async (record: RecordingHistory) => {
  if (record.status !== 'FINISHED') {
    ElMessage.warning('只有FINISHED状态的录制记录才能保存。');
    return;
  }
  try {
    // 记录保存开始
    systemLogStore.addLog({
      type: 'normal',
      module: 'record',
      action: '开始保存录制记录',
      information: '录制记录保存开始',
      details: `开始保存录制记录 (ID: ${record.id})`
    });

    const res = await saveRecord(record.id);
    if (res.code === 200) {
      // 记录保存成功
      systemLogStore.addLog({
        type: 'important',
        module: 'record',
        action: '录制记录保存成功',
        information: '录制记录保存成功',
        details: `录制记录 (ID: ${record.id}) 保存成功`
      });

      ElMessage.success('录制记录保存成功！');
      // 保存成功后刷新当前弹窗数据
      if (recordHistoryDialog.currentScene) {
        await handleRecordHistory(recordHistoryDialog.currentScene);
      }
    } else {
      // 记录保存失败
      systemLogStore.addLog({
        type: 'important',
        module: 'record',
        action: '录制记录保存失败',
        information: '录制记录保存失败',
        details: `录制记录 (ID: ${record.id}) 保存失败: ${res.msg || '未知错误'}`
      });

      ElMessage.error(res.msg || '录制记录保存失败！');
    }
  } catch (error) {
    // 记录保存错误
    systemLogStore.addLog({
      type: 'important',
      module: 'record',
      action: '录制记录保存错误',
      information: '录制记录保存错误',
      details: `录制记录 (ID: ${record.id}) 保存失败: ${(error as Error).message || '未知错误'}`
    });

    console.error('保存录制记录失败:', error);
    ElMessage.error('保存录制记录失败！');
  }
};

//处理强制关闭场景
const foceCloseScene = async (sessionId: number,state:String) => {
  console.log("强制关闭场景:", sessionId,state);
  if(state=="CONFIGURATION" || state=="RUNTIME" || state=="INSTANTIATION"){
    try {
      // 调用删除场景API，使用sessionId参数，调用强制关闭的接口
      const res = await closeScene(sessionId);
      if (res.code === 200) {
        ElMessage.success("场景已强制停止");
        fetchSceneList(); // 重新加载数据
      } else {
        ElMessage.error(res.msg || "强制停止场景失败");
      }
    } catch (error) {
      console.error("强制停止场景失败:", error);
      ElMessage.error("强制停止场景失败");
    }

  }else{
    ElMessage.success("场景正常，无需强制停止！");
  }
  // try {
  //   // 调用删除场景API，使用sessionId参数，调用强制关闭的接口
  //   const res = await deleteScene(sessionId);
  //   if (res.code === 200) {
  //     ElMessage.success("场景已强制停止");
  //     fetchSceneList(); // 重新加载数据
  //   } else {
  //     ElMessage.error(res.msg || "强制停止场景失败");
  //   }
  // } catch (error) {
  //   console.error("强制停止场景失败:", error);
  //   ElMessage.error("强制停止场景失败");
  // }
};

// 处理克隆场景
const handleCopy = (row: SceneData) => {
  dialog.isEdit = false;
  dialog.isCopy = true;
  dialog.copySourceName = row.name;
  dialog.copySessionId = row.id;
  dialog.visible = true;

  // 克隆场景时，建议默认命名为"原名-克隆"便于区分
  sceneForm.id = undefined;
  sceneForm.name = `${row.name}-克隆`;
  sceneForm.isPublic = typeof row.isPublic === 'number' ? row.isPublic : (activeMenuItem.value === '1-1' ? 1 : 0);
  sceneForm.disturb = (row as any).disturb ?? 0;

  nextTick(() => {
    formRef.value?.clearValidate();
  });
};

// 提交表单
const submitForm = () => {
  formRef.value?.validate(async (valid) => {
    if (valid) {
      try {
        if (dialog.isEdit) {
          // 编辑场景 - 使用editSession接口
          const editParams: EditSessionParams = {
            sessionId: sceneForm.id!,
            name: sceneForm.name,
            isPublic: sceneForm.isPublic, // 根据表单选择的公开性
          };

          const res = await editSession(editParams);
          if (res.code === 200) {
            ElMessage.success("更新成功");
            dialog.visible = false;
            fetchSceneList(); // 重新加载数据
          } else {
            ElMessage.error(res.msg || "更新失败");
          }
          } else if (dialog.isCopy && dialog.copySessionId !== null) {
          // 克隆场景
          const userInfo = getUserInfo();
          const createParams: SceneCreateParams = {
            name: sceneForm.name,
            userId: userInfo.id || '', // 使用当前用户ID
            isPublic: sceneForm.isPublic, // 根据表单选择的公开性
            disturb: sceneForm.disturb,
            ordinary: getOrdinaryValue(),
          };

          const res = await copyScene(createParams, dialog.copySessionId);
          if (res.code === 200) {
            ElMessage.success("克隆成功");
            dialog.visible = false;
            fetchSceneList(); // 重新加载数据
          } else {
            ElMessage.error(res.msg || "克隆失败");
          }
        } else {
          // 新增场景
          const userInfo = getUserInfo();
          const createParams: SceneCreateParams = {
            name: sceneForm.name,
            userId: userInfo.id || '', // 使用当前用户ID
            isPublic: sceneForm.isPublic, // 根据表单选择的公开性
            disturb: sceneForm.disturb,
            ordinary: getOrdinaryValue(),
          };

          const res = await createScene(createParams);
          if (res.code === 200) {
            ElMessage.success("添加成功");
            dialog.visible = false;
            fetchSceneList(); // 重新加载数据
          } else {
            ElMessage.error(res.msg || "添加失败");
          }
        }
      } catch (error) {
        console.error("提交表单失败:", error);
        ElMessage.error("操作失败，请稍后重试");
      }
    }
  });
};

// 重置表单
const resetForm = () => {
  sceneForm.id = undefined;
  sceneForm.name = "";
  sceneForm.isPublic = 1; // 默认为公有场景
  sceneForm.disturb = 0;
  dialog.isCopy = false;
  dialog.copySourceName = '';
  dialog.copySessionId = null;
};

const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();
const systemLogStore = useSystemLogStore();
</script>

<style scoped lang="scss">
.scene-container {
  height: 100%;
}

.content-area {
  height: 100%;
  overflow: auto;
}

.scene-manager-container {
  padding: 20px;
  background-color: rgba(0, 20, 60, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
  height: calc(100% - 40px);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 150, 255, 0.1);
}

/* ========== 操作区域 ========== */
.action-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(0, 30, 80, 0.35);
  border-radius: 6px;
  border: 1px solid rgba(0, 150, 255, 0.1);
}

.search-form {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.el-form--inline .el-form-item {
  margin-right: 14px;
  margin-bottom: 0;
}

/* ========== 表格容器 ========== */
.table-wrapper {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ========== 表格样式 ========== */
:deep(.el-table) {
  font-size: 15px;

  th.el-table__cell {
    background-color: rgba(0, 35, 90, 0.75) !important;
    color: #8ec8ff !important;
    font-weight: 600;
    font-size: 15px;
    padding: 14px 0;
    text-align: center;
    border-bottom: 2px solid rgba(0, 150, 255, 0.2) !important;
  }

  td.el-table__cell {
    padding: 12px 0;
    font-size: 14px;
  }

  /* 状态标签增强 */
  .el-tag {
    font-size: 13px;
    padding: 4px 12px;
    border-radius: 3px;
  }
}

/* ========== 操作按钮组 ========== */
.action-buttons {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 6px;
}

/* 表格内小按钮 HUD 风格 */
:deep(.el-table) .el-button--small {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, currentColor, transparent);
    opacity: 0.3;
    transition: all 0.3s;
  }

  &:hover::after {
    left: 5%;
    right: 5%;
    opacity: 0.6;
  }
}

/* 顶部操作按钮增强 */
.action-header > .el-button {
  padding: 8px 20px;
  font-size: 14px;
  border-radius: 3px;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  position: relative;
  overflow: hidden;
  transition: all 0.3s;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(0, 150, 255, 0.2);
  }
}

/* ========== 搜索表单 ========== */
:deep(.el-input__wrapper) {
  height: 34px;
  line-height: 34px;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  line-height: 34px;
}

/* ========== 分页 ========== */
.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

:deep(.el-pagination) {
  font-size: 14px;

  .el-pagination__total {
    font-size: 14px;
  }
}

/* ========== 对话框 ========== */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-header {
  margin-bottom: 20px;
  padding: 15px;
  background-color: rgba(0, 30, 80, 0.5);
  border-radius: 4px;
  border-left: 4px solid #00b0ff;
}

.dialog-header p {
  margin: 5px 0;
  color: #a0d4ff;
  font-size: 14px;
}

.dialog-header strong {
  color: #8ec8ff;
}

/* 表格单元格不换行 */
:deep(.el-table .cell) {
  white-space: nowrap;
}
</style>
