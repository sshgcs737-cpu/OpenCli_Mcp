<template>
  <!-- 无人机路径绘制与移动控制面板 -->
  <div v-show="visible" class="drone-path-panel">
    <div class="panel-header">
      <h3>节点路径</h3>
      <div class="panel-btns">
        <template v-if="!isDrawing">
          <el-button
            type="primary"
            size="small"
            class="tech-button"
            @click="startDrawPath"
          >
            绘制路径
          </el-button>
          <el-button
            type="info"
            size="small"
            class="tech-button-info"
            @click="showCirclePathDialog"
          >
            圆形路径
          </el-button>
          <el-button
            type="info"
            size="small"
            class="tech-button-info"
            @click="showFigure8PathDialog"
          >
            8字形路径
          </el-button>
        </template>
        <template v-else>
          <el-button
            type="danger"
            size="small"
            class="tech-button-danger"
            @click="finishDrawPath"
          >
            完成绘制
          </el-button>
          <el-button
            type="warning"
            size="small"
            class="tech-button-warning"
            @click="cancelDrawPath"
          >
            取消绘制
          </el-button>
        </template>
        <el-button
          type="warning"
          size="small"
          class="tech-button-warning"
          @click="$emit('update:visible', false)"
        >
          关闭
        </el-button>
      </div>
    </div>

    <!-- 路径列表 -->
    <div class="path-list">
      <div v-if="pathList.length === 0" class="no-path">
        <p>暂无保存的路径</p>
        <p class="hint">点击"开始绘制路径"按钮绘制新路径</p>
      </div>

      <div v-for="path in pathList" :key="path.id" class="path-card">
        <div class="path-card-top">
          <span class="path-name">{{ path.name }}</span>
          <div class="path-actions">
            <el-button type="primary" size="small" class="tech-button" @click="previewPath(path.id)">预览</el-button>
            <el-button type="success" size="small" class="tech-button-success" @click="showDroneSelection(path.id)">分配节点</el-button>
            <el-button type="info" size="small" class="tech-button-info" @click="showFormationDialog(path.id)">创建编队</el-button>
            <el-button type="danger" size="small" class="tech-button-danger" @click="deletePath(path.id)">删除</el-button>
          </div>
        </div>
        <div class="path-speed-row">
          <span class="speed-label-inline">移动速度</span>
          <el-input-number
            :model-value="getPathSpeed(path.id)"
            @update:model-value="(val: number) => setPathSpeed(path.id, val)"
            :min="1"
            :max="1000"
            :step="5"
            size="small"
            controls-position="right"
            class="path-speed-input"
          />
          <span class="speed-unit-inline">米/秒</span>
          <span v-if="isPathFlying(path.id)" class="speed-flying-badge">移动中</span>
        </div>
      </div>
    </div>

    <!-- 无人机列表 -->
    <div v-if="droneList.length > 0" class="drone-list">
      <h4>可用节点</h4>
      <div
        v-for="drone in droneList"
        :key="drone.id"
        class="drone-card"
      >
        <div class="drone-info">
          <span class="drone-name">{{ drone.alias || drone.name }}</span>
          <span
            class="drone-status"
            :class="{ 'has-path': hasPath(drone.id) }"
          >
            {{ hasPath(drone.id) ? "已设置路径" : "无路径" }}
          </span>
        </div>
        <div class="drone-actions">
          <el-button 
            v-if="hasPath(drone.id)" 
            type="success" 
            size="small" 
            class="tech-button-success"
            @click="startFly(drone.id)"
            :disabled="isFlying(drone.id)"
          >
            {{ isFlying(drone.id) ? "移动中" : "移动" }}
          </el-button>
          <el-button 
            v-if="isFlying(drone.id)" 
            type="danger" 
            size="small" 
            class="tech-button-danger"
            @click="stopFly(drone.id)"
          >
            停止
          </el-button>
        </div>
      </div>
    </div>

    <!-- 添加编队信息和操作区域 -->
    <div v-if="hasFormation" class="formation-info-section">
      <h4>当前编队</h4>
      <div class="formation-info-card">
        <div class="formation-info">
          <div class="info-row">
            <span class="info-label">编队类型:</span>
            <span class="info-value">{{ formatFormationType(pendingFormation.formationType) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">节点数量:</span>
            <span class="info-value">{{ pendingFormation.entityIds?.length || 0 }} 架</span>
          </div>
          <div class="info-row">
            <span class="info-label">移动速度:</span>
            <span class="info-value">{{ pendingFormation.speed }} 米/秒</span>
          </div>
        </div>
        <div class="formation-actions">
          <el-button type="success" size="small" class="tech-button-success" @click="showFormationConfirmDialog">
            开始移动
          </el-button>
          <el-button type="danger" size="small" class="tech-button-danger" @click="cancelFormation">
            取消编队
          </el-button>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button v-if="flyingDrones.length > 0" type="danger" class="tech-button-danger" @click="stopAllFlights">
        停止所有移动
      </el-button>
      <el-button v-if="droneList.some(d => hasPath(d.id) && !isFlying(d.id))" type="success" class="tech-button-success" @click="startAllDrones">
        所有节点移动
      </el-button>
    </div>

    <!-- 高度输入对话框 -->
    <el-dialog
      v-model="heightDialogVisible"
      title="设置高度"
      width="300px"
      :close-on-click-modal="false"
      :show-close="false"
      class="tech-dialog"
    >
      <p>请为点 #{{ currentPointIndex + 1 }} 设置高度</p>
      <el-input
        v-model.number="pointHeight"
        type="number"
        placeholder="请输入高度(米)"
        class="tech-input"
      ></el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelPointHeight" class="tech-button-cancel">取消</el-button>
          <el-button type="primary" @click="confirmPointHeight" class="tech-button">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 路径名称输入对话框 -->
    <el-dialog
      v-model="nameDialogVisible"
      title="保存路径"
      width="300px"
      :close-on-click-modal="false"
      :show-close="false"
      :before-close="handleNameDialogClose"
      :close-on-press-escape="false"
      class="tech-dialog"
    >
      <p>请为当前路径设置一个名称</p>
      <el-input
        v-model="pathName"
        placeholder="请输入路径名称"
        autofocus
        class="tech-input"
      ></el-input>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="cancelPathName" class="tech-button-cancel">取消</el-button>
          <el-button type="primary" @click="confirmPathName" class="tech-button">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 无人机选择对话框 -->
    <el-dialog
      v-model="droneSelectionVisible"
      title="选择节点"
      width="400px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <p>为路径 {{ selectedPathName }} 分配节点</p>
      <div v-if="droneList.length === 0" class="no-drones">
        暂无可用节点
      </div>
      <el-table
        v-else
        :data="droneList"
        style="width: 100%"
        height="250"
        @selection-change="handleDroneSelectionChange"
        class="tech-table"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column property="id" label="ID" width="80" />
        <el-table-column label="名称">
          <template #default="scope">
            {{ scope.row.alias || scope.row.name }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="hasPath(scope.row.id) ? 'success' : 'info'" class="tech-tag">
              {{ hasPath(scope.row.id) ? "已设置路径" : "无路径" }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="droneSelectionVisible = false" class="tech-button-cancel">取消</el-button>
          <el-button type="primary" @click="assignPathToDrones" class="tech-button">分配路径</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编队设置对话框 -->
    <el-dialog
      v-model="formationDialogVisible"
      title="创建编队移动"
      width="450px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <p>为路径 {{ selectedPathName }} 创建编队移动</p>
      <div v-if="droneList.length < 2" class="no-drones">
        编队移动需要至少两个节点
      </div>
      <div v-else>
        <h4>选择编队节点</h4>
        <el-table
          :data="droneList"
          style="width: 100%"
          height="250"
          @selection-change="handleFormationDroneChange"
          class="tech-table"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column property="id" label="ID" width="80" />
          <el-table-column property="name" label="名称" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="isFlying(scope.row.id) ? 'danger' : 'info'" class="tech-tag">
                {{ isFlying(scope.row.id) ? "移动中" : "待命" }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        
        <h4>编队选项</h4>
        <div class="formation-options">
          <el-form label-position="top" size="small">
            <!-- 新增：编队队形选择 -->
            <el-form-item label="编队队形">
              <el-select v-model="formationType" placeholder="请选择编队队形" class="tech-select">
                <el-option label="跟随模式" value="follow" />
                <el-option label="立方体队形" value="cubic" />
                <el-option label="圆柱队形" value="cylinder" />
              </el-select>
            </el-form-item>

            <!-- 根据不同的队形显示不同的配置选项 -->
            <!-- 跟随模式选项 -->
            <template v-if="formationType === 'follow'">
              <el-form-item label="延迟时间(秒)">
                <el-slider v-model="formationOptions.pathDelay" :min="0.5" :max="50" :step="0.5" show-input />
              </el-form-item>
            </template>
            
            <!-- 立方体队形选项 -->
            <template v-else-if="formationType === 'cubic'">
              <el-form-item label="编队间距(米)">
                <el-slider v-model="formationOptions.spacing" :min="10" :max="1000" :step="5" show-input />
              </el-form-item>
              
              <el-form-item label="立方体结构">
                <div class="cubic-settings">
                  <el-input-number v-model="formationOptions.cubicWidth" :min="1" :max="100" controls-position="right" size="small" placeholder="宽度" />
                  <span class="cubic-label">×</span>
                  <el-input-number v-model="formationOptions.cubicLength" :min="1" :max="100" controls-position="right" size="small" placeholder="长度" />
                  <span class="cubic-label">×</span>
                  <el-input-number v-model="formationOptions.cubicLayers" :min="1" :max="100" controls-position="right" size="small" placeholder="高度" />
                </div>
                <div class="formation-hint">分别表示X、Y、Z轴上的节点数量</div>
              </el-form-item>
            </template>
            
            <!-- 圆柱队形选项 -->
            <template v-else-if="formationType === 'cylinder'">
              <el-form-item label="圆柱半径(米)">
                <el-slider v-model="formationOptions.radius" :min="20" :max="2000" :step="10" show-input />
              </el-form-item>
              
              <el-form-item label="层高(米)">
                <el-slider v-model="formationOptions.height" :min="5" :max="500" :step="5" show-input />
              </el-form-item>
              
              <el-form-item label="圆柱结构">
                <div class="cylinder-settings">
                  <el-input-number v-model="formationOptions.dronesPerLayer" :min="3" :max="12" controls-position="right" size="small" label="每层节点数" />
                  <span class="cubic-label">×</span>
                  <el-input-number v-model="formationOptions.layers" :min="1" :max="50" controls-position="right" size="small" label="层数" />
                </div>
                <div class="formation-hint">表示每层节点数量和总层数</div>
              </el-form-item>
            </template>

            <el-form-item label="移动速度(米/秒)">
              <el-input-number v-model="formationSpeed" :min="30" :max="1000" :step="5" controls-position="right" class="formation-speed-input" />
            </el-form-item>
          </el-form>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="formationDialogVisible = false" class="tech-button-cancel">取消</el-button>
          <el-button 
            type="primary" 
            :disabled="selectedFormationDrones.length < 2" 
            @click="createFormationFlight" 
            class="tech-button"
          >
            创建编队移动
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 新增：编队确认对话框 -->
    <el-dialog
      v-model="formationConfirmDialogVisible"
      title="编队移动确认"
      width="400px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <div class="formation-confirm-content">
        <p>编队已创建完成，是否立即开始移动？</p>
        <div class="formation-confirm-info">
          <div class="confirm-info-item">
            <span class="confirm-label">编队类型:</span>
            <span class="confirm-value">{{ formatFormationType(pendingFormation.formationType) }}</span>
          </div>
          <div class="confirm-info-item">
            <span class="confirm-label">节点数量:</span>
            <span class="confirm-value">{{ pendingFormation.entityIds?.length || 0 }} 架</span>
          </div>
          <div class="confirm-info-item">
            <span class="confirm-label">移动速度:</span>
            <span class="confirm-value">{{ pendingFormation.speed }} 米/秒</span>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="formationConfirmDialogVisible = false" class="tech-button-cancel">取消</el-button>
          <el-button type="success" @click="startFormationFlight" class="tech-button-success">开始移动</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 圆形路径配置对话框 -->
    <el-dialog
      v-model="circlePathDialogVisible"
      title="创建圆形路径"
      width="450px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <div class="circle-path-config">
        <el-form label-position="top" size="small">
          <el-form-item label="半径 (米)">
            <el-slider
              v-model="circlePathConfig.radius"
              :min="50"
              :max="5000"
              :step="10"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="高度 (米)">
            <el-slider
              v-model="circlePathConfig.height"
              :min="0"
              :max="2000"
              :step="10"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="圆形点数">
            <el-slider
              v-model="circlePathConfig.points"
              :min="8"
              :max="72"
              :step="4"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="路径名称">
            <el-input
              v-model="circlePathConfig.name"
              placeholder="请输入圆形路径名称"
              class="tech-input"
            ></el-input>
          </el-form-item>
        </el-form>

        <div class="circle-path-preview">
          <p class="preview-tip">将以所选节点的位置为圆心创建路径</p>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="circlePathDialogVisible = false" class="tech-button-cancel">取消</el-button>
          <el-button
            type="primary"
            @click="startCreateCirclePath"
            :disabled="!circlePathConfig.name.trim()"
            class="tech-button"
          >
            下一步：选择节点
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 圆形路径节点选择对话框 -->
    <el-dialog
      v-model="circlePathNodeSelectionVisible"
      title="选择节点"
      width="400px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <p>为圆形路径 "{{ circlePathConfig.name }}" 选择节点</p>
      <div v-if="droneList.length === 0" class="no-drones">
        暂无可用节点
      </div>
      <el-table
        v-else
        :data="droneList"
        style="width: 100%"
        height="250"
        class="tech-table"
        @row-click="handleCirclePathNodeSelect"
        highlight-current-row
      >
        <el-table-column property="id" label="ID" width="200" />
        <el-table-column label="名称">
          <template #default="scope">
            {{ scope.row.alias || scope.row.name }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="circlePathNodeSelectionVisible = false" class="tech-button-cancel">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 8字形路径配置对话框 -->
    <el-dialog
      v-model="figure8PathDialogVisible"
      title="创建8字形路径"
      width="450px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <div class="circle-path-config">
        <el-form label-position="top" size="small">
          <el-form-item label="圆弧半径 (米)">
            <el-slider
              v-model="figure8PathConfig.radius"
              :min="50"
              :max="5000"
              :step="10"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="高度 (米)">
            <el-slider
              v-model="figure8PathConfig.height"
              :min="0"
              :max="2000"
              :step="10"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="每圈点数">
            <el-slider
              v-model="figure8PathConfig.points"
              :min="8"
              :max="72"
              :step="4"
              show-input
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="路径名称">
            <el-input
              v-model="figure8PathConfig.name"
              placeholder="请输入8字形路径名称"
              class="tech-input"
            ></el-input>
          </el-form-item>
        </el-form>

        <div class="circle-path-preview">
          <p class="preview-tip">8字形路径由两个相切的圆弧组成，节点位于交叉点</p>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="figure8PathDialogVisible = false" class="tech-button-cancel">取消</el-button>
          <el-button
            type="primary"
            @click="startCreateFigure8Path"
            :disabled="!figure8PathConfig.name.trim()"
            class="tech-button"
          >
            下一步：选择节点
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 8字形路径节点选择对话框 -->
    <el-dialog
      v-model="figure8PathNodeSelectionVisible"
      title="选择节点"
      width="400px"
      :close-on-click-modal="false"
      class="tech-dialog"
    >
      <p>为8字形路径 "{{ figure8PathConfig.name }}" 选择节点</p>
      <div v-if="droneList.length === 0" class="no-drones">
        暂无可用节点
      </div>
      <el-table
        v-else
        :data="droneList"
        style="width: 100%"
        height="250"
        class="tech-table"
        @row-click="handleFigure8PathNodeSelect"
        highlight-current-row
      >
        <el-table-column property="id" label="ID" width="200" />
        <el-table-column label="名称">
          <template #default="scope">
            {{ scope.row.alias || scope.row.name }}
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="figure8PathNodeSelectionVisible = false" class="tech-button-cancel">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import * as Cesium from "cesium";
import { PathRoamingManager } from "../../../utils/PathRoamingManager";
import { DroneFlightManager } from "../../../utils/DroneFlightManager";
import { useTopoStore } from "../../../store/modules/topo";
import { useInterferenceStore } from "../../../store/modules/interference";
import { FormationType, FormationMode } from "../../../utils/FormationManager";
import type { FormationOptions } from "../../../utils/FormationManager";
import { editInterferenceNode, stopNodeInterference } from '../../../api/inode';
import { getUserInfo } from '../../../store/user';

// 导入Element Plus组件
import {
  ElButton,
  ElDialog,
  ElInput,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
} from "element-plus";

// 定义组件接收的props
const props = defineProps({
  viewer: {
    type: Object as () => Cesium.Viewer | null,
    default: null,
  },
  visible: {
    type: Boolean,
    default: false,
  },
});

// 定义组件发出的事件
const emit = defineEmits(["update:visible", "droneFlightManagerReady"]);

// 获取topo仓库
const topoStore = useTopoStore();
const interferenceStore = useInterferenceStore();

// 干扰节点的定时干扰器管理
const interferenceTimers = ref<Map<string | number, number>>(new Map());
const INTERFERENCE_INTERVAL = 1000; // 1秒发送一次干扰请求

// 仿真状态
const isSimulationRunning = computed(() => {
  return topoStore.topoData?.state === 'RUNTIME' || topoStore.topoData?.state === 'RUNNING';
});

// 管理器实例
let pathRoamingManager: any = null;
let droneFlightManager: any = null;

// 路径绘制状态
const isDrawing = ref(false);
const pathList = ref<Array<{id: string, name: string}>>([]);

// 无人机列表
const droneList = ref<Array<any>>([]);
const flyingDrones = ref<Array<string>>([]);

// 高度输入对话框
const heightDialogVisible = ref(false);
const pointHeight = ref(100);
const currentPointIndex = ref(0);
let confirmHeightCallback: ((height: number) => void) | null = null;

// 路径名称输入对话框
const nameDialogVisible = ref(false);
const pathName = ref("");
let confirmNameCallback: ((name: string) => void) | null = null;

// 无人机选择对话框
const droneSelectionVisible = ref(false);
const selectedPathId = ref("");
const selectedPathName = ref("");
const selectedDrones = ref<Array<any>>([]);

// 编队移动对话框相关变量
const formationDialogVisible = ref(false);
const selectedFormationDrones = ref<Array<any>>([]);
const formationType = ref<string>("follow"); // 默认为跟随模式
const formationOptions = ref<FormationOptions>({
  pathDelay: 2,       // 默认2秒延迟
  highlightLeader: true,   // 高亮显示领队
  mode: FormationMode.PATH_FOLLOW,    // 路径跟随模式
  spacing: 30,       // 默认间距30米
  radius: 50,        // 默认圆柱半径50米
  height: 10,        // 默认层高10米
  layers: 2,         // 默认2层
  dronesPerLayer: 6, // 默认每层6架无人机
  cubicWidth: 2,     // 默认立方体宽度2
  cubicLength: 2,    // 默认立方体长度2
  cubicLayers: 2,    // 默认立方体层数2
});
const formationSpeed = ref(50);  // 编队移动速度(米/秒)

// 新增：编队确认对话框相关变量
const formationConfirmDialogVisible = ref(false);
const pendingFormation = ref<{
  entityIds: string[],
  pathData: any,
  options: FormationOptions,
  speed: number,
  verticalSpeed: number,
  formationType: FormationType
}>({
  entityIds: [],
  pathData: null,
  options: {} as FormationOptions,
  speed: 50,
  verticalSpeed: 30,
  formationType: FormationType.FOLLOW
});

// 圆形路径相关变量
const circlePathDialogVisible = ref(false);
const circlePathConfig = ref({
  radius: 500,        // 半径(米)
  height: 200,        // 高度(米)
  points: 16,         // 圆形点数
  name: '圆形路径'     // 路径名称
});
const isCreatingCirclePath = ref(false);
let circlePathHandler: Cesium.ScreenSpaceEventHandler | null = null;

// 圆形路径节点选择对话框
const circlePathNodeSelectionVisible = ref(false);
const selectedCirclePathNode = ref<any>(null);

// 8字形路径相关变量
const figure8PathDialogVisible = ref(false);
const figure8PathConfig = ref({
  radius: 300,        // 圆弧半径(米)
  height: 200,        // 高度(米)
  points: 16,         // 每圈点数
  name: '8字形路径'    // 路径名称
});
const figure8PathNodeSelectionVisible = ref(false);
const selectedFigure8PathNode = ref<any>(null);

// 每条路径的独立速度 (米/秒)
const pathSpeeds = ref<Map<string, number>>(new Map());
const DEFAULT_PATH_SPEED = 50; // 默认速度 50 米/秒

// 获取路径速度
const getPathSpeed = (pathId: string): number => {
  return pathSpeeds.value.get(pathId) ?? DEFAULT_PATH_SPEED;
};

// 检查某条路径下是否有节点正在移动
const isPathFlying = (pathId: string): boolean => {
  if (!props.viewer || !droneFlightManager) return false;
  const entities = props.viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const entityAny = entities[i] as any;
    if (entityAny._assignedPathId === pathId && droneFlightManager.isEntityFlying(entities[i].id)) {
      return true;
    }
  }
  return false;
};

// 设置路径速度
const setPathSpeed = (pathId: string, speed: number) => {
  if (!speed || speed < 1) return;
  pathSpeeds.value.set(pathId, speed);

  if (!props.viewer || !droneFlightManager) return;
  const entities = props.viewer.entities.values;
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const entityAny = entity as any;
    if (entityAny._assignedPathId === pathId) {
      entityAny.speed = speed;
      entityAny.verticalSpeed = speed * 0.6;
      // 移动中直接更新速度，保持当前位置不跳回起点
      if (droneFlightManager.isEntityFlying(entity.id)) {
        droneFlightManager.updateEntitySpeed(entity.id, speed, speed * 0.6);
      }
    }
  }
};

// 获取所有无人机节点和干扰节点（model == "prouter"）
const loadDroneNodes = () => {
  if (!topoStore.topoData?.nodes) return;

  // 同时加载无人机和干扰节点
  const nodes = topoStore.topoData.nodes.filter((node: any) =>
    node.type === "DRONE" || node.type === "INODE"
  );
  droneList.value = nodes;
};

// 检查无人机是否已设置路径
const hasPath = (droneId: number): boolean => {
  if (!props.viewer) return false;
  
  // 获取实体
  const entity = props.viewer.entities.getById(String(droneId));
  if (!entity) return false;
  
  // 检查是否有路径数据
  const entityAny = entity as any;
  return entityAny._hasCustomPath && entityAny._pathData;
};

// 检查无人机是否正在移动
const isFlying = (droneId: number): boolean => {
  if (!droneFlightManager) return false;
  return droneFlightManager.isEntityFlying(String(droneId));
};

// 开始绘制路径
const startDrawPath = () => {
  if (!pathRoamingManager) return;
  
  pathRoamingManager.startDrawing();
  isDrawing.value = true;
  ElMessage.success("开始绘制路径，请在地图上点击创建路径点");
};

// 完成绘制路径
const finishDrawPath = () => {
  if (!pathRoamingManager) return;
  
  pathRoamingManager.finishDrawingPath();
  isDrawing.value = false;
};

// 取消绘制路径
const cancelDrawPath = () => {
  if (!pathRoamingManager) return;
  
  pathRoamingManager.cancel();
  isDrawing.value = false;
  ElMessage.info("已取消绘制路径");
};

// 预览路径
const previewPath = (pathId: string) => {
  if (!pathRoamingManager) return;
  
  const success = pathRoamingManager.previewPath(pathId);
  
  if (success) {
    ElMessage.success("正在预览路径");
  } else {
    ElMessage.error("路径预览失败");
  }
};

// 删除路径
const deletePath = (pathId: string) => {
  if (!pathRoamingManager) return;
  
  // 在删除前获取路径数据引用，用于清理已分配该路径的节点
  const pathDataRef = pathRoamingManager.getPathData(pathId);
  
  const success = pathRoamingManager.deletePath(pathId);
  
  if (success) {
    pathList.value = pathRoamingManager.getAllPaths();
    
    // 清理已分配该路径的所有实体
    if (props.viewer) {
      const entities = props.viewer.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const entityAny = entity as any;
        
        // 通过路径ID或路径数据引用匹配
        if (entityAny._hasCustomPath && 
            (entityAny._assignedPathId === pathId || entityAny._pathData === pathDataRef)) {
          // 如果实体正在使用该路径移动，先停止
          if (droneFlightManager && droneFlightManager.isEntityFlying(entity.id)) {
            droneFlightManager.stopFly(entity.id, false);
          }
          
          // 清除路径相关数据
          delete entityAny._hasCustomPath;
          delete entityAny._pathData;
          delete entityAny._assignedPathId;
          delete entityAny._finalPosition;
          delete entityAny._resumePathProgress;
          delete entityAny._resumePathSignature;
        }
      }
    }
    
    // 更新移动状态
    updateFlightStatus();
    
    ElMessage.success("路径已删除");
  } else {
    ElMessage.error("路径删除失败");
  }
};

// 确认点高度
const confirmPointHeight = () => {
  if (confirmHeightCallback && pointHeight.value > 0) {
    confirmHeightCallback(pointHeight.value);
    confirmHeightCallback = null;
  }
  heightDialogVisible.value = false;
};

// 取消点高度设置
const cancelPointHeight = () => {
  if (pathRoamingManager) {
    // 取消添加这个点，删除最后添加的点
    pathRoamingManager.cancelLastPoint();
  }
  // 清空回调避免后续误触发
  confirmHeightCallback = null;
  heightDialogVisible.value = false;
  ElMessage.info("已取消设置点高度");
};

// 确认路径名称
const confirmPathName = () => {
  if (confirmNameCallback && pathName.value.trim()) {
    confirmNameCallback(pathName.value.trim());
    confirmNameCallback = null;
  } else {
    // 如果没有有效的路径名，则清理未保存的路径实体
    if (pathRoamingManager) {
      pathRoamingManager.clearUnsavedPath();
    }
  }
  nameDialogVisible.value = false;
};

// 取消路径命名
const cancelPathName = () => {
  // 清理未保存的路径实体
  if (pathRoamingManager) {
    pathRoamingManager.clearUnsavedPath();
  }
  
  // 清空回调避免后续误触发
  confirmNameCallback = null;
  nameDialogVisible.value = false;
  ElMessage.info("已取消保存路径");
};

// 显示无人机选择对话框
const showDroneSelection = (pathId: string) => {
  const path = pathList.value.find(p => p.id === pathId);
  if (!path) return;
  
  selectedPathId.value = pathId;
  selectedPathName.value = path.name;
  droneSelectionVisible.value = true;
  
  // 重新加载无人机列表
  loadDroneNodes();
};

// 处理无人机选择变化
const handleDroneSelectionChange = (selection: Array<any>) => {
  selectedDrones.value = selection;
};

// 将路径分配给选中的无人机
const assignPathToDrones = () => {
  if (!pathRoamingManager || !selectedPathId.value || selectedDrones.value.length === 0) {
    ElMessage.warning("请先选择节点");
    return;
  }
  
  // 获取路径数据
  const pathData = pathRoamingManager.getPathData(selectedPathId.value);
  if (!pathData) {
    ElMessage.error("路径数据获取失败");
    return;
  }
  
  // 为选中的每个无人机分配路径
  let successCount = 0;
  selectedDrones.value.forEach(drone => {
    if (!props.viewer) return;
    const entity = (props.viewer as unknown as Cesium.Viewer).entities.getById(String(drone.id));
    if (!entity) return;
    
    // 存储路径数据到实体
    const entityAny = entity as any;
    
    // 清除任何可能存在的最终位置信息，确保新路径可以正确使用
    if (entityAny._finalPosition) {
      delete entityAny._finalPosition;
    }
    delete entityAny._resumePathProgress;
    delete entityAny._resumePathSignature;
    
    // 如果实体当前正在移动，先停止它
    if (droneFlightManager && droneFlightManager.isEntityFlying(String(drone.id))) {
      droneFlightManager.stopFly(String(drone.id), true); // 传入true恢复到原始位置
    }
    
    // 设置新路径
    entityAny._hasCustomPath = true;
    entityAny._pathData = pathData;
    entityAny._assignedPathId = selectedPathId.value;
    // 存储路径速度到实体，供 startAllEntitiesWithPath 使用
    entityAny.speed = getPathSpeed(selectedPathId.value);
    entityAny.verticalSpeed = getPathSpeed(selectedPathId.value) * 0.6;
    
    successCount++;
  });
  
  if (successCount > 0) {
    ElMessage.success(`已将路径分配给${successCount}个节点`);
    droneSelectionVisible.value = false;
    
    // 更新移动状态，以防有状态变化
    updateFlightStatus();
  } else {
    ElMessage.error("节点路径分配失败");
  }
};

// 启动无人机移动
const startFly = (droneId: number) => {
  if (!droneFlightManager || !props.viewer) return;

  // 检查仿真状态
  if (!isSimulationRunning.value) {
    ElMessage.warning('仿真未开启，无法启动节点移动');
    return;
  }

  // 检查是否已经在移动
  if (droneFlightManager.isEntityFlying(String(droneId))) {
    ElMessage.warning("该节点已经在移动中");
    return;
  }

  // 获取实体和路径数据
  const entity = props.viewer.entities.getById(String(droneId));
  if (!entity) {
    ElMessage.error("节点实体不存在");
    return;
  }

  const entityAny = entity as any;
  if (!entityAny._hasCustomPath || !entityAny._pathData) {
    ElMessage.warning("该节点未设置移动路径");
    return;
  }

  // 启动移动 - 显式传递路径数据，确保使用最新分配的路径
  const pathData = entityAny._pathData;
  const assignedPathId = entityAny._assignedPathId;
  const speed = assignedPathId ? getPathSpeed(assignedPathId) : DEFAULT_PATH_SPEED;

  const success = droneFlightManager.startFly(String(droneId), pathData, speed, speed * 0.6);

  if (success) {
    // 如果是干扰节点且已开启干扰,启动定时干扰
    if (isInterferenceNode(droneId)) {
      const config = getInterferenceConfig(droneId);
      if (config && config.status === 'RUNTIME') {
        startInterferenceTimer(droneId);
      }
    }

    ElMessage.success(`节点 ${droneId} 开始移动`);
    updateFlightStatus();
  } else {
    ElMessage.error(`节点 ${droneId} 移动启动失败`);
  }
};

// 停止无人机移动
const stopFly = (droneId: number) => {
  if (!droneFlightManager) return;

  // 如果是干扰节点,停止定时干扰
  if (isInterferenceNode(droneId)) {
    stopInterferenceTimer(droneId);
  }

  // 传递false作为第二个参数，表示不恢复到原始位置
  droneFlightManager.stopFly(String(droneId), false);
  ElMessage.success(`节点 ${droneId} 已停止移动`);
  updateFlightStatus();
};

// 更新移动状态
const updateFlightStatus = () => {
  if (!droneFlightManager) return;
  
  flyingDrones.value = droneFlightManager.getActiveEntityIds();
};

// 添加一个定时刷新移动状态的定时器
let statusUpdateTimer: number | null = null;

// 启动定期刷新移动状态
const startStatusUpdateTimer = () => {
  // 如果已经有定时器，先清除
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer);
  }
  
  // 设置定时器，每2秒刷新一次移动状态
  statusUpdateTimer = window.setInterval(() => {
    updateFlightStatus();
  }, 2000);
};

// 停止定期刷新
const stopStatusUpdateTimer = () => {
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer);
    statusUpdateTimer = null;
  }
};

