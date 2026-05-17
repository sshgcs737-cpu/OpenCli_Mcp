<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">干扰参数配置</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <div class="config-section">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">干扰参数</span>
            </div>

            <div class="form-row">
              <div class="form-label">干扰类型</div>
              <el-radio-group v-model="configForm.interfereType" size="small" class="interfere-type-radio-group">
                <el-radio label="压制">压制干扰</el-radio>
                <el-radio label="干扰">阻塞干扰</el-radio>
              </el-radio-group>
            </div>

            <div class="form-row">
              <div class="form-label">干扰模型</div>
              <div class="form-display">{{ configForm.interfereModel }}</div>
            </div>

            <div class="form-row" v-if="configForm.interfereType === '干扰'">
              <div class="form-label">干扰频率</div>
              <el-input-number
                v-model="configForm.interfereFreq"
                :min="0"
                :max="9999999999"
                :step="100"
                size="small"
                class="frequency-input"
                style="width: 180px;"
              />
              <span class="unit-label">Hz</span>
            </div>

            <div class="form-row">
              <div class="form-label">方位角区间</div>
              <div class="angle-range-inputs">
                <el-input-number
                  v-model="configForm.azimuthStart"
                  :min="0"
                  :max="360"
                  :step="1"
                  size="small"
                  class="angle-input"
                />
                <span class="range-separator">至</span>
                <el-input-number
                  v-model="configForm.azimuthEnd"
                  :min="0"
                  :max="360"
                  :step="1"
                  size="small"
                  class="angle-input"
                />
                <span class="unit-label">°</span>
              </div>
            </div>

            <div class="form-row">
              <div class="form-label">俯仰角区间</div>
              <div class="angle-range-inputs">
                <el-input-number
                  v-model="configForm.elevationStart"
                  :min="-90"
                  :max="90"
                  :step="1"
                  size="small"
                  class="angle-input"
                />
                <span class="range-separator">至</span>
                <el-input-number
                  v-model="configForm.elevationEnd"
                  :min="-90"
                  :max="90"
                  :step="1"
                  size="small"
                  class="angle-input"
                />
                <span class="unit-label">°</span>
              </div>
            </div>

            <!-- <div class="form-row">
              <div class="form-label">干扰功率</div>
              <div class="form-slider">
                <el-slider
                  v-model="configForm.interferePowerdb"
                  :min="10"
                  :max="100"
                  :step="5"
                  show-input
                  class="form-input"
                >
                  <template #input>
                    <el-input-number
                      v-model="configForm.interferePowerdb"
                      :min="10"
                      :max="100"
                      :step="5"
                      size="small"
                      class="power-input"
                    />
                  </template>
                  <template #suffix>
                    <span class="unit-label">dBm</span>
                  </template>
                </el-slider>
              </div>
            </div> -->
            <div class="form-row" >
              <div class="form-label">干扰功率</div>
              <el-input-number
                v-model="configForm.interferePowerdb"
                :min="0"
                :max="110"
                :step="10"
                size="small"
                class="frequency-input"
                style="width: 180px;"
              />
              <span class="unit-label">dB</span>
            </div>
          </div>
        </div>

        <div class="custom-dialog-footer">
          <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
          <el-button class="dialog-btn confirm-btn" type="primary" @click="handleConfirm" :loading="isSaving">
            确定
          </el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useTopoStore } from "../../../store/modules/topo";
import { editInterferenceNode, getInodeConfig } from "../../../api/inode";
import { useInterferenceStore } from "../../../store/modules/interference";
import { getUserInfo } from "../../../store/user"; // 导入用户信息获取函数

const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();

interface InterferenceParams {
  interferePowerdb: string | number;
  interfereFreq: string | number;
  azimuth?: string | number;
  elevation?: string | number;
  azimuthStart: number;
  azimuthEnd: number;
  elevationStart: number;
  elevationEnd: number;
  interfereType?: string;
  interfereModel?: string;
}

