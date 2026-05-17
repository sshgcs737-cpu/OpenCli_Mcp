<template>
    <el-card class="measurement-card">
        <template #header>
            <div class="card-header">
                <span>链路测试结果</span>
                <el-tooltip content="查询主动测量任务的执行结果">
                    <el-icon><QuestionFilled /></el-icon>
                </el-tooltip>
            </div>
        </template>
        
        <!-- 链路选择区域 -->
        <el-card class="link-selection-card" style="margin-bottom: 20px;">
            <template #header>
                <div class="card-header">
                    <span>链路选择</span>
                    <el-tooltip content="选择要查看的链路，查询将只返回选中链路的数据">
                        <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                </div>
            </template>
            
            <el-form :model="chartForm" label-width="120px">
                <el-form-item label="选择链路">
                    <el-select 
                        v-model="chartForm.selectedLink" 
                        placeholder="请选择要查看的链路" 
                        style="width: 300px;"
                        @change="onLinkChange"
                    >
                        <el-option 
                            v-for="link in availableLinks" 
                            :key="link" 
                            :label="link" 
                            :value="link"
                        />
                    </el-select>
                    <div class="selection-info">
                        已选择链路: {{ chartForm.selectedLink || '未选择' }}
                    </div>
                </el-form-item>
                <el-form-item>
                    <el-button 
                        type="primary" 
                        @click="handleQuery"
                        :loading="queryLoading"
                        :disabled="!chartForm.selectedLink"
                    >
                        <el-icon><Search /></el-icon>
                        查询选中链路数据
                    </el-button>
                    <el-button @click="handleReset">
                        <el-icon><Refresh /></el-icon>
                        重置
                    </el-button>
                </el-form-item>
            </el-form>
        </el-card>
        
        <!-- 查询结果表格 -->
        <el-table 
            :data="data" 
            style="width: 100%;" 
            v-loading="loading" 
            max-height="600"
            :header-cell-style="{ textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 'bold' }"
            :cell-style="{ textAlign: 'center' }"
        >
            <el-table-column prop="id" label="任务ID" />
            <el-table-column prop="sessionId" label="场景ID" />
            <el-table-column prop="controlType" label="测量类型">
                <template #default="scope">
                    <el-tag :type="getControlTypeTag(scope.row.controlType)">
                        {{ getControlTypeText(scope.row.controlType) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="srcContainer" label="源容器" />
            <el-table-column prop="dstContainer" label="目的容器" />
  
            <el-table-column prop="beginTime" label="开始时间" />
            <el-table-column prop="endTime" label="结束时间" />
            
            <!-- 空数据提示 -->
            <template #empty>
                <div class="empty-data">
                    <el-empty 
                        :image-size="100"
                        description="请先选择链路并点击查询按钮"
                    >
                        <template #description>
                            <span v-if="!chartForm.selectedLink">请先选择要查询的链路</span>
                            <span v-else>点击"查询选中链路数据"按钮获取数据</span>
                        </template>
                    </el-empty>
                </div>
            </template>
        </el-table>

        
        <!-- 图表展示 -->
        <el-card class="chart-card" style="margin-top: 20px;">
            <template #header>
                <div class="card-header">
                    <span>测量结果图表</span>
                    <el-button 
                        type="primary" 
                        size="small" 
                        @click="$emit('refreshChart')"
                        :disabled="!chartForm.selectedLink"
                    >
                        <el-icon><Refresh /></el-icon>
                        刷新图表
                    </el-button>
                </div>
            </template>
            <div ref="chartRef" class="chart-container"></div>
        </el-card>
    </el-card>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { QuestionFilled, Refresh, Search } from '@element-plus/icons-vue';
import { getControlTypeTag, getControlTypeText } from '../utils/chartUtils';
import type { ActiveResultItem, ActiveChartForm } from '../types';

interface Props {
    data: ActiveResultItem[];
    loading?: boolean;
    availableLinks: string[];
}

interface Emits {
    (e: 'linkChange', link: string): void;
    (e: 'refreshChart'): void;
    (e: 'querySelectedLink', link: string): void;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false
});

const emit = defineEmits<Emits>();

const chartRef = ref<HTMLElement>();
const queryLoading = ref(false);

const chartForm = reactive<ActiveChartForm>({
    selectedLink: ''
});

const onLinkChange = () => {
    emit('linkChange', chartForm.selectedLink);
};

const handleQuery = async () => {
    if (!chartForm.selectedLink) {
        return;
    }
    
    queryLoading.value = true;
    try {
        emit('querySelectedLink', chartForm.selectedLink);
    } finally {
        queryLoading.value = false;
    }
};

const handleReset = () => {
    chartForm.selectedLink = '';
    emit('linkChange', '');
};

// 暴露图表引用和表单给父组件
defineExpose({
    chartRef,
    chartForm
});
</script>

<style scoped lang="scss">
.measurement-card {
    margin-bottom: 20px;
    
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
}

.link-selection-card {
    .selection-info {
        margin-top: 8px;
        font-size: 12px;
        color: #6a9fd8;
    }
}

.chart-card {
    .chart-container {
        height: 800px;
        width: 100%;
    }
}

.empty-data {
    padding: 40px 0;
    text-align: center;
    
    .el-empty {
        .el-empty__description {
            color: #6a9fd8;
            font-size: 14px;
        }
    }
}
</style> 