// 停止所有移动
const stopAllFlights = () => {
  if (!droneFlightManager) return;

  // 停止所有干扰节点的定时器
  flyingDrones.value.forEach(droneId => {
    const nodeId = typeof droneId === 'string' ? parseInt(droneId, 10) : droneId;
    if (isInterferenceNode(nodeId)) {
      stopInterferenceTimer(nodeId);
    }
  });

  // 传递false作为第二个参数，表示不恢复到原始位置
  droneFlightManager.stopFly(undefined, false);
  ElMessage.success("已停止所有节点移动");
  updateFlightStatus();
};

// 所有无人机移动
const startAllDrones = () => {
  if (!droneFlightManager) return;

  // 检查仿真状态
  if (!isSimulationRunning.value) {
    ElMessage.warning('仿真未开启，无法启动节点移动');
    return;
  }

  // 获取所有有路径的节点
  const dronesWithPath = droneList.value.filter(drone => hasPath(drone.id));

  const startedDrones = droneFlightManager.startAllEntitiesWithPath();

  if (startedDrones.length > 0) {
    // 为干扰节点启动定时器
    startedDrones.forEach((droneId: string) => {
      const nodeId = parseInt(droneId, 10);
      if (isInterferenceNode(nodeId)) {
        const config = getInterferenceConfig(nodeId);
        if (config && config.status === 'RUNTIME') {
          startInterferenceTimer(nodeId);
        }
      }
    });

    ElMessage.success(`已启动${startedDrones.length}个节点的移动`);
    updateFlightStatus();
  } else {
    ElMessage.warning("没有节点设置了有效路径");
  }
};

