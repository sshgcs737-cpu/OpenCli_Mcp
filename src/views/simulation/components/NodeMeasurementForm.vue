<template>
    <el-card class="measurement-card">
        <template #header>
            <div class="card-header">
                <span>节点测量下发</span>
                <el-tooltip content="配置节点测量参数，监控单个容器的网络状态">
                    <el-icon><QuestionFilled /></el-icon>
                </el-tooltip>
            </div>
        </template>
        
        <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
            <!-- 当没有docker节点时显示提示 -->
            <el-alert 
                v-if="dockerNodes.length === 0" 
                title="当前场景中没有可用的容器节点" 
                type="warning" 
                :closable="false"
                show-icon
                style="margin-bottom: 20px;"
            >
                <template #default>
                    请先在场景中添加ROUTER类型的节点
                </template>
            </el-alert>
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="场景ID" prop="sessionId">
                        <el-input v-model="form.sessionId" placeholder="请输入场景ID"></el-input>
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                    <el-form-item label="上报间隔(秒)" prop="reportInterval" v-if="!props.isMonitoring">
                        <el-input-number v-model="form.reportInterval" :min="1" :max="3600" placeholder="上报间隔" style="width: 100%"></el-input-number>
                    </el-form-item>
                </el-col>
                
            </el-row>
            
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="容器名称" prop="container">
                        <el-select 
                            v-model="form.container" 
                            placeholder="请选择容器" 
                            style="width: 100%"
                        >
                            <el-option 
                                v-for="node in dockerNodes" 
                                :key="node.id" 
                                :label="getContainerDisplayName(node.name)" 
                                :value="node.name"
                            ></el-option>
                        </el-select>
                        <div class="selection-info">
                            已选择 {{ selectedContainerDisplayName || '无' }}
                        </div>
                    </el-form-item>
                </el-col>
                
            </el-row>
            
            <el-form-item>
                <el-button type="primary" @click="handleSubmit" :loading="loading">
                    <el-icon>
                        <VideoPlay v-if="!props.isMonitoring" />
                        <Delete v-else />
                    </el-icon>
                    {{ props.isMonitoring ? '停止监控' : '开始监控' }}
                </el-button>
                <el-button @click="handleReset">
                    <el-icon><Refresh /></el-icon>
                    重置
                </el-button>
            </el-form-item>
        </el-form>
    </el-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { QuestionFilled, VideoPlay, Refresh, Delete } from '@element-plus/icons-vue';
import type { FormRules } from 'element-plus';
import type { NodeMeasurementForm } from '../types';
import { useTopoStore } from '../../../store/modules/topo';

interface Props {
    dockerNodes: any[];
    loading?: boolean;
    isMonitoring?: boolean;
}

interface Emits {
    (e: 'submit', form: NodeMeasurementForm): void;
    (e: 'reset'): void;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    isMonitoring: false
});

const emit = defineEmits<Emits>();

const formRef = ref();
const topoStore = useTopoStore();

// 计算当前场景ID
const currentSessionId = computed(() => topoStore.currentSessionId);

const getContainerDisplayName = (containerName: string) => {
    const targetNode = props.dockerNodes.find((node: any) => node.name === containerName);
    return targetNode?.alias || targetNode?.name || containerName;
};

const selectedContainerDisplayName = computed(() => {
    return form.container ? getContainerDisplayName(form.container) : '';
});

// 从localStorage恢复之前选择的容器
const getStoredContainer = (): string => {
    try {
        const stored = localStorage.getItem('nodeMeasurementContainer');
        return stored || '';
    } catch (error) {
        console.warn('读取存储的容器选择失败:', error);
        return '';
    }
};

// 保存容器选择到localStorage
const saveContainerSelection = (container: string) => {
    try {
        localStorage.setItem('nodeMeasurementContainer', container);
    } catch (error) {
        console.warn('保存容器选择失败:', error);
    }
};

const form = reactive<NodeMeasurementForm>({
    controlType: 1, // 默认开始监控
    sessionId: '',
    container: getStoredContainer(), // 恢复之前选择的容器
    reportInterval: 10
});

// 监听监控状态变化，自动更新controlType
watch(() => props.isMonitoring, (isMonitoring) => {
    form.controlType = isMonitoring ? 2 : 1;
}, { immediate: true });

// 监听场景ID变化，自动填入表单
watch(currentSessionId, (newSessionId) => {
    if (newSessionId) {
        form.sessionId = newSessionId.toString();
    }
}, { immediate: true });

// 监听容器选择变化，保存到localStorage
watch(() => form.container, (newContainer) => {
    if (newContainer) {
        saveContainerSelection(newContainer);
    }
}, { immediate: true });

const rules: FormRules = {
    sessionId: [
        { required: true, message: '请输入场景ID', trigger: 'blur' }
    ],
    container: [
        { required: true, message: '请选择容器', trigger: 'change' }
    ],
    // 只有开始监控时才验证上报间隔
    reportInterval: [
        { 
            required: !props.isMonitoring, 
            message: '请输入报告间隔', 
            trigger: 'blur' 
        }
    ]
};

const handleSubmit = async () => {
    try {
        await formRef.value?.validate();
        emit('submit', form);
    } catch (error) {
        console.error('表单验证失败:', error);
    }
};

const handleReset = () => {
    form.controlType = props.isMonitoring ? 2 : 1;
    form.container = '';
    form.reportInterval = 10;
    // 重置时保持场景ID，因为它是自动填入的
    if (currentSessionId.value) {
        form.sessionId = currentSessionId.value.toString();
    }
    // 清除存储的容器选择
    try {
        localStorage.removeItem('nodeMeasurementContainer');
    } catch (error) {
        console.warn('清除存储的容器选择失败:', error);
    }
    emit('reset');
};
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

.selection-info {
    margin-top: 5px;
    font-size: 12px;
    color: #6a9fd8;
}
</style>