interface InterferenceNodeConfig {
  id: number;
  nodeId: number;
  sessionId: number;
  interferePowerdb: string;
  interfereFreq: string;
  azimuth: string;
  elevation: string;
  status: string;
  lat: string;
  lon: string;
  alt: string;
  cmd: string;
  type?: string;
  interfereModel?: string;
}

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  nodeId: {
    type: [Number, String],
    default: null,
  },
  interferenceParams: {
    type: Object,
    default: () => ({
      interferePowerdb: 50,
      interfereFreq: 2400,
      azimuth: "0,360",
      elevation: "-90,90"
    })
  }
});

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'confirm': [params: InterferenceParams & { nodeId?: number | string | null }];
  'cancel': [];
}>();

const dialogVisible = ref(props.visible);

const isSaving = ref(false);

const parseRangeString = (rangeStr: string, defaultStart: number, defaultEnd: number) => {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { start: defaultStart, end: defaultEnd };
  }
  
  const parts = rangeStr.split(',');
  if (parts.length === 2) {
    const start = parseFloat(parts[0]);
    const end = parseFloat(parts[1]);
    return { 
      start: isNaN(start) ? defaultStart : start, 
      end: isNaN(end) ? defaultEnd : end 
    };
  }
  
  return { start: defaultStart, end: defaultEnd };
};

const configForm = reactive<InterferenceParams>({
  interfereType: '压制',
  interferePowerdb: 50,
  interfereFreq: 0,
  azimuthStart: 0,
  azimuthEnd: 360,
  elevationStart: -90,
  elevationEnd: 90,
  interfereModel: '带内干扰模型',
});

// 监听外部可见性变化
watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val;
    if (val && props.nodeId) { // 确保对话框可见且有nodeId才加载配置
      // 尝试从 interferenceStore 获取最新的配置（如果它已经存在）
      // 否则，使用 props.interferenceParams 作为回退
      let currentParams = interferenceStore.getConfigByNodeId(Number(props.nodeId)) as InterferenceNodeConfig | undefined;

      if (currentParams) {
      } else {
        // 如果store中没有，则将 props.interferenceParams 结构转换为 store 中的格式以便统一处理
        currentParams = {
          id: 0, // 临时ID
          nodeId: Number(props.nodeId),
          sessionId: Number(topoStore.currentSessionId || topoStore.topoData?.id || 0),
          interferePowerdb: String(props.interferenceParams.interferePowerdb || 50),
          interfereFreq: String(props.interferenceParams.interfereFreq === undefined ? (props.interferenceParams.interfereType === '干扰' ? 2347000000 : 0) : props.interferenceParams.interfereFreq),
          azimuth: String(props.interferenceParams.azimuth || "0,360"),
          elevation: String(props.interferenceParams.elevation || "-90,90"),
          status: 'UNKNOWN', // 标记为未知状态，因为prop可能不含此信息
          type: props.interferenceParams.interfereType || '压制', // 从prop或默认值推断
          interfereModel: props.interferenceParams.interfereModel || '带外干扰模型',
          lat: '', // 临时添加必需字段
          lon: '', // 临时添加必需字段
          alt: '', // 临时添加必需字段
          cmd: '' // 临时添加必需字段
        };
      }
      
      // 根据 interfereFreq 和 type (或推断的 interfereType) 设置 configForm.interfereType
      // 如果 interfereFreq 为 '0'，则认为是压制，否则是干扰
      if (currentParams && currentParams.interfereFreq === '0') {
        configForm.interfereType = '压制';
      } else {
        configForm.interfereType = '干扰';
      }
      // 如果 currentParams 中有明确的 type 字段，优先使用它
      if (currentParams && currentParams.type && (currentParams.type === '压制' || currentParams.type === '干扰')) {
        configForm.interfereType = currentParams.type;
      }

      if (currentParams) {
        configForm.interferePowerdb = Number(currentParams.interferePowerdb || 50);
        
        // 解析方位角和俯仰角区间
        // 确保 currentParams.azimuth 和 currentParams.elevation 是字符串类型传递给 parseRangeString
        const azimuthStr = typeof currentParams.azimuth === 'number' ? String(currentParams.azimuth) : currentParams.azimuth;
        const elevationStr = typeof currentParams.elevation === 'number' ? String(currentParams.elevation) : currentParams.elevation;

        const azimuthRange = parseRangeString(azimuthStr || "0,360", 0, 360);
        const elevationRange = parseRangeString(elevationStr || "-90,90", -90, 90);
        
        configForm.azimuthStart = azimuthRange.start;
        configForm.azimuthEnd = azimuthRange.end;
        configForm.elevationStart = elevationRange.start;
        configForm.elevationEnd = elevationRange.end;
        
        // 根据最终确定的 interfereType 设置 interfereFreq
        if (configForm.interfereType === '干扰') {
          // 如果是干扰类型，且原频率是'0'或未定义，则设为默认干扰频率
          configForm.interfereFreq = (currentParams.interfereFreq === '0' || !currentParams.interfereFreq) 
                                      ? 2347000000 
                                      : Number(currentParams.interfereFreq);
        } else {
          configForm.interfereFreq = 0; // 压制类型，频率为0
        }
        // 根据干扰类型设置对应的干扰模型
        if (configForm.interfereType === '压制') {
          configForm.interfereModel = '带外干扰模型';
        } else {
          configForm.interfereModel = '带内干扰模型';
        }
      }
    }
  }
);