// 更新节点在topoStore中的位置
const updateNodePositionInStore = (nodeId: string, position: { longitude: number, latitude: number, height: number }) => {
  // 确保拓扑数据存在
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    console.warn('无法更新节点位置：拓扑数据不存在');
    return;
  }

  // 节点ID是字符串，需要转换为数字
  const nodeIdNumber = parseInt(nodeId, 10);
  if (isNaN(nodeIdNumber)) {
    console.warn(`无法更新节点位置：无效的节点ID "${nodeId}"`);
    return;
  }

  // 查找节点
  const node = topoStore.topoData.nodes.find((n: any) => n.id === nodeIdNumber);
  if (!node) {
    console.warn(`找不到ID为${nodeIdNumber}的节点`);
    return;
  }

  // 更新节点位置 - 使用直接赋值而不是替换整个对象，减少响应式系统的重新渲染
  const roundDecimals = (num: number, decimals = 6) => Number(num.toFixed(decimals));

  // 检查位置是否发生了实质性变化，如果基本相同，则不更新
  const currentLat = roundDecimals(node.geo.lat);
  const currentLon = roundDecimals(node.geo.lon);
  const currentAlt = roundDecimals(node.geo.alt);

  const newLat = roundDecimals(position.latitude);
  const newLon = roundDecimals(position.longitude);
  const newAlt = roundDecimals(position.height);

  // 如果位置实际上没有变化，则跳过更新
  if (currentLat === newLat && currentLon === newLon && currentAlt === newAlt) {
    return;
  }

  // 使用直接赋值的方式更新，而不是重新创建对象
  node.geo.lat = newLat;
  node.geo.lon = newLon;
  node.geo.alt = newAlt;

  // 如果是干扰节点且正在移动，触发定时干扰更新
  if (node.type === 'INODE' && isFlying(nodeIdNumber)) {
    handleInterferenceNodeMovement(nodeIdNumber);
  }
};

