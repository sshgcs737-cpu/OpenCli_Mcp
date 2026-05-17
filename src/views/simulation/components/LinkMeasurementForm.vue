<template>
    <el-card class="measurement-card">
        <template #header>
            <div class="card-header">
                <label>链路测量下发</label>
                <el-tooltip content="配置链路测量参数，支持iperf和hping3等测量工具">
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
                style="margin-bottom: 10px;"
            >
                <template #default>
                    请先在场景中添加Router类型的节点
                </template>
            </el-alert>
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="测量类型" prop="controlType">
                        <el-select v-model="form.controlType" placeholder="请选择测量类型" style="width: 100%">
                            <el-option label="iperf TCP吞吐量测试" :value="1"></el-option>
                            <el-option label="iperf UDP吞吐量、抖动、丢包测试" :value="2"></el-option>
                            <el-option label="hping3 延迟测试" :value="3"></el-option>
                            <el-option label="iperf TCP灌流量" :value="11"></el-option>
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                    <el-form-item label="场景ID" prop="sessionId">
                        <el-input v-model="form.sessionId" placeholder="请输入场景ID"></el-input>
                    </el-form-item>
                </el-col>
            </el-row>
            
            <!-- 链路配置表格 -->
            <el-form-item label="链路配置" prop="links">
                <div class="link-config-container" style="width: 100%">
                    <!-- 容器链路信息提示 -->
                    <el-alert 
                        v-if="routeLinks.length > 0" 
                        :title="`当前场景中发现 ${routeLinks.length} 条容器链路`" 
                        type="success" 
                        :closable="false"
                        show-icon
                        style="margin-bottom: 10px;"
                    >
                    </el-alert>
                    <el-alert 
                        v-else 
                        title="当前场景中没有发现容器链路" 
                        type="warning" 
                        :closable="false"
                        show-icon
                        style="margin-bottom: 10px;"
                    >
                        <template #default>
                            请确保场景中包含DOCKER类型的节点，并且它们之间有链路连接
                        </template>
                    </el-alert>
                    
                    <div class="link-config-header">
                        <span>链路配置列表</span>
                        <div class="link-config-actions">
                            <el-button 
                                type="success" 
                                size="small" 
                                @click="selectFromRouteLinks"
                                :disabled="routeLinks.length === 0"
                            >
                                <el-icon><Select /></el-icon>
                                从容器链路选择
                            </el-button>
                        </div>
                    </div>
                    
                    <!-- 已选择的链路配置表格 -->
                    <el-table 
                        v-if="form.links.length > 0"
                        :data="form.links" 
                        border 
                        style="width: 100%; margin: 10px 0;"
                        :row-key="(row: any) => row.id"
                    >
                        <el-table-column type="index" label="序号" width="60"></el-table-column>
                        <el-table-column label="源容器" min-width="150">
                            <template #default="scope">
                                {{ getContainerDisplayName(scope.row.srcContainer) }}
                            </template>
                        </el-table-column>
                        <el-table-column label="目的容器" min-width="150">
                            <template #default="scope">
                                {{ getContainerDisplayName(scope.row.dstContainer) }}
                            </template>
                        </el-table-column>
                        <el-table-column prop="srcIp" label="源IP" min-width="150"></el-table-column>
                        <el-table-column prop="dstIp" label="目的IP" min-width="150"></el-table-column>
                        <el-table-column label="操作" width="80">
                            <template #default="scope">
                                <el-button 
                                    type="danger" 
                                    size="small" 
                                    :icon="Delete" 
                                    @click="removeLinkConfig(scope.$index)"
                                ></el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                    
                    <!-- 当没有选择链路时显示提示 -->
                    <div v-else class="no-links-hint">
                        暂无链路配置，请点击"从容器链路选择"按钮添加
                    </div>
                    
                    <!-- 容器链路选择对话框 -->
                    <el-dialog v-model="routeLinkDialogVisible" title="选择容器链路" width="60%">
                        <div class="route-link-selection">
                            <el-alert 
                                title="当前场景中的容器链路" 
                                type="info" 
                                :closable="false"
                                style="margin-bottom: 20px;"
                            />
                            
                            <el-table 
                                :data="routeLinks" 
                                style="width: 100%" 
                                @current-change="handleRouteLinkCurrentChange"
                                max-height="400"
                                :row-key="(row: any) => row.id"
                                :header-cell-style="{ textAlign: 'center', backgroundColor: '#f5f7fa', fontWeight: 'bold' }"
                                :highlight-current-row="true"
                                :cell-style="{ textAlign: 'center' }"
                            >
                                <el-table-column prop="label" label="链路" width="200" />
                                <el-table-column prop="description" label="详细信息" min-width="300" />
                                <el-table-column label="方向" width="200">
                                    <template #default="scope">
                                        <div>
                                            <el-tag size="small" :type="getNodeTypeTag(scope.row.node1.type)">
                                                {{ scope.row.node1.alias || scope.row.node1.name }}
                                            </el-tag>
                                            <span style="margin: 0 5px;">-></span>
                                            <el-tag size="small" :type="getNodeTypeTag(scope.row.node2.type)">
                                                {{ scope.row.node2.alias || scope.row.node2.name }}
                                            </el-tag>
                                        </div>
                                    </template>
                                </el-table-column>
                            </el-table>
                            
                            <div style="margin-top: 20px; text-align: right;">
                                <el-button @click="routeLinkDialogVisible = false">取消</el-button>
                                <el-button type="primary" @click="confirmRouteLinkSelection">
                                    确认选择
                                </el-button>
                            </div>
                        </div>
                    </el-dialog>
                    
                    <div class="selection-info">
                        已配置 {{ form.links.length }} 条链路
                    </div>
                </div>
            </el-form-item>
            
            <el-row :gutter="20">
                <el-col :span="12">
                    <el-form-item label="测试时间(秒)" prop="testTime">
                        <el-input-number v-model="form.testTime" :min="1" :max="3600" placeholder="测试时间" style="width: 100%"></el-input-number>
                    </el-form-item>
                </el-col>
                <el-col :span="12">
                    <el-form-item label="带宽限制" prop="bandwidthLimit">
                        <el-input v-model="form.bandwidthLimit" placeholder="带宽限制(可选)"></el-input>
                    </el-form-item>
                </el-col>
            </el-row>
            
            <el-form-item >
                <el-button type="primary" @click="handleSubmit" :loading="loading">
                    <el-icon><VideoPlay /></el-icon>
                    开始测量
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
import { QuestionFilled, VideoPlay, Refresh, Select, Delete } from '@element-plus/icons-vue';
import type { FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { getNodeTypeTag } from '../utils/chartUtils';
import type { LinkMeasurementForm, RouteLink } from '../types';
import { useTopoStore } from '../../../store/modules/topo';

interface Props {
    dockerNodes: any[];
    routeLinks: RouteLink[];
    loading?: boolean;
}

interface Emits {
    (e: 'submit', form: LinkMeasurementForm): void;
    (e: 'reset'): void;
}

const props = withDefaults(defineProps<Props>(), {
    loading: false
});

const emit = defineEmits<Emits>();

const formRef = ref();
const routeLinkDialogVisible = ref(false);
const selectedRouteLink = ref<any>(null);
const topoStore = useTopoStore();

const getContainerDisplayName = (containerName: string) => {
    const targetNode = props.dockerNodes.find((node: any) => node.name === containerName);
    return targetNode?.alias || targetNode?.name || containerName;
};

// 计算当前场景ID
const currentSessionId = computed(() => topoStore.currentSessionId);

const form = reactive<LinkMeasurementForm>({
    controlType: 1,
    sessionId: '',
    links: [],
    testTime: 10,
    bandwidthLimit: ''
});

// 监听场景ID变化，自动填入表单
watch(currentSessionId, (newSessionId) => {
    if (newSessionId) {
        form.sessionId = newSessionId.toString();
    }
}, { immediate: true });

const rules: FormRules = {
    sessionId: [
        { required: true, message: '请输入场景ID', trigger: 'blur' }
    ],
    testTime: [
        { required: true, message: '请输入测试时间', trigger: 'blur' }
    ],
    links: [
        { 
            type: 'array', 
            required: true, 
            message: '请至少添加一条链路配置', 
            trigger: 'change' 
        }
    ]
};

const handleRouteLinkCurrentChange = (current: any) => {
    selectedRouteLink.value = current;
};

const confirmRouteLinkSelection = () => {
    if (!selectedRouteLink.value) {
        ElMessage.warning('请选择一条链路');
        return;
    }
    const rl = selectedRouteLink.value;
    // 检查是否已添加该链路，避免重复
    const isDuplicate = form.links.some(link => 
        link.srcContainer === rl.node1.container && 
        link.dstContainer === rl.node2.container
    );
    
    if (isDuplicate) {
        ElMessage.warning('该链路已添加，请勿重复添加');
        return;
    }
    
    form.links.push({
        id: Date.now() + Math.random(),
        srcContainer: rl.node1.container,
        dstContainer: rl.node2.container,
        srcIp: rl.node1.ip,
        dstIp: rl.node2.ip
    });
    routeLinkDialogVisible.value = false;
    selectedRouteLink.value = null;
    ElMessage.success('已添加 1 条链路配置');
};

const selectFromRouteLinks = () => {
    if (props.routeLinks.length === 0) {
        ElMessage.warning('当前场景中没有发现容器链路');
        return;
    }
    routeLinkDialogVisible.value = true;
};

const removeLinkConfig = (index: number) => {
    form.links.splice(index, 1);
    ElMessage.success('已删除选中的链路配置');
};

const updateLinkConfig = (index: number, field: 'src' | 'dst') => {
    const link = form.links[index];
    if (!link) return;
    
    // 根据选择的容器自动设置IP
    if (field === 'src') {
        const selectedNode = props.dockerNodes.find((node: any) => node.name === link.srcContainer);
        if (selectedNode) {
            link.srcIp = selectedNode.ip || '';
        }
    } else {
        const selectedNode = props.dockerNodes.find((node: any) => node.name === link.dstContainer);
        if (selectedNode) {
            link.dstIp = selectedNode.ip || '';
        }
    }
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
    form.controlType = 1;
    form.links = [];
    form.testTime = 10;
    form.bandwidthLimit = '';
    // 重置时保持场景ID，因为它是自动填入的
    if (currentSessionId.value) {
        form.sessionId = currentSessionId.value.toString();
    }
    emit('reset');
};
</script>

<style scoped lang="scss">
.measurement-card {
    margin-bottom: 10px;
    
    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0px;
    }
}

.selection-info {
    margin-top: 2px;
    font-size: 12px;
    color: #6a9fd8;
    text-align: right;
}

.link-config-container {
    border: 1px solid rgba(0, 150, 255, 0.15);
    border-radius: 4px;
    padding: 10px;
    background-color: rgba(0, 20, 60, 0.4);
}

.link-config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-weight: 500;
    color: #a0d4ff;
}

.link-config-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.route-link-selection {
    .el-alert {
        margin-bottom: 10px;
    }
    
    .el-table {
        .el-tag {
            margin-right: 5px;
        }
    }
}

.no-links-hint {
    text-align: center;
    padding: 20px;
    color: #6a9fd8;
    border: 1px dashed rgba(0, 150, 255, 0.2);
    border-radius: 4px;
    margin: 10px 0;
}
</style>