watch(dialogVisible, (val) => {
  emit("update:visible", val);
});

watch(
  () => configForm.interfereType,
  (val) => {
    if (val === '压制') {
      configForm.interfereFreq = 0;
      configForm.interfereModel = '带外干扰模型';
    } else if (val === '干扰') {
      configForm.interfereFreq = 2347000000;
      configForm.interfereModel = '带内干扰模型';
    }
  }
);

watch(
  () => props.interferenceParams,
  (newParams) => {
    if (newParams) {
      configForm.interferePowerdb = Number(newParams.interferePowerdb || 50);
      
      const azimuthRange = parseRangeString(newParams.azimuth as string, 0, 360);
      const elevationRange = parseRangeString(newParams.elevation as string, -90, 90);
      
      configForm.azimuthStart = azimuthRange.start;
      configForm.azimuthEnd = azimuthRange.end;
      configForm.elevationStart = elevationRange.start;
      configForm.elevationEnd = elevationRange.end;
      
      configForm.interfereFreq = configForm.interfereType === '干扰' ? 2347000000 : 0;
      configForm.interfereModel = configForm.interfereType === '压制' ? '带外干扰模型' : '带内干扰模型';
    }
  },
  { deep: true }
);

watch(
  () => configForm.azimuthStart,
  (newVal) => {
    if (newVal > configForm.azimuthEnd) {
      configForm.azimuthEnd = newVal;
      ElMessage.warning("方位角起始值不能大于结束值");
    }
  }
);

watch(
  () => configForm.azimuthEnd,
  (newVal) => {
    if (newVal < configForm.azimuthStart) {
      configForm.azimuthStart = newVal;
      ElMessage.warning("方位角结束值不能小于起始值");
    }
  }
);

watch(
  () => configForm.elevationStart,
  (newVal) => {
    if (newVal > configForm.elevationEnd) {
      configForm.elevationEnd = newVal;
      ElMessage.warning("俯仰角起始值不能大于结束值");
    }
  }
);

watch(
  () => configForm.elevationEnd,
  (newVal) => {
    if (newVal < configForm.elevationStart) {
      configForm.elevationStart = newVal;
      ElMessage.warning("俯仰角结束值不能小于起始值");
    }
  }
);

const handleClose = () => {
  dialogVisible.value = false;
  emit("cancel");
};