// 判断是否为干扰节点
const isInterferenceNode = (nodeId: string | number): boolean => {
  const nodeIdNumber = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;
  const node = topoStore.topoData?.nodes.find((n: any) => n.id === nodeIdNumber);
  return node?.type === 'INODE';
};

// 获取干扰节点的配置
const getInterferenceConfig = (nodeId: string | number) => {
  const nodeIdNumber = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;
  return interferenceStore.getConfigByNodeId(nodeIdNumber);
};

// 处理干扰节点移动时的干扰发送
const handleInterferenceNodeMovement = async (nodeId: string | number) => {
  const config = getInterferenceConfig(nodeId);
  if (!config || config.status !== 'RUNTIME') {
    return;
  }

  const nodeIdNumber = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;

  try {
    const sessionId = topoStore.currentSessionId;
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (sessionId) {
      // 获取当前节点的最新位置
      const node = topoStore.topoData?.nodes.find((n: any) => n.id === nodeIdNumber);
      if (!node) {
        console.warn(`找不到干扰节点 ${nodeIdNumber}`);
        return;
      }

      // 调用editINode API更新位置并保持干扰状态
      await editInterferenceNode({
        sessionId: Number(sessionId),
        nodeId: nodeIdNumber,
        lat: String(node.geo.lat),
        lon: String(node.geo.lon),
        alt: String(node.geo.alt),
        interferePowerdb: config.interferePowerdb || '',
        interfereFreq: config.interfereFreq || '',
        azimuth: config.azimuth || '',
        elevation: config.elevation || '',
        userId: userId
      });
    }
  } catch (error) {
    console.error(`干扰节点 ${nodeId} 发送编辑请求失败:`, error);
  }
};

// 启动干扰节点的定时干扰
const startInterferenceTimer = (nodeId: string | number) => {
  const nodeIdNumber = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;

  // 如果已经有定时器,先清除
  const existingTimer = interferenceTimers.value.get(nodeIdNumber);
  if (existingTimer) {
    clearInterval(existingTimer);
  }

  const config = getInterferenceConfig(nodeIdNumber);
  if (!config || config.status !== 'RUNTIME') {
    return;
  }

  // 创建定时器,每秒触发一次干扰更新
  const timer = window.setInterval(() => {
    handleInterferenceNodeMovement(nodeIdNumber);
  }, INTERFERENCE_INTERVAL);

  interferenceTimers.value.set(nodeIdNumber, timer);
};

// 停止干扰节点的定时干扰
const stopInterferenceTimer = (nodeId: string | number) => {
  const nodeIdNumber = typeof nodeId === 'string' ? parseInt(nodeId, 10) : nodeId;
  const timer = interferenceTimers.value.get(nodeIdNumber);
  if (timer) {
    clearInterval(timer);
    interferenceTimers.value.delete(nodeIdNumber);
  }
};

