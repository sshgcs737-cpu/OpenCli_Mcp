<template>
  <div class="scene-list-component">
    <!-- 搜索和操作区域 -->
    <div class="action-header">
      <el-button type="primary" @click="handleAdd">新增场景</el-button>
      <el-button type="danger" :disabled="!selectedRows.length" @click="handleBatchDelete">批量删除</el-button>

      <el-form :inline="true" :model="queryForm" class="search-form">
        <el-form-item label="场景名称">
          <el-input v-model="queryForm.name" placeholder="输入场景名称" clearable />
        </el-form-item>
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
    <el-table
      v-loading="loading"
      :data="sceneList"
      stripe
      border
      style="width: 100%"
      height="calc(100vh - 330px)"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="50" align="center" />
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
          <el-tag :type="getStateType(scope.row.state)">{{ scope.row.state }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" min-width="160" align="center">
        <template #default="scope">
          {{ formatDateTime(scope.row.createTime) }}
        </template>
      </el-table-column>
      <el-table-column prop="updateTime" label="更新时间" min-width="160" align="center">
        <template #default="scope">
          {{ formatDateTime(scope.row.updateTime) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="200" align="center">
        <template #default="scope">
          <div class="action-buttons">
            <el-button size="small" type="success" @click="handleLoad(scope.row)">加载</el-button>
            <el-button size="small" type="primary" @click="handleEdit(scope.row)">编辑</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页控件 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.current"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[5, 10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 添加/编辑场景对话框 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑场景' : '新增场景'"
      width="500px"
      destroy-on-close
      @closed="resetForm"
    >
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
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialog.visible = false">取 消</el-button>
          <el-button type="primary" @click="submitForm">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { FormInstance } from "element-plus";
import {
  getSceneList,
  createScene,
  deleteScene,
  batchDeleteScene,
  getTopoBySession,
  editSession,
} from "../api/scene/index";
import type {
  SceneData,
  SceneListParams,
  SceneCreateParams,
  EditSessionParams,
} from "../api/scene/index";
import { useTopoStore } from "../store/modules/topo";
import { useInterferenceStore } from "../store/modules/interference";
import { getUserInfo, getOrdinaryValue } from "../store/user"; // 导入用户信息管理模块
import { useSystemLogStore } from "../store/modules/systemLog";

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
    default:
      return "info";
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
  pageSize: 5,
  total: 0,
});

// 对话框状态
const dialog = reactive({
  visible: false,
  isEdit: false,
});

// 场景表单
interface SceneForm {
  id?: number;
  name: string;
  isPublic: number; // 0代表私有，1代表公共
}

const sceneForm = reactive<SceneForm>({
  id: undefined,
  name: "",
  isPublic: 1, // 默认为公有场景
});

// 表单校验规则
const formRules = {
  name: [
    { required: true, message: "请输入场景名称", trigger: "blur" },
    { min: 2, max: 50, message: "长度在 2 到 50 个字符之间", trigger: "blur" },
  ],
  isPublic: [{ required: true, message: "请选择场景类型", trigger: "change" }],
};

// 表单引用
const formRef = ref<FormInstance>();

// 组件挂载时加载数据
onMounted(() => {
  fetchSceneList();
});

// 获取场景列表数据
const fetchSceneList = async () => {
  loading.value = true;
  try {
    // 构造API请求参数
    const params: SceneListParams = {
      pageNo: pagination.current,
      pageSize: pagination.pageSize,
      name: queryForm.name || undefined,
      user: queryForm.user || undefined,
      ordinary: getOrdinaryValue(),
    };

    // 调用API获取场景列表
    const response = await getSceneList(params);

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

// 处理查询
const handleQuery = () => {
  pagination.current = 1;
  fetchSceneList();
};

// 重置查询条件
const resetQuery = () => {
  queryForm.name = "";
  queryForm.user = "";
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
    // 记录场景加载开始
    systemLogStore.addLog({
      type: 'normal',
      module: 'scene',
      action: '开始加载场景',
      information: '场景加载开始',
      details: `开始加载场景 "${row.name}" (ID: ${row.id})`
    });

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

      // 记录场景加载成功
      systemLogStore.addLog({
        type: 'important',
        module: 'scene',
        action: '场景加载成功',
        information: '场景加载成功',
        details: `场景 "${row.name}" (ID: ${row.id}) 加载成功，包含 ${result.data.nodes?.length || 0} 个节点和 ${result.data.links?.length || 0} 条链路`
      });

      ElMessage.success(`场景"${row.name}"加载成功`);

      // 如果场景已在运行状态，自动获取NEM ID数据
      // 解决新用户加载已运行场景时因无NEM ID导致EMANE数据无法显示的问题
      const sceneState = result.data.state;
      if (sceneState === 'RUNTIME' || sceneState === 'RUNNING') {
        try {
          const nodes = result.data.nodes || [];
          const hasEmane = nodes.some((node: any) => node.type === 'EMANE');
          
          if (hasEmane) {
            const { getNemIds } = await import("../api/node/index");
            const { useNemIdStore } = await import("../store/modules/nemId");
            const nemIdStore = useNemIdStore();
            
            const nemIdResponse = await getNemIds(row.id) as any;
            if (nemIdResponse.code === 200 && nemIdResponse.data?.nemIds) {
              nemIdStore.setNemIds(nemIdResponse.data.sessionId, nemIdResponse.data.nemIds);
              console.log("[SceneList] 场景已运行，自动获取NEM ID成功，共", nemIdResponse.data.nemIds.length, "条");
            }
          }
        } catch (nemIdError) {
          console.warn("[SceneList] 自动获取NEM ID时出错:", nemIdError);
        }
      }
    } else {
      // 记录场景加载失败
      systemLogStore.addLog({
        type: 'warning',
        module: 'scene',
        action: '场景加载失败',
        information: '场景加载失败',
        details: `场景 "${row.name}" (ID: ${row.id}) 加载失败：未获取到有效数据`
      });

      ElMessage.error("加载场景失败");
    }
  } catch (error) {
    // 记录场景加载错误
    systemLogStore.addLog({
      type: 'warning',
      module: 'scene',
      action: '场景加载错误',
      information: '场景加载错误',
      details: `场景 "${row.name}" (ID: ${row.id}) 加载失败: ${error.message || '未知错误'}`
    });

    console.error("加载场景失败:", error);
    ElMessage.error("加载场景失败");
  }
};

// 处理新增场景
const handleAdd = () => {
  dialog.isEdit = false;
  dialog.visible = true;
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
    // 使用场景数据中的isPublic字段，如果没有则默认为公有场景
    sceneForm.isPublic = typeof row.isPublic === 'number' ? row.isPublic : 1;
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
            isPublic: sceneForm.isPublic, // 使用表单中的公开性设置
          };

          const res = await editSession(editParams);
          if (res.code === 200) {
            ElMessage.success("场景更新成功");
            dialog.visible = false;
            fetchSceneList(); // 重新加载数据
          } else {
            ElMessage.error(res.msg || "更新失败");
          }
        } else {
          // 新增场景
          const userInfo = getUserInfo();
          const createParams: SceneCreateParams = {
            name: sceneForm.name,
            userId: userInfo.id || '',
            isPublic: 1, // 默认为公有场景
            ordinary: getOrdinaryValue(),
          };

          const res = await createScene(createParams);
          if (res.code === 200) {
            ElMessage.success("场景添加成功");
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
};

const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();
const systemLogStore = useSystemLogStore();
</script>

<style scoped lang="scss">
.scene-list-component {
  background-color: rgba(0, 20, 60, 0.5);
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.3);
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.action-header .el-button {
  height: 32px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-form {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.el-form--inline .el-form-item {
  margin-right: 16px;
  margin-bottom: 0;
}

:deep(.el-input__wrapper) {
  height: 32px;
  line-height: 32px;
}

:deep(.el-form-item__label) {
  line-height: 32px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

/* 表格样式调整 */
:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background-color: rgba(0, 35, 90, 0.7);
  color: #8ec8ff;
  font-weight: bold;
  text-align: center;
}

:deep(.el-table td) {
  padding: 8px 0;
}

:deep(.el-button--small) {
  padding: 6px 10px;
  margin: 0 3px;
}

/* 按钮间距控制 */
:deep(.el-table .cell) {
  white-space: nowrap;
}

/* 操作按钮组样式 */
.action-buttons {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 5px;
}
</style> 