<template>
    <div class="scene-list-container">
        <div class="search-bar">
          <div class="search-input">
            <span class="label">场景名称：</span>
            <el-input
              v-model="searchName"
              placeholder="输入查询场景名称"
              class="input-with-search"
              clearable
            >
              <template #append>
                <el-button :icon="Search" />
              </template>
            </el-input>
          </div>
          <div class="action-buttons">
            <el-button type="primary" @click="openAddDialog">添加场景</el-button>
            <el-button
              type="danger"
              >批量删除</el-button
            >
          </div>
        </div>

        <!-- 场景列表 -->
        <el-table :data="sceneList" border style="width: 100%" max-height="450">
          <el-table-column type="selection" width="55" />
          <el-table-column prop="id" label="场景ID" width="100" />
          <el-table-column prop="name" label="场景名称" width="150" />
          <el-table-column prop="type" label="场景类型" width="100" />
          <el-table-column prop="createTime" label="创建时间" width="150" />
          <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
          <el-table-column fixed="right" label="操作" width="200">
            <template #default="scope">
              <el-button type="success" size="small" >加载</el-button>
              <el-button type="primary" size="small" >编辑</el-button>
              <el-button type="danger" size="small" >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页控件 -->
        <div class="pagination-container">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next"
            :total="100"
            :page-sizes="[10, 20, 30, 50]"
            :page-size="10"
            :current-page="1"
          />
        </div>

        <!-- 添加场景弹出框 -->
        <el-dialog
            v-model="dialogVisible"
            title="添加场景"
            width="500px"
            :close-on-click-modal="false"
            destroy-on-close
        >
            <el-form :model="sceneForm" label-width="100px" :rules="rules" ref="sceneFormRef">
                <el-form-item label="场景ID" prop="id">
                    <el-input v-model="sceneForm.id" placeholder="请输入场景ID"></el-input>
                </el-form-item>
                <el-form-item label="场景名称" prop="name">
                    <el-input v-model="sceneForm.name" placeholder="请输入场景名称"></el-input>
                </el-form-item>
                
                <el-form-item label="场景类型" prop="type">
                    <el-select v-model="sceneForm.type" placeholder="请选择场景类型" style="width: 100%">
                        <el-option label="陆地场景" value="land"></el-option>
                        <el-option label="海洋场景" value="ocean"></el-option>
                        <el-option label="空中场景" value="air"></el-option>
                        <el-option label="混合场景" value="mixed"></el-option>
                    </el-select>
                </el-form-item>
                
                <el-form-item label="地理位置" prop="location">
                    <el-input v-model="sceneForm.location" placeholder="请输入地理位置"></el-input>
                </el-form-item>
                
                <el-form-item label="场景描述" prop="description">
                    <el-input 
                        v-model="sceneForm.description" 
                        type="textarea" 
                        :rows="3"
                        placeholder="请输入场景描述"
                    ></el-input>
                </el-form-item>
            </el-form>
            
            <template #footer>
                <div class="dialog-footer">
                    <el-button @click="dialogVisible = false">取 消</el-button>
                    <el-button type="primary" @click="handleAddScene">确 定</el-button>
                </div>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { Search } from '@element-plus/icons-vue';
import type { FormRules } from 'element-plus';

// 搜索关键字
const searchName = ref('');

// 添加场景弹出框控制
const dialogVisible = ref(false);

// 场景表单数据
const sceneForm = reactive({
  id: '',
  name: '',
  type: '',
  location: '',
  description: ''
});

// 表单验证规则
const rules = reactive<FormRules>({
  id: [
    { required: true, message: '请输入场景ID', trigger: 'blur' },
    { min: 1, max: 20, message: '长度在 1 到 20 个字符之间', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入场景名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符之间', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择场景类型', trigger: 'change' }
  ],
  location: [
    { required: true, message: '请输入地理位置', trigger: 'blur' }
  ],
  description: [
    { max: 200, message: '描述最多 200 个字符', trigger: 'blur' }
  ]
});

// 表单引用
const sceneFormRef = ref();

// 模拟场景数据
const sceneList = ref([
  {
    id: 1,
    name: '城市仿真场景',
    type: '城市',
    createTime: '2025-05-06 10:30:45',
    description: '城市环境下的通信网络仿真测试场景，包含多个建筑物和复杂地形'
  },
]);


// 打开添加场景对话框
const openAddDialog = () => {
  dialogVisible.value = true;
};

// 添加场景逻辑
const handleAddScene = () => {
  sceneFormRef.value?.validate((valid: boolean) => {
    if (valid) {
      // 这里只是为了让弹出框显示，不需要实现实际的添加功能
      dialogVisible.value = false;
    } else {
      return false;
    }
  });
};
</script>

<style scoped>
.scene-list-container {
  background-color: var(--card-bg, #fff);
  border-radius: 4px;
  min-height: 400px;
  width: 100%;
  max-width: 100%;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.search-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
  padding: 20px 20px 0 20px;
}

.search-input {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.label {
  white-space: nowrap;
}

.input-with-search {
  width: 250px;
  max-width: 100%;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding-bottom: 20px;
}
</style>