// 停止所有干扰节点的干扰
const stopAllInterference = async () => {
  if (!topoStore.topoData || !topoStore.topoData.nodes) {
    return;
  }

  const sessionId = topoStore.currentSessionId;
  if (!sessionId) {
    console.warn('DronePathPanel: 无法关闭干扰: 当前会话ID不存在');
    return;
  }

  const userInfo = getUserInfo();
  const userId = userInfo.id;

  // 找出所有干扰中的INODE节点
  const activeInterferenceNodes = topoStore.topoData.nodes.filter((node: any) => {
    if (node.type !== 'INODE') return false;
    const config = interferenceStore.getConfigByNodeId(node.id);
    return config && config.status === 'RUNTIME';
  });

  if (activeInterferenceNodes.length === 0) {
    return;
  }


  // 为每个活跃的干扰节点调用stopNodeInterference API
  const stopPromises = activeInterferenceNodes.map(async (node: any) => {
    try {
      await stopNodeInterference(Number(sessionId), node.id, userId);

      // 更新interferenceStore中的状态
      const config = interferenceStore.getConfigByNodeId(node.id);
      if (config) {
        interferenceStore.updateInterferenceConfig({
          ...config,
          status: 'SHUTDOWN'
        });
      }

    } catch (error) {
      console.error(`DronePathPanel: 关闭干扰节点 ${node.id} 失败:`, error);
    }
  });

  await Promise.all(stopPromises);
};

// 初始化路径漫游管理器
const initPathRoamingManager = () => {
  if (!props.viewer) {
    console.warn('无法初始化路径管理器: Cesium Viewer为null');
    return;
  }
  
  // 现在不需要类型转换，因为props已正确定义类型
  pathRoamingManager = PathRoamingManager.getInstance(props.viewer);
  
  // 设置UI接口
  pathRoamingManager.setUI({
    showHeightDialog(callback: (height: number) => void) {
      heightDialogVisible.value = true;
      pointHeight.value = 100; // 默认高度
      confirmHeightCallback = callback;
    },
    
    showNameDialog(callback: (name: string) => void) {
      nameDialogVisible.value = true;
      pathName.value = "";
      confirmNameCallback = callback;
    },
    
    updatePathList(paths: Array<{id: string, name: string}>) {
      pathList.value = Array.isArray(paths) ? paths : [];
    },
    
    updateDrawButtonState(drawing: boolean) {
      isDrawing.value = drawing;
    }
  });
  
  // 实现提示输入高度方法
  pathRoamingManager.promptForHeight = function(pointIndex: number) {
    if (this.ui) {
      currentPointIndex.value = pointIndex;
      this.ui.showHeightDialog((height: number) => {
        this.setPointHeight(pointIndex, height);
      });
    }
  };
  
  // 实现提示输入路径名称方法
  pathRoamingManager.promptForPathName = function() {
    if (this.ui) {
      this.ui.showNameDialog((name: string) => {
        // 只有当用户提供了有效的名称时才保存路径
        if (name && name.trim()) {
          const pathId = this.savePath(name);
          if (this.ui) {
            this.ui.updatePathList(this.getAllPaths());
          }
        }
        // 如果没有提供有效名称，clearUnsavedPath会在confirmPathName中处理
      });
    }
  };
  
  // 更新路径列表
  pathList.value = pathRoamingManager.getAllPaths() || [];
};

// 初始化无人机移动管理器
const initDroneFlightManager = () => {
  if (!props.viewer) {
    console.warn('无法初始化移动管理器: Cesium Viewer为null');
    return;
  }

  // 现在不需要类型转换，因为props已正确定义类型
  droneFlightManager = new DroneFlightManager(props.viewer);

  // 设置位置更新回调
  droneFlightManager.setPositionUpdateCallback((entityId: string, position: any) => {
    updateNodePositionInStore(entityId, position);
  });

  // 设置移动状态变化回调，当移动状态变化时更新面板
  droneFlightManager.setFlightStatusCallback((activeEntityIds: string[]) => {
    // 更新移动中的无人机列表
    flyingDrones.value = activeEntityIds;
  });

  // 初始化后更新状态
  updateFlightStatus();

  // 将实例传递给父组件
  emit("droneFlightManagerReady", droneFlightManager);
};

// 初始化管理器
const setupManagers = () => {
  if (props.viewer) {
    if (!pathRoamingManager) {
      initPathRoamingManager();
    }
    
    if (!droneFlightManager) {
      initDroneFlightManager();
    }
    
    // 加载无人机节点
    loadDroneNodes();
  }
};

// 监视visible属性变化
watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.viewer) {
      setupManagers();
      startStatusUpdateTimer();
    } else {
      stopStatusUpdateTimer();
    }
  }
);

// 监视viewer变化
watch(
  () => props.viewer,
  (newVal) => {
    if (newVal && props.visible) {
      setupManagers();
    }
  }
);

// 当topoStore.topoData.nodes变化时，重新加载无人机节点
watch(
  () => topoStore.topoData?.nodes,
  () => {
    loadDroneNodes();
  }
);

// 监听干扰节点配置状态变化，在移动中动态启停干扰定时器
// 解决：干扰开关在节点移动中切换时，定时器也能正确启停
watch(
  () => interferenceStore.interferenceConfigs.map(c => `${c.nodeId}:${c.status}`).join(','),
  (newVal, oldVal) => {
    if (!newVal || !oldVal) return;
    const parseConfigs = (val: string) => {
      if (!val) return new Map<number, string>();
      const map = new Map<number, string>();
      val.split(',').forEach(item => {
        const [id, status] = item.split(':');
        if (id && status) map.set(Number(id), status);
      });
      return map;
    };
    const newMap = parseConfigs(newVal);
    const oldMap = parseConfigs(oldVal);

    newMap.forEach((status, nodeId) => {
      const oldStatus = oldMap.get(nodeId);
      if (status === oldStatus) return;

      if (status === 'RUNTIME' && oldStatus !== 'RUNTIME') {
        // 状态变为 RUNTIME：如果节点正在移动，启动定时器
        if (isFlying(nodeId)) {
          startInterferenceTimer(nodeId);
        }
      } else if (status !== 'RUNTIME' && oldStatus === 'RUNTIME') {
        // 状态从 RUNTIME 变为其他：停止定时器
        stopInterferenceTimer(nodeId);
      }
    });
  }
);

// 监视nameDialogVisible变化
watch(nameDialogVisible, (newVal) => {
  // 当对话框关闭时，如果不是通过确认按钮关闭的，则清理资源
  if (newVal === false && confirmNameCallback) {
    if (pathRoamingManager) {
      pathRoamingManager.clearUnsavedPath();
    }
    confirmNameCallback = null;
    ElMessage.info("已取消保存路径");
  }
});

watch(() => isSimulationRunning.value, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {

    // 停止所有干扰节点的干扰
    await stopAllInterference();

    // 停止所有移动
    if (droneFlightManager && flyingDrones.value.length > 0) {
      stopAllFlights();
    }
  } else if (oldVal === false && newVal === true) {
  }
});


// 组件挂载时初始化
onMounted(() => {
  if (props.visible && props.viewer) {
    setupManagers();
    startStatusUpdateTimer();
  }

});

// 组件卸载时清理资源
onUnmounted(() => {
  if (pathRoamingManager) {
    pathRoamingManager.destroy();
  }

  if (droneFlightManager) {
    droneFlightManager.destroy();
  }

  stopStatusUpdateTimer();

  // 清理所有干扰定时器
  interferenceTimers.value.forEach((timer, nodeId) => {
    clearInterval(timer);
  });
  interferenceTimers.value.clear();

  // 清理圆形路径事件处理器
  cleanupCirclePathHandler();
});

// 导出组件方法供父组件调用
defineExpose({
  pathRoamingManager,
  droneFlightManager,
  startDrawPath,
  finishDrawPath,
  cancelDrawPath,
  updateFlightStatus,
});

// 显示编队设置对话框
const showFormationDialog = (pathId: string) => {
  const path = pathList.value.find(p => p.id === pathId);
  if (!path) return;
  
  selectedPathId.value = pathId;
  selectedPathName.value = path.name;
  formationDialogVisible.value = true;
  
  // 重置选项
  formationType.value = "follow";  // 默认为跟随模式
  formationOptions.value = {
    pathDelay: 2,
    highlightLeader: true,
    mode: FormationMode.PATH_FOLLOW,
    spacing: 30,
    radius: 50,
    height: 10,
    layers: 2,
    dronesPerLayer: 6,
    cubicWidth: 2,
    cubicLength: 2,
    cubicLayers: 2,
  };
  formationSpeed.value = 50;
  selectedFormationDrones.value = [];
  
  // 重新加载无人机列表
  loadDroneNodes();
};

// 处理编队无人机选择变化
const handleFormationDroneChange = (selection: Array<any>) => {
  selectedFormationDrones.value = selection;
};

// 格式化编队类型为中文显示
const formatFormationType = (type: FormationType): string => {
  switch (type) {
    case FormationType.FOLLOW:
      return "跟随模式";
    case FormationType.CUBIC:
      return "立方体队形";
    case FormationType.CYLINDER:
      return "圆柱队形";
    default:
      return "未知队形";
  }
};

// 添加是否有编队的计算属性
const hasFormation = computed(() => {
  return pendingFormation.value.entityIds && pendingFormation.value.entityIds.length >= 2;
});