const handleConfirm = async () => {
  try {
    isSaving.value = true;
    
    if (!topoStore.currentSessionId && !topoStore.topoData?.id) {
      throw new Error('缺少会话ID');
    }
    
    if (!props.nodeId) {
      throw new Error('缺少节点ID');
    }
    
    if (configForm.azimuthStart > configForm.azimuthEnd) {
      throw new Error('方位角起始值不能大于结束值');
    }
    
    if (configForm.elevationStart > configForm.elevationEnd) {
      throw new Error('俯仰角起始值不能大于结束值');
    }
    
    const azimuthString = `${configForm.azimuthStart},${configForm.azimuthEnd}`;
    const elevationString = `${configForm.elevationStart},${configForm.elevationEnd}`;
    
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    // 获取节点的当前位置信息
    const node = topoStore.topoData?.nodes?.find((n: any) => n.id === Number(props.nodeId));
    if (!node) {
      throw new Error('找不到对应的节点');
    }

    const requestData = {
      sessionId: topoStore.currentSessionId || topoStore.topoData?.id,
      nodeId: Number(props.nodeId),
      lat: String(node.geo.lat),
      lon: String(node.geo.lon),
      alt: String(node.geo.alt),
      interferePowerdb: String(configForm.interferePowerdb),
      interfereFreq: configForm.interfereType === '压制' ? '0' : String(configForm.interfereFreq),
      azimuth: azimuthString,
      elevation: elevationString,
      interfereModel: configForm.interfereModel,
      userId: userId
    };
    
    
    try {
      const responseData = await editInterferenceNode(requestData);
      
      
      const params: InterferenceParams & { nodeId?: number | string | null } = {
        interferePowerdb: configForm.interferePowerdb,
        interfereFreq: configForm.interfereFreq,
        azimuth: azimuthString,
        elevation: elevationString,
        azimuthStart: configForm.azimuthStart,
        azimuthEnd: configForm.azimuthEnd,
        elevationStart: configForm.elevationStart,
        elevationEnd: configForm.elevationEnd,
        interfereModel: configForm.interfereModel,
        nodeId: props.nodeId,
      };
      
      const sessionId = topoStore.currentSessionId || topoStore.topoData?.id;
      
      // 保存当前节点的本地状态（RUNTIME/SHUTDOWN 由开关设置，不应被服务端数据覆盖）
      const nodeId = Number(props.nodeId);
      const existingConfig = interferenceStore.getConfigByNodeId(nodeId);
      const preservedStatus = existingConfig?.status;
      
      if (sessionId) {
        try {
          await interferenceStore.fetchInterferenceConfigs(sessionId);
        } catch (configError) {
          console.error('获取最新干扰节点配置失败:', configError);
        }
        
        // fetchInterferenceConfigs 会替换整个配置数组，可能将 RUNTIME/SHUTDOWN 状态覆盖
        // 恢复由开关操作设置的本地状态，确保移动中的干扰定时器不被中断
        if (preservedStatus === 'RUNTIME' || preservedStatus === 'SHUTDOWN') {
          const refreshedConfig = interferenceStore.getConfigByNodeId(nodeId);
          if (refreshedConfig && refreshedConfig.status !== preservedStatus) {
            interferenceStore.updateInterferenceConfig({
              ...refreshedConfig,
              status: preservedStatus
            });
          }
        }
      }
      
      emit('confirm', params);
      
      dialogVisible.value = false;
      
      ElMessage.success("干扰参数配置已保存");
    } catch (apiError: any) {
      console.error('API请求出错:', apiError);
      if (apiError.response && apiError.response.data) {
        const errorData = apiError.response.data;
        throw new Error(errorData.msg || errorData.message || '保存失败');
      }
      throw apiError;
    }
  } catch (error: any) {
    console.error("保存干扰参数失败:", error);
    ElMessage.error(error?.message || "保存干扰参数失败，请重试");
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
/* 对话框蒙层 */
.custom-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

/* 对话框容器 */
.custom-dialog {
  width: 560px;
  background: rgba(25, 32, 44, 0.98);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  font-family: "Microsoft YaHei", sans-serif;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  animation: slideIn 0.3s ease;
  position: relative;
  overflow: hidden;
}

.custom-dialog::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 87, 34, 0.5), transparent);
}

/* 对话框标题栏 */
.custom-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(41, 54, 73, 0.8);
  background: rgba(30, 39, 54, 0.8);
}

