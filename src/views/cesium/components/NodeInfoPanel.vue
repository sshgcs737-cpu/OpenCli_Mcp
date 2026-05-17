<template>
  <div>

    <div class="neo-infobox" v-if="currentNode && showPanelDefault" ref="nodeInfoBoxRef" :style="{ transform: `translate(${dragOffsetX}px, ${dragOffsetY}px)` }">
      <div class="neo-infobox-header">
        <span class="neo-infobox-title"
          ><svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="8" fill="#1e90ff" fill-opacity="0.18" />
            <circle cx="9" cy="9" r="4" fill="#1e90ff" fill-opacity="0.38" />
          </svg>
          节点信息</span
        >
        <span class="neo-infobox-close" @click="$emit('close')">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line
              x1="5"
              y1="5"
              x2="15"
              y2="15"
              stroke="#b6eaff"
              stroke-width="2"
              stroke-linecap="round"
            />
            <line
              x1="15"
              y1="5"
              x2="5"
              y2="15"
              stroke="#b6eaff"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </span>
      </div>
      <div class="neo-infobox-content">
        <div class="neo-section">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#1e90ff" fill-opacity="0.18" /></svg>基本信息
          </div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">ID</div>
              <div class="item-value">{{ currentNode.id }}</div>
            </div>
            <div class="neo-grid-item alias-grid-item">
              <div class="item-label">名称</div>
              <div class="item-value alias-item-value">
                <template v-if="isEditingAlias">
                  <el-input
                    v-model="editableAlias"
                    size="small"
                    maxlength="64"
                    placeholder="请输入节点名"
                    @keyup.enter="handleSaveAlias"
                    @keyup.esc="handleCancelAliasEdit"
                  />
                  <div class="alias-action-row">
                    <button
                      class="alias-action-btn save"
                      @click="handleSaveAlias"
                      :disabled="isAliasSaving"
                    >
                      {{ isAliasSaving ? '保存中...' : '保存' }}
                    </button>
                    <button
                      class="alias-action-btn cancel"
                      @click="handleCancelAliasEdit"
                      :disabled="isAliasSaving"
                    >
                      取消
                    </button>
                  </div>
                </template>
                <template v-else>
                  <span class="alias-text">{{ displayNodeName }}</span>
                  <button
                    v-if="canEditNodeAlias"
                    class="alias-inline-btn"
                    @click="handleStartAliasEdit"
                  >
                    编辑
                  </button>
                </template>
              </div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">类型</div>
              <div class="item-value">{{ getNodeTypeLabel(currentNode.type) }}</div>
            </div>
            <div class="neo-grid-item" v-if="isRouterNode && currentNode.convergenceTime !== undefined">
              <div class="item-label">收敛时间(ms)</div>
              <div class="item-value">{{ currentNode.convergenceTime }}</div>
            </div>
            <div class="neo-grid-item">
              <div class="item-label">状态</div>
              <div class="item-value">
                <span :class="['status-indicator', nodeStatusClass]"></span>
                {{ nodeStatusText }}
              </div>
            </div>
          </div>
          <div class="section-location">
            {{ geoToXYHText(currentNode.geo.lon, currentNode.geo.lat, currentNode.geo.alt) }}
          </div>
        </div>
        
        <div class="neo-section" v-if="isSubnetNode && subnetKeyConfig">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#9c27b0" fill-opacity="0.18" />
              <circle cx="8" cy="8" r="4" fill="#9c27b0" fill-opacity="0.38" />
            </svg>
            子网配置
          </div>
          <div class="neo-grid">
            <div class="neo-grid-item">
              <div class="item-label">模型</div>
              <div class="item-value">{{ subnetKeyConfig.model }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.datarate">
              <div class="item-label">数据速率</div>
              <div class="item-value">{{ subnetKeyConfig.datarate }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.delay">
              <div class="item-label">延迟</div>
              <div class="item-value">{{ subnetKeyConfig.delay }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.frequency">
              <div class="item-label">频率</div>
              <div class="item-value">{{ subnetKeyConfig.frequency }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.frequencyOfInterest">
              <div class="item-label">关注频率</div>
              <div class="item-value">{{ subnetKeyConfig.frequencyOfInterest }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.bandwidth">
              <div class="item-label">带宽</div>
              <div class="item-value">{{ subnetKeyConfig.bandwidth }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.noiseFigure">
              <div class="item-label">噪声系数</div>
              <div class="item-value">{{ subnetKeyConfig.noiseFigure }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.dopplerShiftEnabled">
              <div class="item-label">多普勒频移</div>
              <div class="item-value">{{ subnetKeyConfig.dopplerShiftEnabled }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.txpower">
              <div class="item-label">发射功率</div>
              <div class="item-value">{{ subnetKeyConfig.txpower }}</div>
            </div>
            <div class="neo-grid-item" v-if="subnetKeyConfig.propagation">
              <div class="item-label">传播模型</div>
              <div class="item-value">{{ subnetKeyConfig.propagation }}</div>
            </div>
          </div>
        </div>
        
        <!-- 真正的路由器节点（nest:v3）显示网络层协议模型 -->
        <div class="neo-section" v-if="isRealRouterNode">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#00a0ff" fill-opacity="0.18" />
              <circle cx="8" cy="8" r="4" fill="#00a0ff" fill-opacity="0.38" /></svg>网络层协议模型
          </div>
          <div class="neo-resource-config">

            <div style="margin-top: 18px; text-align: center;">
              <button class="neo-btn protocol-btn" @click="handleOpenProtocolDialog">
                <el-icon><Connection /></el-icon>
                协议配置
              </button>
            </div>


          </div>
        </div>

        <!-- 其他DOCKER节点显示静态路由配置 -->
        <div class="neo-section" v-if="isOtherDockerNode">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#00a0ff" fill-opacity="0.18" />
              <circle cx="8" cy="8" r="4" fill="#00a0ff" fill-opacity="0.38" /></svg>静态路由配置
          </div>
          <div class="neo-resource-config">

            <div style="margin-top: 18px; text-align: center;">
              <button class="neo-btn protocol-btn" @click="handleOpenStaticRouteDialog">
                <el-icon><Connection /></el-icon>
                静态路由配置
              </button>
            </div>


          </div>
        </div>

        <div class="neo-section" v-if="!isSubnetNode">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#ff5252" fill-opacity="0.18" />
              <circle cx="8" cy="8" r="4" fill="#ff5252" fill-opacity="0.38" /></svg>故障设置
          </div>
          <div class="neo-resource-config fault-config">
            <div class="resource-item">
              <div class="resource-label">故障状态</div>
              <el-switch
                v-model="faultConfig.enabled"
                active-color="#ff4949"
                inactive-color="#13ce66"
                :active-text="faultConfig.enabled ? '已开启' : '已关闭'"
                @change="handleFaultToggle"
              />
            </div>
          </div>
        </div>

        <div class="neo-section" v-if="isVMNode && vmTemplateInfo">
          <div class="neo-section-title">
            <svg width="16" height="16" style="margin-right: 4px">
              <circle cx="8" cy="8" r="7" fill="#9c27b0" fill-opacity="0.18" />
              <circle cx="8" cy="8" r="4" fill="#9c27b0" fill-opacity="0.38" />
            </svg>
            虚拟机模板信息
          </div>
          <div class="vm-template-info">
            <div class="vm-template-grid">
              <div class="vm-template-item">
                <div class="vm-item-label">模板名称</div>
                <div class="vm-item-value">{{ vmTemplateInfo.name }}</div>
              </div>
              <div class="vm-template-item">
                <div class="vm-item-label">模板描述</div>
                <div class="vm-item-value">{{ vmTemplateInfo.description }}</div>
              </div>
              <div class="vm-template-item">
                <div class="vm-item-label">CPU核数</div>
                <div class="vm-item-value">{{ vmTemplateInfo.vcpu }} 核</div>
              </div>
              <div class="vm-template-item">
                <div class="vm-item-label">内存大小</div>
                <div class="vm-item-value">{{ formatMemory(vmTemplateInfo.memory) }}</div>
              </div>
              <div class="vm-template-item">
                <div class="vm-item-label">当前内存</div>
                <div class="vm-item-value">{{ formatMemory(vmTemplateInfo.curMemory) }}</div>
              </div>
              <div class="vm-template-item">
                <div class="vm-item-label">磁盘文件</div>
                <div class="vm-item-value">{{ vmTemplateInfo.disk }}</div>
              </div>
              <div class="vm-template-item full-width">
                <div class="vm-item-label">镜像位置</div>
                <div class="vm-item-value">{{ vmTemplateInfo.location }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="neo-actions vm-actions" v-if="isVMNode">
          <div class="vm-action-row">
            <button class="neo-btn vm-start-btn" @click="handleStartVM">
              <el-icon><Monitor /></el-icon>
              启动虚拟机
            </button>
            <button class="neo-btn vm-stop-btn" @click="handleStopVM">
              <el-icon><Close /></el-icon>
              关闭虚拟机
            </button>
          </div>
          <div class="vm-action-row">
            <button class="neo-btn vm-edit-btn" @click="handleEditVMParams">
              <el-icon><Connection /></el-icon>
              编辑参数
            </button>
            <button class="neo-btn delete-btn" @click="handleDelete">
              <el-icon><Delete /></el-icon>
              删除节点
            </button>
          </div>
        </div>

        <!-- 子网节点的特殊界面 -->
        <div class="neo-actions" v-else-if="isSubnetNode">
          <button class="neo-btn subnet-config-btn" @click="handleModifySubnetParams">
            <el-icon><Connection /></el-icon>
            修改参数
          </button>
          <button
            v-if="isSubnetTDMA"
            class="neo-btn slot-config-btn"
            @click="handleOpenSlotConfig"
          >
            <el-icon><Timer /></el-icon>
            时隙配置
          </button>
          <button class="neo-btn delete-btn" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除节点
          </button>
        </div>

        <!-- 其他节点的常规按钮布局 -->
        <div class="neo-actions" v-else-if="!isVMNode && !isBusinessTransmitterNode && !isTMVNode && !isSubnetNode">
          <button class="neo-btn signal-sim-btn" @click="handleOpenSignalSimDialog" v-if="isUAVNode">
            <el-icon><Connection /></el-icon>
            信号级仿真
          </button>
          <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode || isUAVNode">
            <el-icon><Monitor /></el-icon>
            打开终端
          </button>
          <button class="neo-btn delete-btn" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除节点
          </button>
        </div>

        <!-- BUSINESS_Transmitter节点的特殊界面 -->
        <div class="business-transmitter-section" v-if="isBusinessTransmitterNode && businessTransmitterConfig">
          <!-- 发送机界面 -->
          <div v-if="businessTransmitterConfig.deviceType === 'container'" class="transmitter-config">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right: 4px">
                <circle cx="8" cy="8" r="7" fill="#00c853" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="4" fill="#00c853" fill-opacity="0.38" />
              </svg>
              发送机配置
            </div>
            
            <div class="transmitter-operation">
              <div class="operation-type">
                <div class="resource-label">操作类型:</div>
                <el-select v-model="transmitterOperation.type" size="small" class="resource-select" @change="handleOperationTypeChange">
                  <el-option label="生成图片" value="image" />
                  <el-option label="生成视频" value="video" />
                  <el-option label="生成报文" value="packet" />
                  <el-option label="生成数据" value="data" />
                </el-select>
              </div>

              <!-- 生成图片配置 -->
              <div v-if="transmitterOperation.type === 'image'" class="image-config">
                <div class="config-row">
                  <div class="resource-label">图片数量:</div>
                  <el-input-number 
                    v-model="transmitterOperation.imageConfig.count" 
                    :min="1" 
                    :max="100" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">宽度(px):</div>
                  <el-input-number 
                    v-model="transmitterOperation.imageConfig.width" 
                    :min="100" 
                    :max="4096" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">高度(px):</div>
                  <el-input-number 
                    v-model="transmitterOperation.imageConfig.height" 
                    :min="100" 
                    :max="4096" 
                    size="small" 
                    class="config-input"
                  />
                </div>
              </div>

              <!-- 生成视频配置 -->
              <div v-if="transmitterOperation.type === 'video'" class="video-config">
                <div class="config-row">
                  <div class="resource-label">视频数量:</div>
                  <el-input-number 
                    v-model="transmitterOperation.videoConfig.count" 
                    :min="1" 
                    :max="50" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">时长(秒):</div>
                  <el-input-number 
                    v-model="transmitterOperation.videoConfig.duration" 
                    :min="1" 
                    :max="3600" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">业务通信时长(秒):</div>
                  <el-input-number 
                    v-model="transmitterOperation.videoConfig.businessDuration" 
                    :min="0" 
                    :max="7200" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">速率(KB/s):</div>
                  <el-input-number 
                    v-model="transmitterOperation.videoConfig.bitrate" 
                    :min="1" 
                    :max="10000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
              </div>

              <!-- 生成报文配置 -->
              <div v-if="transmitterOperation.type === 'packet'" class="packet-config">
                <div class="config-row">
                  <div class="resource-label">数量:</div>
                  <el-input-number 
                    v-model="transmitterOperation.packetConfig.count" 
                    :min="1" 
                    :max="1000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">报文数量:</div>
                  <el-input-number 
                    v-model="transmitterOperation.packetConfig.packetCount" 
                    :min="1" 
                    :max="10000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">报文大小(bytes):</div>
                  <el-input-number 
                    v-model="transmitterOperation.packetConfig.packetSize" 
                    :min="64" 
                    :max="65536" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">业务通信时长(秒):</div>
                  <el-input-number 
                    v-model="transmitterOperation.packetConfig.delay" 
                    :min="0" 
                    :max="3600" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">速率(KB/s):</div>
                  <el-input-number 
                    v-model="transmitterOperation.packetConfig.rate" 
                    :min="0" 
                    :max="100000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
              </div>

              <!-- 生成数据配置 -->
              <div v-if="transmitterOperation.type === 'data'" class="data-config">
                <div class="config-row">
                  <div class="resource-label">数量:</div>
                  <el-input-number 
                    v-model="transmitterOperation.dataConfig.count" 
                    :min="1" 
                    :max="1000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">数据大小(KB):</div>
                  <el-input-number 
                    v-model="transmitterOperation.dataConfig.dataSize" 
                    :min="1" 
                    :max="1024" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">数据类型:</div>
                  <el-select 
                    v-model="transmitterOperation.dataConfig.dataType" 
                    size="small" 
                    class="config-input"
                  >
                    <el-option label="随机数据" value="random" />
                    <el-option label="文本数据" value="text" />
                    <el-option label="二进制数据" value="binary" />
                  </el-select>
                </div>
                <div class="config-row">
                  <div class="resource-label">业务通信时长(秒):</div>
                  <el-input-number 
                    v-model="transmitterOperation.dataConfig.delay" 
                    :min="0" 
                    :max="3600" 
                    size="small" 
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">速率(KB/s):</div>
                  <el-input-number 
                    v-model="transmitterOperation.dataConfig.rate" 
                    :min="0" 
                    :max="100000" 
                    size="small" 
                    class="config-input"
                  />
                </div>
              </div>
            </div>

            <div class="neo-actions transmitter-actions">
              <button 
                class="neo-btn start-transmission-btn" 
                @click="handleStartTransmission"
                :disabled="transferExecuting"
                :loading="transferExecuting"
              >
                <el-icon v-if="!transferExecuting"><VideoPlay /></el-icon>
                <span v-if="transferExecuting">传输中...</span>
                <span v-else>开始传输</span>
              </button>
              <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
                <el-icon><Monitor /></el-icon>
                打开终端
              </button>
              <button class="neo-btn delete-btn" @click="handleDelete">
                <el-icon><Delete /></el-icon>
                删除节点
              </button>
            </div>

            <!-- 传输状态显示 -->
            <div v-if="transferStatus" class="transfer-status-display">
              <div class="status-header">传输状态</div>
              <div class="status-content">{{ transferStatus }}</div>
            </div>
          </div>

          <!-- 接收机界面 -->
          <div v-if="businessTransmitterConfig.deviceType === 'transferTarget'" class="receiver-config">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right: 4px">
                <circle cx="8" cy="8" r="7" fill="#1e90ff" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="4" fill="#1e90ff" fill-opacity="0.38" />
              </svg>
              接收机配置
            </div>
            
            <div class="neo-actions receiver-actions">
              <button class="neo-btn view-results-btn" @click="handleViewResults">
                <el-icon><View /></el-icon>
                查看结果
              </button>
              <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
                <el-icon><Monitor /></el-icon>
                打开终端
              </button>
              <button class="neo-btn delete-btn" @click="handleDelete">
                <el-icon><Delete /></el-icon>
                删除节点
              </button>
            </div>
          </div>
        </div>
        
        <!-- BUSINESS_Transmitter节点但没有配置时的常规按钮 -->
        <div class="neo-actions" v-else-if="isBusinessTransmitterNode && !businessTransmitterConfig">
          <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
            <el-icon><Monitor /></el-icon>
            打开终端
          </button>
          <button class="neo-btn delete-btn" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除节点
          </button>
        </div>

        <!-- TMV流量终端节点的特殊界面 -->
        <div class="tmv-analyzer-section" v-if="isTMVNode && tmvConfig">
          <!-- 发送机界面 -->
          <div v-if="tmvConfig.deviceType === 'transmitter'" class="tmv-transmitter-config">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right: 4px">
                <circle cx="8" cy="8" r="7" fill="#ff9800" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="4" fill="#ff9800" fill-opacity="0.38" />
              </svg>
              流量发送机配置
            </div>

            <div class="tmv-operation">
              <div class="operation-config">
                <div class="config-row">
                  <div class="resource-label">流量模型:</div>
                  <el-select v-model="tmvOperation.trafficModel" size="small" class="resource-select">
                    <el-option
                      v-for="option in tmvTrafficModelOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </div>
                <div class="config-row">
                  <div class="resource-label">测试时长(秒):</div>
                  <el-input-number
                    v-model="tmvOperation.testDuration"
                    :min="1"
                    :max="3600"
                    size="small"
                    class="config-input"
                  />
                </div>
                <div class="config-row">
                  <div class="resource-label">目标IP:</div>
                  <el-input
                    v-model="tmvOperation.dstIp"
                    size="small"
                    placeholder="10.0.0.2"
                    class="config-input"
                  />
                </div>
              </div>
            </div>

            <div class="neo-actions tmv-actions">
              <button
                class="neo-btn start-tmv-btn"
                @click="handleStartTMVAnalysis"
                :disabled="tmvExecuting || !checkTMVExecutionTime().canExecute"
                :loading="tmvExecuting"
              >
                <el-icon v-if="!tmvExecuting"><DataAnalysis /></el-icon>
                <span v-if="tmvExecuting">分析中...</span>
                <span v-else-if="!checkTMVExecutionTime().canExecute">
                  等待中 ({{ Math.ceil(tmvRemainingTime / 1000) }}s)
                </span>
                <span v-else>开始发送</span>
              </button>
              <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
                <el-icon><Monitor /></el-icon>
                打开终端
              </button>
              <button class="neo-btn delete-btn" @click="handleDelete">
                <el-icon><Delete /></el-icon>
                删除节点
              </button>
            </div>

            <!-- 分析状态显示 -->
            <div v-if="tmvStatus" class="tmv-status-display">
              <div class="status-header">分析状态</div>
              <div class="status-content">{{ tmvStatus }}</div>
            </div>
          </div>

          <!-- 接收机界面 -->
          <div v-if="tmvConfig.deviceType === 'receiver'" class="tmv-receiver-config">
            <div class="neo-section-title">
              <svg width="16" height="16" style="margin-right: 4px">
                <circle cx="8" cy="8" r="7" fill="#2196f3" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="4" fill="#2196f3" fill-opacity="0.38" />
              </svg>
              流量接收机配置
            </div>

            <div class="neo-actions tmv-receiver-actions">
              <button class="neo-btn view-tmv-data-btn" @click="handleViewTMVData" :loading="tmvDataLoading">
                <el-icon><DataAnalysis /></el-icon>
                查看数据
              </button>
              <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
                <el-icon><Monitor /></el-icon>
                打开终端
              </button>
              <button class="neo-btn delete-btn" @click="handleDelete">
                <el-icon><Delete /></el-icon>
                删除节点
              </button>
            </div>
          </div>
        </div>

        <!-- TMV节点但没有配置时的常规按钮 -->
        <div class="neo-actions" v-else-if="isTMVNode && !tmvConfig">
          <button class="neo-btn terminal-btn" @click="handleOpenTerminal" v-if="isRouterNode">
            <el-icon><Monitor /></el-icon>
            打开终端
          </button>
          <button class="neo-btn delete-btn" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除节点
          </button>
        </div>
      </div>
    </div>
    
    <!-- 信号级仿真对话框 -->
    <el-dialog
      v-model="showSignalSimDialog"
      title="信号级仿真"
      width="500px"
      center
      destroy-on-close
      class="signal-sim-dialog"
      :close-on-click-modal="false"
    >
      <div class="signal-sim-content">
        <div class="signal-sim-header">
          <span class="signal-sim-title">
            <svg class="panel-icon" width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="8" fill="#1e90ff" fill-opacity="0.18" />
              <circle cx="9" cy="9" r="4" fill="#1e90ff" fill-opacity="0.38" />
            </svg>
            节点网卡
          </span>
        </div>
        <div class="signal-sim-interfaces">
          <template v-if="nodeInterfaces.length > 0">
            <div class="interface-list">
              <div
                v-for="iface in nodeInterfaces"
                :key="iface.id"
                class="interface-item"
              >
                <div class="interface-info">
                  <span class="interface-name">{{ iface.name || 'iface'+iface.id }}</span>
                  <span class="interface-id">(ID: {{ iface.id }})</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="no-interfaces">
            该节点无网卡接口
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showSignalSimDialog = false" :disabled="isLoading">取消</el-button>
          <el-button
            type="primary"
            @click="handleStartSignalSimulation"
            :disabled="nodeInterfaces.length === 0 || isLoading"
            :loading="isLoading"
          >
            {{ isLoading ? '处理中...' : '确认开启' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    

    <!-- VM参数编辑对话框 -->
    <VMEditDialog
      v-model:visible="showVMEditDialog"
      :nodeId="currentNode?.id"
      :sessionId="topoStore.currentSessionId ?? topoStore.topoData?.id"
      :templateId="vmTemplateInfo?.id || 1"
      :templateName="vmTemplateInfo?.name || 'Unknown'"
      :initialData="vmEditData"
      @confirm="handleVMEditConfirm"
    />
    <!-- 协议配置对话框 -->
    <protocolConfigDialog
      v-if="showProtocolDialog"
      :visible="showProtocolDialog"
      :protocol="networkProtocolConfig.routerProtocol"
      :interfaces="protocolIfaces"
      :nodeName="currentNode?.name"
      :nodeType="currentNode?.type"
      :nodeImage="currentNode?.image"
      @close="handleProtocolClose"
      @save="handleProtocolSave"
    />

    <!-- 子网参数修改对话框 -->
    <SubnetConfigDialog
      v-if="showSubnetConfigDialog"
      :visible="showSubnetConfigDialog"
      :initialData="subnetConfigData"
      :isEditMode="true"
      @close="handleSubnetConfigClose"
      @confirm="handleSubnetConfigSave"
    />

    <!-- 时隙配置对话框 -->
    <SlotConfigDialog
      v-if="showSlotConfigDialog"
      :visible="showSlotConfigDialog"
      :subnetId="currentNode?.id"
      :initialConfig="slotConfig"
      @close="handleSlotConfigClose"
      @confirm="handleSlotConfigConfirm"
    />

    <!-- TMV数据查看对话框 -->
    <el-dialog
      v-model="showTMVDataDialog"
      title="流量模型数据分析"
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="tmv-data-content">
        <!-- 文件信息 -->
        <div class="tmv-file-info" v-if="tmvFileInfo">
          <h4>文件信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">容器:</span>
              <span class="info-value">{{ tmvFileInfo.container }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">文件名:</span>
              <span class="info-value">{{ tmvFileInfo.filename }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">生成时间:</span>
              <span class="info-value">{{ tmvFileInfo.generated_time }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">记录数量:</span>
              <span class="info-value">{{ tmvFileInfo.row_count }}</span>
            </div>
          </div>
        </div>

        <!-- 图表容器 -->
        <div class="tmv-chart-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div>
              <h4>流量模型数据分析图表</h4>
              <div style="font-size: 12px; color: #666;">
                <span>当前模型: {{ tmvTrafficModelOptions.find(opt => opt.value === tmvOperation.trafficModel)?.label || '未知模型' }}</span>
                <span style="margin-left: 15px;">数据点数: {{ tmvChartData.length }}</span>
                <span v-if="tmvChartData.length > 0" style="margin-left: 15px;">
                  时间范围: {{ new Date(tmvChartData[0].timestamp * 1000).toLocaleTimeString() }} -
                  {{ new Date(tmvChartData[tmvChartData.length - 1].timestamp * 1000).toLocaleTimeString() }}
                </span>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <el-button size="small" @click="exportChart" :disabled="!tmvChartData.length || isChartRendering" :loading="isChartRendering">
                <el-icon><Download /></el-icon>
                导出图表
              </el-button>
              <el-button size="small" @click="refreshChart" :disabled="!tmvChartData.length || isChartRendering" :loading="isChartRendering">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </div>

          <!-- 图表选择器 -->
          <div style="margin-bottom: 15px;">
            <el-radio-group v-model="activeChartView" size="small" @change="handleChartViewChange" :disabled="isChartRendering">
              <el-radio-button label="analysis">模型分析图</el-radio-button>
              <el-radio-button label="original">原始数据图</el-radio-button>
              <el-radio-button label="both">双图对比</el-radio-button>
            </el-radio-group>
            <span v-if="isChartRendering" style="margin-left: 10px; color: #409EFF; font-size: 12px;">
              <i class="el-icon-loading"></i> 渲染中...
            </span>

          </div>

          <!-- 单图表显示 -->
          <div v-if="activeChartView !== 'both'">
            <div id="tmvChart" style="width: 100%; height: 500px; min-height: 400px;"></div>
          </div>

          <!-- 双图表对比显示 -->
          <div v-else class="dual-chart-container">
            <div class="chart-item">
              <h5>模型分析图</h5>
              <div id="tmvAnalysisChart" style="width: 100%; height: 400px; min-height: 350px;"></div>
            </div>
            <div class="chart-item">
              <h5>原始数据图</h5>
              <div id="tmvOriginalChart" style="width: 100%; height: 400px; min-height: 350px;"></div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 简化的传输结果对话框 -->
    <el-dialog
      v-model="showTransferResultDialog"
      title="业务传输结果"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="transferResultData" class="simple-transfer-result">
        <!-- 状态显示 -->
        <div class="status-row">
          <el-tag :type="getStatusType(transferResultData.status)" size="large">
            {{ getStatusText(transferResultData.status) }}
          </el-tag>
          <span class="timestamp">{{ transferResultData.timestamp }}</span>
        </div>

        <!-- 基本信息 -->
        <el-descriptions :column="1" border class="result-info">
          <el-descriptions-item label="任务ID">
            <div class="id-row">
              <code>{{ transferResultData.transferId }}</code>
              <el-button size="small" text @click="copyToClipboard(transferResultData.transferId)">
                复制
              </el-button>
            </div>
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.source" label="源节点">
            {{ transferResultData.source }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.target" label="目标节点">
            {{ transferResultData.target }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.sourceIp" label="源IP">
            {{ transferResultData.sourceIp }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.targetIp" label="目标IP">
            {{ transferResultData.targetIp }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.port" label="端口">
            {{ transferResultData.port }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.file" label="文件路径">
            {{ transferResultData.file }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.delay !== undefined" label="业务通信时长">
            {{ transferResultData.delay || 0 }}秒
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.rate !== undefined" label="传输速率">
            {{ transferResultData.rate === 0 ? '不限速' : (transferResultData.rate || 0) + ' KB/s' }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.details?.sent" label="发送端">
            {{ transferResultData.details.sent }}
          </el-descriptions-item>

          <el-descriptions-item v-if="transferResultData.details?.received" label="接收端">
            {{ transferResultData.details.received }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 网络指标信息 -->
        <div v-if="transferResultData.networkMetrics" class="network-metrics-section">
          <h4>网络性能指标</h4>
          <el-descriptions :column="2" border class="network-metrics-info">
            <el-descriptions-item label="数据包统计">
              成功: {{ transferResultData.networkMetrics.successful_packets || 0 }} / 
              总计: {{ transferResultData.networkMetrics.total_packets || 0 }}
            </el-descriptions-item>

            <el-descriptions-item label="丢包统计">
              丢失: {{ transferResultData.networkMetrics.lost_packets || 0 }} 个
            </el-descriptions-item>

            <el-descriptions-item label="错误率">
              <el-tag 
                :type="(transferResultData.networkMetrics.error_rate || 0) < 0.01 ? 'success' : 
                      (transferResultData.networkMetrics.error_rate || 0) < 0.05 ? 'warning' : 'danger'"
                size="small"
              >
                {{ ((transferResultData.networkMetrics.error_rate || 0) * 100).toFixed(2) }}%
              </el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="网络抖动">
              {{ (transferResultData.networkMetrics.jitter || 0).toFixed(2) }} ms
            </el-descriptions-item>

            <el-descriptions-item label="带宽利用率">
              {{ (transferResultData.networkMetrics.bandwidth || 0).toFixed(2) }} Mbps
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 详细信息 -->
        <div v-if="transferResultData.message" class="message-section">
          <h4>详细信息</h4>
          <el-input
            v-model="transferResultData.message"
            type="textarea"
            :rows="6"
            readonly
            class="message-textarea"
          />
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button
            v-if="transferResultData?.status === 'running'"
            type="primary"
            @click="refreshTransferStatus"
            :loading="refreshing"
          >
            刷新状态
          </el-button>
          <el-button
            v-if="transferResultData?.file && transferResultData?.source"
            type="success"
            @click="handleViewFile"
            :loading="viewingFile"
          >
            <el-icon><Document /></el-icon>
            查看文件
          </el-button>
          <el-button @click="showTransferResultDialog = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 文件内容查看对话框 -->
    <el-dialog
      v-model="showFileContentDialog"
      title="文件内容"
      width="700px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="file-content-container">
        <div class="file-info">
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="容器">
              {{ transferResultData?.source || '未知' }}
            </el-descriptions-item>
            <el-descriptions-item label="文件路径">
              {{ transferResultData?.file || '未知' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <div class="file-content">
          <!-- 图片展示 -->
          <div v-if="fileContentType === 'image'" class="media-content image-content">
            <img :src="fileContentData" alt="文件图片" class="file-image" />
          </div>
          
          <!-- 视频展示 -->
          <div v-else-if="fileContentType === 'video'" class="media-content video-content">
            <video :src="fileContentData" controls class="file-video">
              您的浏览器不支持视频播放。
            </video>
          </div>
          
          <!-- 文本内容展示 -->
          <div v-else class="text-content">
            <el-input
              v-model="fileContent"
              type="textarea"
              :rows="15"
              readonly
              resize="vertical"
              class="file-content-textarea"
              placeholder="文件内容将在此显示..."
            />
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="copyToClipboard(fileContent)" type="primary">
            <el-icon><DocumentCopy /></el-icon>
            复制内容
          </el-button>
          <el-button @click="showFileContentDialog = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useTopoStore } from "../../../store/modules/topo";
import { geoToXYHText } from "../../../utils/coordTransform";
import { useDraggable } from '../../../composables/useDraggable';
import { useVMTemplateStore } from "../../../store/modules/vmTemplate";
import { getCsv, trafficModel } from "../../../api/traffic";
import { executeOperation, fetchTransferStatus, viewFile } from "../../../api/container";
import { computed, ref, onMounted, nextTick, watch, onUnmounted } from "vue";
import { ElMessageBox, ElMessage, ElDialog } from "element-plus";
import { Delete, Monitor, Close, Minus, Connection, DataAnalysis, VideoPlay, View, Check, Loading, Key, Timer, Odometer, Upload, Download, Right, Document, SuccessFilled, CircleCloseFilled, InfoFilled, DocumentCopy, Refresh } from '@element-plus/icons-vue';
import { startVMNode, stopVMNode } from "../../../api/node";
// import { modifyLink,signalStart } from "../../../api/link"; // 已改为使用store方法
import Vnc from "./Vnc.vue";
import VMEditDialog from "./VMEditDialog.vue";
import type { NodeIface, Link, Node } from "../../../types/topo";
import { getUserInfo } from "../../../store/user";
import protocolConfigDialog from "./protocolConfigDialog.vue";
import SubnetConfigDialog from "./SubnetConfigDialog.vue";
import SlotConfigDialog from "./SlotConfigDialog.vue";
import eventBus from '../../../utils/eventBus';
import * as echarts from 'echarts';
import { generateTDMA, type GenerateTDMARequest } from '../../../api/tdma';


const props = defineProps<{
  node: any;
  showPanel?: boolean; // 是否显示面板UI，如果为false只显示对话框
}>();

// 默认值处理
const showPanelDefault = computed(() => {
  return props.showPanel !== false;
});

const emit = defineEmits(["close", "delete", "openTerminal", "openVnc", "refresh-links"]);

const topoStore = useTopoStore();
const vmTemplateStore = useVMTemplateStore();
const isLoading = ref(false);

// 拖拽功能
const nodeInfoBoxRef = ref<HTMLElement | null>(null);
const { offsetX: dragOffsetX, offsetY: dragOffsetY, resetPosition: resetDragPosition } = useDraggable(
  nodeInfoBoxRef,
  '.neo-infobox-header'
);

// TMV数据查看相关状态
const tmvDataLoading = ref(false);
const showTMVDataDialog = ref(false);
const tmvChartData = ref<any[]>([]);
const tmvFileInfo = ref<any>(null);
const activeChartView = ref('analysis'); // 当前激活的图表视图：analysis, original, both
const isChartRendering = ref(false); // 图表渲染状态

// 信号级仿真相关状态
const showSignalSimDialog = ref(false);
const selectedInterfaces = ref<number[]>([]);
const nodeInterfaces = ref<NodeIface[]>([]);

// 资源配置相关数据
const resourceConfig = ref({
  server: 'auto',
  cpu: '2',
  memory: '2',
  cpuShare: 'normal'
});

// 网络协议配置相关数据
const networkProtocolConfig = ref({
  droneProtocol: 'OLSR',      // 无人机默认协议
  routerProtocol: 'OSPF'      // 路由器默认协议
});


const currentNode = computed(() => {
  if (!props.node?.id || !topoStore.topoData?.nodes) return props.node;
  return topoStore.topoData.nodes.find((n: Node) => n.id === props.node.id) || props.node;
});

// 去掉节点名称中的 sessionId 后缀（如 "流量终端1-835" → "流量终端1"）
const stripSessionSuffix = (name: string): string => {
  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  if (sessionId && name.endsWith(`-${sessionId}`)) {
    return name.slice(0, -(String(sessionId).length + 1));
  }
  return name;
};

// 节点显示名称（优先alias，回退去除sessionId后缀的name）
const displayNodeName = computed((): string => {
  if (!currentNode.value) return '';
  return currentNode.value.alias || stripSessionSuffix(currentNode.value.name || '');
});

// 监听收敛时间更新事件，自动刷新
const handleRouterConvergenceUpdated = () => {
  if (currentNode.value && currentNode.value.id) {
    const node = topoStore.topoData?.nodes?.find((n: any) => n.id === currentNode.value.id);
    if (node) {
      currentNode.value = { ...node };
    }
  }
};


const faultConfig = ref({
  enabled: false
});


const vmWebSocketUrl = ref<string | null>(null);


const showVMEditDialog = ref(false);
const vmEditData = ref({
  cpu: 1,
  memory: '1048576',
  currentMemory: '1048576',
  templateId: 1
});
const isEditingAlias = ref(false);
const isAliasSaving = ref(false);
const editableAlias = ref('');


watch(() => currentNode.value?.status, (newStatus) => {
  faultConfig.value.enabled = newStatus === 'DOWN';
}, { immediate: true });

watch(
  () => [currentNode.value?.id, currentNode.value?.alias, currentNode.value?.name],
  () => {
    if (!isEditingAlias.value) {
      editableAlias.value = displayNodeName.value;
    }
  },
  { immediate: true }
);

const normalizeRoleForEdit = (role: any): number | undefined => {
  if (typeof role === 'number') {
    return role;
  }
  if (typeof role === 'string') {
    const roleMap: Record<string, number> = {
      WHITE: 1,
      RED: 2,
      BLUE: 3
    };
    const mappedRole = roleMap[role.toUpperCase()];
    if (mappedRole !== undefined) {
      return mappedRole;
    }
    const parsedRole = Number(role);
    if (!Number.isNaN(parsedRole)) {
      return parsedRole;
    }
  }
  return undefined;
};

const handleStartAliasEdit = () => {
  if (!canEditNodeAlias.value || !currentNode.value) {
    return;
  }
  editableAlias.value = displayNodeName.value;
  isEditingAlias.value = true;
};

const handleCancelAliasEdit = () => {
  isEditingAlias.value = false;
  editableAlias.value = displayNodeName.value;
};

const handleSaveAlias = async () => {
  if (!currentNode.value?.id || isAliasSaving.value) {
    return;
  }

  const trimmedAlias = editableAlias.value.trim();
  if (!trimmedAlias) {
    ElMessage.warning('节点名不能为空');
    return;
  }

  const duplicateAlias = topoStore.topoData?.nodes?.some((node: Node) => {
    if (node.id === currentNode.value?.id) {
      return false;
    }
    return (node.alias || node.name || '').trim() === trimmedAlias;
  });

  if (duplicateAlias) {
    ElMessage.warning(`节点名称"${trimmedAlias}"已存在，请修改后重试`);
    return;
  }

  try {
    isAliasSaving.value = true;
    const normalizedRole = normalizeRoleForEdit(currentNode.value.role);
    const updatedNodeData = {
      ...currentNode.value,
      alias: trimmedAlias,
      ...(normalizedRole !== undefined ? { role: normalizedRole } : {})
    };

    await (topoStore as any).editNodeRemote(updatedNodeData);

    if (props.node && props.node.id === currentNode.value.id) {
      props.node.alias = trimmedAlias;
    }

    editableAlias.value = trimmedAlias;
    isEditingAlias.value = false;
    ElMessage.success('节点名修改成功');
  } catch (error: any) {
    console.error('更新节点名失败:', error);
    ElMessage.error(error?.message || '更新节点名失败');
  } finally {
    isAliasSaving.value = false;
  }
};


const handleFaultToggle = async (value: boolean) => {
  try {

    const convertRoleToNumber = (role: any): number => {
      if (typeof role === 'number') {
        return role; // 如果已经是数字，直接返回
      }
      if (typeof role === 'string') {
        const roleMap: Record<string, number> = {
          'WHITE': 1,
          'RED': 2,
          'BLUE': 3
        };
        return roleMap[role.toUpperCase()] || 1; // 默认为WHITE(1)
      }
      return 1; // 默认为WHITE(1)
    };


    const updatedNodeData = {
      ...currentNode.value,
      status: value ? 'DOWN' : 'UP', // 故障开启时设为DOWN，关闭时设为UP
      role: convertRoleToNumber(currentNode.value?.role) // 确保role是数字格式
    };


    await (topoStore as any).editNodeRemote(updatedNodeData);


    ElMessage({
      message: value ? '节点故障已开启，状态已设为DOWN' : '节点故障已关闭，状态已设为UP',
      type: value ? 'warning' : 'success',
      duration: 2000
    });
  } catch (error: any) {

    console.error('更新节点状态失败:', error);
    ElMessage({
      message: error?.message || '更新节点状态失败',
      type: 'error',
      duration: 3000
    });

    faultConfig.value.enabled = !value;
  }
};

// 节点状态文本计算属性
const nodeStatusText = computed(() => {
  const status = currentNode.value?.status || 'UP';
  return status === 'UP' ? '正常' : '故障';
});

// 节点状态样式类计算属性
const nodeStatusClass = computed(() => {
  const status = currentNode.value?.status || 'UP';
  return status === 'UP' ? 'status-up' : 'status-down';
});

// 判断是否为分布式场景
const isDistributedScene = computed(() => {
  const topoData = topoStore.topoData;
  if (topoData?.metadata && topoData.metadata.disturb) {
    return topoData.metadata.disturb === '1';
  } else if (topoData?.options && topoData.options.disturb) {
    return topoData.options.disturb === '1';
  }
  return false;
});

// 节点类型中英文映射
const getNodeTypeLabel = (type: string): string => {
  // 根据节点名称前缀来确定类型，不再依赖type字段
  const nodeName = currentNode.value?.name || '';

  // 优先检查更具体的前缀，避免被通用前缀误判

  // 业务终端（需要在BUSINESS之前判断）
  if (nodeName.includes('BUSINESS_Transmitter') || nodeName.startsWith('业务终端')) {
    return '业务终端';
  }

  // 攻击机
  if (nodeName.includes('ATTACK_MACHINE') || nodeName.startsWith('攻击机')) {
    return '攻击机';
  }

  // 安全机
  if (nodeName.includes('SECURITY_MACHINE') || nodeName.startsWith('安全机')) {
    return '安全机';
  }

  // SDN控制器
  if (nodeName.includes('SDN_CONTROLLER') || nodeName.startsWith('SDN控制器')) {
    return 'SDN控制器';
  }

  // Ovs交换机（需要在SWITCH之前判断）
  if (nodeName.includes('Ovs_SWITCH') || nodeName.startsWith('Ovs交换机')) {
    return 'Ovs交换机';
  }

  // P4交换机（需要在SWITCH之前判断）
  if (nodeName.includes('P4') || nodeName.startsWith('P4交换机')) {
    return 'P4交换机';
  }

  // SR交换机（需要在SWITCH之前判断）
  if (nodeName.includes('SR') || nodeName.startsWith('SR交换机')) {
    return 'SR交换机';
  }

  // 视频服务器
  if (nodeName.includes('RTSP_RTP') || nodeName.startsWith('视频服务器')) {
    return '视频服务器';
  }

  // VoIP服务器
  if (nodeName.includes('VoIP_SIP') || nodeName.startsWith('VoIP')) {
    return 'VoIP服务器';
  }

  // HTTP服务器
  if (nodeName.includes('HTTP') || nodeName.startsWith('HTTP')) {
    return 'HTTP服务器';
  }

  // FTP服务器
  if (nodeName.includes('FTP') || nodeName.startsWith('FTP')) {
    return 'FTP服务器';
  }

  // DNS服务器
  if (nodeName.includes('DNS') || nodeName.startsWith('DNS')) {
    return 'DNS服务器';
  }

  // SMTP服务器
  if (nodeName.includes('SMTP') || nodeName.startsWith('SMTP')) {
    return 'SMTP服务器';
  }

  // 流量终端
  if (nodeName.includes('TMV') || nodeName.startsWith('流量终端')) {
    return '流量终端';
  }

  // 机动车
  if (nodeName.startsWith('VAN') || nodeName.startsWith('机动车')) {
    return '机动车';
  }

  // 卫星
  if (nodeName.startsWith('SATELLITE') || nodeName.startsWith('卫星')) {
    return '卫星';
  }

  // 无人机
  if (nodeName.startsWith('DRONE') || nodeName.startsWith('无人机')) {
    return '无人机';
  }

  // 基站
  if (nodeName.startsWith('BASESTATION') || nodeName.startsWith('基站')) {
    return '基站';
  }

  // 子网（EMANE）
  if (nodeName.startsWith('subnet-') || nodeName.startsWith('子网')) {
    return '子网';
  }

  // 干扰节点（INODE）
  if (nodeName.startsWith('干扰')) {
    return '干扰节点';
  }

  // 服务器
  if (nodeName.startsWith('SERVER') || nodeName.startsWith('服务器')) {
    return '服务器';
  }

  // 路由器
  if (nodeName.startsWith('ROUTER') || nodeName.startsWith('路由器')) {
    return '路由器';
  }

  // 交换机
  if (nodeName.startsWith('SWITCH') || nodeName.startsWith('交换机')) {
    return '交换机';
  }

  // 虚拟机
  if (nodeName.startsWith('VMNODE') || nodeName.startsWith('虚拟机')) {
    return '虚拟机';
  }

  // 半实物节点
  if (nodeName.startsWith('ens52f0') || nodeName.startsWith('半实物')) {
    return '半实物节点';
  }

  // 设备
  if (nodeName.startsWith('DEVICE') || nodeName.startsWith('设备')) {
    return '设备';
  }

  // 如果所有前缀都不匹配，返回默认值
  return '设备';
};

// 判断是否为无人机节点（包括机动车和卫星）
const isUAVNode = computed(() => {
  const nodeType = getNodeTypeLabel(currentNode.value?.type || '');
  const nodeName = currentNode.value?.name || '';
  return nodeType === 'DRONE' ||
         nodeType === '机动车' ||
         nodeType === '卫星' ||
         nodeName.startsWith('DRONE') ||
         nodeName.startsWith('VAN') ||
         nodeName.startsWith('SATELLITE') ||
         nodeName.startsWith('无人机') ||
         nodeName.startsWith('机动车') ||
         nodeName.startsWith('卫星') ||
         nodeName.startsWith('BASESTATION');
});

// 判断是否为真正的路由器节点（DOCKER类型且镜像为nest:v3）
const isRealRouterNode = computed(() => {
  const actualType = currentNode.value?.type || '';
  const image = currentNode.value?.image || '';
  const nodeType = getNodeTypeLabel(currentNode.value?.type || '');
  const nodeName = currentNode.value?.name || '';

  // DOCKER类型且镜像为nest:v3的节点才是真正的路由器
  if (actualType === 'DOCKER' && image === 'nest:v3') {
    return true;
  }

  // 其他类型的路由器节点
  return nodeType === '路由器' ||
         nodeName.startsWith('ROUTER') ||
         nodeName.startsWith('路由器');
});

// 判断是否为其他DOCKER节点（非nest:v3镜像的DOCKER节点）
const isOtherDockerNode = computed(() => {
  const actualType = currentNode.value?.type || '';
  const image = currentNode.value?.image || '';

  return actualType === 'DOCKER' && image !== 'nest:v3';
});

// 判断是否为路由器节点（包含所有DOCKER节点，用于终端功能等）
const isRouterNode = computed(() => {
  const nodeType = getNodeTypeLabel(currentNode.value?.type || '');
  const nodeName = currentNode.value?.name || '';
  const actualType = currentNode.value?.type || '';

  return nodeType === '路由器' ||
         nodeName.startsWith('ROUTER') ||
         nodeName.startsWith('路由器') ||
         actualType === 'DOCKER'; // DOCKER类型的节点都应该有终端功能
});

// 判断是否为VM节点
const isVMNode = computed(() => {
  const nodeType = currentNode.value?.type || '';
  const nodeName = currentNode.value?.name || '';
  return nodeType === 'VMNODE' || nodeType === 'SERVER' || nodeName.startsWith('虚拟机');
});

const isInterferenceNode = computed(() => {
  return currentNode.value?.type === 'INODE';
});

const canEditNodeAlias = computed(() => {
  return Boolean(currentNode.value?.id) && !isVMNode.value && !isInterferenceNode.value;
});

// 判断是否为子网节点
const isSubnetNode = computed(() => {
  const nodeType = currentNode.value?.type || '';
  return nodeType === 'EMANE';
});

const isTMVNode = computed(() => {
  return currentNode.value?.image === 'tmv:v1';
});

const isChildOfSubnetNode = computed(() => {
  if (!currentNode.value?.parent_id || !topoStore.topoData?.nodes) {
    return false;
  }

  const parentNode = topoStore.topoData.nodes.find((node: any) => node.id === currentNode.value?.parent_id);
  return parentNode?.type === 'EMANE';
});

const isConnectedToSubnetNode = computed(() => {
  if (!currentNode.value?.id || !topoStore.topoData?.links || !topoStore.topoData?.nodes) {
    return false;
  }

  return topoStore.topoData.links.some((link: any) => {
    if (link.node1_id !== currentNode.value?.id && link.node2_id !== currentNode.value?.id) {
      return false;
    }

    const otherNodeId = link.node1_id === currentNode.value?.id ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData.nodes.find((node: any) => node.id === otherNodeId);
    return otherNode?.type === 'EMANE';
  });
});

const isWirelessEnvironmentNode = computed(() => {
  return isSubnetNode.value || isChildOfSubnetNode.value || isConnectedToSubnetNode.value;
});

// 从本地存储获取TMV配置
const tmvConfig = ref<any>(null);
const loadTMVConfig = () => {
  if (!isTMVNode.value || !currentNode.value?.id) return;

  const storageKey = `tmvConfig_${currentNode.value.id}`;
  const savedConfig = localStorage.getItem(storageKey);

  if (savedConfig) {
    try {
      tmvConfig.value = JSON.parse(savedConfig);
    } catch (error) {
      console.error('解析TMV配置失败:', error);
      tmvConfig.value = null;
    }
  }
};

// 监听节点变化，重新加载TMV配置
watch(() => currentNode.value?.id, () => {
  if (isTMVNode.value) {
    loadTMVConfig();
  }
}, { immediate: true });

// 判断是否为BUSINESS_Transmitter节点
const isBusinessTransmitterNode = computed(() => {
  return currentNode.value?.image === 'data:v1';
});

// 从本地存储获取BUSINESS_Transmitter配置
const businessTransmitterConfig = ref<any>(null);
const loadBusinessTransmitterConfig = () => {
  if (!isBusinessTransmitterNode.value || !currentNode.value?.id) return;
  
  const storageKey = `businessTransmitterConfig_${currentNode.value.id}`;
  const savedConfig = localStorage.getItem(storageKey);
  
  if (savedConfig) {
    try {
      businessTransmitterConfig.value = JSON.parse(savedConfig);
    } catch (error) {
      console.error('解析业务终端配置失败:', error);
      businessTransmitterConfig.value = null;
    }
  }
};

// 监听节点变化，重新加载配置
watch(() => currentNode.value?.id, () => {
  if (isBusinessTransmitterNode.value) {
    loadBusinessTransmitterConfig();
  }
}, { immediate: true });

// BUSINESS_Transmitter操作配置
const transmitterOperation = ref({
  type: 'image', // 'image' | 'video' | 'packet' | 'data'
  imageConfig: {
    count: 1,
    width: 1920,
    height: 1080
  },
  videoConfig: {
    count: 1,
    duration: 10,
    businessDuration: 0,
    bitrate: 1024
  },
  packetConfig: {
    count: 1,
    packetCount: 10,
    packetSize: 1024,
    delay: 0,
    rate: 0
  },
  dataConfig: {
    count: 1,
    dataSize: 10,
    dataType: 'random',
    delay: 0,
    rate: 0
  }
});

// TMV流量终端操作配置
const tmvOperation = ref({
  trafficModel: 'power_law_model.sh', // 流量模型
  testDuration: 60, // 测试时长（秒）
  dstIp: '10.0.0.2' // 目标IP
});

// TMV流量模型选项
const tmvTrafficModelOptions = [
  { label: '幂律模型', value: 'power_law_model.sh' },
  { label: '自相似模型', value: 'similar_model.sh' },
  { label: '马尔可夫模型', value: 'markov_model.sh' },
  { label: '长相关模型', value: 'lrd_model.sh' }
];

// 传输状态管理
const transferExecuting = ref(false);
const currentTransferId = ref<string | null>(null);
const transferStatus = ref('');
let transferCheckInterval: any = null;

// TMV分析状态管理
const tmvExecuting = ref(false);
const tmvStatus = ref('');
const tmvExecutionStartTime = ref<number | null>(null);
const tmvExecutionTimer = ref<number | null>(null);
const tmvMinExecutionTime = ref(5000); // 最小执行时间5秒
const tmvCooldownTime = ref(2000); // 冷却时间2秒
const tmvRemainingTime = ref(0); // 剩余时间显示
const tmvCountdownTimer = ref<number | null>(null);

// 检查TMV执行时间限制
const checkTMVExecutionTime = (): { canExecute: boolean; remainingTime: number; message: string } => {
  const now = Date.now();

  // 如果当前正在执行
  if (tmvExecuting.value && tmvExecutionStartTime.value) {
    const elapsedTime = now - tmvExecutionStartTime.value;
    const remainingTime = Math.max(0, tmvMinExecutionTime.value - elapsedTime);

    if (remainingTime > 0) {
      return {
        canExecute: false,
        remainingTime,
        message: `当前模型正在执行中，请等待 ${Math.ceil(remainingTime / 1000)} 秒后再试`
      };
    }
  }

  // 检查冷却时间
  if (tmvExecutionStartTime.value) {
    const timeSinceLastExecution = now - tmvExecutionStartTime.value;
    const totalRequiredTime = tmvMinExecutionTime.value + tmvCooldownTime.value;

    if (timeSinceLastExecution < totalRequiredTime) {
      const remainingCooldown = totalRequiredTime - timeSinceLastExecution;
      return {
        canExecute: false,
        remainingTime: remainingCooldown,
        message: `请等待 ${Math.ceil(remainingCooldown / 1000)} 秒冷却时间后再执行下一个模型`
      };
    }
  }

  return {
    canExecute: true,
    remainingTime: 0,
    message: '可以执行'
  };
};

// 启动TMV执行计时器
const startTMVExecutionTimer = () => {
  tmvExecutionStartTime.value = Date.now();

  // 清除之前的计时器
  if (tmvExecutionTimer.value) {
    clearTimeout(tmvExecutionTimer.value);
  }
  if (tmvCountdownTimer.value) {
    clearInterval(tmvCountdownTimer.value);
  }

  // 启动倒计时更新
  tmvCountdownTimer.value = setInterval(() => {
    const timeCheck = checkTMVExecutionTime();
    tmvRemainingTime.value = timeCheck.remainingTime;

    if (timeCheck.canExecute && !tmvExecuting.value) {
      // 倒计时结束，清除计时器
      if (tmvCountdownTimer.value) {
        clearInterval(tmvCountdownTimer.value);
        tmvCountdownTimer.value = null;
      }
      tmvRemainingTime.value = 0;
    }
  }, 100); // 每100ms更新一次

  // 设置最小执行时间计时器
  tmvExecutionTimer.value = setTimeout(() => {
    // TMV最小执行时间已到
  }, tmvMinExecutionTime.value);
};

// 停止TMV执行计时器
const stopTMVExecutionTimer = () => {
  if (tmvExecutionTimer.value) {
    clearTimeout(tmvExecutionTimer.value);
    tmvExecutionTimer.value = null;
  }
  if (tmvCountdownTimer.value) {
    clearInterval(tmvCountdownTimer.value);
    tmvCountdownTimer.value = null;
  }
  tmvRemainingTime.value = 0;
};

// 导出图表
const exportChart = () => {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const modelType = getCurrentTrafficModelType();

    if (activeChartView.value === 'both') {
      // 双图表模式 - 分别导出两个图表
      const analysisChartDom = document.getElementById('tmvAnalysisChart');
      const originalChartDom = document.getElementById('tmvOriginalChart');

      if (analysisChartDom && originalChartDom) {
        const analysisChart = echarts.getInstanceByDom(analysisChartDom);
        const originalChart = echarts.getInstanceByDom(originalChartDom);

        if (analysisChart && originalChart) {
          // 导出分析图表
          const analysisDataURL = analysisChart.getDataURL({
            type: 'png',
            pixelRatio: 2,
            backgroundColor: '#fff'
          });

          const analysisLink = document.createElement('a');
          analysisLink.download = `TMV_${modelType}_Analysis_${timestamp}.png`;
          analysisLink.href = analysisDataURL;
          document.body.appendChild(analysisLink);
          analysisLink.click();
          document.body.removeChild(analysisLink);

          // 导出原始数据图表
          setTimeout(() => {
            const originalDataURL = originalChart.getDataURL({
              type: 'png',
              pixelRatio: 2,
              backgroundColor: '#fff'
            });

            const originalLink = document.createElement('a');
            originalLink.download = `TMV_${modelType}_Original_${timestamp}.png`;
            originalLink.href = originalDataURL;
            document.body.appendChild(originalLink);
            originalLink.click();
            document.body.removeChild(originalLink);
          }, 500);

          ElMessage.success('双图表导出成功');
          return;
        }
      }
    } else {
      // 单图表模式
      const chartDom = document.getElementById('tmvChart');
      if (!chartDom) {
        ElMessage.error('图表未找到');
        return;
      }

      const myChart = echarts.getInstanceByDom(chartDom);
      if (!myChart) {
        ElMessage.error('图表实例未找到');
        return;
      }

      // 导出为PNG图片
      const dataURL = myChart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      });

      // 创建下载链接
      const link = document.createElement('a');
      const viewSuffix = activeChartView.value === 'original' ? '_Original' : '_Analysis';
      link.download = `TMV_${modelType}${viewSuffix}_${timestamp}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      ElMessage.success('图表导出成功');
    }
  } catch (error) {
    console.error('导出图表失败:', error);
    ElMessage.error('导出图表失败');
  }
};

// 刷新图表
const refreshChart = () => {
  nextTick(() => {
    renderTMVChart();
  });
  ElMessage.success('图表已刷新');
};

// 清理所有图表实例
const cleanupCharts = () => {
  const chartIds = ['tmvChart', 'tmvAnalysisChart', 'tmvOriginalChart'];
  chartIds.forEach(id => {
    const chartDom = document.getElementById(id);
    if (chartDom) {
      const chart = echarts.getInstanceByDom(chartDom);
      if (chart) {
        // 调用自定义清理函数
        if ((chart as any)._cleanup) {
          (chart as any)._cleanup();
        } else {
          chart.dispose();
        }
      }
    }
  });
};

// 处理图表视图切换
const handleChartViewChange = () => {
  cleanupCharts(); // 先清理现有图表
  nextTick(() => {
    renderTMVChart();
  });
};

// 生成容器名称（name-sessionId格式）
const generateContainerName = () => {
  if (!businessTransmitterConfig.value || !currentNode.value) return '';
  
  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  const nodeName = currentNode.value.name;
  
  return `${nodeName}-${sessionId}`;
};

// 处理操作类型变化
const handleOperationTypeChange = (type: string) => {
  // 操作类型变更
};

// 处理开始传输
const handleStartTransmission = async () => {
  if (!businessTransmitterConfig.value) {
    ElMessage.error('节点配置信息缺失');
    return;
  }

  if (transferExecuting.value) {
    ElMessage.warning('已有传输任务在进行中');
    return;
  }

  const config = transmitterOperation.value;
  const operationType = config.type;
  
  // 生成容器名称
  const containerName = generateContainerName();
  
  if (!containerName) {
    ElMessage.error('无法生成容器名称，请检查节点和会话信息');
    return;
  }

  // 查找接收机节点作为传输目标
  let transferTargetName = '';
  if (topoStore.topoData?.nodes) {
    const receiverNode = topoStore.topoData.nodes.find((node: any) => {
      if (node.image !== 'data:v1') return false;
      
      const nodeStorageKey = `businessTransmitterConfig_${node.id}`;
      const nodeConfig = localStorage.getItem(nodeStorageKey);
      
      if (nodeConfig) {
        try {
          const parsedConfig = JSON.parse(nodeConfig);
          return parsedConfig.deviceType === 'transferTarget';
        } catch {
          return false;
        }
      }
      return false;
    });

    if (receiverNode) {
      const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
      transferTargetName = `${receiverNode.name}-${sessionId}`;
    }
  }

  transferExecuting.value = true;
  transferStatus.value = '正在启动传输任务...';

  // 清理之前的检查间隔
  if (transferCheckInterval) {
    clearInterval(transferCheckInterval);
  }

  try {
    let serviceParams: any = {};
    let transferParams: any = {};

    if (operationType === 'image') {
      serviceParams = {
        count: config.imageConfig.count,
        width: config.imageConfig.width,
        height: config.imageConfig.height
      };
      
      ElMessage.info(`开始生成${config.imageConfig.count}张图片 (${config.imageConfig.width}x${config.imageConfig.height})`);
    } else if (operationType === 'video') {
      serviceParams = {
        count: config.videoConfig.count,
        duration: config.videoConfig.duration
      };

      if (transferTargetName) {
        transferParams = {
          delay: config.videoConfig.businessDuration,
          rate: config.videoConfig.bitrate
        };
      }
      
      ElMessage.info(`开始生成${config.videoConfig.count}个视频 (时长:${config.videoConfig.duration}秒, 速率:${config.videoConfig.bitrate}KB/s)`);
    } else if (operationType === 'packet') {
      serviceParams = {
        count: config.packetConfig.count,
        packetCount: config.packetConfig.packetCount,
        packetSize: config.packetConfig.packetSize
      };

      transferParams = {
        delay: config.packetConfig.delay,
        rate: config.packetConfig.rate
      };
      
      ElMessage.info(`开始生成${config.packetConfig.count}组报文 (报文数量:${config.packetConfig.packetCount}, 大小:${config.packetConfig.packetSize}字节)`);
    } else if (operationType === 'data') {
      serviceParams = {
        count: config.dataConfig.count,
        dataSize: config.dataConfig.dataSize,
        dataType: config.dataConfig.dataType
      };

      transferParams = {
        delay: config.dataConfig.delay,
        rate: config.dataConfig.rate
      };
      
      ElMessage.info(`开始生成${config.dataConfig.count}组数据 (大小:${config.dataConfig.dataSize}MB, 类型:${config.dataConfig.dataType})`);
    }

    const response = await executeOperation({
      container: containerName,
      operation: operationType,
      transferTarget: transferTargetName || undefined,
      serviceParams,
      transferParams
    });

    if (response.data.success) {
      currentTransferId.value = response.data.transfer_id;
      transferStatus.value = `传输任务已启动 `;

      ElMessage.success('传输任务启动成功');

      // 开始检查传输状态
      checkTransferStatus();
      transferCheckInterval = setInterval(checkTransferStatus, 2000);

    } else {
      transferStatus.value = `传输任务启动失败: ${response.data.output || '未知错误'}`;
      ElMessage.error(`传输任务启动失败: ${response.data.output || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('启动传输失败:', error);
    transferStatus.value = `传输任务启动失败: ${error.message || '网络错误'}`;
    ElMessage.error(`启动传输失败: ${error.message || '网络错误'}`);

    // 发生错误时停止计时器
    stopTMVExecutionTimer();
    tmvExecuting.value = false;
  } finally {
    transferExecuting.value = false;
  }
};

// 检查传输状态
const checkTransferStatus = async () => {
  if (!currentTransferId.value) return;
  
  try {
    const response = await fetchTransferStatus(currentTransferId.value);
    const data = response.data;

    switch (data.status) {
      case 'running':
        transferStatus.value = `传输中... ${data.message || ''}`;
        break;
      case 'completed':
        transferStatus.value = `传输成功！ ${data.message || ''}`;
        if (transferCheckInterval) {
          clearInterval(transferCheckInterval);
          transferCheckInterval = null;
        }
        ElMessage.success('传输任务已完成');
        break;
      case 'failed':
      case 'error':
        transferStatus.value = `传输失败: ${data.message || ''}`;
        if (data.error) {
          transferStatus.value += ` (${data.error})`;
        }
        if (transferCheckInterval) {
          clearInterval(transferCheckInterval);
          transferCheckInterval = null;
        }
        ElMessage.error('传输任务失败');
        break;
      default:
        transferStatus.value = `未知状态: ${data.status}`;
    }
  } catch (error: any) {
    console.error('获取传输状态失败:', error);
    transferStatus.value = `获取状态失败: ${error.message || '网络错误'}`;
  }
};

// 处理查看结果
const handleViewResults = async () => {
  if (!businessTransmitterConfig.value) {
    ElMessage.error('节点配置信息缺失');
    return;
  }

  // 查找最近的传输任务
  let latestTransferId = currentTransferId.value;
  
  // 如果没有当前传输ID，可以从其他发送机节点获取
  if (!latestTransferId && topoStore.topoData?.nodes) {
    const transmitterNodes = topoStore.topoData.nodes.filter((node: any) => {
      if (node.image !== 'data:v1') return false;
      
      const nodeStorageKey = `businessTransmitterConfig_${node.id}`;
      const nodeConfig = localStorage.getItem(nodeStorageKey);
      
      if (nodeConfig) {
        try {
          const parsedConfig = JSON.parse(nodeConfig);
          return parsedConfig.deviceType === 'container';
        } catch {
          return false;
        }
      }
      return false;
    });

    // 这里可以实现更复杂的逻辑来找到相关的传输任务
    // 暂时提示用户没有可查看的结果
    if (transmitterNodes.length === 0) {
      ElMessage.warning('未找到相关的传输任务');
      return;
    }
  }

  if (!latestTransferId) {
    ElMessage.info('当前没有可查看的传输结果，请先执行传输任务');
    return;
  }

  try {
    const response = await fetchTransferStatus(latestTransferId);
    const data = response.data;

    // 创建结构化的结果内容
    const resultData = {
      status: data.status,
      transferId: latestTransferId,
      message: data.message || '',
      details: data.details || {},
      delay: data.delay,
      rate: data.rate,
      // 新增网络指标数据
      networkMetrics: data.network_metrics || null,
      source: data.source || '',
      target: data.target || '',
      sourceIp: data.source_ip || '',
      targetIp: data.target_ip || '',
      file: data.file || '',
      port: data.port || '',
      key: data.key || '',
      timestamp: new Date().toLocaleString('zh-CN')
    };
    
    // 显示优化后的结果对话框
    showTransferResultDialogHandler(resultData);
    
  } catch (error: any) {
    console.error('查看结果失败:', error);
    ElMessage.error(`查看结果失败: ${error.message || '网络错误'}`);
  }
};

// 传输结果对话框状态
const showTransferResultDialog = ref(false);
const transferResultData = ref<any>(null);
const viewingFile = ref(false);
const fileContent = ref('');
const showFileContentDialog = ref(false);
const fileContentType = ref('text'); // 'text', 'image', 'video'
const fileContentData = ref('');

// 显示传输结果对话框 - 使用Element Plus组件优化
const showTransferResultDialogHandler = (resultData: any) => {
  transferResultData.value = resultData;
  showTransferResultDialog.value = true;
};

// 获取状态类型
const getStatusType = (status: string) => {
  const statusTypeMap: Record<string, string> = {
    'completed': 'success',
    'running': 'info',
    'failed': 'error',
    'error': 'error'
  };
  return statusTypeMap[status] || 'info';
};

// 获取状态文本
const getStatusText = (status: string) => {
  const statusTextMap: Record<string, string> = {
    'completed': '传输成功',
    'running': '传输中',
    'failed': '传输失败',
    'error': '传输错误'
  };
  return statusTextMap[status] || '未知状态';
};

// 获取状态图标
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return 'SuccessFilled';
    case 'running': return 'Loading';
    case 'failed':
    case 'error': return 'CircleCloseFilled';
    default: return 'InfoFilled';
  }
};

// 刷新状态
const refreshing = ref(false);
const refreshTransferStatus = async () => {
  if (!transferResultData.value?.transferId) return;

  refreshing.value = true;
  try {
    const response = await fetchTransferStatus(transferResultData.value.transferId);
    const data = response.data;

    // 更新结果数据
    transferResultData.value = {
      ...transferResultData.value,
      status: data.status,
      message: data.message || transferResultData.value.message,
      details: data.details || transferResultData.value.details,
      delay: data.delay !== undefined ? data.delay : transferResultData.value.delay,
      rate: data.rate !== undefined ? data.rate : transferResultData.value.rate,
      // 更新网络指标数据
      networkMetrics: data.network_metrics || transferResultData.value.networkMetrics,
      source: data.source || transferResultData.value.source,
      target: data.target || transferResultData.value.target,
      sourceIp: data.source_ip || transferResultData.value.sourceIp,
      targetIp: data.target_ip || transferResultData.value.targetIp,
      file: data.file || transferResultData.value.file,
      port: data.port || transferResultData.value.port,
      key: data.key || transferResultData.value.key,
      timestamp: new Date().toLocaleString('zh-CN')
    };

    ElMessage.success('状态已刷新');
  } catch (error: any) {
    ElMessage.error(`刷新失败: ${error.message || '网络错误'}`);
  } finally {
    refreshing.value = false;
  }
};

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制到剪贴板');
  } catch (error) {
    // 降级方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    ElMessage.success('已复制到剪贴板');
  }
};

// 查看文件内容
const handleViewFile = async () => {
  if (!transferResultData.value?.source || !transferResultData.value?.file) {
    ElMessage.warning('文件信息不完整，无法查看');
    return;
  }

  viewingFile.value = true;
  try {
    const response = await viewFile(transferResultData.value.source, transferResultData.value.file);
    if (response.code === 200) {
      const data = response.data;
      
      // 根据文件类型设置展示方式
      if (data.type === 'image') {
        fileContentType.value = 'image';
        fileContentData.value = data.data;
        fileContent.value = '图片文件';
      } else if (data.type === 'video') {
        fileContentType.value = 'video';
        fileContentData.value = data.data;
        fileContent.value = '视频文件';
      } else {
        fileContentType.value = 'text';
        fileContentData.value = data.data || data.content || data || '文件内容为空';
        fileContent.value = fileContentData.value;
      }
      
      showFileContentDialog.value = true;
    } else {
      ElMessage.error(`查看文件失败: ${response.msg || '未知错误'}`);
    }
  } catch (error: any) {
    console.error('查看文件失败:', error);
    ElMessage.error(`查看文件失败: ${error.message || '网络错误'}`);
  } finally {
    viewingFile.value = false;
  }
};

// 生成TMV容器名称（name-sessionId格式）
const generateTMVContainerName = () => {
  if (!tmvConfig.value || !currentNode.value) return '';

  const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
  const nodeName = currentNode.value.name;

  return `${nodeName}-${sessionId}`;
};

// 处理开始TMV分析
const handleStartTMVAnalysis = async () => {
  if (!tmvConfig.value) {
    ElMessage.error('节点配置信息缺失');
    return;
  }

  // 检查时间限制
  const timeCheck = checkTMVExecutionTime();
  if (!timeCheck.canExecute) {
    ElMessage.warning(timeCheck.message);
    return;
  }

  if (tmvExecuting.value) {
    ElMessage.warning('已有分析任务在进行中');
    return;
  }

  // 生成容器名称
  const containerName = generateTMVContainerName();

  if (!containerName) {
    ElMessage.error('无法生成容器名称，请检查节点和会话信息');
    return;
  }

  // 查找接收机节点作为目标
  let receiverContainerName = '';
  if (topoStore.topoData?.nodes) {
    const receiverNode = topoStore.topoData.nodes.find((node: any) => {
      if (node.image !== 'tmv:v1') return false;

      const nodeStorageKey = `tmvConfig_${node.id}`;
      const nodeConfig = localStorage.getItem(nodeStorageKey);

      if (nodeConfig) {
        try {
          const parsedConfig = JSON.parse(nodeConfig);
          return parsedConfig.deviceType === 'receiver';
        } catch {
          return false;
        }
      }
      return false;
    });

    if (receiverNode) {
      const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
      receiverContainerName = `${receiverNode.name}-${sessionId}`;
    }
  }

  if (!receiverContainerName) {
    ElMessage.error('未找到接收机节点，请确保场景中有TMV接收机节点');
    return;
  }

  tmvExecuting.value = true;
  tmvStatus.value = '正在启动流量分析任务...';

  // 启动执行计时器
  startTMVExecutionTimer();

  try {
    // 调用流量模型API
    const trafficParams = {
      container: containerName,
      dst_ip: tmvOperation.value.dstIp,
      re_container: receiverContainerName,
      time: tmvOperation.value.testDuration.toString(),
      traffic_model: tmvOperation.value.trafficModel,
      csv_filename: 'traffic_latest.csv' // 使用固定文件名，便于数据查看
    };


    const response = await trafficModel(trafficParams);

    if (response.code === 200) {
      ElMessage.success('TMV流量分析任务启动成功');
      tmvStatus.value = `分析任务已启动，模型: ${tmvOperation.value.trafficModel}，时长: ${tmvOperation.value.testDuration}秒`;

      // 根据配置的测试时长设置最小执行时间
      const configuredDuration = tmvOperation.value.testDuration * 1000; // 转换为毫秒
      tmvMinExecutionTime.value = Math.max(configuredDuration, 5000); // 至少5秒

    } else {
      throw new Error(response.msg || '未知错误');
    }

  } catch (error: any) {
    console.error('启动TMV分析失败:', error);
    tmvStatus.value = `分析任务启动失败: ${error.message || '网络错误'}`;
    ElMessage.error(`启动TMV分析失败: ${error.message || '网络错误'}`);

    // 发生错误时停止计时器
    stopTMVExecutionTimer();
    tmvExecuting.value = false;
  } finally {
    // 只有在成功启动任务时才保持执行状态
    // 实际的执行状态将由计时器控制
    if (tmvStatus.value.includes('启动失败')) {
      tmvExecuting.value = false;
    } else {
      // 设置一个延迟，确保任务有足够时间完成
      setTimeout(() => {
        tmvExecuting.value = false;
        stopTMVExecutionTimer();
      }, tmvMinExecutionTime.value);
    }
  }
};

// 获取VM模板信息，根据节点数据中的templateId匹配对应的模板
const vmTemplateInfo = computed(() => {
  if (!isVMNode.value) return null;

  const node = currentNode.value;
  if (!node) return null;

  // 第一优先级：如果节点数据中包含完整的模板相关字段，直接使用节点数据构建模板信息
  // 这确保显示的是放置时选择的模板信息，而不是默认模板
  if (node.templateId || node.templateName || node.vcpu || node.memory) {
    const templateInfo = {
      id: node.templateId || 0,
      name: node.templateName || `模板${node.templateId || ''}` || "虚拟机模板",
      description: node.templateName ? `${node.templateName}模板` : "虚拟机模板",
      vcpu: node.vcpu || 1,
      memory: node.memory || "1048576",
      curMemory: node.curMemory || node.memory || "1048576",
      disk: node.disk || "default.img",
      location: node.location || node.image || "",
      template: "",
      createTime: "",
      updateTime: ""
    };
    return templateInfo;
  }

  // 第二优先级：从模板store中根据templateId获取完整模板信息
  if (node.templateId && vmTemplateStore.templates.length > 0) {
    const template = vmTemplateStore.getTemplateById(node.templateId);
    if (template) {
      return template;
    }
  }

  // 第三优先级：如果有模板数据但没有匹配的templateId，返回第一个模板作为示例
  if (vmTemplateStore.templates.length > 0) {
    return vmTemplateStore.templates[0];
  }

  // 最后的回退：如果没有任何模板数据，返回默认信息
  const defaultTemplate = {
    id: 1,
    name: "cirros",
    description: "一个测试用的最小镜像",
    vcpu: 1,
    memory: "1048576",
    curMemory: "1048576",
    disk: "cirros.img",
    location: "/var/lib/libvirt/images/cirros.img",
    template: "",
    createTime: "",
    updateTime: ""
  };
  return defaultTemplate;
});

// 格式化内存大小显示
const formatMemory = (memory: string): string => {
  const memoryKB = parseInt(memory);
  if (memoryKB >= 1024 * 1024) {
    return `${(memoryKB / (1024 * 1024)).toFixed(1)} GB`;
  } else if (memoryKB >= 1024) {
    return `${(memoryKB / 1024).toFixed(1)} MB`;
  } else {
    return `${memoryKB} KB`;
  }
};



onMounted(async () => {
  // 注册收敛时间更新事件监听（在 onUnmounted 中清理）
  (eventBus as any).on('router-convergence-updated', handleRouterConvergenceUpdated);

  // 如果是VM节点，确保VM模板数据可用
  if (isVMNode.value) {
    try {
      await vmTemplateStore.ensureTemplatesAvailable();
    } catch (error) {
      console.error('获取VM模板数据失败:', error);
    }
  }
});

// 组件卸载时清理定时器和事件监听
onUnmounted(() => {
  if (transferCheckInterval) {
    clearInterval(transferCheckInterval);
  }
  stopTMVExecutionTimer(); // 清理TMV定时器
  cleanupCharts(); // 清理图表实例
  (eventBus as any).off('router-convergence-updated', handleRouterConvergenceUpdated);
});

const handleDelete = async () => {
  if (isSimulationRunning.value && isWirelessEnvironmentNode.value) {
    ElMessage.warning('对无线环境进行操作请先暂停场景');
    return;
  }

  try {
    await ElMessageBox.confirm(`确定要删除节点"${displayNodeName.value}"吗？`, "删除确认", {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning",
      center: true,
      customClass: "delete-confirm-box",
    });
    await (topoStore as any).removeNodeRemote(currentNode.value?.id);
    ElMessage.success("节点已删除");
    emit("close");
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || "删除失败");
    }
  }
};

// 打开终端
const handleOpenTerminal = async () => {
  emit('openTerminal', currentNode.value);
};

// 获取节点的所有网卡接口
const getNodeInterfaces = () => {
  nodeInterfaces.value = [];
  selectedInterfaces.value = [];
  protocolIfaces.value = [];

  if (!currentNode.value || !currentNode.value.id) return;

  // 获取节点的所有链路
  const nodeLinks: Link[] = topoStore.topoData?.links.filter(
    (link: Link) => link.node1_id === currentNode.value.id || link.node2_id === currentNode.value.id
  ) || [];

  // 从链路中提取接口信息
  nodeLinks.forEach((link: Link) => {
    if (link.node1_id === currentNode.value.id && link.iface1) {
      nodeInterfaces.value.push(link.iface1);
      if (link.iface1.name) protocolIfaces.value.push(link.iface1.name);
    } else if (link.node2_id === currentNode.value.id && link.iface2) {
      nodeInterfaces.value.push(link.iface2);
      if (link.iface2.name) protocolIfaces.value.push(link.iface2.name);
    }
  });
};

// 打开信号级仿真对话框
const handleOpenSignalSimDialog = () => {
  nodeInterfaces.value = [];
  selectedInterfaces.value = [];

  if (!currentNode.value || !currentNode.value.id) return;

  // 获取所有EMANE节点ID
  const emaneNodeIds = topoStore.topoData?.nodes
    ?.filter((n: Node) => n.type === 'EMANE')
    .map((n: Node) => n.id) || [];

  // 获取当前节点的所有链路
  const nodeLinks: Link[] = topoStore.topoData?.links.filter(
    (link: Link) => link.node1_id === currentNode.value.id || link.node2_id === currentNode.value.id
  ) || [];

  // 仅收集与EMANE节点连接的链路上的网卡接口
  nodeLinks.forEach((link: Link) => {
    const otherNodeId = link.node1_id === currentNode.value.id ? link.node2_id : link.node1_id;
    if (!emaneNodeIds.includes(otherNodeId)) return; // 跳过非EMANE链路（有线链路等）

    if (link.node1_id === currentNode.value.id && link.iface1) {
      nodeInterfaces.value.push(link.iface1);
    } else if (link.node2_id === currentNode.value.id && link.iface2) {
      nodeInterfaces.value.push(link.iface2);
    }
  });

  // 自动选中所有EMANE连接的网卡
  selectedInterfaces.value = nodeInterfaces.value.map(iface => iface.id);

  showSignalSimDialog.value = true;
};

// 打开协议配置对话框
const showProtocolDialog = ref(false);
const handleOpenProtocolDialog = () => {
  getNodeInterfaces();
  showProtocolDialog.value = true;
};

// 打开静态路由配置对话框（其他DOCKER节点）
const handleOpenStaticRouteDialog = () => {
  getNodeInterfaces();
  showProtocolDialog.value = true;
};

// 子网参数修改相关状态
const showSubnetConfigDialog = ref(false);
const subnetConfigData = ref<any>(null);

// 时隙配置相关状态
const showSlotConfigDialog = ref(false);
const slotConfig = ref({
  filePath: '',
  slotCount: 10,
  slotWidth: 100,
  nodeSlotMap: {} as Record<number, number>,
});

const protocolIfaces = ref<string[]>([]);

// 协议配置对话框关闭处理
const handleProtocolClose = () => {
  showProtocolDialog.value = false;
};

// 开始信号级仿真
const handleStartSignalSimulation = async () => {
  if (selectedInterfaces.value.length === 0) {
    ElMessage.warning('没有与EMANE连接的网卡接口');
    return;
  }
  
  try {
    // 显示加载中
    isLoading.value = true;
    
    // 获取当前会话ID
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (!sessionId) {
      throw new Error('无法获取会话ID');
    }
    
    // 获取选中的接口名称列表
    const selectedIfaceNames = selectedInterfaces.value.map(id => {
      const iface = nodeInterfaces.value.find((iface: NodeIface) => iface.id === id);
      return iface?.name || 'iface'+id;
    }).join(', ');
    
    // 获取节点的所有链路
    const nodeLinks: Link[] = topoStore.topoData?.links.filter(
      (link: Link) => link.node1_id === currentNode.value.id || link.node2_id === currentNode.value.id
    ) || [];

    // 处理每个选中的接口
    const modifyPromises = selectedInterfaces.value.map(async (ifaceId) => {
      // 找到包含该接口的链路
      const targetLink = nodeLinks.find((link: Link) => {
        if (link.node1_id === currentNode.value.id && link.iface1?.id === ifaceId) {
          return true;
        }
        if (link.node2_id === currentNode.value.id && link.iface2?.id === ifaceId) {
          return true;
        }
        return false;
      });

      if (!targetLink) return null;

      // 创建label对象
      const label = {
        session_id: sessionId,
        node_id: currentNode.value.id,
        iface_id: ifaceId
      };
      
      // 调用signalStartRemote方法
      return (topoStore as any).signalStartRemote({
        ...targetLink,
        label: label
      });
    });
    
    // 等待所有modifyLink操作完成
    const modifyResults = await Promise.all(modifyPromises);
    
    // 查找与当前节点相连的EMANE节点
    const emaneNodes: Node[] = [];
    
    // 遍历所有节点，找到类型为EMANE的节点
    if (topoStore.topoData?.nodes) {
      for (const node of topoStore.topoData.nodes) {
        // 检查节点是否为EMANE类型
        if (node.type === 'EMANE') {
          // 检查该EMANE节点是否与当前节点有链路连接
          const hasConnection = nodeLinks.some((link: Link) => {
            return link.node1_id === node.id || link.node2_id === node.id;
          });
          
          if (hasConnection) {
            emaneNodes.push(node);
          }
        }
      }
    }
    
     
    
    // 关闭对话框
    showSignalSimDialog.value = false;
  } catch (error: any) {
    console.error('开启信号级仿真失败:', error);
    ElMessage.error(error?.message || '开启信号级仿真失败');
  } finally {
    isLoading.value = false;
  }
};

// 启动虚拟机
const handleStartVM = async () => {
  try {
    isLoading.value = true;

    // 获取当前会话ID
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (!sessionId) {
      ElMessage.error("会话信息不完整，无法启动虚拟机");
      return;
    }

    // 获取当前用户ID
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    // 调用startVMNode API
    const response = await startVMNode(sessionId, currentNode.value?.id, userId) as any;

    if (response && response.code === 200 && response.data) {
      // 暂存WebSocket URL
      vmWebSocketUrl.value = response.data;

      // Emit event to open VNC in parent component
      emit('openVnc', {
        nodeId: currentNode.value?.id,
        nodeName: displayNodeName.value,
        wsUrl: response.data
      });

    } else {
      ElMessage.error(response?.msg || '启动虚拟机失败');
    }
  } catch (error: any) {
    console.error('启动虚拟机失败:', error);
    ElMessage.error(error?.message || '启动虚拟机失败，请重试');
  } finally {
    isLoading.value = false;
  }
};

// 关闭虚拟机
const handleStopVM = async () => {
  try {
    isLoading.value = true;

    // 获取当前会话ID
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (!sessionId) {
      ElMessage.error("会话信息不完整，无法关闭虚拟机");
      return;
    }

    // 获取当前用户ID
    const userInfo = getUserInfo();
    const userId = userInfo.id;

    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    // 调用stopVMNode API
    const response = await stopVMNode(sessionId, currentNode.value?.id, userId) as any;

    if (response && response.code === 200) {
      ElMessage.success('虚拟机关闭');

      // 清除WebSocket URL
      vmWebSocketUrl.value = null;

      // VNC window is now managed by parent Cesium.vue component

    } else {
      ElMessage.error(response?.msg || '关闭虚拟机失败');
    }
  } catch (error: any) {
    console.error('关闭虚拟机失败:', error);
    ElMessage.error(error?.message || '关闭虚拟机失败，请重试');
  } finally {
    isLoading.value = false;
  }
};

// 编辑虚拟机参数
const handleEditVMParams = () => {
  if (!vmTemplateInfo.value) {
    ElMessage.error('无法获取VM模板信息');
    return;
  }

  // 初始化编辑数据
  vmEditData.value = {
    cpu: vmTemplateInfo.value.vcpu || 1,
    memory: vmTemplateInfo.value.memory || '1048576',
    currentMemory: vmTemplateInfo.value.curMemory || vmTemplateInfo.value.memory || '1048576',
    templateId: vmTemplateInfo.value.id || 1
  };

  showVMEditDialog.value = true;
};

// 处理VM编辑确认
const handleVMEditConfirm = (data: any) => {
  // VM参数更新
  // 这里可以添加更新本地数据的逻辑
  ElMessage.success('虚拟机参数已更新');
};

// VNC相关方法
// VNC management moved to parent Cesium.vue component

// 协议配置保存回调
function handleProtocolSave({ config }: { config: any }) {
}

// 检查仿真是否正在运行
const isSimulationRunning = computed(() => {
  // 检查拓扑数据中的会话状态
  return topoStore.topoData?.state === 'RUNTIME' || 
         topoStore.topoData?.state === 'RUNNING' ||
         topoStore.topoData?.status === 'RUNNING';
});

// 处理子网参数修改
const handleModifySubnetParams = () => {
  if (!currentNode.value) {
    ElMessage.error('节点信息不完整');
    return;
  }
  
  // 检查仿真是否正在运行
  if (isSimulationRunning.value) {
    ElMessage.warning('仿真运行时无法修改参数，请先停止仿真');
    return;
  }
  
  // 准备子网配置数据 - 传递完整的节点信息，包括现有的EMANE配置
  subnetConfigData.value = {
    id: currentNode.value.id,
    name: currentNode.value.name,
    alias: currentNode.value.alias,
    geo: currentNode.value.geo || { lon: 0, lat: 0, alt: 0 },
    position: currentNode.value.position || { x: 0, y: 0, z: 0 },
    // 传递现有的EMANE配置信息
    emane: currentNode.value.emane,
    emane_configs: currentNode.value.emane_configs,
    displayModel: currentNode.value.displayModel,
    phy_type: currentNode.value.phy_type,
    role: currentNode.value.role,
    type: currentNode.value.type,
    model: currentNode.value.model
  };
  showSubnetConfigDialog.value = true;
};

// 处理子网参数修改确认
const handleSubnetConfigSave = (nodeData: any) => {
  showSubnetConfigDialog.value = false;
};

const handleSubnetConfigClose = () => {
  showSubnetConfigDialog.value = false;
};

const isSubnetTDMA = computed(() => {
  if (!currentNode.value || !isSubnetNode.value) {
    return false;
  }

  // 检查节点的emane_configs中是否配置了TDMA模型
  const emaneConfigs = currentNode.value.emane_configs;

  // emane_configs 是数组结构，每个元素都有 model 字段
  if (Array.isArray(emaneConfigs)) {
    return emaneConfigs.some((config: any) => {
      return config.model && config.model.toLowerCase().includes('tdma');
    });
  }

  // 保留兼容性：如果是对象结构
  if (emaneConfigs && emaneConfigs.mac && emaneConfigs.mac.model) {
    return emaneConfigs.mac.model.toLowerCase().includes('tdma');
  }

  return false;
});

const subnetKeyConfig = computed(() => {
  if (!currentNode.value || !isSubnetNode.value) return null;
  const configs = currentNode.value.emane_configs;
  if (!Array.isArray(configs) || configs.length === 0) return null;

  const val = (key: string): string | null => {
    for (const cfg of configs) {
      const c = cfg.config || {};
      if (c[key]?.value !== undefined) return c[key].value;
    }
    return null;
  };

  const modelRaw = configs[0].model || currentNode.value.emane || '';
  const modelMap: Record<string, string> = {
    'emane_rfpipe': 'RF Pipe',
    'emane_ieee80211abg': 'IEEE 802.11abg',
    'emane_tdma': 'TDMA',
    'emane_tdmaeventscheduler': 'TDMA Event Scheduler',
  };
  const modelLabel = modelMap[modelRaw] || modelRaw.replace('emane_', '');

  const freqRaw = val('frequency');
  const freqMHz = freqRaw ? (Number(freqRaw) / 1e6).toFixed(1) : null;

  const bwRaw = val('bandwidth');
  const bwMHz = bwRaw ? (Number(bwRaw) / 1e6).toFixed(1) : null;

  const drRaw = val('datarate');
  let datarate: string | null = null;
  if (drRaw) {
    const dr = Number(drRaw);
    if (dr >= 1e6) datarate = (dr / 1e6).toFixed(1) + ' Mbps';
    else if (dr >= 1e3) datarate = (dr / 1e3).toFixed(0) + ' Kbps';
    else datarate = dr + ' bps';
  }

  const delayRaw = val('delay');
  const delay = delayRaw !== null && delayRaw !== '' ? delayRaw + ' 秒' : null;

  const freqOfInterestRaw = val('frequencyofinterest');
  const freqOfInterestMHz = freqOfInterestRaw ? (Number(freqOfInterestRaw) / 1e6).toFixed(1) : null;

  const noiseFigureRaw = val('systemnoisefigure');
  const noiseFigure = noiseFigureRaw !== null && noiseFigureRaw !== '' ? noiseFigureRaw : null;

  const dopplerShiftEnableRaw = val('dopplershiftenable');
  const dopplerShiftEnabled = dopplerShiftEnableRaw !== null && dopplerShiftEnableRaw !== ''
    ? (['1', 'true', 'on', 'yes'].includes(String(dopplerShiftEnableRaw).toLowerCase()) ? '已启用' : '未启用')
    : null;

  return {
    model: modelLabel,
    datarate,
    delay,
    frequency: freqMHz ? freqMHz + ' MHz' : null,
    frequencyOfInterest: freqOfInterestMHz ? freqOfInterestMHz + ' MHz' : null,
    bandwidth: bwMHz ? bwMHz + ' MHz' : null,
    noiseFigure,
    dopplerShiftEnabled,
    txpower: val('txpower') ? val('txpower') + ' dBm' : null,
    propagation: (() => {
      const v = val('propagationmodel');
      if (!v) return null;
      const map: Record<string, string> = {
        'freespace': '自由空间',
        '2ray': '双射线',
        'precomputed': '预计算',
      };
      return map[v] || v;
    })(),
  };
});

// 打开时隙配置对话框
const handleOpenSlotConfig = () => {
  if (!currentNode.value) {
    ElMessage.error('节点信息不完整');
    return;
  }

  showSlotConfigDialog.value = true;
};

// 处理时隙配置确认
const handleSlotConfigConfirm = async (config: any) => {
  try {
    slotConfig.value = { ...config };

    // 创建一个反向映射：slotIndex -> nemId
    const slotToNodeMap: Record<number, string> = {};
    Object.entries(config.nodeSlotMap).forEach(([nemId, slotIndex]) => {
      slotToNodeMap[slotIndex as number] = nemId.toString();
    });

    // 生成完整的时隙列表（所有时隙，默认nemId为"65535"）
    const slotList = Array.from({ length: config.slotCount }, (_, index) => ({
      index: index,
      nodes: slotToNodeMap[index] || "65535"
    }));

    // 构建API请求参数
    const requestData: GenerateTDMARequest = {
      savePath: config.filePath,
      slots: config.slotCount,
      slotduration: config.slotWidth,
      slotList: slotList
    };

    // 调用API生成TDMA调度文件
    await generateTDMA(requestData);
  } catch (error) {
    console.error('TDMA配置失败:', error);
  }
};

// 处理时隙配置对话框关闭
const handleSlotConfigClose = () => {
  showSlotConfigDialog.value = false;
};

// TMV数据查看处理函数
const handleViewTMVData = async () => {
  try {
    tmvDataLoading.value = true;

    // 获取当前TMV节点信息
    const nodeId = currentNode.value?.id;
    const nodeName = currentNode.value?.name;

    if (!nodeId || !nodeName) {
      ElMessage.error('节点信息不完整');
      return;
    }

    // 检查是否为接收机节点
    if (!tmvConfig.value || tmvConfig.value.deviceType !== 'receiver') {
      ElMessage.warning('只有TMV接收机节点可以查看数据');
      return;
    }

    // 生成容器名称（与发送分析时保持一致）
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    const containerName = `${nodeName}-${sessionId}`;

    // 查找最近的CSV文件
    // 由于我们现在使用手动触发方式，需要查找最新生成的CSV文件
    const csvFilename = await findLatestCSVFile(containerName);

    if (!csvFilename) {
      ElMessage.warning('未找到TMV数据文件，请确保已执行过流量分析');
      return;
    }

    // 调用getCsv接口
    const csvParams = {
      container: containerName,
      filename: csvFilename
    };


    const response = await getCsv(csvParams);

    if (response.code === 200 && response.data) {
      // 处理响应数据
      const { content, file_info, row_count } = response.data;

      tmvFileInfo.value = {
        ...file_info,
        row_count
      };

      // 处理content数组，统计size字段的分布
      if (content && Array.isArray(content)) {
        tmvChartData.value = processChartData(content);
        showTMVDataDialog.value = true;

        ElMessage.success(`成功获取TMV数据，共${row_count}条记录`);
      } else {
        ElMessage.warning('响应数据格式异常');
      }
    } else {
      ElMessage.error(response.msg || '获取TMV数据失败');
    }

  } catch (error: any) {
    console.error('TMV数据查看失败:', error);
    ElMessage.error(error.message || '获取TMV数据失败');
  } finally {
    tmvDataLoading.value = false;
  }
};

// 查找最新的CSV文件
const findLatestCSVFile = async (containerName: string): Promise<string | null> => {
  try {
    // 使用固定的文件名，与流量分析时生成的文件名保持一致
    return 'traffic_latest.csv';

  } catch (error) {
    console.error('查找CSV文件失败:', error);
    return null;
  }
};

// 处理图表数据 - 转换为时间序列数据
const processChartData = (content: any[]) => {
  if (!content || content.length === 0) {
    return [];
  }

  // 将数据转换为时间序列格式，按时间戳排序
  const timeSeriesData = content
    .map(item => ({
      timestamp: parseFloat(item.timestamp),
      size: parseInt(item.size) || 0,
      time: new Date(parseFloat(item.timestamp) * 1000) // 转换为Date对象用于显示
    }))
    .sort((a, b) => a.timestamp - b.timestamp); // 按时间戳排序


  return timeSeriesData;
};

// 监听TMV数据对话框显示状态，渲染图表
watch(showTMVDataDialog, (newVal) => {
  if (newVal && tmvChartData.value.length > 0) {
    // 延迟渲染图表，确保DOM已更新
    nextTick(() => {
      renderTMVChart();
    });
  }
});

// 获取当前选择的流量模型类型
const getCurrentTrafficModelType = () => {
  const currentModel = tmvOperation.value.trafficModel;
  if (currentModel.includes('power_law')) return 'power_law';
  if (currentModel.includes('markov')) return 'markov';
  if (currentModel.includes('similar')) return 'self_similar';
  if (currentModel.includes('lrd')) return 'long_range';
  return 'default';
};

// 渲染TMV数据图表
const renderTMVChart = () => {
  // 防止重复渲染
  if (isChartRendering.value) {
    return;
  }

  // 验证数据
  if (!tmvChartData.value || tmvChartData.value.length === 0) {
    console.warn('TMV图表数据为空');
    const containers = ['tmvChart', 'tmvAnalysisChart', 'tmvOriginalChart'];
    containers.forEach(id => {
      const dom = document.getElementById(id);
      if (dom) {
        dom.innerHTML = '<div style="text-align: center; padding: 40px; color: #999; font-size: 14px;">暂无数据</div>';
      }
    });
    return;
  }

  isChartRendering.value = true;

  try {
    // 根据当前视图模式渲染不同的图表
    switch (activeChartView.value) {
      case 'analysis':
        renderSingleChart('tmvChart', 'analysis');
        break;
      case 'original':
        renderSingleChart('tmvChart', 'original');
        break;
      case 'both':
        renderSingleChart('tmvAnalysisChart', 'analysis');
        renderSingleChart('tmvOriginalChart', 'original');
        break;
    }
  } finally {
    // 延迟重置渲染状态，确保渲染完成
    setTimeout(() => {
      isChartRendering.value = false;
    }, 500);
  }
};

// 渲染单个图表
const renderSingleChart = (containerId: string, chartMode: 'analysis' | 'original') => {
  const chartDom = document.getElementById(containerId);
  if (!chartDom) {
    console.error(`图表容器未找到: ${containerId}`);
    return;
  }

  try {
    // 显示加载状态
    chartDom.innerHTML = '<div style="text-align: center; padding: 30px; color: #409EFF; font-size: 14px;"><i class="el-icon-loading"></i> 正在渲染图表...</div>';

    // 使用 setTimeout 确保 DOM 更新和避免阻塞
    setTimeout(() => {
      try {
        // 清理之前的图表实例
        const existingChart = echarts.getInstanceByDom(chartDom);
        if (existingChart) {
          existingChart.dispose();
        }

        const myChart = echarts.init(chartDom, null, {
          renderer: 'canvas',
          useDirtyRect: true // 性能优化
        });

        const modelType = getCurrentTrafficModelType();

        // 根据图表模式和模型类型选择不同的图表渲染方式
        let option;
        const startTime = performance.now();

        if (chartMode === 'original') {
          // 渲染原始数据图表
          option = renderOriginalDataChart();
        } else {
          // 渲染模型分析图表
          switch (modelType) {
            case 'power_law':
              option = renderPowerLawAnalysisChart();
              break;
            case 'markov':
              option = renderMarkovAnalysisChart();
              break;
            case 'self_similar':
              // 临时使用原函数，后续优化
              option = renderSelfSimilarAnalysisChart();
              break;
            case 'long_range':
              // 临时使用原函数，后续优化
              option = renderLongRangeAnalysisChart();
              break;
            default:
              option = renderDefaultAnalysisChart();
              break;
          }
        }

        const renderTime = performance.now() - startTime;

        if (option) {
          // 使用动画效果
          const animatedOption = {
            ...option,
            animation: true,
            animationDuration: 1000,
            animationEasing: 'cubicOut' as const
          };

          // 设置图表选项，添加错误处理
          myChart.setOption(animatedOption as any, true); // true表示不合并，完全替换

          // 监听窗口大小变化，自动调整图表大小
          let resizeTimer: number | null = null;
          const debouncedResizeHandler = () => {
            if (resizeTimer) {
              clearTimeout(resizeTimer);
            }
            resizeTimer = setTimeout(() => {
              try {
                if (myChart && !myChart.isDisposed()) {
                  myChart.resize();
                }
              } catch (resizeError) {
                console.warn('图表resize失败:', resizeError);
              }
            }, 150);
          };

          window.addEventListener('resize', debouncedResizeHandler);

          // 存储清理函数到图表实例
          (myChart as any)._cleanup = () => {
            window.removeEventListener('resize', debouncedResizeHandler);
            if (resizeTimer) {
              clearTimeout(resizeTimer);
            }
            if (!myChart.isDisposed()) {
              myChart.dispose();
            }
          };

        } else {
          console.error('图表选项生成失败');
          chartDom.innerHTML = '<div style="text-align: center; padding: 30px; color: #f56c6c; font-size: 14px;">图表选项生成失败</div>';
        }
      } catch (innerError) {
        console.error('图表渲染内部错误:', innerError);
        chartDom.innerHTML = '<div style="text-align: center; padding: 30px; color: #f56c6c; font-size: 14px;">图表渲染失败</div>';
      }
    }, 100); // 延迟100ms确保DOM更新
  } catch (error) {
    console.error('TMV图表渲染失败:', error);
    chartDom.innerHTML = '<div style="text-align: center; padding: 30px; color: #f56c6c; font-size: 14px;">图表渲染失败</div>';
  }
};

// 原始数据图表
const renderOriginalDataChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length === 0) {
      throw new Error('数据为空');
    }

    // 准备原始数据时间序列
    const timeSeriesData = tmvChartData.value
      .filter(item => item && typeof item.timestamp === 'number' && typeof item.size === 'number')
      .map(item => [item.timestamp * 1000, item.size]);

    if (timeSeriesData.length === 0) {
      throw new Error('没有有效的数据点');
    }

    // 计算基本统计信息
    const sizes = timeSeriesData.map(item => item[1]);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgSize;
    const variabilityLevel = cv < 0.3 ? '低变异' : cv < 0.7 ? '中等变异' : '高变异';

    // 性能优化：如果数据点太多，进行下采样
    let displayData = timeSeriesData;
    const MAX_POINTS = 5000;
    if (timeSeriesData.length > MAX_POINTS) {
      const step = Math.ceil(timeSeriesData.length / MAX_POINTS);
      displayData = timeSeriesData.filter((_, index) => index % step === 0);
    }

    return {
      title: {
        text: `原始数据 - ${variabilityLevel}`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: cv < 0.3 ? '#27ae60' : cv < 0.7 ? '#f39c12' : '#e74c3c'
        }
      },
      tooltip: {
        trigger: 'axis',
        formatter: function(params: any) {
          const data = params[0];
          const timestamp = data.value[0];
          const size = data.value[1];
          const time = new Date(timestamp);
          return `
            <div style="text-align: left; max-width: 200px;">
              <strong>${time.toLocaleTimeString()}</strong><br/>
              大小: ${size} bytes<br/>
              <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
              <small style="color: #666;">
                均值: ${avgSize.toFixed(1)}B<br/>
                变异系数: ${cv.toFixed(3)}
              </small>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'time',
        name: '时间',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: function(value: number) {
            const date = new Date(value);
            const timeRange = displayData.length > 0 ?
              displayData[displayData.length - 1][0] - displayData[0][0] : 0;

            if (timeRange < 60000) {
              return date.toLocaleTimeString('zh-CN', {
                hour12: false,
                minute: '2-digit',
                second: '2-digit'
              });
            } else if (timeRange < 3600000) {
              return date.toLocaleTimeString('zh-CN', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              });
            } else {
              return date.toLocaleTimeString('zh-CN', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          }
        }
      },
      yAxis: {
        type: 'value',
        name: '数据包大小 (bytes)',
        nameLocation: 'middle',
        nameGap: 50
      },
      series: [
        {
          name: '数据包大小',
          type: 'line',
          data: displayData,
          symbol: 'circle',
          symbolSize: 3,
          smooth: false,
          connectNulls: false,
          sampling: 'lttb', // 大数据量时的采样优化
          itemStyle: {
            color: '#409EFF',
            opacity: 0.8
          },
          lineStyle: {
            width: 1.5,
            color: '#409EFF'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0, color: 'rgba(64, 158, 255, 0.3)'
              }, {
                offset: 1, color: 'rgba(64, 158, 255, 0.1)'
              }]
            }
          },
          emphasis: {
            itemStyle: {
              color: '#66b1ff',
              opacity: 1,
              borderColor: '#fff',
              borderWidth: 2
            }
          }
        }
      ],
      grid: {
        left: '8%',
        right: '8%',
        bottom: '15%',
        top: '12%',
        containLabel: true
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'filter'
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'filter',
          bottom: '5%',
          height: '6%'
        }
      ]
    };
  } catch (error) {
    console.error('原始数据图表渲染失败:', error);
    return {
      title: { text: '原始数据 - 数据处理失败', left: 'center' },
      series: []
    };
  }
};

// 幂律模型分析图表 - 包大小分布柱状图
const renderPowerLawAnalysisChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length === 0) {
      throw new Error('数据为空');
    }



    // 统计包大小分布，0-150为一个统计区间
    const sizeDistribution: { [key: string]: number } = {};
    const intervalSize = 150;

    tmvChartData.value.forEach(item => {
      if (item && typeof item.size === 'number') {
        const size = item.size;
        const intervalKey = `${Math.floor(size / intervalSize) * intervalSize}-${Math.floor(size / intervalSize) * intervalSize + intervalSize}`;
        sizeDistribution[intervalKey] = (sizeDistribution[intervalKey] || 0) + 1;
      }
    });

    // 转换为图表数据
    const categories = Object.keys(sizeDistribution).sort((a, b) => {
      const aStart = parseInt(a.split('-')[0]);
      const bStart = parseInt(b.split('-')[0]);
      return aStart - bStart;
    });

    if (categories.length === 0) {
      throw new Error('没有有效的数据点');
    }

    const distributionData = categories.map(key => sizeDistribution[key]);

    // 计算幂律特征
    const totalPackets = tmvChartData.value.length;
    const smallPackets = tmvChartData.value.filter(item => item.size < 300).length;
    const largePackets = tmvChartData.value.filter(item => item.size > 1000).length;
    const smallPacketRatio = (smallPackets / totalPackets * 100).toFixed(1);
    const largePacketRatio = (largePackets / totalPackets * 100).toFixed(1);

    // 判断是否符合幂律分布
    const isPowerLaw = smallPackets > largePackets * 3; // 小包数量应该远大于大包
    const powerLawText = isPowerLaw ? '符合幂律分布特征' : '不符合典型幂律分布';

    return {
      title: {
        text: `幂律模型 - ${powerLawText}`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: isPowerLaw ? '#27ae60' : '#e74c3c'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          const data = params[0];
          return `
            <div style="text-align: left; max-width: 200px;">
              <strong>${data.name} bytes</strong><br/>
              数量: ${data.value} 个<br/>
              占比: ${((data.value / tmvChartData.value.length) * 100).toFixed(1)}%<br/>
              <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
              <small style="color: #666;">
                小包比例: ${smallPacketRatio}%<br/>
                大包比例: ${largePacketRatio}%
              </small>
            </div>
          `;
        }
      },
      xAxis: {
        type: 'category',
        data: categories,
        name: '包大小区间 (bytes)',
        nameLocation: 'middle',
        nameGap: 25,
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          interval: 0
        }
      },
      yAxis: {
        type: 'value',
        name: '数据包数量',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          fontSize: 10
        }
      },
      series: [
        {
          name: '数据包数量',
          type: 'bar',
          data: distributionData,
          itemStyle: {
            color: '#409EFF',
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: '#66b1ff'
            }
          }
        }
      ],
      grid: {
        left: '8%',
        right: '8%',
        bottom: '15%',
        top: '12%',
        containLabel: true
      }
    };
  } catch (error) {
    console.error('幂律模型图表渲染失败:', error);
    return {
      title: { text: '幂律模型 - 数据处理失败', left: 'center' },
      series: []
    };
  }
};

// 马尔可夫模型分析图表 - 状态转移概率图
const renderMarkovAnalysisChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length < 2) {
      throw new Error('数据不足，至少需要2个数据点');
    }



    // 定义状态：根据包大小分为小、中、大三个状态
    const sizes = tmvChartData.value.map(item => item.size).filter(size => typeof size === 'number');
    if (sizes.length === 0) {
      throw new Error('没有有效的数据点');
    }

    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const range = maxSize - minSize;

    if (range === 0) {
      throw new Error('数据包大小无变化，无法进行状态分析');
    }

  const stateRanges = [
    { min: minSize, max: minSize + range * 0.33, name: '小流量' },
    { min: minSize + range * 0.33, max: minSize + range * 0.66, name: '中流量' },
    { min: minSize + range * 0.66, max: maxSize, name: '大流量' }
  ];

  const states = stateRanges.map(range => range.name);

  // 将数据点分配到状态
  const stateSequence = tmvChartData.value.map(item => {
    const size = item.size;
    for (let i = 0; i < stateRanges.length; i++) {
      if (size >= stateRanges[i].min && size < stateRanges[i].max) {
        return states[i];
      }
    }
    return states[states.length - 1];
  });

  // 计算转移矩阵
  const transitionMatrix: { [key: string]: { [key: string]: number } } = {};
  states.forEach(state => {
    transitionMatrix[state] = {};
    states.forEach(nextState => {
      transitionMatrix[state][nextState] = 0;
    });
  });

  for (let i = 0; i < stateSequence.length - 1; i++) {
    const current = stateSequence[i];
    const next = stateSequence[i + 1];
    transitionMatrix[current][next]++;
  }

  // 计算转移概率
  const transitionProb: { [key: string]: { [key: string]: number } } = {};
  states.forEach(state => {
    transitionProb[state] = {};
    const total = states.reduce((sum, nextState) => sum + transitionMatrix[state][nextState], 0);
    states.forEach(nextState => {
      transitionProb[state][nextState] = total > 0 ?
        transitionMatrix[state][nextState] / total : 0;
    });
  });

  // 验证马尔可夫性质 - 检查状态转移的随机性
  const stateDistribution = states.map(state => {
    const count = stateSequence.filter(s => s === state).length;
    return count / stateSequence.length;
  });

  // 计算转移矩阵的均匀性（马尔可夫性指标）
  let markovScore = 0;
  states.forEach(state => {
    const probs = states.map(nextState => transitionProb[state][nextState]);
    const maxProb = Math.max(...probs);
    const minProb = Math.min(...probs);
    markovScore += (maxProb - minProb); // 转移概率差异越小，马尔可夫性越强
  });
  markovScore = markovScore / states.length;

  const isMarkovian = markovScore < 0.7; // 阈值可调整
  const markovText = isMarkovian ? '具有马尔可夫特性' : '马尔可夫特性不明显';

  // 准备图表数据
  const datasets = states.map((state, i) => ({
    name: `从 ${state} 转移`,
    type: 'bar',
    data: states.map(nextState => transitionProb[state][nextState]),
    itemStyle: {
      color: ['#2ecc71', '#f39c12', '#e74c3c'][i % 3]
    }
  }));

    return {
      title: {
        text: `马尔可夫模型 - ${markovText}`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: isMarkovian ? '#27ae60' : '#e74c3c'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: function(params: any) {
          const data = params[0];
          return `
            <div style="text-align: left; max-width: 200px;">
              <strong>${data.seriesName} → ${data.name}</strong><br/>
              转移概率: ${(data.value * 100).toFixed(1)}%<br/>
              <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
              <small style="color: #666;">
                状态分布: ${states.map((s, i) => `${s} ${(stateDistribution[i] * 100).toFixed(1)}%`).join(', ')}
              </small>
            </div>
          `;
        }
      },
      legend: {
        data: datasets.map(d => d.name),
        bottom: '5%',
        textStyle: {
          fontSize: 12
        }
      },
      xAxis: {
        type: 'category',
        data: states,
        name: '目标状态',
        nameLocation: 'middle',
        nameGap: 25,
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '转移概率',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontSize: 12
        },
        max: 1,
        axisLabel: {
          formatter: '{value}',
          fontSize: 10
        }
      },
      series: datasets,
      grid: {
        left: '8%',
        right: '8%',
        bottom: '18%',
        top: '12%',
        containLabel: true
      }
    };
  } catch (error) {
    console.error('马尔可夫模型图表渲染失败:', error);
    return {
      title: { text: '马尔可夫模型 - 数据处理失败', left: 'center' },
      series: []
    };
  }
};

// 自相似模型分析图表 - 优化版本，更直观易懂
const renderSelfSimilarAnalysisChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length < 50) {
      throw new Error('数据不足，至少需要50个数据点进行Hurst分析');
    }

    // 计算R/S统计量
    const sizes = tmvChartData.value.map(item => item.size).filter(size => typeof size === 'number');
    if (sizes.length === 0) {
      throw new Error('没有有效的数据点');
    }

    // 使用R/S分析方法计算Hurst指数
    const windowSizes: number[] = [];
    const rsValues: number[] = [];

    // 生成窗口大小序列（使用更直观的窗口大小）
    const minWindow = 10;
    const maxWindow = Math.floor(sizes.length / 4);
    for (let n = minWindow; n <= maxWindow; n = Math.floor(n * 1.5)) {
      windowSizes.push(n);
    }

    windowSizes.forEach(n => {
      if (n >= sizes.length) return;

      const rsStats = [];

      // 计算多个窗口的R/S统计量
      for (let start = 0; start <= sizes.length - n; start += Math.floor(n / 2)) {
        const window = sizes.slice(start, start + n);

        // 计算均值
        const mean = window.reduce((sum, val) => sum + val, 0) / n;

        // 计算累积偏差
        const deviations = window.map(val => val - mean);
        const cumulativeDeviations = [];
        let cumSum = 0;
        for (let i = 0; i < deviations.length; i++) {
          cumSum += deviations[i];
          cumulativeDeviations.push(cumSum);
        }

        // 计算范围R
        const maxCumDev = Math.max(...cumulativeDeviations);
        const minCumDev = Math.min(...cumulativeDeviations);
        const range = maxCumDev - minCumDev;

        // 计算标准差S
        const variance = deviations.reduce((sum, dev) => sum + dev * dev, 0) / n;
        const stdDev = Math.sqrt(variance);

        // 计算R/S统计量
        if (stdDev > 0) {
          rsStats.push(range / stdDev);
        }
      }

      if (rsStats.length > 0) {
        const avgRS = rsStats.reduce((sum, val) => sum + val, 0) / rsStats.length;
        rsValues.push(avgRS);
      }
    });

    // 计算Hurst指数（使用对数回归）
    let hurstIndex = 0.5;
    let rSquared = 0;

    if (windowSizes.length > 2 && rsValues.length > 2) {
      const logWindowSizes = windowSizes.map(n => Math.log(n));
      const logRSValues = rsValues.map(rs => Math.log(rs));

      const n = logWindowSizes.length;
      const sumX = logWindowSizes.reduce((sum, val) => sum + val, 0);
      const sumY = logRSValues.reduce((sum, val) => sum + val, 0);
      const sumXY = logWindowSizes.reduce((sum, val, i) => sum + val * logRSValues[i], 0);
      const sumX2 = logWindowSizes.reduce((sum, val) => sum + val * val, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      hurstIndex = slope;

      // 计算R²
      const meanY = sumY / n;
      const ssTotal = logRSValues.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
      const intercept = (sumY - slope * sumX) / n;
      const ssResidual = logWindowSizes.reduce((sum, val, i) => {
        const predicted = slope * val + intercept;
        return sum + Math.pow(logRSValues[i] - predicted, 2);
      }, 0);
      rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    }

    // 判断自相似性
    const isSelfSimilar = hurstIndex > 0.5 && hurstIndex < 1.0;
    const selfSimilarText = isSelfSimilar ? '具有自相似特性' : '不具有明显自相似特性';

    // 生成拟合曲线数据
    const fitLineData = windowSizes.map((n, i) => [n, rsValues[i] ? Math.pow(n, hurstIndex) * (rsValues[0] / Math.pow(windowSizes[0], hurstIndex)) : 0]);

    // 创建更直观的图表配置
    return {
      title: {
        text: `自相似模型分析结果`,
        subtext: `${selfSimilarText} (Hurst指数: ${hurstIndex.toFixed(3)})`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: isSelfSimilar ? '#27ae60' : '#e74c3c'
        },
        subtextStyle: {
          fontSize: 12,
          color: '#666'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985'
          }
        },
        formatter: function(params: any) {
          if (params && params.length > 0) {
            const windowSize = params[0].value[0];
            const rsValue = params[0].value[1];
            return `
              <div style="text-align: left; padding: 8px;">
                <strong style="color: #333;">窗口分析结果</strong><br/>
                <div style="margin: 8px 0;">
                  <span style="color: #666;">观察窗口大小:</span> <strong>${windowSize}个数据点</strong><br/>
                  <span style="color: #666;">波动强度(R/S):</span> <strong>${rsValue.toFixed(2)}</strong>
                </div>
                <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;"/>
                <div style="font-size: 11px; color: #888;">
                  <div>Hurst指数: ${hurstIndex.toFixed(3)} ${isSelfSimilar ? '✓' : '✗'}</div>
                  <div>拟合度: ${(rSquared * 100).toFixed(1)}%</div>
                  <div style="margin-top: 4px; color: ${isSelfSimilar ? '#27ae60' : '#e74c3c'};">
                    ${isSelfSimilar ? '数据表现出自相似特性' : '数据不具有明显自相似特性'}
                  </div>
                </div>
              </div>
            `;
          }
          return '';
        }
      },
      legend: {
        data: ['实际测量值', '理论拟合线'],
        bottom: '8%',
        textStyle: {
          fontSize: 12
        }
      },
      xAxis: {
        type: 'value',
        name: '观察窗口大小 (数据点个数)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          fontSize: 12,
          color: '#333'
        },
        axisLabel: {
          fontSize: 11,
          formatter: '{value}'
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      yAxis: {
        type: 'value',
        name: 'R/S统计量 (波动强度)',
        nameLocation: 'middle',
        nameGap: 50,
        nameTextStyle: {
          fontSize: 12,
          color: '#333'
        },
        axisLabel: {
          fontSize: 11,
          formatter: '{value}'
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      series: [
        {
          name: '实际测量值',
          type: 'scatter',
          data: windowSizes.map((n, i) => [n, rsValues[i]]),
          symbolSize: 10,
          itemStyle: {
            color: isSelfSimilar ? '#27ae60' : '#e74c3c',
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 4,
            shadowColor: 'rgba(0,0,0,0.3)'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(0,0,0,0.5)'
            }
          }
        },
        {
          name: '理论拟合线',
          type: 'line',
          data: fitLineData,
          lineStyle: {
            color: '#3498db',
            width: 3,
            type: 'solid',
            shadowBlur: 2,
            shadowColor: 'rgba(52, 152, 219, 0.3)'
          },
          symbol: 'none',
          smooth: true,
          emphasis: {
            lineStyle: {
              width: 4
            }
          }
        }
      ],
      grid: {
        left: '12%',
        right: '8%',
        bottom: '20%',
        top: '18%',
        containLabel: true
      },
      graphic: [
        {
          type: 'text',
          left: '15%',
          top: '25%',
          style: {
            text: `自相似性判断标准:\nHurst指数 > 0.5 表示具有自相似特性\n当前值: ${hurstIndex.toFixed(3)} ${isSelfSimilar ? '✓ 通过' : '✗ 未通过'}`,
            fontSize: 11,
            fill: '#666',
            lineHeight: 16
          }
        }
      ]
    };
  } catch (error) {
    console.error('自相似模型图表渲染失败:', error);
    return {
      title: {
        text: '自相似模型分析',
        subtext: '数据处理失败，请重新尝试',
        left: 'center',
        textStyle: { color: '#e74c3c' },
        subtextStyle: { color: '#999' }
      },
      series: []
    };
  }
};

// 长相关模型分析图表 - 自相关分析和长程依赖检测
const renderLongRangeAnalysisChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length < 50) {
      throw new Error('数据不足，至少需要50个数据点进行长程依赖分析');
    }

    // 准备原始数据时间序列
    const timeSeriesData = tmvChartData.value
      .filter(item => item && typeof item.timestamp === 'number' && typeof item.size === 'number')
      .map(item => [item.timestamp * 1000, item.size]);

    const sizes = tmvChartData.value.map(item => item.size).filter(size => typeof size === 'number');
    if (sizes.length === 0) {
      throw new Error('没有有效的数据点');
    }

    const maxLag = Math.min(200, Math.floor(sizes.length / 3)); // 最大滞后
    const correlations: number[] = [];
    const lags: number[] = [];

    // 计算自相关函数
    const mean = sizes.reduce((sum, val) => sum + val, 0) / sizes.length;
    const variance = sizes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sizes.length;

    // 计算自相关系数
    for (let lag = 1; lag <= maxLag; lag++) {
      let correlation = 0;
      const n = sizes.length - lag;

      for (let i = 0; i < n; i++) {
        correlation += (sizes[i] - mean) * (sizes[i + lag] - mean);
      }

      correlation = correlation / (n * variance);
      correlations.push(correlation);
      lags.push(lag);
    }

    // 计算长程依赖指标
    // 1. 计算相关系数衰减率
    const significantCorrelations = correlations.filter(corr => Math.abs(corr) > 0.1);
    // const decayRate = significantCorrelations.length / correlations.length;

    // 2. 计算积分相关时间
    // const integralCorrelationTime = correlations.reduce((sum, corr) => {
    //   return sum + Math.abs(corr);
    // }, 0);

    // 3. 检测长程依赖性
    const longRangeThreshold = 0.05; // 阈值
    const longRangeCount = correlations.filter((corr, i) => i > 10 && Math.abs(corr) > longRangeThreshold).length;
    const hasLongRangeDependence = longRangeCount > maxLag * 0.1;

    // 4. 计算相关系数的对数衰减拟合
    const logLags: number[] = [];
    const logCorrelations: number[] = [];

    correlations.forEach((corr, i) => {
      if (corr > 0 && lags[i] > 0) {
        logLags.push(Math.log(lags[i]));
        logCorrelations.push(Math.log(corr));
      }
    });

    // 线性回归计算衰减指数
    let decayExponent = 0;
    if (logLags.length > 5) {
      const n = logLags.length;
      const sumX = logLags.reduce((sum, val) => sum + val, 0);
      const sumY = logCorrelations.reduce((sum, val) => sum + val, 0);
      const sumXY = logLags.reduce((sum, val, i) => sum + val * logCorrelations[i], 0);
      const sumX2 = logLags.reduce((sum, val) => sum + val * val, 0);

      decayExponent = Math.abs((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX));
    }

    // 生成置信区间线
    const confidenceLevel = 1.96 / Math.sqrt(sizes.length); // 95%置信区间
    const upperConfidence = lags.map(() => confidenceLevel);
    const lowerConfidence = lags.map(() => -confidenceLevel);

    const dependenceText = hasLongRangeDependence ? '检测到长程依赖性' : '无明显长程依赖性';
    const dependenceColor = hasLongRangeDependence ? '#27ae60' : '#e74c3c';

    return {
      title: {
        text: `长相关模型 - ${dependenceText}`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: dependenceColor
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: function(params: any) {
          const data = params[0];
          if (data.seriesName === '自相关系数') {
            const lag = data.value[0];
            const correlation = data.value[1];
            const isSignificant = Math.abs(correlation) > confidenceLevel;
            return `
              <div style="text-align: left; max-width: 200px;">
                <strong>滞后: ${lag}</strong><br/>
                相关系数: ${correlation.toFixed(4)}<br/>
                显著性: ${isSignificant ? '显著' : '不显著'}<br/>
                <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
                <small style="color: #666;">
                  置信区间: ±${confidenceLevel.toFixed(4)}<br/>
                  长程相关点: ${longRangeCount}/${maxLag}
                </small>
              </div>
            `;
          }
          return '';
        }
      },
      legend: {
        data: ['自相关系数', '95%置信区间', '零线'],
        bottom: '5%',
        textStyle: {
          fontSize: 12
        }
      },
      xAxis: {
        type: 'value',
        name: '滞后 (lag)',
        nameLocation: 'middle',
        nameGap: 25,
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          fontSize: 10
        }
      },
      yAxis: {
        type: 'value',
        name: '自相关系数',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontSize: 12
        },
        axisLabel: {
          fontSize: 10
        },
        axisLine: {
          show: true
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#f0f0f0'
          }
        }
      },
      series: [
        {
          name: '自相关系数',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: lags.map((lag, i) => [lag, correlations[i]]),
          smooth: false,
          lineStyle: {
            color: '#9b59b6',
            width: 2
          },
          itemStyle: {
            color: '#9b59b6'
          },
          symbol: 'circle',
          symbolSize: 3
        },
        {
          name: '95%置信区间',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: lags.map((lag, i) => [lag, confidenceLevel]),
          lineStyle: {
            color: '#e74c3c',
            width: 1,
            type: 'dashed'
          },
          symbol: 'none',
          silent: true
        },
        {
          name: '95%置信区间',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: lags.map((lag, i) => [lag, -confidenceLevel]),
          lineStyle: {
            color: '#e74c3c',
            width: 1,
            type: 'dashed'
          },
          symbol: 'none',
          silent: true,
          showInLegend: false
        },
        {
          name: '零线',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [[0, 0], [maxLag, 0]],
          lineStyle: {
            color: '#95a5a6',
            width: 1,
            type: 'solid'
          },
          symbol: 'none',
          silent: true
        }
      ],
      grid: {
        left: '8%',
        right: '8%',
        bottom: '18%',
        top: '12%',
        containLabel: true
      }
    };
  } catch (error) {
    console.error('长相关模型图表渲染失败:', error);
    return {
      title: { text: '长相关模型 - 数据处理失败', left: 'center' },
      series: []
    };
  }
};

// 默认分析图表 - 基本统计分析
const renderDefaultAnalysisChart = () => {
  try {
    // 验证数据
    if (!tmvChartData.value || tmvChartData.value.length === 0) {
      throw new Error('数据为空');
    }

    // 准备图表数据 - 使用时间戳和size组成的数据点
    let chartData = tmvChartData.value
      .filter(item => item && typeof item.timestamp === 'number' && typeof item.size === 'number')
      .map(item => [
        item.timestamp * 1000, // ECharts需要毫秒级时间戳
        item.size
      ]);

    if (chartData.length === 0) {
      throw new Error('没有有效的数据点');
    }

    // 计算基本统计信息
    const sizes = chartData.map(item => item[1]);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
    const stdDev = Math.sqrt(variance);

    // 计算变异系数（CV）
    const cv = stdDev / avgSize;
    const variabilityLevel = cv < 0.3 ? '低变异' : cv < 0.7 ? '中等变异' : '高变异';

    // 性能优化：如果数据点太多，进行下采样
    const MAX_POINTS = 5000;
    if (chartData.length > MAX_POINTS) {
      const step = Math.ceil(chartData.length / MAX_POINTS);
      chartData = chartData.filter((_, index) => index % step === 0);
    }

    return {
      title: {
        text: `基本统计分析 - ${variabilityLevel}`,
        left: 'center',
        top: '2%',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: cv < 0.3 ? '#27ae60' : cv < 0.7 ? '#f39c12' : '#e74c3c'
        }
      },
    tooltip: {
      trigger: 'axis',
      formatter: function(params: any) {
        const data = params[0];
        const timestamp = data.value[0];
        const size = data.value[1];
        const time = new Date(timestamp);
        return `
          <div style="text-align: left; max-width: 200px;">
            <strong>${time.toLocaleTimeString()}</strong><br/>
            大小: ${size} bytes<br/>
            <hr style="margin: 5px 0; border: none; border-top: 1px solid #eee;"/>
            <small style="color: #666;">
              均值: ${avgSize.toFixed(1)}B<br/>
              标准差: ${stdDev.toFixed(1)}B
            </small>
          </div>
        `;
      }
    },
    xAxis: {
      type: 'time',
      name: '时间',
      nameLocation: 'middle',
      nameGap: 25,
      nameTextStyle: {
        fontSize: 12
      },
      axisLabel: {
        formatter: function(value: number) {
          const date = new Date(value);
          // 根据时间范围动态调整显示格式
          const timeRange = tmvChartData.value.length > 0 ?
            tmvChartData.value[tmvChartData.value.length - 1].timestamp - tmvChartData.value[0].timestamp : 0;

          if (timeRange < 60) {
            // 小于1分钟，显示秒
            return date.toLocaleTimeString('zh-CN', {
              hour12: false,
              minute: '2-digit',
              second: '2-digit'
            });
          } else if (timeRange < 3600) {
            // 小于1小时，显示分秒
            return date.toLocaleTimeString('zh-CN', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            });
          } else {
            // 大于1小时，显示时分
            return date.toLocaleTimeString('zh-CN', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '数据包大小 (bytes)',
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: {
        fontSize: 12
      },
      axisLabel: {
        fontSize: 10
      }
    },
    series: [
      {
        name: '数据包大小',
        type: 'line',
        data: chartData,
        symbol: 'circle',
        symbolSize: 3,
        smooth: false,
        connectNulls: false,
        sampling: 'lttb',
        itemStyle: {
          color: '#409EFF',
          opacity: 0.8
        },
        lineStyle: {
          width: 1.5,
          color: '#409EFF'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(64, 158, 255, 0.3)'
            }, {
              offset: 1, color: 'rgba(64, 158, 255, 0.1)'
            }]
          }
        },
        emphasis: {
          itemStyle: {
            color: '#66b1ff',
            opacity: 1,
            borderColor: '#fff',
            borderWidth: 2
          }
        }
      }
    ],
    grid: {
      left: '8%',
      right: '8%',
      bottom: '15%',
      top: '12%',
      containLabel: true
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter'
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'filter',
        bottom: '5%',
        height: '6%'
      }
    ]
  };
  } catch (error) {
    console.error('默认图表渲染失败:', error);
    return {
      title: { text: 'TMV数据 - 数据处理失败', left: 'center' },
      series: []
    };
  }
};

// 暴露打开信号仿真对话框的方法
const openSignalSimDialog = () => {
  handleOpenSignalSimDialog();
};

// 暴露方法和ref供父组件调用
defineExpose({
  getNodeInterfaces,
  openSignalSimDialog,
  showSignalSimDialog
});
</script>

<style scoped>
.neo-infobox {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.85) 0%,
    rgba(17, 23, 64, 0.9) 100%
  );
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: min(408px, calc(100vw - 40px));
  min-width: 300px;
  min-height: 150px;
  max-height: 80vh;
  overflow: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 122, 255, 0.2);
  color: white;
  transform-origin: top right;
  animation: infobox-appear 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;
  resize: both;
}

/* 隐藏WebKit浏览器的滚动条 */
.neo-infobox::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* 改进媒体查询 - 针对不同屏幕尺寸优化布局 */
@media screen and (max-width: 768px) {
  .neo-infobox {
    top: 10px;
    right: 10px;
    width: min(350px, calc(100vw - 20px));
    max-height: 70vh; /* 小屏幕减小最大高度 */
  }
  
  .neo-infobox-content {
    padding: 10px; /* 减小内边距 */
  }
  
  .neo-grid {
    grid-template-columns: 1fr; /* 小屏幕下改为单列显示 */
    gap: 8px; /* 减小间距 */
  }
  
  .resource-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .resource-label {
    min-width: auto;
  }
  
  .resource-select {
    width: 100%;
  }
  
  .neo-actions {
    flex-direction: column;
    gap: 8px; /* 减小按钮间距 */
  }

  .vm-actions {
    gap: 8px;
  }

  .vm-action-row {
    gap: 8px;
  }

  .neo-section {
    margin-bottom: 12px; /* 减小区块间距 */
  }
}

/* 特别处理低高度屏幕，确保内容可见 */
@media screen and (max-height: 700px) {
  .neo-infobox {
    top: 5px;
    max-height: calc(100vh - 10px);
    font-size: 0.95em; /* 略微减小字体大小 */
  }
  
  .neo-section {
    margin-bottom: 8px; /* 减小区块间距 */
    padding: 6px 0; /* 减小内部间距 */
  }
  
  .resource-description {
    font-size: 12px;
    padding: 5px 10px;
    margin-top: 5px;
  }

  .neo-grid-item {
    padding: 6px 10px; /* 减小内边距 */
  }
  
  .neo-btn {
    padding: 8px 0; /* 减小按钮高度 */
  }

  .neo-infobox-header {
    padding: 12px 16px; /* 减小头部高度 */
  }
}

/* 针对小高度宽屏幕（如笔记本）的特殊处理 */
@media screen and (min-width: 769px) and (max-height: 800px) {
  .neo-infobox {
    max-height: 85vh;
    right: 15px;
    top: 15px;
  }

  .fault-config, .neo-resource-config {
    gap: 8px; /* 减小配置项间距 */
  }
}

/* 当终端显示时调整信息框位置 */
@media screen and (max-width: 1200px) {
  .showTerminal .neo-infobox {
    top: 10px;
    height: auto;
    max-height: 40vh;
  }
}

@keyframes infobox-appear {
  0% {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.neo-infobox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  background: linear-gradient(
    90deg,
    rgba(9, 84, 159, 0.4) 0%,
    rgba(40, 75, 150, 0.2) 100%
  );
  border-bottom: 1px solid rgba(0, 122, 255, 0.2);
  font-weight: 600;
  font-size: 16px;
  color: #00c6ff;
  text-shadow: 0 0 10px rgba(0, 198, 255, 0.3);
  position: relative;
  /* 确保头部不会滚动 */
  flex: 0 0 auto;
}

.neo-infobox-header::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 15%;
  width: 70%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 198, 255, 0.7), transparent);
}

.neo-infobox-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.neo-infobox-close {
  cursor: pointer;
  color: rgba(0, 198, 255, 0.8);
  font-size: 18px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 122, 255, 0.1);
  transition: all 0.2s ease;
}

.neo-infobox-close:hover {
  color: #00c6ff;
  background-color: rgba(0, 122, 255, 0.3);
  transform: rotate(90deg);
  box-shadow: 0 0 8px rgba(0, 198, 255, 0.5);
}

.neo-infobox-content {
  padding: 14px;
  /* 允许内容区域自适应 */
  flex: 1 1 auto;
  overflow-y: auto;
  /* 隐藏滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

/* 隐藏内容区域的WebKit滚动条 */
.neo-infobox-content::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.neo-section {
  margin-bottom: 16px;
  animation: section-appear 0.5s ease forwards;
  opacity: 0;
  transform: translateY(10px);
}
.neo-section:nth-child(1) {
  animation-delay: 0.1s;
}
.neo-section:nth-child(2) {
  animation-delay: 0.2s;
}
.neo-section:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes section-appear {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.neo-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 10px;
  color: rgba(0, 198, 255, 0.9);
  letter-spacing: 0.5px;
}
.neo-section-title .el-icon {
  color: #00c6ff;
  font-size: 18px;
  background: rgba(0, 198, 255, 0.15);
  padding: 4px;
  border-radius: 6px;
}
.neo-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 4px;
}
.neo-grid-item {
  display: flex;
  flex-direction: column;
  background-color: rgba(255, 255, 255, 0.04);
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(0, 122, 255, 0.05);
}
.neo-grid-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.15);
  box-shadow: 0 0 10px rgba(0, 122, 255, 0.1);
  transform: scale(1.02);
}
.item-label {
  color: #7fdfff;
  font-size: 15px;
  font-weight: 400;
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}
.item-value {
  color: #eaf6ff;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.5px;
}
.alias-grid-item {
  grid-column: span 1;
}
.alias-item-value {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.alias-text {
  word-break: break-all;
}
.alias-action-row {
  display: flex;
  gap: 8px;
}
.alias-inline-btn,
.alias-action-btn {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.alias-inline-btn {
  align-self: flex-start;
  padding: 4px 10px;
  background: linear-gradient(90deg, rgba(30, 144, 255, 0.35), rgba(0, 198, 255, 0.28));
  color: #dff6ff;
  font-size: 12px;
}
.alias-inline-btn:hover {
  box-shadow: 0 0 10px rgba(0, 198, 255, 0.25);
  transform: translateY(-1px);
}
.alias-action-btn {
  flex: 1;
  padding: 6px 0;
  color: #fff;
  font-size: 12px;
}
.alias-action-btn.save {
  background: linear-gradient(to right, #0052cc, #0088ff);
}
.alias-action-btn.cancel {
  background: linear-gradient(to right, #4b5563, #6b7280);
}
.alias-action-btn:disabled,
.alias-inline-btn:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  transform: none;
  box-shadow: none;
}
.alias-item-value :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 198, 255, 0.18);
}
.alias-item-value :deep(.el-input__inner) {
  color: #eaf6ff;
}
.section-location {
  margin: 10px 0 0 0;
  color: #b6eaff;
  font-size: 14px;
  background: linear-gradient(90deg, #1e90ff11 0, #1e2736 100%);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: "Consolas", "Menlo", monospace;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 4px #1e90ff11;
}
.neo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 10px;
}

/* VM节点的特殊按钮布局 */
.vm-actions {
  flex-direction: column;
  gap: 10px;
}

.vm-action-row {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
.neo-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 8px;
  letter-spacing: 0.5px;
}
.delete-btn {
  background: linear-gradient(to right, #8B0000, #FF0000);
  color: #ffffff;
}
.delete-btn:hover {
  background: linear-gradient(to right, #FF0000, #FF4500);
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  transform: translateY(-2px);
}
.terminal-btn {
  background: linear-gradient(to right, #0052cc, #0088ff);
  color: #ffffff;
}
.terminal-btn:hover {
  background: linear-gradient(to right, #0088ff, #00aaff);
  box-shadow: 0 0 10px rgba(0, 136, 255, 0.5);
  transform: translateY(-2px);
}





.resource-description {
  margin: 10px 0 0 0;
  color: #b6eaff;
  font-size: 13px;
  background: linear-gradient(90deg, #00c85311 0, #1e2736 100%);
  border-radius: 8px;
  padding: 8px 14px;
  font-style: italic;
  letter-spacing: 0.3px;
  text-align: center;
}

.neo-resource-config {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(0, 200, 83, 0.1);
}

.resource-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.resource-label {
  color: #7fdfff;
  font-size: 14px;
  font-weight: 400;
  margin-right: 10px;
  min-width: 80px;
}

.resource-select {
  width: 200px;
  --el-select-border-color-hover: rgba(0, 200, 83, 0.6);
}

:deep(.el-select .el-input__wrapper) {
  background-color: rgba(0, 122, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(0, 200, 83, 0.2);
}

:deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px rgba(0, 200, 83, 0.4);
}

:deep(.el-select .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px rgba(0, 200, 83, 0.6);
}

:deep(.el-select-dropdown__item.selected) {
  color: #00c853;
  font-weight: 600;
}

:deep(.el-input__inner) {
  color: #eaf6ff;
}

:deep(.el-select .el-input .el-select__caret) {
  color: rgba(0, 200, 83, 0.8);
}

/* 故障模拟样式 */
.fault-config {
  border: 1px solid rgba(255, 82, 82, 0.2);
}

.fault-config .el-slider__runway {
  background-color: rgba(255, 255, 255, 0.1);
}

.fault-config .el-slider__bar {
  background-color: rgba(255, 82, 82, 0.8);
}

.fault-config .el-slider__button {
  border: 2px solid rgba(255, 82, 82, 0.8);
}

.fault-status {
  margin: 10px 0 0 0;
  color: #b6eaff;
  font-size: 13px;
  background: linear-gradient(90deg, rgba(255, 82, 82, 0.05) 0, #1e2736 100%);
  border-radius: 8px;
  padding: 8px 14px;
  font-style: italic;
  letter-spacing: 0.3px;
  text-align: center;
  transition: all 0.3s ease;
}

.fault-status.active {
  color: #ffb6b6;
  background: linear-gradient(90deg, rgba(255, 82, 82, 0.15) 0, #1e2736 100%);
  border-left: 3px solid rgba(255, 82, 82, 0.5);
}

/* 仿真粒度样式 */
.simulation-config {
  border: 1px solid rgba(156, 39, 176, 0.2);
}

.simulation-description {
  background: linear-gradient(90deg, rgba(156, 39, 176, 0.05) 0, #1e2736 100%);
  border-left: 3px solid rgba(156, 39, 176, 0.3);
}



/* 针对小屏幕设备的特殊处理 */
@media screen and (max-width: 480px) {
  .neo-infobox {
    top: 10px;
    right: 10px;
    width: calc(100vw - 20px);
    max-height: 85vh;
  }
  
  .neo-infobox-title {
    font-size: 14px;
    max-width: 200px;
  }
  
  .item-label {
    font-size: 13px;
  }
  
  .item-value {
    font-size: 13px;
  }
  
  .neo-infobox-header {
    padding: 12px 14px;
  }
  
  .neo-infobox-content {
    padding: 10px;
  }
}



/* 信号级仿真按钮样式 */
.signal-sim-btn {
  background: linear-gradient(to right, #0066cc, #1e90ff);
  color: #ffffff;
}
.signal-sim-btn:hover {
  background: linear-gradient(to right, #1e90ff, #00bfff);
  box-shadow: 0 0 10px rgba(30, 144, 255, 0.5);
  transform: translateY(-2px);
}

/* 子网配置按钮样式 */
.subnet-config-btn {
  background: linear-gradient(to right, #9c27b0, #e1bee7);
  color: #ffffff;
}
.subnet-config-btn:hover {
  background: linear-gradient(to right, #7b1fa2, #ce93d8);
  box-shadow: 0 0 10px rgba(156, 39, 176, 0.5);
  transform: translateY(-2px);
}

/* 时隙配置按钮样式 */
.slot-config-btn {
  background: linear-gradient(to right, #ff6b6b, #feca57);
  color: #ffffff;
}
.slot-config-btn:hover {
  background: linear-gradient(to right, #ee5a24, #ff9ff3);
  box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
  transform: translateY(-2px);
}

/* 信号级仿真对话框样式 */
.signal-sim-content {
  padding: 10px 0;
}

.signal-sim-header {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.signal-sim-title {
  font-size: 16px;
  font-weight: 500;
  color: #1e90ff;
  display: flex;
  align-items: center;
  gap: 8px;
}

.signal-sim-interfaces {
  background-color: rgba(30, 144, 255, 0.05);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 16px;
  border: 1px solid rgba(30, 144, 255, 0.2);
  max-height: 250px;
  overflow-y: auto;
}

.selection-hint {
  font-size: 13px;
  color: #1e90ff;
  margin-bottom: 12px;
  padding: 6px 10px;
  background-color: rgba(30, 144, 255, 0.08);
  border-radius: 4px;
  text-align: center;
  border-left: 3px solid #1e90ff;
}

.interface-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.interface-item {
  margin-right: 0;
  padding: 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
  background-color: rgba(30, 144, 255, 0.08);
  border: 1px solid rgba(30, 144, 255, 0.1);
  display: flex;
  align-items: center;
}

.interface-item:hover {
  background-color: rgba(30, 144, 255, 0.15);
  border-color: rgba(30, 144, 255, 0.2);
}

.interface-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.interface-name {
  font-weight: 500;
  color: #333;
}

.interface-id {
  color: #666;
  font-size: 13px;
}

.no-interfaces {
  color: #ff6b6b;
  text-align: center;
  font-style: italic;
  padding: 20px 0;
}


:deep(.signal-sim-dialog .el-dialog) {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(30, 144, 255, 0.2);
}

:deep(.signal-sim-dialog .el-dialog__header) {
  background: linear-gradient(90deg, rgba(9, 84, 159, 0.8) 0%, rgba(40, 75, 150, 0.6) 100%);
  color: white;
  padding: 16px 20px;
  margin: 0;
  border-bottom: 1px solid rgba(30, 144, 255, 0.2);
}

:deep(.signal-sim-dialog .el-dialog__title) {
  color: white;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

:deep(.signal-sim-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: rgba(255, 255, 255, 0.8);
}

:deep(.signal-sim-dialog .el-dialog__body) {
  padding: 20px;
}

:deep(.signal-sim-dialog .el-dialog__footer) {
  border-top: 1px solid rgba(30, 144, 255, 0.1);
  padding: 15px 20px;
}

:deep(.signal-sim-dialog .el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: #1e90ff;
  border-color: #1e90ff;
}

:deep(.signal-sim-dialog .el-checkbox__input.is-checked+.el-checkbox__label) {
  color: #1e90ff;
}

/* 节点状态指示器样式 */
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-indicator.status-up {
  background-color: #67c23a;
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
}

.status-indicator.status-down {
  background-color: #f56c6c;
  box-shadow: 0 0 4px rgba(245, 108, 108, 0.5);
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  :deep(.signal-sim-dialog .el-dialog) {
    width: 95% !important;
    margin: 0 auto;
  }

  .signal-sim-interfaces {
    padding: 10px;
    max-height: 200px;
  }

  .interface-item {
    padding: 8px;
  }
}

/* VM模板信息样式 */
.vm-template-info {
  padding: 4px;
}

.vm-template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.vm-template-item {
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(156, 39, 176, 0.08) 0%, rgba(156, 39, 176, 0.04) 100%);
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(156, 39, 176, 0.15);
  transition: all 0.3s ease;
}

.vm-template-item:hover {
  background: linear-gradient(135deg, rgba(156, 39, 176, 0.12) 0%, rgba(156, 39, 176, 0.06) 100%);
  border-color: rgba(156, 39, 176, 0.25);
  box-shadow: 0 4px 12px rgba(156, 39, 176, 0.15);
  transform: translateY(-2px);
}

.vm-template-item.full-width {
  grid-column: 1 / -1;
}

.vm-item-label {
  color: #e1bee7;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}

.vm-item-value {
  color: #f3e5f5;
  font-size: 15px;
  font-weight: 400;
  letter-spacing: 0.3px;
  word-break: break-all;
}

/* VM按钮样式 */
.vm-start-btn {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border-color: #4caf50;
}

.vm-start-btn:hover {
  background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.vm-stop-btn {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  border-color: #f44336;
}

.vm-stop-btn:hover {
  background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

.vm-edit-btn {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  border-color: #ff9800;
}

.vm-edit-btn:hover {
  background: linear-gradient(135deg, #f57c00 0%, #ef6c00 100%);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

/* VNC窗口样式 */
.draggable-vnc {
  position: fixed;
  z-index: 1000;
  background: linear-gradient(
    135deg,
    rgba(8, 15, 39, 0.95) 0%,
    rgba(17, 23, 64, 0.95) 100%
  );
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  width: 800px;
  height: 600px;
  min-width: 600px;
  min-height: 400px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  resize: both;
}

.vnc-header {
  background: linear-gradient(
    90deg,
    rgba(24, 29, 40, 0.9) 0%,
    rgba(31, 38, 54, 0.9) 100%
  );
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
  backdrop-filter: blur(5px);
}

.vnc-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
}

.vnc-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.vnc-control {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 12px;
}

.vnc-control.minimize {
  background: linear-gradient(135deg, #e6a23c 0%, #cf9236 100%);
  color: #ffffff;
}

.vnc-control.minimize:hover {
  background: linear-gradient(135deg, #cf9236 0%, #b8832f 100%);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(230, 162, 60, 0.4);
}

.vnc-control.close {
  background: linear-gradient(135deg, #f56c6c 0%, #e85656 100%);
  color: #ffffff;
}

.vnc-control.close:hover {
  background: linear-gradient(135deg, #e85656 0%, #d94545 100%);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}

.vnc-body {
  height: calc(100% - 49px);
  transition: all 0.3s ease;
  overflow: hidden;
}

.vnc-body.minimized {
  height: 0;
}

/* 响应式VNC窗口 */
@media (max-width: 768px) {
  .draggable-vnc {
    width: calc(100vw - 40px);
    height: calc(100vh - 100px);
    left: 20px !important;
    top: 50px !important;
  }
}
.protocol-btn {
  background: linear-gradient(90deg, #1e90ff 0%, #00c6ff 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 22px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 2px 8px #1e90ff33;
  transition: background 0.2s, box-shadow 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.protocol-btn:hover {
  background: linear-gradient(90deg, #00c6ff 0%, #1e90ff 100%);
  box-shadow: 0 4px 16px #00c6ff44;
}

/* TMV数据查看按钮样式 */
.tmv-data-btn {
  background: linear-gradient(90deg, #67c23a 0%, #85ce61 100%);
  color: white;
}

.tmv-data-btn:hover {
  background: linear-gradient(90deg, #85ce61 0%, #95d475 100%);
  box-shadow: 0 4px 16px #67c23a44;
}

.tmv-data-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* TMV数据对话框样式 */
.tmv-data-content {
  padding: 20px;
}

.tmv-file-info {
  margin-bottom: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.tmv-file-info h4 {
  margin: 0 0 15px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
}

.info-label {
  font-weight: 600;
  color: #606266;
  margin-right: 8px;
  min-width: 80px;
}

.info-value {
  color: #303133;
  font-family: 'Courier New', monospace;
}

.tmv-chart-container {
  margin-top: 20px;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}

.tmv-chart-container h4 {
  margin: 0 0 15px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.dual-chart-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 10px;
}

.chart-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-item h5 {
  margin: 0 0 15px 0;
  text-align: center;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  border-bottom: 2px solid #409EFF;
}

#tmvChart {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

/* BUSINESS_Transmitter相关样式 */
.business-transmitter-section {
  margin-top: 16px;
}

.transmitter-config, .receiver-config {
  background: rgba(0, 200, 83, 0.05);
  border: 1px solid rgba(0, 200, 83, 0.15);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.receiver-config {
  background: rgba(30, 144, 255, 0.05);
  border-color: rgba(30, 144, 255, 0.15);
}

.transmitter-operation {
  margin: 16px 0;
}

.operation-type {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.image-config, .video-config {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-input {
  width: 120px;
}

.transmitter-actions, .receiver-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* 三个按钮时的特殊布局 */
.transmitter-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.transmitter-actions .start-transmission-btn {
  grid-column: 1 / -1; /* 占满整行 */
}

.receiver-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.receiver-actions .view-results-btn {
  grid-column: 1 / -1; /* 占满整行 */
}

/* 按钮样式 */
.start-transmission-btn {
  background: linear-gradient(135deg, #00c853 0%, #4caf50 100%);
  color: white;
}

.start-transmission-btn:hover {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
  box-shadow: 0 4px 16px rgba(0, 200, 83, 0.4);
}

.view-results-btn {
  background: linear-gradient(135deg, #1e90ff 0%, #42a5f5 100%);
  color: white;
}

.view-results-btn:hover {
  background: linear-gradient(135deg, #42a5f5 0%, #64b5f6 100%);
  box-shadow: 0 4px 16px rgba(30, 144, 255, 0.4);
}

/* Element Plus组件样式覆盖 */
:deep(.config-input .el-input-number__decrease),
:deep(.config-input .el-input-number__increase) {
  background-color: rgba(0, 200, 83, 0.1);
  border-color: rgba(0, 200, 83, 0.2);
  color: #00c853;
}

:deep(.config-input .el-input-number__decrease:hover),
:deep(.config-input .el-input-number__increase:hover) {
  background-color: rgba(0, 200, 83, 0.2);
  color: #00c853;
}

:deep(.config-input .el-input__wrapper) {
  background-color: rgba(0, 200, 83, 0.08);
  border-color: rgba(0, 200, 83, 0.15);
}

:deep(.config-input .el-input__wrapper:hover) {
  border-color: rgba(0, 200, 83, 0.3);
}

:deep(.config-input .el-input__wrapper.is-focus) {
  border-color: #00c853;
  box-shadow: 0 0 0 1px rgba(0, 200, 83, 0.2);
}

/* 响应式调整 */
@media screen and (max-width: 768px) {
  .config-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .config-input {
    width: 100%;
  }
  
  .operation-type {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .transmitter-actions, .receiver-actions, .tmv-actions, .tmv-receiver-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .transmitter-actions .start-transmission-btn,
  .receiver-actions .view-results-btn,
  .tmv-actions .start-tmv-btn,
  .tmv-receiver-actions .view-tmv-data-btn {
    grid-column: auto; /* 重置grid布局 */
  }
}

/* 传输状态显示样式 */
.transfer-status-display {
  margin-top: 16px;
  background: linear-gradient(135deg, rgba(30, 144, 255, 0.12) 0%, rgba(30, 144, 255, 0.08) 100%);
  border: 1px solid rgba(30, 144, 255, 0.25);
  border-radius: 10px;
  padding: 16px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 8px rgba(30, 144, 255, 0.1);
}

.status-header {
  font-size: 16px;
  font-weight: 700;
  color: #00d4ff;
  margin-bottom: 12px;
  text-shadow: 0 2px 8px rgba(0, 212, 255, 0.5);
  letter-spacing: 0.8px;
  background: linear-gradient(135deg, #00d4ff, #00b0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
}

.status-content {
  font-size: 15px;
  color: #f0f8ff;
  line-height: 1.8;
  word-break: break-all;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  background: linear-gradient(135deg, rgba(164, 143, 255, 0.15), rgba(0, 212, 255, 0.1));
  padding: 16px 18px;
  border-radius: 12px;
  border: 2px solid rgba(164, 143, 255, 0.3);
  font-family: 'Consolas', 'Monaco', 'JetBrains Mono', 'Courier New', monospace;
  letter-spacing: 0.5px;
  backdrop-filter: blur(8px);
  box-shadow: 
    0 4px 16px rgba(164, 143, 255, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

/* 现代化传输结果对话框样式 */
:deep(.modern-transfer-dialog) {
  .el-message-box {
    width: 600px;
    max-width: 90vw;
    border-radius: 20px;
    overflow: hidden;
    background: linear-gradient(145deg, #0a1228 0%, #1a1a40 50%, #2c0a16 100%);
    border: 2px solid rgba(164, 143, 255, 0.3);
    box-shadow: 
      0 20px 60px rgba(0, 0, 0, 0.8),
      0 0 40px rgba(164, 143, 255, 0.2);
  }
  
  .el-message-box__header {
    background: transparent;
    padding: 0;
    border-bottom: none;
  }
  
  .el-message-box__content {
    padding: 0;
    max-height: 80vh;
    overflow: hidden;
    color: white;
  }
  
  .el-message-box__btns {
    padding: 20px 24px;
    background: linear-gradient(135deg, rgba(164, 143, 255, 0.1), rgba(0, 200, 255, 0.1));
    border-top: 1px solid rgba(164, 143, 255, 0.2);
  }
  
  .el-button--primary {
    background: linear-gradient(135deg, #00b0ff, #00e5ff);
    border: none;
    color: white;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 8px;
    transition: all 0.3s ease;
  }
  
  .el-button--primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(164, 143, 255, 0.4);
  }
}

/* 现代化传输结果内容样式 */
.modern-transfer-result {
  background: transparent;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
}

/* 状态头部卡片 */
.status-header-card {
  background: linear-gradient(135deg, rgba(164, 143, 255, 0.2), rgba(0, 200, 255, 0.2));
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(164, 143, 255, 0.2);
  backdrop-filter: blur(10px);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-radius: 25px;
  font-weight: 700;
  font-size: 16px;
  backdrop-filter: blur(10px);
  border: 2px solid;
}

.status-badge.status-completed {
  background: linear-gradient(135deg, rgba(16, 220, 96, 0.2), rgba(22, 160, 133, 0.2));
  border-color: #10dc60;
  color: #10dc60;
  text-shadow: 0 0 20px rgba(16, 220, 96, 0.5);
}

.status-badge.status-running {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.2));
  border-color: #3498db;
  color: #3498db;
  text-shadow: 0 0 20px rgba(52, 152, 219, 0.5);
}

.status-badge.status-failed,
.status-badge.status-error {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(192, 57, 43, 0.2));
  border-color: #e74c3c;
  color: #e74c3c;
  text-shadow: 0 0 20px rgba(231, 76, 60, 0.5);
}

.status-icon {
  font-size: 20px;
  animation: pulse 2s infinite;
}

.timestamp-chip {
  background: rgba(164, 143, 255, 0.1);
  color: #00b0ff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid rgba(164, 143, 255, 0.3);
}

/* 信息网格容器 */
.info-grid-container {
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.info-card-modern {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
  border: 1px solid rgba(164, 143, 255, 0.2);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.info-card-modern::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #00b0ff, #00e5ff);
}

.info-card-modern.primary-card::before {
  background: linear-gradient(90deg, #00d4ff, #00b0ff);
}

.info-card-modern:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(164, 143, 255, 0.3);
  border-color: rgba(164, 143, 255, 0.5);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 18px;
  color: #00b0ff;
}

.card-label {
  font-size: 13px;
  color: #b8c5d1;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  word-break: break-all;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.primary-value {
  color: #00d4ff;
  text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
}

/* 传输流程部分 */
.transfer-flow-section {
  padding: 24px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.05), rgba(164, 143, 255, 0.05));
  border-top: 1px solid rgba(164, 143, 255, 0.2);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.section-icon {
  font-size: 20px;
  color: #00b0ff;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.flow-visualization {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
}

.flow-node {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  border: 2px solid rgba(164, 143, 255, 0.3);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  min-width: 180px;
}

.flow-node:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(164, 143, 255, 0.3);
}

.sender-node {
  border-color: rgba(0, 212, 255, 0.5);
}

.receiver-node {
  border-color: rgba(16, 220, 96, 0.5);
}

.node-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #00b0ff, #00e5ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
  flex-shrink: 0;
}

.node-content {
  flex: 1;
}

.node-label {
  font-size: 12px;
  color: #b8c5d1;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.node-value {
  font-size: 14px;
  color: white;
  font-weight: 600;
  word-break: break-all;
}

.flow-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.connector-line {
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #00b0ff, #00e5ff);
  border-radius: 1px;
}

.connector-arrow {
  font-size: 20px;
  color: #00b0ff;
  animation: bounce 2s infinite;
}

/* 详细信息面板 */
.details-panel {
  padding: 24px;
  border-top: 1px solid rgba(164, 143, 255, 0.2);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.panel-icon {
  font-size: 18px;
  color: #00b0ff;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.details-content {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(164, 143, 255, 0.2);
  border-radius: 12px;
  overflow: hidden;
}

.message-text {
  padding: 16px;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e0e7ff;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 动画效果 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateX(0); }
  40% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modern-transfer-dialog .el-message-box {
    width: 95vw !important;
  }
  
  .info-grid-container {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .flow-visualization {
    flex-direction: column;
    gap: 16px;
  }
  
  .flow-connector {
    transform: rotate(90deg);
  }
  
  .connector-line {
    width: 2px;
    height: 40px;
  }
}

/* 优化后的传输结果对话框样式 */
:deep(.transfer-result-dialog-v2) {
  .el-message-box {
    width: 620px;
    max-width: 90vw;
  }
  
  .el-message-box__content {
    padding: 0;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .transfer-result-content {
    padding: 24px;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border-radius: 8px;
    line-height: 1.6;
  }
  
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid #e9ecef;
  }
  
  .status-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border-radius: 25px;
    font-weight: 600;
    font-size: 15px;
    line-height: 1.4;
  }
  
  .status-badge.status-completed {
    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    color: #155724;
    border: 1px solid #c3e6cb;
  }
  
  .status-badge.status-running {
    background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    color: #0c5460;
    border: 1px solid #bee5eb;
  }
  
  .status-badge.status-failed,
  .status-badge.status-error {
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    color: #721c24;
    border: 1px solid #f5c6cb;
  }
  
  .status-icon {
    font-size: 18px;
    line-height: 1;
  }
  
  .timestamp {
    color: #6c757d;
    font-size: 13px;
    font-family: 'Consolas', 'Monaco', monospace;
    padding: 6px 12px;
    background: #f1f3f4;
    border-radius: 12px;
  }
  
  .result-section {
    margin-bottom: 24px;
    padding: 20px;
    background: #ffffff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-left: 4px solid #007bff;
  }
  
  .result-section:last-child {
    margin-bottom: 0;
  }
  
  .section-title {
    margin: 0 0 16px 0;
    color: #495057;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.4;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }
  
  .info-item.full-width {
    grid-column: 1 / -1;
  }
  
  .info-label {
    color: #6c757d;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    line-height: 1.3;
  }
  
  .info-value {
    color: #212529;
    font-size: 15px;
    font-weight: 500;
    word-break: break-word;
    line-height: 1.5;
  }
  
  .message-content {
    background: #f1f5f9;
    padding: 14px 16px;
    border-radius: 8px;
    border-left: 4px solid #007bff;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 14px;
    line-height: 1.6;
    margin-top: 4px;
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .el-message-box {
      width: 95vw;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }
    
    .result-header {
      flex-direction: column;
      gap: 12px;
      align-items: flex-start;
    }
    
    .transfer-result-content {
      padding: 20px;
    }
    
    .result-section {
      padding: 16px;
      margin-bottom: 20px;
    }
  }
}

/* V3版本 - 全新设计的传输结果对话框 */
:deep(.transfer-result-dialog-v3) {
  .el-message-box {
    width: 540px;
    max-width: 90vw;
    border-radius: 16px;
    overflow: hidden;
  }
  
  .el-message-box__header {
    display: none;
  }
  
  .el-message-box__content {
    padding: 0;
    max-height: 75vh;
    overflow-y: auto;
  }
  
  .transfer-result-content-v3 {
    background: linear-gradient(145deg, #f8fafc 0%, #ffffff 100%);
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }
  
  /* 状态头部 */
  .result-status-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 24px 28px;
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    overflow: hidden;
  }
  
  .result-status-header::before {
    content: '';
    position: absolute;
    top: 0;
    right: -50px;
    width: 100px;
    height: 100%;
    background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1));
    transform: skewX(-15deg);
  }
  
  .status-indicator {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: bold;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  
  .status-indicator.status-completed {
    background: linear-gradient(135deg, #10dc60, #16a085);
    color: white;
    box-shadow: 0 4px 15px rgba(16, 220, 96, 0.4);
  }
  
  .status-indicator.status-running {
    background: linear-gradient(135deg, #3498db, #2980b9);
    color: white;
    box-shadow: 0 4px 15px rgba(52, 152, 219, 0.4);
  }
  
  .status-indicator.status-failed,
  .status-indicator.status-error {
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    color: white;
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
  }
  
  .status-info {
    flex: 1;
    color: white;
  }
  
  .status-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.2;
    text-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  .status-time {
    margin: 4px 0 0 0;
    font-size: 14px;
    opacity: 0.9;
    font-weight: 400;
  }
  
  /* 信息卡片 */
  .info-cards {
    padding: 24px 28px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
  }
  
  .info-card {
    background: white;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    border: 1px solid #e2e8f0;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  
  .info-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
  }
  
  .info-card.primary::before {
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
  }
  
  .info-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  }
  
  .card-icon {
    font-size: 20px;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    border-radius: 8px;
  }
  
  .card-content {
    flex: 1;
    min-width: 0;
  }
  
  .card-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }
  
  .card-value {
    display: block;
    font-size: 16px;
    color: #1e293b;
    font-weight: 600;
    word-break: break-all;
  }
  
  /* 传输详情 */
  .transfer-details {
    padding: 24px 28px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }
  
  .details-title {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: #334155;
  }
  
  .details-flow {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  
  .flow-item {
    background: white;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid #e2e8f0;
    flex: 1;
    min-width: 160px;
  }
  
  .flow-icon {
    font-size: 18px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 8px;
  }
  
  .flow-content {
    flex: 1;
  }
  
  .flow-label {
    display: block;
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
    margin-bottom: 4px;
  }
  
  .flow-value {
    display: block;
    font-size: 14px;
    color: #1e293b;
    font-weight: 600;
    word-break: break-all;
  }
  
  .flow-arrow {
    font-size: 20px;
    color: #64748b;
    font-weight: bold;
    flex-shrink: 0;
  }
  
  /* 详细信息 */
  .message-section {
    padding: 24px 28px;
    border-top: 1px solid #e2e8f0;
  }
  
  .message-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #334155;
  }
  
  .message-content-v3 {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .el-message-box {
      width: 95vw;
    }
    
    .info-cards {
      grid-template-columns: 1fr;
      padding: 20px;
    }
    
    .result-status-header,
    .transfer-details,
    .message-section {
      padding-left: 20px;
      padding-right: 20px;
    }
    
    .details-flow {
      flex-direction: column;
      align-items: stretch;
    }
    
    .flow-arrow {
      transform: rotate(90deg);
      align-self: center;
    }
  }
}

/* 按钮禁用状态 */
.start-transmission-btn:disabled {
  background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
  cursor: not-allowed;
  opacity: 0.7;
}

.start-transmission-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 简化的传输结果对话框样式 */
.simple-transfer-result {
  padding: 16px 0;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.timestamp {
  color: #909399;
  font-size: 14px;
}

.result-info {
  margin-bottom: 20px;
}

.id-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.id-row code {
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #409eff;
  word-break: break-all;
}

.message-section {
  margin-top: 20px;
}

.message-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.message-textarea {
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.network-metrics-section {
  margin-top: 20px;
  padding: 16px;
  background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
  border-radius: 8px;
  border: 1px solid #b3d9ff;
}

.network-metrics-section h4 {
  margin: 0 0 16px 0;
  color: #1976d2;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-metrics-section h4::before {
  content: '📊';
  font-size: 18px;
}

.network-metrics-info {
  background: white;
  border-radius: 6px;
}

.network-metrics-info :deep(.el-descriptions__label) {
  background: #f8f9fa;
  color: #495057;
  font-weight: 600;
}

.network-metrics-info :deep(.el-descriptions__content) {
  background: white;
  color: #212529;
  font-weight: 500;
}

/* 网络指标标签样式优化 */
.network-metrics-info .el-tag {
  font-weight: 600;
  border-radius: 12px;
  padding: 4px 12px;
}

/* 数据包统计样式 */
.network-metrics-info :deep(.el-descriptions__content) {
  font-family: 'Consolas', 'Monaco', monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 文件内容查看对话框样式 */
.file-content-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.file-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.file-content {
  flex: 1;
}

/* 媒体内容样式 */
.media-content {
  text-align: center;
  padding: 20px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-content {
  background: #f8f9fa;
}

.video-content {
  background: #f8f9fa;
}

.file-image {
  max-width: 100%;
  max-height: 500px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.file-video {
  max-width: 100%;
  max-height: 500px;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.text-content {
  width: 100%;
}

.file-content-textarea {
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
}

.file-content-textarea :deep(.el-textarea__inner) {
  font-family: 'JetBrains Mono', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

/* TMV流量终端样式 */
.tmv-analyzer-section {
  margin-top: 20px;
}

.tmv-transmitter-config,
.tmv-receiver-config {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.05), rgba(255, 193, 7, 0.05));
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.tmv-operation {
  margin: 20px 0;
}

.operation-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-input {
  flex: 1;
  max-width: 200px;
}

/* TMV按钮布局 - 与BUSINESS_Transmitter保持一致 */
.tmv-actions, .tmv-receiver-actions {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* TMV发送机主按钮占满整行 */
.tmv-actions .start-tmv-btn {
  grid-column: 1 / -1; /* 占满整行 */
}

/* TMV接收机主按钮占满整行 */
.tmv-receiver-actions .view-tmv-data-btn {
  grid-column: 1 / -1; /* 占满整行 */
}

.start-tmv-btn {
  background: linear-gradient(135deg, #ff9800, #ffc107);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.3s ease;
}

.start-tmv-btn:hover {
  background: linear-gradient(135deg, #f57c00, #ff9800);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

.start-tmv-btn:disabled {
  background: #ccc;
  transform: none;
  box-shadow: none;
}

.view-tmv-data-btn {
  background: linear-gradient(135deg, #2196f3, #03a9f4);
  border: none;
  color: white;
  font-weight: 600;
  transition: all 0.3s ease;
}

.view-tmv-data-btn:hover {
  background: linear-gradient(135deg, #1976d2, #2196f3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
}

.tmv-status-display {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  border-left: 4px solid #ff9800;
}

.tmv-status-display .status-header {
  font-weight: 600;
  color: #ff9800;
  margin-bottom: 8px;
}

.tmv-status-display .status-content {
  color: #e0e7ff;
  font-size: 14px;
  line-height: 1.5;
}
</style>