// 修改创建编队移动方法
const createFormationFlight = () => {
  if (!droneFlightManager || !selectedPathId.value || selectedFormationDrones.value.length < 2) {
    ElMessage.warning("请选择至少两个节点");
    return;
  }
  
  // 获取路径数据
  const pathData = pathRoamingManager?.getPathData(selectedPathId.value);
  if (!pathData) {
    ElMessage.error("路径数据获取失败");
    return;
  }
  
  // 准备实体ID数组，第一个为领队
  const entityIds = selectedFormationDrones.value.map(drone => String(drone.id));
  
  // 设置编队选项
  const options: FormationOptions = {
    ...formationOptions.value,
    followerCount: entityIds.length - 1  // 减去一个领队
  };
  
  // 根据选择的队形类型设置FormationType
  let selectedFormationType: FormationType;
  switch (formationType.value) {
    case "cubic":
      selectedFormationType = FormationType.CUBIC;
      break;
    case "cylinder":
      selectedFormationType = FormationType.CYLINDER;
      break;
    case "follow":
    default:
      selectedFormationType = FormationType.FOLLOW;
      break;
  }
  
  // 使用droneFlightManager创建编队但不立即开始移动
  const success = droneFlightManager.createFormationFollow(
    entityIds,
    pathData,
    options,
    formationSpeed.value,
    formationSpeed.value * 0.6,
    selectedFormationType,
    false  // 明确指定不立即开始移动
  );
  
  if (!success) {
    ElMessage.error("创建编队失败");
    return;
  }
  
  // 保存编队信息，以便确认时使用
  pendingFormation.value = {
    entityIds,
    pathData,
    options,
    speed: formationSpeed.value,
    verticalSpeed: formationSpeed.value * 0.6,
    formationType: selectedFormationType
  };
  
  // 关闭编队设置对话框
  formationDialogVisible.value = false;
  
  // 不再自动显示确认对话框，而是显示成功消息
  ElMessage.success(`编队创建成功，请点击"开始移动"按钮开始移动`);
};

// 新增：显示编队确认对话框
const showFormationConfirmDialog = () => {
  formationConfirmDialogVisible.value = true;
};

// 新增：取消编队
const cancelFormation = () => {
  // 清空编队信息
  pendingFormation.value = {
    entityIds: [],
    pathData: null,
    options: {} as FormationOptions,
    speed: 50,
    verticalSpeed: 30,
    formationType: FormationType.FOLLOW
  };
  
  ElMessage.info("已取消编队");
};

// 处理名称对话框关闭
const handleNameDialogClose = (done: () => void) => {
  if (pathRoamingManager) {
    pathRoamingManager.clearUnsavedPath();
  }
  confirmNameCallback = null;
  done();
  ElMessage.info("已取消保存路径");
};

// 新增：开始编队移动
const startFormationFlight = () => {
  if (!droneFlightManager || !pendingFormation.value.entityIds.length) {
    ElMessage.error("编队信息不完整，无法开始移动");
    formationConfirmDialogVisible.value = false;
    return;
  }

  // 检查仿真状态
  if (!isSimulationRunning.value) {
    ElMessage.warning('仿真未开启，无法启动编队移动');
    formationConfirmDialogVisible.value = false;
    return;
  }
  
  // 现在才真正创建并开始编队移动
  const success = droneFlightManager.createFormationFollow(
    pendingFormation.value.entityIds,
    pendingFormation.value.pathData,
    pendingFormation.value.options,
    pendingFormation.value.speed,
    pendingFormation.value.verticalSpeed,
    pendingFormation.value.formationType,
    true  // 明确指定立即开始移动
  );
  
  if (success) {
    ElMessage.success(`${pendingFormation.value.entityIds.length}个节点的${formatFormationType(pendingFormation.value.formationType)}编队开始移动`);
    formationConfirmDialogVisible.value = false;
    updateFlightStatus();
  } else {
    ElMessage.error("启动编队移动失败");
  }
};

// 显示圆形路径对话框
const showCirclePathDialog = () => {
  circlePathDialogVisible.value = true;
  // 重置配置
  circlePathConfig.value = {
    radius: 500,
    height: 200,
    points: 16,
    name: '圆形路径'
  };
};

// 开始创建圆形路径
const startCreateCirclePath = () => {
  if (!props.viewer || !circlePathConfig.value.name.trim()) {
    ElMessage.warning("请输入路径名称");
    return;
  }

  // 检查是否有可用节点
  if (droneList.value.length === 0) {
    ElMessage.warning("当前场景中没有可用的节点");
    return;
  }

  // 关闭配置对话框,打开节点选择对话框
  circlePathDialogVisible.value = false;
  circlePathNodeSelectionVisible.value = true;

  // 重新加载节点列表
  loadDroneNodes();
  ElMessage.info("请选择要为其创建圆形路径的节点");
};

// 处理圆形路径节点选择
const handleCirclePathNodeSelect = (node: any) => {
  if (!node) return;

  selectedCirclePathNode.value = node;
  circlePathNodeSelectionVisible.value = false;

  // 使用选中节点创建圆形路径
  createCirclePathForNode(node);
};

// 为选中节点创建圆形路径
const createCirclePathForNode = (node: any) => {
  if (!pathRoamingManager) return;

  // 节点的当前位置将作为圆形路径的起点
  const startLongitude = node.geo.lon;
  const startLatitude = node.geo.lat;
  const startHeight = node.geo.alt;

  // 配置参数
  const pointCount = circlePathConfig.value.points;
  const radius = circlePathConfig.value.radius;
  const height = circlePathConfig.value.height;

  // 计算圆心位置：从节点位置(起点)向内偏移半径距离
  // 假设起点在圆周0度位置(正东方向)
  const metersPerDegree = 111320; // 大约每度经纬度对应的米数

  // 圆心在起点的正西方向(偏移-radius米)
  const centerLonOffset = -radius / (metersPerDegree * Math.cos(startLatitude * Math.PI / 180));
  const centerLongitude = startLongitude + centerLonOffset;
  const centerLatitude = startLatitude; // 纬度不变

  // 生成圆形路径点，第一个点就是节点当前位置
  const circlePoints: Cesium.Cartesian3[] = [];

  for (let i = 0; i < pointCount; i++) {
    // 计算角度 (弧度)，从0度开始(正东方向)，负值表示顺时针方向
    const angle = -(2 * Math.PI * i) / pointCount;

    // 计算相对于圆心的偏移量 (以米为单位)
    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);

    // 将米偏移量转换为经纬度偏移量
    const lonOffset = offsetX / (metersPerDegree * Math.cos(centerLatitude * Math.PI / 180));
    const latOffset = offsetY / metersPerDegree;

    // 计算点的经纬度
    const pointLongitude = centerLongitude + lonOffset;
    const pointLatitude = centerLatitude + latOffset;

    // 创建点位置
    const pointPosition = Cesium.Cartesian3.fromDegrees(
      pointLongitude,
      pointLatitude,
      height
    );

    circlePoints.push(pointPosition);
  }

  // 闭合圆形，添加第一个点作为最后一个点
  circlePoints.push(circlePoints[0].clone());

  // 使用pathRoamingManager创建路径
  const pathId = pathRoamingManager.createCirclePath(
    circlePoints,
    circlePathConfig.value.name
  );

  if (pathId) {
    // 更新路径列表
    pathList.value = pathRoamingManager.getAllPaths();

    // 自动将路径分配给选中的节点
    if (props.viewer) {
      const entity = props.viewer.entities.getById(String(node.id));
      if (entity) {
        const pathData = pathRoamingManager.getPathData(pathId);
        if (pathData) {
          const entityAny = entity as any;

          // 清除任何可能存在的最终位置信息
          if (entityAny._finalPosition) {
            delete entityAny._finalPosition;
          }
          delete entityAny._resumePathProgress;
          delete entityAny._resumePathSignature;

          // 如果实体当前正在移动，先停止它
          if (droneFlightManager && droneFlightManager.isEntityFlying(String(node.id))) {
            droneFlightManager.stopFly(String(node.id), true);
          }

          // 设置新路径
          entityAny._hasCustomPath = true;
          entityAny._pathData = pathData;
          entityAny._assignedPathId = pathId;
          entityAny.speed = getPathSpeed(pathId);
          entityAny.verticalSpeed = getPathSpeed(pathId) * 0.6;

          ElMessage.success(`圆形路径 "${circlePathConfig.value.name}" 已创建并分配给节点 "${node.alias || node.name}"`);
        }
      }
    }
  } else {
    ElMessage.error("圆形路径创建失败");
  }
};

// 设置圆形路径事件处理器
const setupCirclePathHandler = () => {
  if (!props.viewer) return;
  
  circlePathHandler = new Cesium.ScreenSpaceEventHandler(props.viewer.scene.canvas);
  
  // 鼠标左键点击事件 - 选择圆心位置
  circlePathHandler.setInputAction(
    handleCirclePathClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
};

// 处理圆形路径点击
const handleCirclePathClick = (event: any) => {
  if (!props.viewer || !isCreatingCirclePath.value) return;
  
  const earthPosition = props.viewer.scene.pickPosition(event.position);
  if (!Cesium.defined(earthPosition)) {
    ElMessage.error("无法获取点击位置，请重试");
    return;
  }
  
  // 创建圆形路径
  createCirclePath(earthPosition);
  
  // 清理事件处理器
  cleanupCirclePathHandler();
  isCreatingCirclePath.value = false;
};

// 创建圆形路径
const createCirclePath = (center: Cesium.Cartesian3) => {
  if (!pathRoamingManager) return;
  
  // 获取圆心的地理坐标
  const centerCartographic = Cesium.Cartographic.fromCartesian(center);
  const centerLongitude = Cesium.Math.toDegrees(centerCartographic.longitude);
  const centerLatitude = Cesium.Math.toDegrees(centerCartographic.latitude);
  
  // 生成圆形路径点
  const circlePoints: Cesium.Cartesian3[] = [];
  const pointCount = circlePathConfig.value.points;
  const radius = circlePathConfig.value.radius;
  const height = circlePathConfig.value.height;
  
  for (let i = 0; i < pointCount; i++) {
    // 计算角度 (弧度)
    const angle = (2 * Math.PI * i) / pointCount;
    
    // 计算相对于圆心的偏移量 (以米为单位)
    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);
    
    // 将米偏移量转换为经纬度偏移量
    const metersPerDegree = 111320; // 大约每度经纬度对应的米数
    const lonOffset = offsetX / (metersPerDegree * Math.cos(centerLatitude * Math.PI / 180));
    const latOffset = offsetY / metersPerDegree;
    
    // 计算点的经纬度
    const pointLongitude = centerLongitude + lonOffset;
    const pointLatitude = centerLatitude + latOffset;
    
    // 创建点位置
    const pointPosition = Cesium.Cartesian3.fromDegrees(
      pointLongitude,
      pointLatitude,
      height
    );
    
    circlePoints.push(pointPosition);
  }
  
  // 闭合圆形，添加第一个点作为最后一个点
  circlePoints.push(circlePoints[0].clone());
  
  // 使用pathRoamingManager创建路径
  const pathId = pathRoamingManager.createCirclePath(
    circlePoints,
    circlePathConfig.value.name
  );
  
  if (pathId) {
    // 更新路径列表
    pathList.value = pathRoamingManager.getAllPaths();
    ElMessage.success(`圆形路径 "${circlePathConfig.value.name}" 创建成功`);
  } else {
    ElMessage.error("圆形路径创建失败");
  }
};