.custom-dialog-title {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  position: relative;
  padding-left: 12px;
}

.custom-dialog-title::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: #ff5722;
  border-radius: 2px;
}

.custom-dialog-close {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #7f8c9d;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.custom-dialog-close:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: rotate(90deg);
}

.close-icon {
  font-style: normal;
}

/* 对话框内容区 */
.custom-dialog-body {
  padding: 24px;
  max-height: 65vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 87, 34, 0.3) transparent;
}

.custom-dialog-body::-webkit-scrollbar {
  width: 6px;
}

.custom-dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.custom-dialog-body::-webkit-scrollbar-thumb {
  background-color: rgba(255, 87, 34, 0.3);
  border-radius: 3px;
}

/* 对话框底部 */
.custom-dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px 24px;
  background: rgba(30, 39, 54, 0.8);
  border-top: 1px solid rgba(41, 54, 73, 0.8);
}

/* 表单样式 */
.config-section {
  margin-bottom: 28px;
  background: rgba(35, 45, 60, 0.4);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 87, 34, 0.08);
  transition: all 0.3s ease;
}

.config-section:hover {
  border-color: rgba(255, 87, 34, 0.3);
  box-shadow: 0 0 20px rgba(255, 87, 34, 0.1);
}

.section-title-block {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #ff5722, #ff9800);
  margin-right: 10px;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(255, 87, 34, 0.3);
}

.section-title {
  font-size: 14px;
  color: #ff5722;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.form-row {
  display: flex;
  margin-bottom: 16px;
  align-items: center;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 80px;
  text-align: right;
  padding-right: 16px;
  color: #a0aec0;
  font-size: 13px;
  font-weight: 500;
}

.form-input {
  flex: 1;
}

.form-display {
  flex: 1;
  color: #e0e0e0;
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(30, 40, 55, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  min-height: 16px;
  display: flex;
  align-items: center;
}

.form-slider {
  flex: 1;
  display: flex;
  align-items: center;
}

.unit-label {
  margin-left: 8px;
  color: #a0aec0;
  font-size: 12px;
}

/* 新增角度区间样式 */
.angle-range-inputs {
  display: flex;
  align-items: center;
  flex: 1;
}

.angle-input {
  width: 100px;
}

.range-separator {
  margin: 0 10px;
  color: #a0aec0;
  font-size: 14px;
}

/* 按钮样式 */
.dialog-btn {
  min-width: 90px;
  height: 36px;
  font-size: 14px;
  border-radius: 6px;
  border: none;
  font-weight: 500;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.dialog-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transform: translateX(-100%);
  transition: transform 0.6s ease;
}

.dialog-btn:hover::after {
  transform: translateX(100%);
}

.cancel-btn {
  background: rgba(40, 57, 80, 0.8);
  color: #fff;
  margin-right: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background: rgba(53, 70, 92, 0.8);
  transform: translateY(-1px);
}

.confirm-btn {
  background: linear-gradient(135deg, #e65100, #ff5722);
  color: #fff;
  box-shadow: 0 4px 15px rgba(255, 87, 34, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #ff5722, #e65100);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 87, 34, 0.4);
}

/* Element Plus样式覆盖 */
:deep(.el-input__wrapper) {
  background-color: rgba(30, 40, 55, 0.6) !important;
  box-shadow: none !important;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(255, 87, 34, 0.3);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #ff5722;
  box-shadow: 0 0 0 1px rgba(255, 87, 34, 0.2) !important;
}

:deep(.el-input__inner) {
  color: #fff;
  height: 36px;
  font-size: 13px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.3) !important;
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.05);
}

:deep(.el-slider__runway) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-slider__bar) {
  background-color: #ff5722;
}

:deep(.el-slider__button) {
  border-color: #ff5722;
}

