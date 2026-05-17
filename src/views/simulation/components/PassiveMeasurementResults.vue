<template>
    <el-card class="measurement-card">
        <template #header>
            <div class="card-header">
                <span>节点测试结果查询</span>
                <el-tooltip content="查询被动测量任务的执行结果">
                    <el-icon><QuestionFilled /></el-icon>
                </el-tooltip>
            </div>
        </template>
        
        <!-- 容器选择区域 -->
        <el-card class="container-selection-card" style="margin-bottom: 20px;">
            <template #header>
                <div class="card-header">
                    <span>容器选择</span>
                    <el-tooltip content="选择要查看的容器，图表将只显示选中容器的数据">
                        <el-icon><QuestionFilled /></el-icon>
                    </el-tooltip>
                </div>
            </template>
            
            <el-form :model="chartForm" label-width="120px">
                <el-form-item label="选择容器">
                    <el-select 
                        v-model="chartForm.selectedContainer" 
                        placeholder="请选择要查看的容器" 
                        style="width: 300px;"
                        @change="onContainerChange"
                    >
                        <el-option 
                            v-for="container in availableContainers" 
                            :key="container" 
                            :label="container" 
                            :value="container"
                        />
                    </el-select>
                    <div class="selection-info">
                        已选择容器: {{ chartForm.selectedContainer || '未选择' }}
                    </div>
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
            <el-table-column prop="container" label="容器名称" />
            <el-table-column prop="status" label="状态">
                <template #default="scope">
                    <el-tag :type="scope.row.status === 2 ? 'success' : 'danger'">
                        {{ scope.row.status === 2 ? '成功' : '失败' }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column prop="cpu" label="CPU使用率(%)" />
            <el-table-column prop="mem" label="内存使用率(%)" />
            <el-table-column prop="reportInterval" label="上报间隔(秒)" />
            <el-table-column prop="execTime" label="执行时间" />
        </el-table>
        
        <!-- 图表展示 -->
        <el-card class="chart-card" style="margin-top: 20px;">
            <template #header>
                <div class="card-header">
                    <span>测量结果图表</span>
                    <el-button type="primary" size="small" @click="$emit('refreshChart')">
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
import { QuestionFilled, Refresh } from '@element-plus/icons-vue';
import type { PassiveResultItem, PassiveChartForm } from '../types';

interface Props {
    data: PassiveResultItem[];
    loading?: boolean;
    availableContainers: string[];
}

interface Emits {
    (e: 'containerChange', container: string): void;
    (e: 'refreshChart'): void;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false
});

const emit = defineEmits<Emits>();

const chartRef = ref<HTMLElement>();

const chartForm = reactive<PassiveChartForm>({
    selectedContainer: ''
});

const onContainerChange = () => {
    emit('containerChange', chartForm.selectedContainer);
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

.container-selection-card {
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

// 表格样式优化
:deep(.el-table) {
    .el-table__header-wrapper {
        .el-table__header {
            th {
                background-color: rgba(0, 35, 90, 0.7) !important;
                color: #8ec8ff;
                font-weight: bold;
                text-align: center;
                padding: 12px 0;
            }
        }
    }
    
    .el-table__body-wrapper {
        .el-table__body {
            td {
                text-align: center;
                padding: 12px 0;
            }
        }
    }
}

// 确保表格占满容器
.measurement-card {
    .el-table {
        width: 100% !important;
        height: auto;
        min-height: 400px;
    }
}
</style> 