// 清理圆形路径事件处理器
const cleanupCirclePathHandler = () => {
  if (circlePathHandler) {
    circlePathHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    circlePathHandler = null;
  }
};

// ========== 8字形路径功能 ==========

// 显示8字形路径对话框
const showFigure8PathDialog = () => {
  figure8PathDialogVisible.value = true;
  figure8PathConfig.value = {
    radius: 300,
    height: 200,
    points: 16,
    name: '8字形路径'
  };
};

// 开始创建8字形路径
const startCreateFigure8Path = () => {
  if (!props.viewer || !figure8PathConfig.value.name.trim()) {
    ElMessage.warning("请输入路径名称");
    return;
  }

  if (droneList.value.length === 0) {
    ElMessage.warning("当前场景中没有可用的节点");
    return;
  }

  figure8PathDialogVisible.value = false;
  figure8PathNodeSelectionVisible.value = true;

  loadDroneNodes();
  ElMessage.info("请选择要为其创建8字形路径的节点");
};

// 处理8字形路径节点选择
const handleFigure8PathNodeSelect = (node: any) => {
  if (!node) return;

  selectedFigure8PathNode.value = node;
  figure8PathNodeSelectionVisible.value = false;

  createFigure8PathForNode(node);
};

// 为选中节点创建8字形路径
const createFigure8PathForNode = (node: any) => {
  if (!pathRoamingManager) return;

  // 节点当前位置作为8字形交叉点（起点）
  const startLongitude = node.geo.lon;
  const startLatitude = node.geo.lat;

  const pointCount = figure8PathConfig.value.points;
  const radius = figure8PathConfig.value.radius;
  const height = figure8PathConfig.value.height;

  const metersPerDegree = 111320;

  // 8字形由两个相切圆组成，交叉点是节点位置
  // 上圆圆心在节点正上方（北）偏移radius米
  const upperCenterLat = startLatitude + radius / metersPerDegree;
  const upperCenterLon = startLongitude;
  // 下圆圆心在节点正下方（南）偏移radius米
  const lowerCenterLat = startLatitude - radius / metersPerDegree;
  const lowerCenterLon = startLongitude;

  const figure8Points: Cesium.Cartesian3[] = [];

  // 上半圆：从交叉点出发，逆时针绕上圆一圈回到交叉点
  // 交叉点在上圆的最南端（角度 = -PI/2 即 270度）
  for (let i = 0; i <= pointCount; i++) {
    const angle = -Math.PI / 2 - (2 * Math.PI * i) / pointCount; // 逆时针

    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);

    const lonOffset = offsetX / (metersPerDegree * Math.cos(upperCenterLat * Math.PI / 180));
    const latOffset = offsetY / metersPerDegree;

    const pointLon = upperCenterLon + lonOffset;
    const pointLat = upperCenterLat + latOffset;

    figure8Points.push(Cesium.Cartesian3.fromDegrees(pointLon, pointLat, height));
  }

  // 下半圆：从交叉点出发，顺时针绕下圆一圈回到交叉点
  // 交叉点在下圆的最北端（角度 = PI/2 即 90度）
  // 跳过 i=0（与上半圆终点重合的交叉点），避免重复点导致节点在交叉点停顿
  for (let i = 1; i <= pointCount; i++) {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / pointCount; // 顺时针

    const offsetX = radius * Math.cos(angle);
    const offsetY = radius * Math.sin(angle);

    const lonOffset = offsetX / (metersPerDegree * Math.cos(lowerCenterLat * Math.PI / 180));
    const latOffset = offsetY / metersPerDegree;

    const pointLon = lowerCenterLon + lonOffset;
    const pointLat = lowerCenterLat + latOffset;

    figure8Points.push(Cesium.Cartesian3.fromDegrees(pointLon, pointLat, height));
  }

  // 使用pathRoamingManager创建路径（复用createCirclePath方法）
  const pathId = pathRoamingManager.createCirclePath(
    figure8Points,
    figure8PathConfig.value.name
  );

  if (pathId) {
    pathList.value = pathRoamingManager.getAllPaths();

    // 将路径分配给选中节点
    if (props.viewer) {
      const entity = props.viewer.entities.getById(String(node.id));
      if (entity) {
        const entityAny = entity as any;
        const pathData = pathRoamingManager.getPathData(pathId);

        if (pathData) {
          entityAny._hasCustomPath = true;
          entityAny._pathData = pathData;
          entityAny._assignedPathId = pathId;
          entityAny.speed = getPathSpeed(pathId);
          entityAny.verticalSpeed = getPathSpeed(pathId) * 0.6;

          ElMessage.success(`8字形路径 "${figure8PathConfig.value.name}" 已创建并分配给节点 "${node.alias || node.name}"`);
        }
      }
    }
  } else {
    ElMessage.error("8字形路径创建失败");
  }
};
</script>

<style scoped>
.drone-path-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  width: 450px;
  background: linear-gradient(90deg, rgba(10, 21, 54, 0.9) 0%, rgba(16, 42, 92, 0.9) 100%);
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 0 24px #1e90ff44, 0 0 0 1.5px #1e90ff33 inset;
  border: 1.5px solid #1e90ff55;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
  color: #b6eaff;
  font-family: "Orbitron", "Arial", sans-serif;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #1e90ff33;
  padding-bottom: 10px;
}

.panel-header h3 {
  margin: 0;
  color: #4dd0ff;
  font-size: 18px;
  font-weight: normal;
  text-shadow: 0 0 8px #00eaff;
  letter-spacing: 1px;
}

.panel-btns {
  display: flex;
  gap: 10px;
}

h4 {
  margin-top: 15px;
  margin-bottom: 10px;
  color: #4dd0ff;
  font-weight: normal;
  font-size: 16px;
  border-bottom: 1px solid #1e90ff33;
  padding-bottom: 5px;
  text-shadow: 0 0 8px #00eaff;
}

/* 路径列表样式 */
.path-list {
  margin-bottom: 15px;
  max-height: 280px;
  overflow-y: auto;
}

.path-card {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
  transition: border-color 0.2s;
}

.path-card:hover {
  border-color: #00eaff55;
}

.path-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.path-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.path-name {
  font-weight: normal;
  font-size: 14px;
  color: #b6eaff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.path-speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: rgba(0, 20, 50, 0.4);
  border-radius: 3px;
  border: 1px solid #00eaff18;
}

.speed-label-inline {
  font-size: 12px;
  color: #4dd0ff;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.speed-unit-inline {
  font-size: 12px;
  color: #8ab4ff;
  white-space: nowrap;
}

.speed-flying-badge {
  font-size: 11px;
  color: #67c23a;
  background: rgba(103, 194, 58, 0.12);
  border: 1px solid rgba(103, 194, 58, 0.35);
  border-radius: 3px;
  padding: 1px 6px;
  text-shadow: 0 0 6px rgba(103, 194, 58, 0.6);
  animation: pulse-green 1.5s ease-in-out infinite;
}

@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

:deep(.path-speed-input) {
  width: 108px;
}

:deep(.path-speed-input .el-input__wrapper) {
  background: rgba(0, 30, 70, 0.8) !important;
  box-shadow: 0 0 0 1px #00eaff33 !important;
}

:deep(.path-speed-input .el-input__inner) {
  background: transparent;
  color: #e0f4ff;
  font-size: 13px;
  text-align: center;
}

:deep(.path-speed-input .el-input-number__decrease),
:deep(.path-speed-input .el-input-number__increase) {
  background: rgba(0, 30, 70, 0.8);
  border-color: #00eaff33;
  color: #4dd0ff;
}

:deep(.path-speed-input .el-input-number__decrease:hover),
:deep(.path-speed-input .el-input-number__increase:hover) {
  color: #00eaff;
  background: rgba(0, 60, 120, 0.8);
}