/* ---- 新增/修改 el-input-number 样式 ---- */
/* 整体 el-input-number 容器 (small size) */
:deep(.el-input-number.el-input-number--small) {
  width: 120px; /* 调整宽度以适应按钮和数字 */
  height: 30px; /* 减小高度 */
  border: 1px solid rgba(255, 255, 255, 0.08); /* 统一边框 */
  border-radius: 6px; /* 统一圆角 */
  background-color: rgba(30, 40, 55, 0.6); /* 统一背景 */
  display: flex; /* 使用flex布局子元素 */
  overflow: hidden; /* 确保子元素的圆角效果正确 */
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
:deep(.el-input-number.el-input-number--small:hover) {
  border-color: rgba(255, 87, 34, 0.4);
}
/* Element Plus 使用 is-focus 类来表示聚焦状态 */
:deep(.el-input-number.el-input-number--small.is-focus) {
  border-color: #ff5722 !important;
  box-shadow: 0 0 0 1px rgba(255, 87, 34, 0.3) !important;
}

/* 加减按钮 */
:deep(.el-input-number.el-input-number--small .el-input-number__decrease),
:deep(.el-input-number.el-input-number--small .el-input-number__increase) {
  width: 28px; /* 按钮宽度 */
  height: 100%; /* 按钮高度撑满 */
  background: transparent; /* 按钮背景透明或与父容器略有区别 */
  color: #a0aec0;
  border: none; /* 移除按钮自身边框 */
  position: relative; /* 用于伪元素分隔线 */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  font-size: 12px; /* 调整图标大小 */
  line-height: 30px; /* 确保 +/- 垂直居中 */
}

:deep(.el-input-number.el-input-number--small .el-input-number__decrease:hover),
:deep(.el-input-number.el-input-number--small .el-input-number__increase:hover) {
  background: rgba(255, 255, 255, 0.08) !important;
  color: #fff !important;
}

/* 按钮和输入区域的分隔线 */
:deep(.el-input-number.el-input-number--small .el-input-number__decrease::after),
:deep(.el-input-number.el-input-number--small .el-input-number__increase::before) {
  content: "";
  position: absolute;
  top: 20%;
  bottom: 20%;
  width: 1px;
  background-color: rgba(255, 255, 255, 0.08); /* 分隔线颜色 */
}
:deep(.el-input-number.el-input-number--small .el-input-number__decrease::after) {
  right: 0;
}
:deep(.el-input-number.el-input-number--small .el-input-number__increase::before) {
  left: 0;
}

/* 中间的输入区域 el-input (此选择器是el-input-number内部的el-input组件) */
:deep(.el-input-number.el-input-number--small .el-input) {
  flex: 1; /* 占据剩余空间 */
  height: 100%;
}

/* 输入区域的 wrapper */
:deep(.el-input-number.el-input-number--small .el-input__wrapper) {
  background-color: transparent !important; /* 背景透明，由父级 el-input-number 控制 */
  border: none !important; /* 移除 wrapper 边框 */
  box-shadow: none !important; /* 移除 wrapper 阴影 */
  padding: 0 !important; /* 移除 wrapper padding */
  height: 100%;
  display: flex;
  align-items: center;
}

/* 实际的 input 元素 */
:deep(.el-input-number.el-input-number--small .el-input__inner) {
  height: 100%; /* 高度撑满 wrapper */
  line-height: normal; /* 移除可能导致对不齐的 line-height */
  color: #e0e0e0; /* 文本颜色调亮一些 */
  font-size: 13px;
  text-align: center;
  padding: 0 3px; /* 输入框内部左右 padding */
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  width: 100%; /* 宽度撑满 */
}
/* ---- 结束新增/修改 el-input-number 样式 ---- */

/* 动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 针对 Element Plus input 组件隐藏原生 number 箭头 */
:deep(.el-input__inner[type='number'])::-webkit-inner-spin-button,
:deep(.el-input__inner[type='number'])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
:deep(.el-input__inner[type='number']) {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* 干扰类型单选组样式 */
.interfere-type-radio-group :deep(.el-radio),
.interfere-type-radio-group :deep(.el-radio__label) {
  color: #fff !important;
  font-size: 15px !important;
}
</style> 