.path-actions {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.no-path {
  text-align: center;
  padding: 20px;
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  color: #b6eaff;
  border: 1px solid #00eaff22;
}

.hint {
  font-size: 0.9em;
  color: #8ab4ff;
  margin-top: 5px;
}

/* 无人机列表样式 */
.drone-list {
  margin-bottom: 15px;
  max-height: 200px;
  overflow-y: auto;
}

.drone-card {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
}

.drone-info {
  display: flex;
  flex-direction: column;
}

.drone-name {
  font-weight: normal;
  font-size: 14px;
  color: #b6eaff;
}

.drone-status {
  font-size: 12px;
  color: #8ab4ff;
  margin-top: 3px;
}

.drone-status.has-path {
  color: #67c23a;
  text-shadow: 0 0 8px rgba(103, 194, 58, 0.5);
}

.drone-actions {
  display: flex;
  gap: 5px;
}

.no-drones {
  text-align: center;
  padding: 20px;
  color: #b6eaff;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid #1e90ff33;
}

/* 对话框 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 10px;
}

/* 技术风格按钮 */
:deep(.tech-button) {
  background: linear-gradient(180deg, #0a3677 0%, #051c3d 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button:hover) {
  background: linear-gradient(180deg, #0d4798 0%, #062752 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

:deep(.tech-button-success) {
  background: linear-gradient(180deg, #12592c 0%, #083a1c 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-success:hover) {
  background: linear-gradient(180deg, #177037 0%, #0a4622 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

:deep(.tech-button-danger) {
  background: linear-gradient(180deg, #592c12 0%, #3a1c08 100%) !important;
  border: 1.5px solid #ff4d4d55 !important;
  transition: all 0.3s;
  color: #ffb6b6 !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-danger:hover) {
  background: linear-gradient(180deg, #703717 0%, #46220a 100%) !important;
  box-shadow: 0 0 12px #ff4d4d77;
}

:deep(.tech-button-warning) {
  background: linear-gradient(180deg, #594812 0%, #3a2c08 100%) !important;
  border: 1.5px solid #ffaa0055 !important;
  transition: all 0.3s;
  color: #ffe9b6 !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-warning:hover) {
  background: linear-gradient(180deg, #705917 0%, #46370a 100%) !important;
  box-shadow: 0 0 12px #ffaa0077;
}

:deep(.tech-button-cancel) {
  background: linear-gradient(180deg, #2a3550 0%, #1a2238 100%) !important;
  border: 1.5px solid #8ab4ff55 !important;
  transition: all 0.3s;
  color: #b6eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-cancel:hover) {
  background: linear-gradient(180deg, #374a6e, #232f4e) !important;
  box-shadow: 0 0 12px #8ab4ff44;
}

:deep(.tech-tag) {
  background: linear-gradient(90deg, #051428 0%, #0a2852 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-dialog) {
  background: linear-gradient(90deg, #0a1536 0%, #102a5c 100%);
  border-radius: 6px;
  border: 1.5px solid #1e90ff55;
  box-shadow: 0 0 24px #1e90ff44;
}

:deep(.tech-dialog .el-dialog__header) {
  color: #4dd0ff;
  text-shadow: 0 0 8px #00eaff;
  font-family: "Orbitron", "Arial", sans-serif;
  border-bottom: 1px solid #1e90ff33;
}

:deep(.tech-dialog .el-dialog__body) {
  color: #b6eaff;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-dialog .el-dialog__title) {
  color: #4dd0ff;
}

:deep(.tech-input .el-input__inner) {
  background: rgba(0, 40, 80, 0.8);
  border: 1.5px solid #00eaff55;
  color: #b6eaff;
}

:deep(.tech-input .el-input__inner::placeholder) {
  color: #8ab4ff;
  opacity: 0.9;
}

:deep(.tech-table) {
  background: transparent;
  color: #090e10;
  border: 1.5px solid #00eaff55;
}

:deep(.tech-table th),
:deep(.tech-table td) {
  background: rgba(0, 40, 80, 0.4);
  color: #b6eaff;
  border-bottom: 1px solid #1e90ff33;
}

:deep(.tech-table .el-table__header-wrapper) {
  background: rgba(16, 42, 92, 0.8);
}

:deep(.tech-table .el-checkbox__inner) {
  background: rgba(0, 40, 80, 0.4);
  border: 1.5px solid #00eaff55;
}

:deep(.el-button.is-disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 自定义滚动条 */
.path-list::-webkit-scrollbar,
.drone-list::-webkit-scrollbar {
  width: 6px;
  background: rgba(10, 21, 54, 0.3);
}

.path-list::-webkit-scrollbar-thumb,
.drone-list::-webkit-scrollbar-thumb {
  background: rgba(0, 150, 255, 0.5);
  border-radius: 3px;
}

.path-list::-webkit-scrollbar-thumb:hover,
.drone-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 150, 255, 0.8);
}

/* 添加编队选项样式 */
.formation-options {
  margin-top: 10px;
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 15px;
  border: 1px solid #00eaff22;
}

:deep(.tech-button-info) {
  background: linear-gradient(180deg, #125959 0%, #083a3a 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #b6eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
}

:deep(.tech-button-info:hover) {
  background: linear-gradient(180deg, #177070 0%, #0a4646 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

/* 新增编队相关样式 */
.cubic-settings,
.cylinder-settings {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.cubic-label {
  color: #4dd0ff;
  font-weight: bold;
}

.formation-hint {
  font-size: 12px;
  color: #8ab4ff;
  margin-top: 4px;
}

:deep(.tech-select) {
  width: 100%;
  background: rgba(0, 40, 80, 0.4);
  border: 1.5px solid #00eaff55;
}

:deep(.tech-select .el-input__inner) {
  background: rgba(0, 40, 80, 0.4);
  color: #b6eaff;
  border: none;
}

:deep(.el-select-dropdown) {
  background: rgba(10, 21, 54, 0.95);
  border: 1.5px solid #00eaff55;
}

:deep(.el-select-dropdown__item) {
  color: #b6eaff;
}

:deep(.el-select-dropdown__item.selected) {
  color: #00eaff;
  background: rgba(0, 40, 80, 0.6);
}

:deep(.el-select-dropdown__item:hover) {
  background: rgba(0, 40, 80, 0.8);
}

:deep(.el-input-number) {
  background: rgba(0, 40, 80, 0.4);
  border: 1.5px solid #00eaff55;
  width: 80px;
}

:deep(.el-input-number .el-input__inner) {
  background: rgba(0, 40, 80, 0.4);
  color: #b6eaff;
  border: none;
  text-align: center;
}

:deep(.el-input-number__increase),
:deep(.el-input-number__decrease) {
  background: rgba(0, 40, 80, 0.6);
  color: #b6eaff;
  border-color: rgba(0, 198, 255, 0.3);
}

:deep(.el-input-number__increase:hover),
:deep(.el-input-number__decrease:hover) {
  color: #00eaff;
}

/* 编队确认对话框样式 */
.formation-confirm-content {
  padding: 10px 0;
}

.formation-confirm-info {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 12px;
  margin-top: 15px;
  border: 1px solid #00eaff22;
}

.confirm-info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.confirm-info-item:last-child {
  margin-bottom: 0;
}

.confirm-label {
  color: #8ab4ff;
}

.confirm-value {
  color: #00eaff;
  font-weight: 500;
}

/* 编队信息区域样式 */
.formation-info-section {
  margin: 15px 0;
}

.formation-info-card {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
}

.formation-info {
  flex: 1;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  max-width: 250px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #8ab4ff;
  font-size: 14px;
}

.info-value {
  color: #00eaff;
  font-weight: 500;
  font-size: 14px;
}

.formation-actions {
  display: flex;
  gap: 8px;
}

/* 圆形路径配置对话框样式 */
.circle-path-config {
  padding: 10px 0;
}

.circle-path-preview {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 15px;
  margin-top: 15px;
  border: 1px solid #00eaff22;
  text-align: center;
}

.preview-tip {
  color: #8ab4ff;
  margin: 0;
  font-size: 14px;
}

/* 速度控制区域样式 */
.speed-control-section {
  margin: 15px 0;
}

.speed-control-card {
  background: rgba(0, 40, 80, 0.4);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 0 16px #00eaff33;
  border: 1px solid #00eaff22;
}

.speed-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.speed-label {
  color: #8ab4ff;
  font-size: 14px;
}

.speed-value {
  color: #00eaff;
  font-weight: 500;
  font-size: 16px;
  text-shadow: 0 0 8px #00eaff;
}

.speed-slider-container {
  margin: 10px 0;
}

.speed-presets {
  display: flex;
  justify-content: space-around;
  gap: 8px;
  margin-top: 12px;
}

:deep(.tech-button-mini) {
  background: linear-gradient(180deg, #0a3677 0%, #051c3d 100%) !important;
  border: 1.5px solid #00eaff55 !important;
  transition: all 0.3s;
  color: #00eaff !important;
  font-family: "Orbitron", "Arial", sans-serif;
  padding: 4px 12px;
  font-size: 12px;
}

:deep(.tech-button-mini:hover) {
  background: linear-gradient(180deg, #0d4798 0%, #062752 100%) !important;
  box-shadow: 0 0 12px #00eaff77;
}

/* 滑块样式优化 */
:deep(.el-slider) {
  margin: 10px 0;
}

:deep(.el-slider__runway) {
  background-color: rgba(0, 40, 80, 0.6);
  border: 1px solid #00eaff33;
}

:deep(.el-slider__bar) {
  background: linear-gradient(90deg, #00eaff 0%, #4dd0ff 100%);
}

:deep(.el-slider__button) {
  background: #00eaff;
  border: 2px solid #4dd0ff;
  box-shadow: 0 0 8px #00eaff66;
}

:deep(.el-slider__button:hover) {
  box-shadow: 0 0 12px #00eaff99;
}

:deep(.el-input-number) {
  width: 100px;
}

:deep(.formation-speed-input) {
  width: 100%;
}

:deep(.formation-speed-input .el-input__inner) {
  color: #b6eaff;
  background: rgba(0, 40, 80, 0.6);
  border-color: #00eaff55;
  text-align: center;
}

:deep(.formation-speed-input .el-input-number__increase),
:deep(.formation-speed-input .el-input-number__decrease) {
  background: rgba(0, 40, 80, 0.6);
  border-color: #00eaff55;
  color: #b6eaff;
}

:deep(.formation-speed-input .el-input-number__increase:hover),
:deep(.formation-speed-input .el-input-number__decrease:hover) {
  background: rgba(0, 102, 204, 0.6);
  color: #4dd0ff;
}

:deep(.el-input-number .el-input__inner) {
  color: #b6eaff;
  background: rgba(0, 40, 80, 0.6);
  border-color: #00eaff55;
}
</style> 