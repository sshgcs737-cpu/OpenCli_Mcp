<template>
  <teleport to="body">
    <!-- 上下文菜单容器 -->
    <div v-if="visible && position" class="context-menu-container">
      <!-- 菜单和卡片包装容器 -->
      <div
        ref="menuWrapperRef"
        class="menu-and-card-wrapper"
        :class="{ 'flip-left': cardFlipLeft }"
        :style="{
          top: menuAdjustedY + 'px',
          left: menuAdjustedX + 'px'
        }"  
        @mouseleave="handleWrapperMouseLeave"
      >
        <!-- 上下文菜单 -->
        <div class="node-context-menu" @mousedown.stop>
          <div
            class="context-menu-item"
            @mouseenter="handleBasicInfoHover(true)"
            @mouseleave="handleBasicInfoHover(false)"
          >
            <span class="menu-icon">ℹ</span>
            <span class="menu-text">节点信息</span>
          </div>
          <div
            class="context-menu-item"
            @mouseenter="handleProtocolMenuHover(true)"
            @mouseleave="handleProtocolMenuHover(false)"
          >
            <span class="menu-icon">⚙</span>
            <span class="menu-text">节点操作</span>
          </div>
          <div
            v-if="shouldShowDataManageMenu"
            class="context-menu-item"
            @mouseenter="handleDataManageHover(true)"
            @mouseleave="handleDataManageHover(false)"
            @click="handleDataManagePin"
          >
            <span class="menu-icon">📊</span>
            <span class="menu-text">数据管理</span>
          </div>
              <!-- <div class="history-iface-select" v-if="dockerIfacesList.length > 0">
                <label style="color:#9fb8d9;margin-right:8px;">网卡：</label>
                <select v-model="selectedIface">
                  <option v-for="n in dockerIfacesList" :key="n" :value="n">{{ n }}</option>
                </select>
              </div> -->

          <div v-if="shouldShowHistoryMenu" class="context-menu-item" @mouseenter="handleHistoryHover(true)" @mouseleave="handleHistoryHover(false)">
            <span class="menu-icon">🕘</span>
            <span class="menu-text">历史数据</span>
          </div>
        </div>

        <!-- 历史数据查询卡片 -->
        <div v-if="showHistoryQuery && fullNode" class="history-card" :style="{ transform: cardOffsetY !== 0 ? `translateY(${cardOffsetY}px)` : '' }" @mouseenter="handleHistoryCardEnter">
          <!-- 头部 -->
          <div class="history-header">
            <div class="history-header-left">
              <span class="history-header-icon">&#128202;</span>
              <span class="history-header-title">历史数据查询</span>
              <span class="history-header-node">{{ displayNodeName }}</span>
            </div>
            <button class="history-close-btn" @click="handleCloseHistoryCard" title="关闭">&#10005;</button>
          </div>

          <!-- 查询表单 -->
          <div class="history-form">
            <div class="history-form-row">
              <div class="history-form-field">
                <label>开始</label>
                <el-date-picker
                  v-model="historyStart"
                  type="datetime"
                  placeholder="选择开始时间"
                  :editable="false"
                  format="YYYY/MM/DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  @visible-change="onPickerVisibleChange"
                />
              </div>
              <div class="history-form-field">
                <label>结束</label>
                <el-date-picker
                  v-model="historyEnd"
                  type="datetime"
                  placeholder="选择结束时间"
                  :editable="false"
                  format="YYYY/MM/DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  @visible-change="onPickerVisibleChange"
                />
              </div>
              <button class="history-query-btn" :disabled="historyQueryLoading" @click="handleQueryHistory">
                <span v-if="historyQueryLoading" class="history-btn-spinner"></span>
                {{ historyQueryLoading ? '查询中' : '查询' }}
              </button>
            </div>
          </div>

          <!-- 图表区 -->
          <div class="history-chart-area" @mouseenter="lastHistoryInteractionTime = Date.now()">
            <div v-if="historyChartVisible" class="history-chart-container">
              <div ref="historyChartRef" class="history-chart"></div>
            </div>
            <!-- 空数据占位 -->
            <div v-else-if="historyNoData" class="history-empty">
              <span class="history-empty-icon">&#128196;</span>
              <span>暂无数据，请调整查询时间范围</span>
            </div>
            <!-- 错误状态 -->
            <div v-else-if="historyError" class="history-empty history-error-state">
              <span class="history-empty-icon">&#9888;</span>
              <span>{{ historyError }}</span>
            </div>
          </div>

          <!-- 数据摘要统计 -->
          <div v-if="historySummary" class="history-summary">
            <div class="history-summary-item" v-for="item in historySummary" :key="item.label">
              <div class="history-summary-label">{{ item.label }}</div>
              <div class="history-summary-value" :style="{ color: item.color || '#eaf6ff' }">{{ item.value }}</div>
            </div>
          </div>
        </div>

        <!-- 基本信息悬浮卡片 -->
        <div
          v-if="showBasicInfo && fullNode"
          class="basic-info-card"
          :style="{ transform: cardOffsetY !== 0 ? `translateY(${cardOffsetY}px)` : '' }"
          @mousedown.stop
          @mouseleave="handleBasicInfoCardLeave"
        >
          <!-- 基本信息部分 -->
          <div class="info-section">
            <div class="section-title">基本信息</div>
            <div class="info-row">
              <div class="info-label">ID</div>
              <div class="info-value">{{ fullNode.id }}</div>
            </div>
            <div class="info-row alias-info-row">
              <div class="info-label">名称</div>
              <div class="info-value alias-info-value">
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
            <div class="info-row">
              <div class="info-label">类型</div>
              <div class="info-value">{{ getNodeTypeLabel(fullNode.type) }}</div>
            </div>
            <!-- 下面添加了状态信息 -->
            <div class="info-row">
              <div class="info-label">状态</div>
              <div class="info-value">
                <span :class="['status-badge', isInterferenceNode ? ('status-interference-' + interferenceStatusClass) : ('status-' + (fullNode.status || 'up').toLowerCase())]">
                  {{ isInterferenceNode ? interferenceStatusText : nodeStatusText }}
                </span>
              </div>
            </div>
          </div>

          <!-- 坐标信息部分 -->
          <div class="info-section" v-if="fullNode.geo">
            <div class="section-title">坐标信息</div>
            <div class="location-row">
              <span>{{ geoToXYHText(fullNode.geo.lon, fullNode.geo.lat, fullNode.geo.alt) }}</span>
            </div>
          </div>

          <!-- 子网配置信息（仅EMANE子网节点） -->
          <div class="info-section" v-if="isSubnetNode && subnetKeyConfig">
            <div class="section-title">子网配置</div>
            <div class="info-row">
              <div class="info-label">模型</div>
              <div class="info-value">{{ subnetKeyConfig.model }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.datarate">
              <div class="info-label">数据速率</div>
              <div class="info-value">{{ subnetKeyConfig.datarate }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.delay">
              <div class="info-label">延迟</div>
              <div class="info-value">{{ subnetKeyConfig.delay }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.frequency">
              <div class="info-label">频率</div>
              <div class="info-value">{{ subnetKeyConfig.frequency }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.frequencyOfInterest">
              <div class="info-label">关注频率</div>
              <div class="info-value">{{ subnetKeyConfig.frequencyOfInterest }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.bandwidth">
              <div class="info-label">带宽</div>
              <div class="info-value">{{ subnetKeyConfig.bandwidth }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.noiseFigure">
              <div class="info-label">噪声系数</div>
              <div class="info-value">{{ subnetKeyConfig.noiseFigure }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.dopplerShiftEnabled">
              <div class="info-label">多普勒频移</div>
              <div class="info-value">{{ subnetKeyConfig.dopplerShiftEnabled }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.txpower">
              <div class="info-label">发射功率</div>
              <div class="info-value">{{ subnetKeyConfig.txpower }}</div>
            </div>
            <div class="info-row" v-if="subnetKeyConfig.propagation">
              <div class="info-label">传播模型</div>
              <div class="info-value">{{ subnetKeyConfig.propagation }}</div>
            </div>
          </div>

          <!-- 干扰参数部分（仅干扰节点） -->
          <div class="info-section" v-if="isInterferenceNode">
            <div class="section-title">干扰参数</div>
            <div class="info-row">
              <div class="info-label">干扰功率</div>
              <div class="info-value">{{ interferenceNodeConfig?.interferePowerdb ? `${interferenceNodeConfig.interferePowerdb} dB` : '未配置' }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">干扰频率</div>
              <div class="info-value">{{ interferenceNodeConfig?.interfereFreq ? `${interferenceNodeConfig.interfereFreq} MHz` : '未配置' }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">方位角</div>
              <div class="info-value">{{ interferenceNodeConfig?.azimuth ? `${interferenceNodeConfig.azimuth}°` : '未配置' }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">俯仰角</div>
              <div class="info-value">{{ interferenceNodeConfig?.elevation ? `${interferenceNodeConfig.elevation}°` : '未配置' }}</div>
            </div>
            <div class="info-row">
              <div class="info-label">干扰开关</div>
              <div class="info-value">
                <span :class="['status-badge', interferenceNodeConfig?.status === 'RUNTIME' ? 'status-interference-active' : 'status-interference-inactive']">
                  {{ interferenceNodeConfig?.status === 'RUNTIME' ? '已开启' : '未开启' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 虚拟机模板信息部分 -->
          <div class="info-section" v-if="isVMNode && vmTemplateInfo">
            <div class="section-title">模板信息</div>
            <div class="vm-template-grid">
              <div class="vm-template-item">
                <div class="item-label">模板名称</div>
                <div class="item-value">{{ vmTemplateInfo.name }}</div>
              </div>
              <div class="vm-template-item">
                <div class="item-label">模板描述</div>
                <div class="item-value">{{ vmTemplateInfo.description }}</div>
              </div>
              <div class="vm-template-item">
                <div class="item-label">CPU核数</div>
                <div class="item-value">{{ vmTemplateInfo.vcpu }}核</div>
              </div>
              <div class="vm-template-item">
                <div class="item-label">内存大小</div>
                <div class="item-value">{{ formatMemory(vmTemplateInfo.memory) }}</div>
              </div>
              <div class="vm-template-item">
                <div class="item-label">当前内存</div>
                <div class="item-value">{{ formatMemory(vmTemplateInfo.curMemory) }}</div>
              </div>
              <div class="vm-template-item">
                <div class="item-label">磁盘文件</div>
                <div class="item-value">{{ vmTemplateInfo.disk }}</div>
              </div>
              <div class="vm-template-item full-width">
                <div class="item-label">镜像位置</div>
                <div class="item-value">{{ vmTemplateInfo.location }}</div>
              </div>
            </div>
          </div>

          <!-- 协议信息部分 -->
          <div class="info-section" v-if="canShowProtocol">
            <div class="section-title">路由协议信息</div>
            <div v-if="fullNode?.config_services && fullNode.config_services.filter((p: string) => p !== 'zebra').length > 0" class="protocol-list">
              <div v-for="protocol in fullNode.config_services.filter((p: string) => p !== 'zebra')" :key="protocol" class="protocol-item">
                <span class="protocol-badge">{{ getProtocolLabel(protocol) }}</span>
              </div>
            </div>
            <div v-else class="no-protocol">
              <div class="no-protocol-text">未配置协议</div>
            </div>
          </div>
        </div>

        <!-- 节点操作悬浮卡片 -->
        <div
          v-if="showProtocolInfo && fullNode"
          class="operation-card"
          :style="{ transform: cardOffsetY !== 0 ? `translateY(${cardOffsetY}px)` : '' }"
          @mouseleave="handleProtocolInfoCardLeave"
        >
          <!-- 故障设置部分（仅普通节点：排除子网、虚拟机、业务终端、TMV、干扰） -->
          <div class="operation-section" v-if="!isSubnetNode && !isVMNode  && !isInterferenceNode">
            <div class="section-title">
              <svg width="16" height="16" style="margin-right: 4px; vertical-align: middle;">
                <circle cx="8" cy="8" r="7" fill="#ff5252" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="4" fill="#ff5252" fill-opacity="0.38" />
              </svg>故障设置
            </div>
            <div class="fault-config">
              <div class="fault-item">
                <div class="fault-label">故障状态</div>
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

          <!-- 操作按钮部分 -->
          <div class="operation-section operation-buttons-section">
            <div class="section-title">
              <svg width="16" height="16" style="margin-right: 4px; vertical-align: middle;">
                <path d="M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8z" fill="#00d4ff" fill-opacity="0.18" />
                <circle cx="8" cy="8" r="2" fill="#00d4ff" fill-opacity="0.38" />
              </svg>操作功能
            </div>
            <div class="operation-buttons-group">
              <!-- 信号级仿真（无人机类节点） -->
              <button
                v-if="isUAVNode"
                class="operation-btn signal-btn"
                @click="handleOpenSignalSimDialog"
                title="信号级仿真"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                信号级仿真
              </button>

              <!-- 打开终端（路由器/DOCKER节点和无人机类节点） -->
              <button
                v-if="canOpenTerminal"
                class="operation-btn terminal-btn"
                @click="handleOpenTerminal"
                title="打开终端"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
                打开终端
              </button>

              <!-- 虚拟机操作 -->
              <button 
                v-if="isVMNode"
                class="operation-btn vm-start-btn"
                @click="handleStartVM"
                title="启动虚拟机"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                </svg>
                启动虚拟机
              </button>

              <!-- 虚拟机关闭按钮 -->
              <button 
                v-if="isVMNode"
                class="operation-btn vm-stop-btn"
                @click="handleStopVM"
                title="关闭虚拟机"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"></path>
                </svg>
                关闭虚拟机
              </button>

              <!-- 虚拟机参数编辑 -->
              <button 
                v-if="isVMNode"
                class="operation-btn vm-edit-btn"
                @click="handleEditVMParams"
                title="编辑参数"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                编辑参数
              </button>

              <!-- 协议配置（仅真正的路由器节点：DOCKER + nest:v3） -->
              <button
                v-if="isRealRouterNode"
                class="operation-btn protocol-btn"
                @click="handleOpenProtocolConfig"
                title="协议配置"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <path d="M12 1v6m0 6v4M4.22 4.22l4.24 4.24m5.08 0l4.24-4.24M1 12h6m6 0h4M4.22 19.78l4.24-4.24m5.08 0l4.24 4.24"></path>
                </svg>
                协议配置
              </button>

              <!-- 静态路由配置（仅其他DOCKER节点：DOCKER + 非nest:v3） -->
              <button
                v-if="isOtherDockerNode"
                class="operation-btn static-route-btn"
                @click="handleOpenStaticRouteConfig"
                title="静态路由配置"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                  <path d="M8 8l-3-3-3 3M16 16l3 3 3-3"></path>
                </svg>
                静态路由
              </button>

              <!-- 子网参数修改（仅子网/EMANE节点） -->
              <button
                v-if="isSubnetNode"
                class="operation-btn subnet-config-btn"
                @click="handleModifySubnetParams"
                title="修改子网参数"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
                修改参数
              </button>

              <!-- 时隙配置（仅TDMA子网） -->
              <button
                v-if="isSubnetNode && isSubnetTDMA"
                class="operation-btn slot-config-btn"
                @click="handleOpenSlotConfig"
                title="时隙配置"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                时隙配置
              </button>

              <!-- 配置干扰参数（仅干扰节点） -->
              <button
                v-if="isInterferenceNode"
                class="operation-btn interference-config-btn"
                @click="handleConfigInterference"
                title="配置干扰参数"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                配置干扰参数
              </button>

              <!-- 干扰功率调节滑动条（仅干扰节点且已配置） -->
              <div v-if="isInterferenceNode && interferenceNodeConfig?.interferePowerdb" class="power-slider-section">
                <div class="power-slider-header">
                  <span class="power-slider-label">干扰功率</span>
                  <span class="power-slider-value">{{ localPowerValue.toFixed(1) }} dB</span>
                </div>
                <div class="power-slider-container">
                  <el-slider
                    v-model="localPowerValue"
                    :min="0"
                    :max="100"
                    :step="0.1"
                    :show-tooltip="true"
                    @input="handlePowerSliderInput"
                    @change="handlePowerSliderChange"
                  />
                </div>
              </div>

              <!-- 删除节点 -->
              <button 
                class="operation-btn delete-btn"
                @click="handleDelete"
                title="删除节点"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                删除节点
              </button>

              <!-- 更改无线参数 -->
               <button
                v-if="isUAVNode"
                class="operation-btn wireless-config-btn"
                @click="handleOpenWirelessConfig"
                title="更改无线参数"
                >
              <svg t="1776761899223" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" 
               p-id="8272" width="200" height="200">
               <path d="M746.666667 725.333333c59.733333-12.8 106.666667-64 106.666666-128 0-72.533333-55.466667-128-128-128-17.066667 
               0-29.866667 4.266667-42.666666 8.533334V469.333333c0-93.866667-76.8-170.666667-170.666667-170.666666s-170.666667 76.8-170.666667 170.666666c0 17.066667 4.266667 29.866667 4.266667 46.933334-8.533333-4.266667-17.066667-4.266667-25.6-4.266667C260.266667 512 213.333333 558.933333 213.333333 618.666667S260.266667 725.333333 320 725.333333h426.666667z m0 85.333334h-426.666667C213.333333 810.666667 128 725.333333 128
                618.666667c0-85.333333 55.466667-157.866667 128-183.466667C273.066667 311.466667 379.733333 213.333333 
                512 213.333333c110.933333 0 209.066667 72.533333 243.2 170.666667 102.4 12.8 183.466667 102.4 183.466667 213.333333s-85.333333
                 200.533333-192 213.333334z" fill="#3defee" p-id="8273"></path>
                </svg>
                更改无线参数
              </button>
            </div>
          </div>
        </div>

        <!-- 数据管理悬浮卡片已移至独立区域 -->
      </div>
    </div>

    <!-- 历史数据查询卡片（右侧悬浮卡，已移入包装容器） -->

    <!-- 独立的数据管理悬浮卡片（不随菜单关闭而关闭） -->
    <div
      v-if="showDataManage && dataManageNode"
      class="data-manage-card"
      ref="dataManageCardRef"
      :style="{ left: dmDragOffsetX + 'px', top: dmDragOffsetY + 'px' }"
      @mousedown.stop
      @mouseleave="handleDataManageCardLeave"
    >
      <div class="data-manage-section">
        <div class="data-manage-header">
          <div class="section-title">数据管理 - {{ dataManageNode.alias || stripSessionSuffix(dataManageNode.name || '') }}</div>
          <button class="history-close-btn" @click="showDataManage = false; dataManagePinned = false" title="关闭">&#10005;</button>
        </div>

        <!-- 有EMANE数据时显示节点自身指标 -->
        <template v-if="nodeHasEmaneData && nodeEmaneData.some(d => d.hasData)">
          <div v-for="item in nodeEmaneData" :key="item.nemId" class="emane-node-block">
            <div class="emane-header">
              <span class="emane-label">{{ item.iface }}</span>
              <span class="emane-nem-tag">NEM {{ item.nemId }}</span>
            </div>
            <template v-if="item.hasData">
              <div v-for="neighbor in item.neighbors" :key="neighbor.neighborNem" class="emane-neighbor-block">
                <div class="emane-neighbor-header">
                  <span class="emane-neighbor-name">{{ neighbor.neighborName }}</span>
                  <span class="emane-nem-tag small">NEM {{ neighbor.neighborNem }}</span>
                </div>
              <!-- NeighborMetricTable -->
              <div v-if="neighbor.metric" class="emane-table-section">
                <div class="emane-table-title">相邻节点指标表</div>
                <div class="emane-metrics-grid">
                  <div class="emane-metric-item"><span class="metric-label">接收包</span><span class="metric-value">{{ neighbor.metric.rxPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">发送包</span><span class="metric-value">{{ neighbor.metric.txPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">丢包</span><span class="metric-value" :class="{ 'value-warn': neighbor.metric.missedPkts !== null && neighbor.metric.missedPkts > 0 }">{{ neighbor.metric.missedPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">带宽利用率</span><span class="metric-value">{{ neighbor.metric.bwUtil !== null ? neighbor.metric.bwUtil.toFixed(2) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">平均接收速率</span><span class="metric-value">{{ neighbor.metric.rxRateAvg !== null ? neighbor.metric.rxRateAvg.toFixed(1) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">平均发送速率</span><span class="metric-value">{{ neighbor.metric.txRateAvg !== null ? neighbor.metric.txRateAvg.toFixed(1) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">最后接收</span><span class="metric-value">{{ neighbor.metric.lastRx !== null ? neighbor.metric.lastRx.toFixed(1)  : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">最后发送</span><span class="metric-value">{{ neighbor.metric.lastTx !== null ? neighbor.metric.lastTx.toFixed(1) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">SINR标准差</span><span class="metric-value">{{ neighbor.metric.sinrStdv !== null ? neighbor.metric.sinrStdv.toFixed(2) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">底噪均值</span><span class="metric-value">{{ neighbor.metric.nfAvg !== null ? neighbor.metric.nfAvg.toFixed(1) + ' dBm' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">底噪标准差</span><span class="metric-value">{{ neighbor.metric.nfStdv !== null ? neighbor.metric.nfStdv.toFixed(2) : '-' }}</span></div>
                </div>
              </div>
              <!-- NeighborStatusTable -->
              <div v-if="neighbor.status" class="emane-table-section">
                <div class="emane-table-title">相邻节点状态表</div>
                <div class="emane-metrics-grid">
                  <div class="emane-metric-item"><span class="metric-label">SINR均值</span><span class="metric-value" :class="{ 'value-warn': neighbor.status.sinrAvg !== null && neighbor.status.sinrAvg < 10 }">{{ neighbor.status.sinrAvg !== null ? neighbor.status.sinrAvg.toFixed(1) + ' dB' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">底噪均值</span><span class="metric-value">{{ neighbor.status.nfAvg !== null ? neighbor.status.nfAvg.toFixed(1) + ' dBm' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">接收包</span><span class="metric-value">{{ neighbor.status.rxPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">发送包</span><span class="metric-value">{{ neighbor.status.txPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">丢包</span><span class="metric-value" :class="{ 'value-warn': neighbor.status.missedPkts !== null && neighbor.status.missedPkts > 0 }">{{ neighbor.status.missedPkts ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">带宽利用率比</span><span class="metric-value">{{ neighbor.status.bwUtilRatio !== null ? neighbor.status.bwUtilRatio.toFixed(2) : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">接收老化</span><span class="metric-value">{{ neighbor.status.rxRAge !== null ? neighbor.status.rxRAge.toFixed(1) + ' s' : '-' }}</span></div>
                </div>
              </div>
              <!-- RFSignalTable -->
              <div v-if="neighbor.rfSignal" class="emane-table-section">
                <div class="emane-table-title">RF信号表</div>
                <div class="emane-metrics-grid">
                  <div class="emane-metric-item"><span class="metric-label">平均SINR</span><span class="metric-value" :class="{ 'value-warn': neighbor.rfSignal.avgSINR !== null && neighbor.rfSignal.avgSINR < 10 }">{{ neighbor.rfSignal.avgSINR !== null ? neighbor.rfSignal.avgSINR.toFixed(1) + ' dB' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">接收功率</span><span class="metric-value">{{ neighbor.rfSignal.avgRxPower !== null ? neighbor.rfSignal.avgRxPower.toFixed(1) + ' dBm' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">底噪</span><span class="metric-value">{{ neighbor.rfSignal.avgNoiseFloor !== null ? neighbor.rfSignal.avgNoiseFloor.toFixed(1) + ' dBm' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">平均INR</span><span class="metric-value">{{ neighbor.rfSignal.avgINR !== null ? neighbor.rfSignal.avgINR.toFixed(1) + ' dB' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">天线ID</span><span class="metric-value">{{ neighbor.rfSignal.antennaId ?? '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">频率</span><span class="metric-value">{{ neighbor.rfSignal.frequencyHz !== null ? (neighbor.rfSignal.frequencyHz / 1e6).toFixed(2) + ' MHz' : '-' }}</span></div>
                  <div class="emane-metric-item"><span class="metric-label">样本数</span><span class="metric-value">{{ neighbor.rfSignal.numSamples ?? '-' }}</span></div>
                </div>
              </div>
              </div>
            </template>
            <div v-else class="emane-no-data">暂无数据</div>
          </div>
          <div v-if="emaneLastUpdated" class="emane-update-time">
            更新于 {{ formatEmaneTime(emaneLastUpdated) }}
          </div>
        </template>

        <!-- EMANE节点但暂无数据 -->
        <div v-else-if="nodeNemIds.length > 0" class="data-manage-placeholder">
          <div class="placeholder-text">暂无EMANE数据，等待更新...</div>
        </div>

        <!-- 非EMANE节点：展示被动测量(iface)数据 -->
        <template v-else>
          <template v-if="dataManageNode && passiveMeasurements.get(dataManageNode.id) && passiveMeasurements.get(dataManageNode.id).iface && passiveMeasurements.get(dataManageNode.id).iface.length">
            <div v-for="(iface, idx) in passiveMeasurements.get(dataManageNode.id).iface.filter((i: any) => i.name && i.name.startsWith('eth'))" :key="iface.name + '_' + idx" class="iface-block">
              <div class="iface-header">
                <span class="iface-name">{{ iface.name || ('iface' + iface.id) }}</span>
                <span class="iface-id">ID: {{ iface.id }}</span>
              </div>
              <div class="iface-grid">
                <div class="iface-item">发送包: <strong>{{ iface.txPackages || '-' }}</strong></div>
                <div class="iface-item">发送字节: <strong>{{ iface.txBytes || '-' }}</strong></div>
                <div class="iface-item">接收包: <strong>{{ iface.rxPackages || '-' }}</strong></div>
                <div class="iface-item">接收字节: <strong>{{ iface.rxBytes || '-' }}</strong></div>
              </div>
            </div>
            <div v-if="passiveMeasurements.get(dataManageNode.id).updatedAt" class="passive-update-time">更新于 {{ new Date(passiveMeasurements.get(dataManageNode.id).updatedAt).toLocaleTimeString() }}</div>
          </template>
          <div v-else class="data-manage-placeholder">
            <div class="placeholder-text">该节点无可用数据</div>
          </div>
        </template>
      </div>
    </div>

    <!-- 半透明背景，用于关闭菜单 -->
    <div
      v-if="visible"
      class="context-menu-backdrop"
      @click="handleBackdropClick"
      @contextmenu.prevent="handleBackdropClick"
    ></div>

    <!-- VM参数编辑对话框 -->
    <VMEditDialog
      v-model:visible="showVMEditDialog"
      :nodeId="fullNode?.id || 0"
      :sessionId="topoStore.currentSessionId ?? topoStore.topoData?.id"
      :templateId="vmTemplateInfo?.id || 1"
      :templateName="vmTemplateInfo?.name || 'Unknown'"
      :initialData="vmEditData"
      @confirm="handleVMEditConfirm"
    />
    <!-- 协议配置对话框 -->
    <protocolConfigDialog
      v-if="showProtocolConfigDialog"
      :visible="showProtocolConfigDialog"
      :protocol="''"
      :interfaces="nodeInterfaces"
      :nodeName="fullNode?.name || ''"
      :nodeType="fullNode?.type"
      :nodeImage="fullNode?.image"
      @close="showProtocolConfigDialog = false"
      @save="handleProtocolSave"
    />
    <!-- 静态路由配置对话框（复用protocolConfigDialog，非无线设备） -->
    <protocolConfigDialog
      v-if="showStaticRouteDialog"
      :visible="showStaticRouteDialog"
      :protocol="''"
      :interfaces="nodeInterfaces"
      :nodeName="fullNode?.name || ''"
      :nodeType="fullNode?.type || 'OTHER'"
      :nodeImage="''"
      @close="showStaticRouteDialog = false"
      @save="handleStaticRouteSave"
    />

    <!-- 节点无线参数修改对话框 -->
    <WirelessConfigDialog
      v-if="showWirelessConfigDialog"
      :visible="showWirelessConfigDialog"
      :initialData="wirelessConfigData"
      :isEditMode="true"
      @close="handleWirelessConfigClose"
      @confirm="handleWirelessConfigSave"
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
      :subnetId="fullNode?.id || 0"
      :initialConfig="slotConfig"
      @close="handleSlotConfigClose"
      @confirm="handleSlotConfigConfirm"
    />
    <!-- 干扰参数配置对话框 -->
    <InterferenceConfigDialog
      v-model:visible="showInterferenceConfigDialog"
      :node-id="fullNode?.id"
      :interference-params="interferenceDialogParams"
      @confirm="handleInterferenceConfigConfirm"
    />
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useDraggable } from '../../../composables/useDraggable';
import { useTopoStore } from '../../../store/modules/topo';
import { geoToXYHText } from '../../../utils/coordTransform';
import { useVMTemplateStore } from '../../../store/modules/vmTemplate';
import { ElMessage, ElMessageBox } from 'element-plus';
import WirelessConfigDialog from './WirelessConfigDialog.vue';
import type { Node } from '../../../types/topo';
import { startVMNode, stopVMNode } from '../../../api/node';
import { getUserInfo } from '../../../store/user';
import VMEditDialog from './VMEditDialog.vue';
import protocolConfigDialog from './protocolConfigDialog.vue';
import SubnetConfigDialog from './SubnetConfigDialog.vue';

import SlotConfigDialog from './SlotConfigDialog.vue';
import InterferenceConfigDialog from './InterferenceConfigDialog.vue';
import { useInterferenceStore } from '../../../store/modules/interference';
import { useEmaneStore } from '../../../store/modules/emane';
import { useNemIdStore } from '../../../store/modules/nemId';
import eventBus from '../../../utils/eventBus';
import type { InterferenceNodeData } from '../../../api/inode';
import { editInterferenceNode } from '../../../api/inode';
import { getHistoryData } from '../../../api/historyData';
import { getAllProtocols } from '../../../api/protocol';
import * as echarts from 'echarts';

// 节点上下文菜单组件属性定义
interface NodeContextMenuProps {
  visible: boolean;
  node: any;
  position: { x: number; y: number } | null;
}

// 定义属性
const props = withDefaults(defineProps<NodeContextMenuProps>(), {
  visible: false,// 是否显示上下文菜单
  node: null,// 当前操作的节点
  position: null// 菜单显示位置
});

// 定义事件 让父组件监听事件 修改节点状态
const emit = defineEmits<{
  close: [];// 关闭上下文菜单
  selectMenu: [menu: string];// 选择菜单项
  openTerminal: [node: Node | null];// 打开终端
  openSignalSim: [node: Node | null];// 打开信号级仿真对话框
  openVnc: [data: {nodeId: any; nodeName: string; wsUrl: string}];// 打开VNC连接
}>();

const topoStore = useTopoStore();
const vmTemplateStore = useVMTemplateStore();
const interferenceStore = useInterferenceStore();
const emaneStore = useEmaneStore();
const nemIdStore = useNemIdStore();
const currentView = ref<'menu' | 'protocolInfo' | 'dataManage'>('menu');

// 数据管理卡片拖拽
const dataManageCardRef = ref<HTMLElement | null>(null);
const { offsetX: dmDragOffsetX, offsetY: dmDragOffsetY } = useDraggable(
  dataManageCardRef,
  '.data-manage-header'
);
// 数据管理卡片持久化的节点数据（菜单关闭后仍保留）
const dataManageNode = ref<Node | null>(null);
const showBasicInfo = ref(false); // 是否显示基本信息卡片
const showProtocolInfo = ref(false); // 是否显示协议信息卡片
const showDataManage = ref(false); // 是否显示数据管理卡片
const dataManagePinned = ref(false); // 数据管理卡片是否被点击固定
const showVMEditDialog = ref(false); // 是否显示虚拟机参数编辑对话框
const showProtocolConfigDialog = ref(false); // 是否显示协议配置对话框
const showStaticRouteDialog = ref(false); // 是否显示静态路由配置对话框
const showSubnetConfigDialog = ref(false); // 是否显示子网参数修改对话框
const showSlotConfigDialog = ref(false); // 是否显示时隙配置对话框
const showInterferenceConfigDialog = ref(false); // 是否显示干扰参数配置对话框
const showWirelessConfigDialog = ref(false); // 是否显示无线参数配置对话框
const wirelessConfigData = ref<any>({}); // 无线参数配置数据
const nodeInterfaces = ref<string[]>([]); // 节点接口列表
const menuWrapperRef = ref<HTMLElement | null>(null); // 菜单包装容器ref
const cardOffsetY = ref(0); // 卡片垂直偏移量（防止超出屏幕）
const cardFlipLeft = ref(false); // 卡片是否翻转到菜单左侧（防止超出屏幕右侧）
const menuAdjustedY = ref(0); // 父菜单调整后的Y坐标
const menuAdjustedX = ref(0); // 父菜单调整后的X坐标

const vmEditData = ref<any>({
  cpu: 1,
  memory: '1048576',
  currentMemory: '1048576',
  templateId: 1
});
const isEditingAlias = ref(false);
const isAliasSaving = ref(false);
const editableAlias = ref('');

// 故障配置状态
const faultConfig = ref({
  enabled: false
});

// 记录当前显示的节点ID，用于检测节点切换
const currentNodeId = ref<number | null>(null);

// 本地节点副本，用于实时显示状态变化
const localNodeData = ref<Node | null>(null);

// 直接使用传入的node，它已经是topoStore中查找到的完整节点数据
const fullNode = computed((): Node | null => {
  return localNodeData.value || props.node || null;
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
  if (!fullNode.value) return '';
  return fullNode.value.alias || stripSessionSuffix(fullNode.value.name || '');
});

// 监听props.node变化，同步本地节点副本
watch(() => props.node, (newNode) => {
  if (newNode) {
    localNodeData.value = { ...newNode };
  }
}, { immediate: true });

watch(
  () => [fullNode.value?.id, fullNode.value?.alias, fullNode.value?.name],
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
  if (!canEditNodeAlias.value || !fullNode.value) {
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
  if (!fullNode.value?.id || isAliasSaving.value) {
    return;
  }

  const trimmedAlias = editableAlias.value.trim();
  if (!trimmedAlias) {
    ElMessage.warning('节点名不能为空');
    return;
  }

  const duplicateAlias = topoStore.topoData?.nodes?.some((node: Node) => {
    if (node.id === fullNode.value?.id) {
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
    const normalizedRole = normalizeRoleForEdit(fullNode.value.role);
    const updatedNodeData = {
      ...fullNode.value,
      alias: trimmedAlias,
      ...(normalizedRole !== undefined ? { role: normalizedRole } : {})
    };

    await (topoStore as any).editNodeRemote(updatedNodeData);

    if (localNodeData.value && localNodeData.value.id === fullNode.value.id) {
      localNodeData.value = {
        ...localNodeData.value,
        alias: trimmedAlias
      };
    }

    if (props.node && props.node.id === fullNode.value.id) {
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

// 监听showBasicInfo变化，当显示基本信息卡片时，从后端获取协议配置并更新 config_services
watch(showBasicInfo, async (newVal) => {
  if (newVal && fullNode.value && isRealRouterNode.value) {
    try {
      const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
      if (!sessionId || !fullNode.value.name) return;
      const containerName = `${fullNode.value.name}-${sessionId}`;
      const protocolData = await getAllProtocols(sessionId, containerName, false);
      if (protocolData && typeof protocolData === 'object') {
        const services: string[] = [];
        if (protocolData.protocolOspf2 === 'on') services.push('OSPFv2');
        if (protocolData.protocolOspf3 === 'on') services.push('OSPFv3');
        if (protocolData.protocolRip === 'on') services.push('RIP');
        if (protocolData.protocolIsis === 'on') services.push('IS-IS');
        if (protocolData.protocolPim === 'on') services.push('PIM');
        if (protocolData.protocolBgp === 'on') services.push('BGP');
        if (protocolData.protocolSnapshot === 'on') services.push('Snapshot');
        if (protocolData.protocolBackpressure === 'on') services.push('Backpressure');
        if (services.length > 0) services.unshift('zebra');
        // 更新本地节点副本
        if (localNodeData.value) {
          localNodeData.value = { ...localNodeData.value, config_services: services };
        }
        // 同步到 topoStore
        const storeNode = topoStore.topoData?.nodes?.find((n: any) => n.id === fullNode.value?.id);
        if (storeNode) {
          storeNode.config_services = services;
        }
      }
    } catch (e) {
      // 获取协议信息失败时不影响基本信息卡片显示
    }
  }
});

// 监听showProtocolInfo变化，仅在节点切换时才初始化故障状态
watch(showProtocolInfo, (newVal) => {
  if (newVal && fullNode.value) {
    // 检测节点是否改变
    if (fullNode.value.id !== currentNodeId.value) {
      // 节点切换了，初始化故障配置
      currentNodeId.value = fullNode.value.id;
      faultConfig.value.enabled = fullNode.value.status === 'DOWN';
    }
  }
});

// 判断是否为无人机节点（包括机动车和卫星） —— 用于信号级仿真按钮
const isUAVNode = computed(() => {
  if (!fullNode.value) return false;
  const nodeType = getNodeTypeLabel(fullNode.value.type || '');
  const nodeName = fullNode.value.name || '';
  return nodeType === '无人机' ||
         nodeType === '机动车' ||
         nodeType === '卫星' ||
         nodeName.startsWith('DRONE') ||
         nodeName.startsWith('VAN') ||
         nodeName.startsWith('SATELLITE') ||
         nodeName.startsWith('BASESTATION');
});

// 判断是否为真正的路由器节点（DOCKER类型且镜像为nest:v3）—— 用于协议配置
const isRealRouterNode = computed(() => {
  if (!fullNode.value) return false;
  const actualType = fullNode.value.type || '';
  const image = fullNode.value.image || '';
  const nodeType = getNodeTypeLabel(fullNode.value.type || '');
  const nodeName = fullNode.value.name || '';

  if (actualType === 'DOCKER' && image === 'nest:v3') {
    return true;
  }
  return nodeType === '路由器' ||
         nodeName.startsWith('ROUTER') ||
         nodeName.startsWith('路由器');
});

// 判断是否为其他DOCKER节点（非nest:v3镜像的DOCKER节点）—— 用于静态路由
const isOtherDockerNode = computed(() => {
  if (!fullNode.value) return false;
  const actualType = fullNode.value.type || '';
  const image = fullNode.value.image || '';
  return actualType === 'DOCKER' && image !== 'nest:v3';
});

// 判断是否为路由器节点（包含所有DOCKER节点，用于终端功能等）
const isRouterNode = computed(() => {
  if (!fullNode.value) return false;
  const nodeType = getNodeTypeLabel(fullNode.value.type || '');
  const nodeName = fullNode.value.name || '';
  const actualType = fullNode.value.type || '';
  return nodeType === '路由器' ||
         nodeName.startsWith('ROUTER') ||
         nodeName.startsWith('路由器') ||
         actualType === 'DOCKER';
});

// 判断是否为虚拟机
const isVMNode = computed(() => {
  if (!fullNode.value) return false;
  const nodeType = fullNode.value.type || '';
  const nodeName = fullNode.value.name || '';
  return nodeType === 'VMNODE' || nodeType === 'SERVER' || nodeName.startsWith('虚拟机');
});

// 判断是否为半实物节点
const isHalfPhysicalNode = computed(() => {
  if (!fullNode.value) return false;
  const nodeType = fullNode.value.type || '';
  const nodeName = fullNode.value.name || '';
  return nodeType === 'RJ45' || ['ens52f0', 'ens52f1', 'ens52f2', 'ens52f3'].includes(nodeName);
});

// 判断是否为交换机/控制器类节点（OVS/P4/SDN等底层type为DOCKER，需通过name和image辅助判断）
const isSwitchLikeNode = computed(() => {
  if (!fullNode.value) return false;
  const nodeType = fullNode.value.type || '';
  const nodeName = fullNode.value.name || '';
  const nodeImage = fullNode.value.image || '';

  if (['SWITCH', 'Ovs_SWITCH', 'P4_SWITCH', 'SR_SWITCH', 'SDN_CONTROLLER'].includes(nodeType)) {
    return true;
  }

  if (nodeName.includes('Ovs_SWITCH') || nodeName.startsWith('Ovs交换机')) return true;
  if (nodeName.includes('P4') || nodeName.startsWith('P4交换机')) return true;
  if (nodeName.includes('SR_SWITCH') || nodeName.startsWith('SR交换机')) return true;
  if (nodeName.includes('SDN_CONTROLLER') || nodeName.startsWith('SDN控制器')) return true;

  if (nodeImage === 'sdn:v1.1' || nodeImage === 'p4lang/bm-4c:v1.0') return true;

  return false;
});

// 判断是否为BUSINESS_Transmitter节点
const isBusinessTransmitterNode = computed(() => {
  return fullNode.value?.image === 'data:v1';
});

// 判断是否为TMV节点
const isTMVNode = computed(() => {
  return fullNode.value?.image === 'tmv:v1';
});

// 判断是否为干扰节点（INODE）
const isInterferenceNode = computed(() => {
  if (!fullNode.value) return false;
  return fullNode.value.type === 'INODE';
});

const canEditNodeAlias = computed(() => {
  return Boolean(fullNode.value?.id) && !isVMNode.value && !isInterferenceNode.value;
});

// 干扰节点配置（从interferenceStore获取）
const interferenceNodeConfig = computed<InterferenceNodeData | null>(() => {
  if (!fullNode.value || !isInterferenceNode.value) return null;
  return interferenceStore.getConfigByNodeId(fullNode.value.id) || null;
});

// 干扰状态文本
const interferenceStatusText = computed(() => {
  if (!interferenceNodeConfig.value) return '未知状态';
  switch (interferenceNodeConfig.value.status) {
    case 'INSTANTIATION': return '未配置';
    case 'DEFINITION': return '已配置';
    case 'RUNTIME': return '干扰中';
    case 'SHUTDOWN': return '已关闭';
    default: return '未知状态';
  }
});

// 干扰状态CSS类名
const interferenceStatusClass = computed(() => {
  if (!interferenceNodeConfig.value) return 'inactive';
  switch (interferenceNodeConfig.value.status) {
    case 'INSTANTIATION': return 'inactive';
    case 'DEFINITION': return 'configured';
    case 'RUNTIME': return 'active';
    case 'SHUTDOWN': return 'shutdown';
    default: return 'inactive';
  }
});

// 干扰配置对话框参数
const interferenceDialogParams = computed(() => {
  if (!interferenceNodeConfig.value) return {
    interferePowerdb: 50,
    interfereFreq: 2400,
    azimuth: '0,360',
    elevation: '-90,90'
  };
  return {
    interferePowerdb: interferenceNodeConfig.value.interferePowerdb
      ? parseInt(interferenceNodeConfig.value.interferePowerdb) : 50,
    interfereFreq: interferenceNodeConfig.value.interfereFreq
      ? parseInt(interferenceNodeConfig.value.interfereFreq) : 2400,
    azimuth: interferenceNodeConfig.value.azimuth || '0,360',
    elevation: interferenceNodeConfig.value.elevation || '-90,90'
  };
});

// ===== 干扰功率滑动条相关 =====
const localPowerValue = ref<number>(50);
let powerUpdateTimer: number | null = null;
let lastPowerUpdateTime = 0;

// 监听干扰配置变化，同步本地功率值
watch(() => interferenceNodeConfig.value?.interferePowerdb, (newPower) => {
  if (newPower !== null && newPower !== undefined && newPower !== '') {
    localPowerValue.value = Number(newPower);
  }
}, { immediate: true });

const handlePowerSliderInput = (value: number) => {
  localPowerValue.value = value;
  if (powerUpdateTimer !== null) {
    clearTimeout(powerUpdateTimer);
  }
  const now = Date.now();
  const timeSinceLastUpdate = now - lastPowerUpdateTime;
  if (timeSinceLastUpdate >= 1000) {
    sendPowerUpdateRequest(value);
    lastPowerUpdateTime = now;
  } else {
    const remainingTime = 1000 - timeSinceLastUpdate;
    powerUpdateTimer = window.setTimeout(() => {
      sendPowerUpdateRequest(value);
      lastPowerUpdateTime = Date.now();
    }, remainingTime);
  }
};

const handlePowerSliderChange = (value: number) => {
  if (powerUpdateTimer !== null) {
    clearTimeout(powerUpdateTimer);
  }
  sendPowerUpdateRequest(value);
  lastPowerUpdateTime = Date.now();
};

const sendPowerUpdateRequest = async (value: number) => {
  if (!props.node || !interferenceNodeConfig.value) return;
  const sessionId = topoStore.currentSessionId;
  if (!sessionId) {
    ElMessage.error('当前会话ID不存在');
    return;
  }
  const userInfo = getUserInfo();
  try {
    await editInterferenceNode({
      sessionId: Number(sessionId),
      nodeId: props.node.id,
      lat: props.node.geo.lat.toString(),
      lon: props.node.geo.lon.toString(),
      alt: props.node.geo.alt.toString(),
      interferePowerdb: value.toString(),
      interfereFreq: interferenceNodeConfig.value.interfereFreq || '',
      azimuth: interferenceNodeConfig.value.azimuth || '',
      elevation: interferenceNodeConfig.value.elevation || '',
      userId: userInfo.id
    });
    interferenceStore.updateInterferenceConfig({
      ...interferenceNodeConfig.value,
      interferePowerdb: value.toString()
    });
  } catch (error: any) {
    console.error('更新干扰功率失败:', error);
    ElMessage.error(error?.message || '更新干扰功率失败');
    if (interferenceNodeConfig.value?.interferePowerdb) {
      localPowerValue.value = Number(interferenceNodeConfig.value.interferePowerdb);
    }
  }
};

// 判断是否可以打开终端（仅路由器/DOCKER节点和无人机类节点）
const canOpenTerminal = computed(() => {
  return isRouterNode.value || isUAVNode.value;
});

// 判断是否可以显示协议信息（基本信息卡片中的协议展示）
const canShowProtocol = computed(() => {
  return isRealRouterNode.value || isUAVNode.value;
});

// 判断是否为子网节点（EMANE）
const isSubnetNode = computed(() => {
  if (!props.node) return false;
  return props.node.type === 'EMANE';
});

const isChildOfSubnetNode = computed(() => {
  if (!fullNode.value?.parent_id || !topoStore.topoData?.nodes) {
    return false;
  }

  const parentNode = topoStore.topoData.nodes.find((node: any) => node.id === fullNode.value?.parent_id);
  return parentNode?.type === 'EMANE';
});

const isConnectedToSubnetNode = computed(() => {
  if (!fullNode.value?.id || !topoStore.topoData?.links || !topoStore.topoData?.nodes) {
    return false;
  }

  return topoStore.topoData.links.some((link: any) => {
    if (link.node1_id !== fullNode.value?.id && link.node2_id !== fullNode.value?.id) {
      return false;
    }

    const otherNodeId = link.node1_id === fullNode.value?.id ? link.node2_id : link.node1_id;
    const otherNode = topoStore.topoData?.nodes.find((node: any) => node.id === otherNodeId);
    return otherNode?.type === 'EMANE';
  });
});

const isWirelessEnvironmentNode = computed(() => {
  return isSubnetNode.value || isChildOfSubnetNode.value || isConnectedToSubnetNode.value;
});

// 是否支持历史数据/数据管理菜单
const supportsHistoryAndDataManage = computed(() => {
  if (!fullNode.value) return false;

  if (isSubnetNode.value || isInterferenceNode.value || isHalfPhysicalNode.value || isVMNode.value || isSwitchLikeNode.value ) {
    return false;
  }

  return isRouterNode.value || isUAVNode.value || nodeNemIds.value.length > 0;
});

const shouldShowDataManageMenu = computed(() => {
  return supportsHistoryAndDataManage.value;
});

const shouldShowHistoryMenu = computed(() => {
  return supportsHistoryAndDataManage.value && topoStore.topoData?.state !== 'RUNTIME';
});

// 判断子网是否使用TDMA模型
const isSubnetTDMA = computed(() => {
  if (!fullNode.value || !isSubnetNode.value) return false;
  const emaneConfigs = fullNode.value.emane_configs;
  if (Array.isArray(emaneConfigs)) {
    return emaneConfigs.some((config: any) => {
      return config.model && config.model.toLowerCase().includes('tdma');
    });
  }
  return false;
});

// 子网关键配置信息（从 emane_configs 中提取）
const subnetKeyConfig = computed(() => {
  if (!fullNode.value || !isSubnetNode.value) return null;
  const configs = fullNode.value.emane_configs;
  if (!Array.isArray(configs) || configs.length === 0) return null;

  // 从所有 config 对象中查找参数值（兼容单对象和拆分数组两种结构）
  const val = (key: string): string | null => {
    for (const cfg of configs) {
      const c = cfg.config || {};
      if (c[key]?.value !== undefined) return c[key].value;
    }
    return null;
  };

  // 模型名称美化
  const modelRaw = configs[0].model || fullNode.value.emane || '';
  const modelMap: Record<string, string> = {
    'emane_rfpipe': 'RF Pipe',
    'emane_ieee80211abg': 'IEEE 802.11abg',
    'emane_tdma': 'TDMA',
    'emane_tdmaeventscheduler': 'TDMA Event Scheduler',
  };
  const modelLabel = modelMap[modelRaw] || modelRaw.replace('emane_', '');

  // 频率转 MHz 显示
  const freqRaw = val('frequency');
  const freqMHz = freqRaw ? (Number(freqRaw) / 1e6).toFixed(1) : null;

  // 带宽转 MHz 显示
  const bwRaw = val('bandwidth');
  const bwMHz = bwRaw ? (Number(bwRaw) / 1e6).toFixed(1) : null;

  // 数据速率转可读格式
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

// 检查仿真是否正在运行
const isSimulationRunning = computed(() => {
  return topoStore.topoData?.state === 'RUNTIME' ||
         topoStore.topoData?.state === 'RUNNING' ||
         topoStore.topoData?.status === 'RUNNING';
});

// ===== EMANE数据管理相关 =====

// 获取当前节点的NEM信息
const nodeNemInfo = computed(() => {
  if (!fullNode.value) return null;
  return nemIdStore.getNemIdsByNodeId(fullNode.value.id) || null;
});

// 获取当前节点的所有NEM ID列表（一个节点可能有多个接口）
const nodeNemIds = computed<Array<{ iface: string; nemId: number }>>(() => {
  if (!nodeNemInfo.value?.ifaceNemMap) return [];
  return Object.entries(nodeNemInfo.value.ifaceNemMap).map(([iface, nemId]) => ({
    iface,
    nemId: nemId as number
  }));
});

// 当前节点是否有EMANE数据
const nodeHasEmaneData = computed(() => {
  return nodeNemIds.value.length > 0 && emaneStore.hasEmaneData;
});

// NEM ID → 节点名称 反向查找
const nemToNodeName = computed(() => {
  const map = new Map<number, string>();
  const topoNodes = topoStore.topoData?.nodes || [];
  for (const nemInfo of nemIdStore.nemIds) {
    const node = topoNodes.find((n: any) => n.id === nemInfo.nodeId);
    const name = node?.alias || node?.name || `节点${nemInfo.nodeId}`;
    for (const [, nemId] of Object.entries(nemInfo.ifaceNemMap)) {
      map.set(nemId as number, name);
    }
  }
  return map;
});

// 根据NEM ID获取节点名称
const getNodeNameByNem = (nemId: number) => {
  return nemToNodeName.value.get(nemId) || `NEM ${nemId}`;
};

// 获取当前节点每个NEM对应子网的允许邻居（按NEM ID分组）
const allowedNeighborsByNem = computed<Map<number, Set<number>>>(() => {
  const result = new Map<number, Set<number>>();
  if (!fullNode.value) return result;
  const nodeId = fullNode.value.id;
  const links = topoStore.topoData?.links || [];
  const nodes = topoStore.topoData?.nodes || [];
  const myNemInfo = nemIdStore.getNemIdsByNodeId(nodeId);
  if (!myNemInfo?.ifaceNemMap) return result;

  // 辅助：根据链路接口对象查找 NEM store 中的 NEM ID（兼容 id/name 两种 key）
  const resolveNem = (nemInfo: any, ifaceObj: any): number | undefined => {
    if (!nemInfo?.ifaceNemMap || !ifaceObj) return undefined;
    const byId = ifaceObj.id !== undefined ? nemInfo.ifaceNemMap[ifaceObj.id.toString()] : undefined;
    if (byId !== undefined) return byId as number;
    const byName = ifaceObj.name ? nemInfo.ifaceNemMap[ifaceObj.name] : undefined;
    if (byName !== undefined) return byName as number;
    return undefined;
  };

  // Step 1: 当前节点的每个NEM对应哪个EMANE子网
  // myNemId -> emaneSubnetNodeId
  const nemToSubnet = new Map<number, number>();
  links.forEach((link: any) => {
    let myIfaceObj: any = null;
    let peerNodeId: number | null = null;
    if (link.node1_id === nodeId) {
      myIfaceObj = link.iface1;
      peerNodeId = link.node2_id;
    } else if (link.node2_id === nodeId) {
      myIfaceObj = link.iface2;
      peerNodeId = link.node1_id;
    }
    if (!myIfaceObj || peerNodeId === null) return;
    const peerNode = nodes.find((n: any) => n.id === peerNodeId);
    if (peerNode?.type !== 'EMANE') return;
    const myNem = resolveNem(myNemInfo, myIfaceObj);
    if (myNem !== undefined) {
      nemToSubnet.set(myNem, peerNodeId);
    }
  });

  // Step 2: 对每个子网，找其他节点连接到该子网的NEM
  nemToSubnet.forEach((subnetId, myNemId) => {
    const peerNems = new Set<number>();
    links.forEach((link: any) => {
      let peerId: number | null = null;
      let peerIfaceObj: any = null;
      if (link.node1_id === subnetId && link.node2_id !== nodeId) {
        peerId = link.node2_id;
        peerIfaceObj = link.iface2;
      } else if (link.node2_id === subnetId && link.node1_id !== nodeId) {
        peerId = link.node1_id;
        peerIfaceObj = link.iface1;
      }
      if (peerId === null) return;
      const peerNemInfo = nemIdStore.getNemIdsByNodeId(peerId);
      const peerNem = resolveNem(peerNemInfo, peerIfaceObj);
      if (peerNem !== undefined) {
        peerNems.add(peerNem);
      } else if (peerNemInfo?.ifaceNemMap) {
        // 兜底：无法精确匹配时添加对端所有NEM
        Object.values(peerNemInfo.ifaceNemMap).forEach(nem => peerNems.add(nem as number));
      }
    });
    result.set(myNemId, peerNems);
  });

  return result;
});

// 获取当前节点各NEM接口的指标数据（每个NEM仅显示其子网的直连邻居）
const nodeEmaneData = computed(() => {
  // 依赖 lastUpdated 确保数据更新时触发重新计算
  const _tick = emaneStore.lastUpdated;
  void _tick;
  if (nodeNemIds.value.length === 0) return [];

  // 当前节点自身所有NEM ID（用于过滤自身）
  const ownNemIds = new Set(nodeNemIds.value.map(n => n.nemId));
  const nemAllowedMap = allowedNeighborsByNem.value;

  return nodeNemIds.value.map(({ iface, nemId }) => {
    // 该NEM对应子网的允许邻居集合
    const allowedNems = nemAllowedMap.get(nemId);

    // 从该NEM的视角获取所有邻居数据
    const viewpoint = emaneStore.viewpointData[nemId];
    const metrics = viewpoint?.neighborMetricTables || [];
    const statuses = viewpoint?.neighborStatusTables || [];
    const rfSignals = viewpoint?.rfSignalTables || [];

    // 收集邻居NEM ID：过滤掉65535、自身NEM、非本子网节点
    const neighborNemSet = new Set<number>();
    const isAllowed = (nem: number) => nem !== 65535 && !ownNemIds.has(nem) && (!allowedNems || allowedNems.has(nem));
    metrics.forEach(m => { if (isAllowed(m.nem)) neighborNemSet.add(m.nem); });
    statuses.forEach(s => { if (isAllowed(s.nem)) neighborNemSet.add(s.nem); });
    rfSignals.forEach(r => { if (isAllowed(r.nem)) neighborNemSet.add(r.nem); });

    const neighbors = Array.from(neighborNemSet).map(neighborNem => {
      const metric = metrics.find(m => m.nem === neighborNem);
      const status = statuses.find(s => s.nem === neighborNem);
      const rfSignal = rfSignals.find(r => r.nem === neighborNem);
      return {
        neighborNem,
        neighborName: getNodeNameByNem(neighborNem),
        metric: metric || null,
        status: status || null,
        rfSignal: rfSignal || null,
      };
    });

    return {
      iface,
      nemId,
      hasData: neighbors.length > 0,
      neighbors,
    };
  });
});

// EMANE最后更新时间
const emaneLastUpdated = computed(() => {
  return emaneStore.lastUpdated;
});

// 被动测量数据映射: nodeId -> measurement
const passiveMeasurements = ref<Map<number, any>>(new Map());

// 历史数据查询相关
const showHistoryQuery = ref(false);
const historyStart = ref<string | null>(null);
const historyEnd = ref<string | null>(null);
const historyQueryLoading = ref(false);
const historyChartRef = ref<HTMLElement | null>(null);
const historyChartInstance = ref<any>(null);
const historyChartVisible = ref(false);
const historyNoData = ref(false);
const historyError = ref<string | null>(null);
const historySummary = ref<{ label: string; value: string; color?: string }[] | null>(null);
let historyHideTimer: ReturnType<typeof setTimeout> | null = null;
let lastHistoryInteractionTime = 0; // 跟踪最后一次用户交互时间
// Docker-specific history storage
const lastDockerData = ref<any>(null);
const dockerIfacesList = ref<string[]>([]);
const selectedIface = ref<string | null>(null);
const lastHistoryRaw = ref<any>(null);

const handleToggleHistoryQuery = () => {
  showHistoryQuery.value = !showHistoryQuery.value;
};

const handleQueryHistory = async () => {
  if (!topoStore.currentSessionId) {
    ElMessage.warning('当前会话ID不存在');
    return;
  }
  if (!fullNode.value) {
    ElMessage.warning('节点信息不完整');
    return;
  }

  // 重置状态
  historyNoData.value = false;
  historyError.value = null;
  historySummary.value = null;

  // 更新交互时间，防止查询过程中鼠标移开导致卡片关闭
  lastHistoryInteractionTime = Date.now();
  const nodeType = (fullNode.value.type || '').toString();
  const typePayload = nodeType.toUpperCase() === 'DOCKER' ? 1 : 2;

  // 将输入的本地日期时间转换为时间戳（毫秒），以字符串形式传给后端；为空则传空字符串
  const startVal = historyStart.value ? String(new Date(historyStart.value).getTime()) : '';
  const endVal = historyEnd.value ? String(new Date(historyEnd.value).getTime()) : '';

  try {
    historyQueryLoading.value = true;
    const resp = await getHistoryData({
      sessionId: topoStore.currentSessionId,
      type: typePayload,
      start: startVal,
      end: endVal
    });

    if (resp && (resp as any).code === 200) {
        try {
          const raw = (resp as any).data;
          lastHistoryRaw.value = raw;
          await renderHistoryChart(raw);
        } catch (e) {
          console.error('渲染历史图表失败', e);
          historyError.value = '图表渲染失败';
        }
    } else {
      historyError.value = ((resp as any)?.msg) || '未获取到数据';
    }
  } catch (error: any) {
    console.error('查询历史数据失败:', error);
    historyError.value = error?.message || '查询历史数据失败';
  } finally {
    historyQueryLoading.value = false;
  }
};

const renderHistoryChart = async (rawData: any) => {
  if (!rawData) {
    historyChartVisible.value = false;
    historyNoData.value = true;
    return;
  }

  const list = Array.isArray(rawData) ? rawData : (rawData.data || rawData.list || []);
  if (!Array.isArray(list) || list.length === 0) {
    historyChartVisible.value = false;
    historyNoData.value = true;
    return;
  }

  const times: string[] = [];
  const rx: number[] = [];
  const tx: number[] = [];
  const lost: number[] = [];
  const sinr: (number | null)[] = [];

  const isDockerNode = (fullNode.value?.type || '').toString().toUpperCase() === 'DOCKER';
  const sessionId = topoStore.currentSessionId;
  const expectedContainerA = `${fullNode.value?.name || ''}-${sessionId}`;
  const expectedContainerB = `${fullNode.value?.alias || ''}-${sessionId}`;

  const targetNems = nodeNemIds.value.map(n => n.nemId);


  const dockerIfaceMap: Record<string, { rx: number[]; tx: number[]; rxDropped: number[]; txDropped: number[]; rxBytes: number[]; txBytes: number[]; rxErrors: number[]; txErrors: number[] }> = {};

  list.forEach((item: any) => {
    const ts = item.timestamp ?? item.time ?? item.ts ?? item.t ?? item._time;
    const timeLabel = ts ? new Date(Number(ts)).toLocaleTimeString() : '';
    times.push(timeLabel);

    if (isDockerNode) {
      const wirds = item.wirdInfoList || item.wirdInfo || [];
      const perIfaceValues: Record<string, { rx: number; tx: number; lost: number; rxDropped?: number; txDropped?: number; rxBytes?: number; txBytes?: number; rxErrors?: number; txErrors?: number }> = {};
      for (const w of wirds) {
        const container = w.container || '';
        const matched = container === expectedContainerA || container === expectedContainerB || (fullNode.value && container.includes(fullNode.value.name)) || (fullNode.value && container.includes(fullNode.value.alias || ''));
        if (!matched) continue;
        const ifaces = Array.isArray(w.iface) ? w.iface : [];
        for (const iface of ifaces) {
          const name = iface.name || (`iface${iface.id || ''}`);
          const rxVal = Number(iface.rxPackages ?? 0) || 0;
          const txVal = Number(iface.txPackages ?? 0) || 0;
          const rxBytes = Number(iface.rxBytes ?? 0) || 0;
          const txBytes = Number(iface.txBytes ?? 0) || 0;
          const rxErrors = Number(iface.rxErrors ?? 0) || 0;
          const txErrors = Number(iface.txErrors ?? 0) || 0;
          const rxDropped = Number(iface.rxDropped ?? 0) || 0;
          const txDropped = Number(iface.txDropped ?? 0) || 0;
          perIfaceValues[name] = {
            rx: (perIfaceValues[name]?.rx || 0) + rxVal,
            tx: (perIfaceValues[name]?.tx || 0) + txVal,
            rxDropped: (perIfaceValues[name]?.rxDropped || 0) + rxDropped,
            txDropped: (perIfaceValues[name]?.txDropped || 0) + txDropped,
            rxBytes: (perIfaceValues[name]?.rxBytes || 0) + rxBytes,
            txBytes: (perIfaceValues[name]?.txBytes || 0) + txBytes,
            rxErrors: (perIfaceValues[name]?.rxErrors || 0) + rxErrors,
            txErrors: (perIfaceValues[name]?.txErrors || 0) + txErrors
          };
        }
      }

      const knownIfaces = Object.keys(dockerIfaceMap);
      for (const k of knownIfaces) {
        const v = perIfaceValues[k];
        dockerIfaceMap[k].rx.push(v ? v.rx : 0);
        dockerIfaceMap[k].tx.push(v ? v.tx : 0);
        dockerIfaceMap[k].rxDropped.push(v ? v.rxDropped : 0);
        dockerIfaceMap[k].txDropped.push(v ? v.txDropped : 0);
        dockerIfaceMap[k].rxBytes.push(v ? v.rxBytes : 0);
        dockerIfaceMap[k].txBytes.push(v ? v.txBytes : 0);
        dockerIfaceMap[k].rxErrors.push(v ? v.rxErrors : 0);
        dockerIfaceMap[k].txErrors.push(v ? v.txErrors : 0);
      }
      for (const [name, vals] of Object.entries(perIfaceValues)) {
        if (!dockerIfaceMap[name]) {
          dockerIfaceMap[name] = { rx: Array(times.length - 1).fill(0), tx: Array(times.length - 1).fill(0), rxDropped: Array(times.length - 1).fill(0), txDropped: Array(times.length - 1).fill(0), rxBytes: Array(times.length - 1).fill(0), txBytes: Array(times.length - 1).fill(0), rxErrors: Array(times.length - 1).fill(0), txErrors: Array(times.length - 1).fill(0) };
          dockerIfaceMap[name].rx.push(vals.rx);
          dockerIfaceMap[name].tx.push(vals.tx);
          dockerIfaceMap[name].rxDropped.push(vals.rxDropped || 0);
          dockerIfaceMap[name].txDropped.push(vals.txDropped || 0);
          dockerIfaceMap[name].rxBytes.push(vals.rxBytes || 0);
          dockerIfaceMap[name].txBytes.push(vals.txBytes || 0);
          dockerIfaceMap[name].rxErrors.push(vals.rxErrors || 0);
          dockerIfaceMap[name].txErrors.push(vals.txErrors || 0);
        }
      }
    } else {
        let rxVal = 0;
        let txVal = 0;
        let lostVal = 0;
        let sinrVal: number | null = null;

        const emanes = item.emaneInfoMsgs || item.emaneInfoMsg || [];
        for (const em of emanes) {
          // 按 nemId 筛选：只取本节点自己的 EMANE 消息
          const emNemId = typeof em.nemId === 'string' ? Number(em.nemId) : em.nemId;
          if (!targetNems.includes(emNemId)) continue;

          const metricTables = Array.isArray(em.neighborMetricTables) ? em.neighborMetricTables : (em.neighborMetricTables ? [em.neighborMetricTables] : []);
          const rfTables = Array.isArray(em.rfSignalTables) ? em.rfSignalTables : (em.rfSignalTables ? [em.rfSignalTables] : []);

          // 聚合所有邻居的收发包数据
          for (const m of metricTables) {
            rxVal += Number(m.rxPkts) || 0;
            txVal += Number(m.txPkts) || 0;
            lostVal += Number(m.missedPkts) || 0;
          }

          // SINR 从 RF 信号表获取（跳过广播 NEM 65535）
          for (const r of rfTables) {
            const nem = typeof r.nem === 'string' ? Number(r.nem) : r.nem;
            if (nem === 65535) continue;
            if (r.avgSINR != null && sinrVal == null) sinrVal = Number(r.avgSINR);
          }
        }

        rx.push(rxVal);
        tx.push(txVal);
        lost.push(lostVal);
        sinr.push(sinrVal != null ? sinrVal : null);
    }
  });

  // 构建数据摘要统计
  if (isDockerNode) {
    const pick = selectedIface.value || dockerIfacesList.value[0] || Object.keys(dockerIfaceMap)[0];
    const vals = pick ? dockerIfaceMap[pick] : null;
    if (vals) {
      const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
      historySummary.value = [
        { label: '总接收包', value: sumArr(vals.rx).toLocaleString(), color: '#00d4ff' },
        { label: '总发送包', value: sumArr(vals.tx).toLocaleString(), color: '#00aaff' },
        { label: '总接收字节', value: sumArr(vals.rxBytes).toLocaleString(), color: '#9af764' },
        { label: '总发送字节', value: sumArr(vals.txBytes).toLocaleString(), color: '#ffd666' },
      ];
    }
  } else {
    const sumArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avgArr = (arr: (number | null)[]) => {
      const valid = arr.filter((v): v is number => v != null);
      return valid.length > 0 ? (valid.reduce((a, b) => a + b, 0) / valid.length) : null;
    };
    const avgSinr = avgArr(sinr);
    historySummary.value = [
      { label: '总接收包', value: sumArr(rx).toLocaleString(), color: '#00d4ff' },
      { label: '总发送包', value: sumArr(tx).toLocaleString(), color: '#00aaff' },
      { label: '总丢包', value: sumArr(lost).toLocaleString(), color: '#ff6b6b' },
      { label: '平均SINR', value: avgSinr != null ? avgSinr.toFixed(2) + ' dB' : '-', color: '#9af764' },
    ];
  }

  historyNoData.value = false;
  historyError.value = null;

  historyChartVisible.value = true;
  await nextTick(); // 等待 v-if 渲染出图表容器 DOM
  if (!historyChartRef.value) return;

  const initChartInstanceIfNeeded = async () => {
    if (historyChartInstance.value) return;
    let attempts = 0;
    while ((!historyChartRef.value || (historyChartRef.value.clientWidth || 0) <= 0) && attempts < 12) {
      await new Promise(r => setTimeout(r, 50));
      attempts++;
    }
    if (!historyChartRef.value) return;
    try {
      historyChartInstance.value = echarts.init(historyChartRef.value, undefined, { renderer: 'canvas' });
    } catch (e) {
      try { historyChartInstance.value = echarts.init(historyChartRef.value, undefined, { renderer: 'canvas' }); } catch (e2) { console.error('echarts init failed', e2); }
    }
  };

  await initChartInstanceIfNeeded();

  // 公共 tooltip 配置
  const commonTooltip = {
    trigger: 'axis' as const,
    backgroundColor: 'rgba(15, 25, 41, 0.95)',
    borderColor: 'rgba(0, 234, 255, 0.3)',
    textStyle: { color: '#eaf6ff', fontSize: 12 },
    axisPointer: { type: 'cross' as const, crossStyle: { color: 'rgba(0, 234, 255, 0.3)' } },
  };

  // 公共网格线
  const commonSplitLine = { lineStyle: { color: 'rgba(255, 255, 255, 0.06)' } };

  // 生成带渐变 areaStyle 的 series
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };
  const makeAreaStyle = (color: string) => ({
    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: hexToRgba(color, 0.25) },
      { offset: 1, color: 'rgba(0,0,0,0)' }
    ])
  });

  // dataZoom 配置
  const commonDataZoom = times.length > 20 ? [{
    type: 'slider' as const,
    bottom: 4,
    height: 18,
    borderColor: 'rgba(0, 234, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    fillerColor: 'rgba(0, 234, 255, 0.1)',
    handleStyle: { color: '#00eaff', borderColor: '#00eaff' },
    textStyle: { color: '#9fb8d9', fontSize: 10 },
    dataBackground: { lineStyle: { color: 'rgba(0, 234, 255, 0.3)' }, areaStyle: { color: 'rgba(0, 234, 255, 0.05)' } },
  }] : [];

  const bottomGrid = commonDataZoom.length > 0 ? '16%' : '8%';

  //有线节点
  const option = (() => {
      if (isDockerNode) {
          lastDockerData.value = { times: times.slice(), ifaces: dockerIfaceMap };
          dockerIfacesList.value = Object.keys(dockerIfaceMap);
          if (!selectedIface.value && dockerIfacesList.value.length > 0) selectedIface.value = dockerIfacesList.value[0];
          const series: any[] = [];
          const legend: string[] = [];
          const pick = selectedIface.value || dockerIfacesList.value[0];
          if (pick && dockerIfaceMap[pick]) {
            const vals = dockerIfaceMap[pick];
            const names = [
              { key: 'rx', label: '接收包' },
              { key: 'tx', label: '发送包' },
              { key: 'txBytes', label: '发送字节' },
              { key: 'rxBytes', label: '接收字节' },
              { key: 'txErrors', label: '发送错误包' },
              { key: 'rxErrors', label: '接收错误包' },
              { key: 'txDropped', label: '发送丢弃包' },
              { key: 'rxDropped', label: '接收丢弃包' }
            ];
            const colors8 = ['#00d4ff', '#00aaff', '#9af764', '#ffd666', '#ff6b6b', '#7aa2ff', '#a37cff', '#4de0a8'];
            names.forEach((n, idx) => {
              legend.push(n.label);
              const dataArr = vals[n.key] || [];
              series.push({
                name: n.label, type: 'line', data: dataArr, smooth: true, showSymbol: false,
                yAxisIndex: 0, itemStyle: { color: colors8[idx % colors8.length] },
                lineStyle: { width: 2 },
                areaStyle: idx < 2 ? makeAreaStyle(colors8[idx]) : undefined,
              });
            });
          }
            return {
            backgroundColor: 'transparent',
            tooltip: commonTooltip,
            legend: { type: 'scroll', data: legend, textStyle: { color: '#cfe8ff', fontSize: 11 }, top: 4, itemWidth: 12, itemHeight: 8 },
            grid: { left: '6%', right: '6%', bottom: bottomGrid, top: 36, containLabel: true },
            xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#233b63' } }, axisLabel: { color: '#9fb8d9', fontSize: 10 }, boundaryGap: false },
            yAxis: [{ type: 'value', name: '数量', position: 'left', axisLine: { lineStyle: { color: '#2ec7c9' } }, axisLabel: { color: '#9fb8d9', fontSize: 10 }, splitLine: commonSplitLine, nameTextStyle: { color: '#9fb8d9', fontSize: 10 } }],
            dataZoom: commonDataZoom,
            series
          };
        }

      // 无线节点
      return {
        backgroundColor: 'transparent',
        tooltip: commonTooltip,
        legend: { type: 'scroll', data: ['接收包', '发送包', '丢包', 'SINR'], textStyle: { color: '#cfe8ff', fontSize: 11 }, top: 4, itemWidth: 12, itemHeight: 8 },
        grid: { left: '6%', right: '6%', bottom: bottomGrid, top: 36, containLabel: true },
        xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#233b63' } }, axisLabel: { color: '#9fb8d9', fontSize: 10 }, boundaryGap: false },
        yAxis: [
          { type: 'value', name: '数量', position: 'left', axisLine: { lineStyle: { color: '#2ec7c9' } }, axisLabel: { color: '#9fb8d9', fontSize: 10 }, splitLine: commonSplitLine, nameTextStyle: { color: '#9fb8d9', fontSize: 10 } },
          { type: 'value', name: 'dB', position: 'right', axisLine: { lineStyle: { color: '#9af764' } }, axisLabel: { color: '#9fb8d9', fontSize: 10 }, splitLine: { show: false }, nameTextStyle: { color: '#9fb8d9', fontSize: 10 } }
        ],
        dataZoom: commonDataZoom,
        series: [
          { name: '接收包', type: 'line', data: rx, smooth: true, symbol: 'circle', showSymbol: false, lineStyle: { width: 2 }, yAxisIndex: 0, itemStyle: { color: '#00d4ff' }, areaStyle: makeAreaStyle('#00d4ff') },
          { name: '发送包', type: 'line', data: tx, smooth: true, symbol: 'circle', showSymbol: false, lineStyle: { width: 2 }, yAxisIndex: 0, itemStyle: { color: '#00aaff' }, areaStyle: makeAreaStyle('#00aaff') },
          { name: '丢包', type: 'line', data: lost, smooth: true, symbol: 'circle', showSymbol: false, lineStyle: { width: 2 }, yAxisIndex: 0, itemStyle: { color: '#ff6b6b' } },
          { name: 'SINR', type: 'line', data: sinr.map(v => isNaN(v as number) ? null : v), smooth: true, symbol: 'circle', showSymbol: false, lineStyle: { width: 2 }, yAxisIndex: 1, itemStyle: { color: '#9af764' } },
        ]
      };
    })();

    if (historyChartInstance.value) {
      historyChartInstance.value.setOption(option, { notMerge: true });
      window.setTimeout(() => { try { historyChartInstance.value?.resize(); } catch (e) {} }, 200);
      window.setTimeout(() => { try { adjustCardOffset(); } catch (e) {} }, 350);
    }
  };


const latestIfaceValue = (iface: string | null, stat: string) => {
  try {
    if (!iface || !lastDockerData.value) return '-';
    const ifaces = lastDockerData.value.ifaces || {};
    const vals = ifaces[iface];
    if (!vals) return '-';
    const idx = (lastDockerData.value.times || []).length - 1;
    if (idx < 0) return 0;
    switch (stat) {
      case 'txPackages': return vals.tx[idx] ?? 0;
      case 'txBytes': return vals.txBytes ? (vals.txBytes[idx] ?? 0) : 0;
      case 'txErrors': return vals.txErrors ? (vals.txErrors[idx] ?? 0) : 0;
      case 'txDropped': return vals.lost ? (vals.lost[idx] ?? 0) : 0;
      case 'rxPackages': return vals.rx[idx] ?? 0;
      case 'rxBytes': return vals.rxBytes ? (vals.rxBytes[idx] ?? 0) : 0;
      case 'rxErrors': return vals.rxErrors ? (vals.rxErrors[idx] ?? 0) : 0;
      case 'rxDropped': return vals.lost ? (vals.lost[idx] ?? 0) : 0;
      default: return '-';
    }
  } catch (e) {
    return '-';
  }
};

const statLabel = (key: string) => {
  switch (key) {
    case 'txPackages': return '发送包';
    case 'txBytes': return '发送字节';
    case 'txErrors': return '发送错误包';
    case 'txDropped': return '发送丢弃包';
    case 'rxPackages': return '接收包';
    case 'rxBytes': return '接收字节';
    case 'rxErrors': return '接收错误包';
    case 'rxDropped': return '接收丢弃包';
    default: return key;
  }
};

// 当历史查询卡片重新显示时，尝试使用上次数据恢复图表（或 resize）
watch(showHistoryQuery, (val) => {
  if (val) {
    nextTick(() => {
      // 当卡片重新出现：如果已有实例，先 resize；否则用上次数据重建
      if (historyChartInstance.value && historyChartRef.value) {
        try { historyChartInstance.value.resize(); } catch (e) { console.warn('history chart resize failed', e); }
      }
      if (lastHistoryRaw.value) {
        (async () => { try { await renderHistoryChart(lastHistoryRaw.value); } catch (e) { console.error(e); } })();
      }
    });
  } else {
    // 卡片隐藏时，释放图表实例，避免引用已卸载的 DOM
    try {
      if (historyChartInstance.value) {
        historyChartInstance.value.dispose();
        historyChartInstance.value = null;
      }
    } catch (e) {
      // ignore
    }
    historyChartVisible.value = false;
  }
});

// 当切换所选网卡时重绘（仅 docker 场景）
watch(selectedIface, (val) => {
  if (!val) return;
  // 重新渲染图表使用 lastDockerData
  if (lastDockerData.value) {
    // build a simple option for selected iface
    nextTick(async () => {
      try {
        const pick = val as string;
        const times = lastDockerData.value.times || [];
        const vals = lastDockerData.value.ifaces?.[pick];
        if (!vals) return;
        const option = {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'axis' },
          legend: { data: ['接收包', '发送包', '发送字节', '接收字节', '发送错误包', '接收错误包', '发送丢弃包', '接收丢弃包'], textStyle: { color: '#cfe8ff' }, top: 6 },
          grid: { left: '6%', right: '6%', bottom: '8%', top: 40 },
          xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#233b63' } }, axisLabel: { color: '#9fb8d9' } },
          yAxis: [{ type: 'value', name: '数量', position: 'left', axisLine: { lineStyle: { color: '#2ec7c9' } }, axisLabel: { color: '#9fb8d9' } }],
          series: [
            { name: '发送包', type: 'line', data: vals.tx || [], smooth: true, showSymbol: false, itemStyle: { color: '#00aaff' } },
            { name: '发送字节', type: 'line', data: vals.txBytes || [], smooth: true, showSymbol: false, itemStyle: { color: '#7aa2ff' } },
            { name: '发送错误包', type: 'line', data: vals.txErrors || [], smooth: true, showSymbol: false, itemStyle: { color: '#ff6b6b' } },
            { name: '发送丢弃包', type: 'line', data: vals.txDropped || [], smooth: true, showSymbol: false, itemStyle: { color: '#ff9f43' } },
            { name: '接收包', type: 'line', data: vals.rx || [], smooth: true, showSymbol: false, itemStyle: { color: '#00d4ff' } },
            { name: '接收字节', type: 'line', data: vals.rxBytes || [], smooth: true, showSymbol: false, itemStyle: { color: '#9af764' } },
            { name: '接收错误包', type: 'line', data: vals.rxErrors || [], smooth: true, showSymbol: false, itemStyle: { color: '#ffd666' } },
            { name: '接收丢弃包', type: 'line', data: vals.rxDropped || [], smooth: true, showSymbol: false, itemStyle: { color: '#4de0a8' } }
          ]
        };
        // ensure chart instance exists, retry if container not ready
        let attempts = 0;
        while ((!historyChartInstance.value) && attempts < 8) {
          if (historyChartRef.value && (historyChartRef.value.clientWidth || 0) > 0) {
            try { historyChartInstance.value = echarts.init(historyChartRef.value, undefined, { renderer: 'canvas' }); } catch (e) {}
          }
          if (historyChartInstance.value) break;
          await new Promise(r => setTimeout(r, 60));
          attempts++;
        }
        if (historyChartInstance.value) {
          historyChartInstance.value.setOption(option, { notMerge: true });
          window.setTimeout(() => { try { historyChartInstance.value?.resize(); } catch (e) {} }, 100);
        }
      } catch (e) {
        console.error('切换网卡渲染失败', e);
      }
    });
  }
});

// 从 container 字段解析节点名和场景 id
const parseContainer = (container: string) => {
  if (!container) return { nodeName: '', sceneId: null };
  let nodeName = container;
  let sceneId: string | null = null;
  const trySplit = (sep: string) => {
    const parts = container.split(sep);
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (!isNaN(Number(last))) {
        sceneId = last;
        nodeName = parts.slice(0, parts.length - 1).join(sep);
        return true;
      }
    }
    return false;
  };
  trySplit('_') || trySplit('-') || trySplit(':');
  return { nodeName, sceneId };
};

// 处理被动测量事件，将数据映射到对应节点
const handlePassiveMeasurement = (data: any) => {
  try {
    const container = data?.container || '';
    if (!container) return;
    const { nodeName, sceneId } = parseContainer(container);
    if (!nodeName) return;

    // 在 topo 中查找节点（优先 alias，然后 name）
    const nodes = topoStore.topoData?.nodes || [];
    const matched = nodes.find((n: any) => {
      const nameMatch = (n.alias && n.alias === nodeName) || (n.name && n.name === nodeName);
      if (!nameMatch) return false;
      if (sceneId && topoStore.topoData?.id) {
        return String(topoStore.topoData.id) === String(sceneId);
      }
      return true;
    });

    if (!matched) return;

    passiveMeasurements.value.set(matched.id, {
      cpu: data.cpu,
      mem: data.mem,
      iface: Array.isArray(data.iface) ? data.iface : [],
      updatedAt: Date.now(),
      raw: data,
    });
  } catch (e) {
    console.error('处理被动测量数据出错:', e);
  }
};

onMounted(() => {
  (eventBus as any).on('passive:measurement', handlePassiveMeasurement);
  // ensure chart resizes when window size changes
  window.addEventListener('resize', handleWindowResize);
});

onUnmounted(() => {
  (eventBus as any).off('passive:measurement', handlePassiveMeasurement);
  if (historyHideTimer) {
    clearTimeout(historyHideTimer);
    historyHideTimer = null;
  }
  try {
    if (historyChartInstance.value) {
      historyChartInstance.value.dispose();
      historyChartInstance.value = null;
    }
  } catch (e) {
    // ignore
  }
  window.removeEventListener('resize', handleWindowResize);
});

// resize handler to keep echarts responsive
function handleWindowResize() {
  try {
    if (historyChartInstance.value) historyChartInstance.value.resize();
  } catch (e) {
    // ignore
  }
}

// 格式化时间
const formatEmaneTime = (timestamp: number | Date | null): string => {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};

// 获取虚拟机模板信息
const vmTemplateInfo = computed(() => {
  if (!isVMNode.value || !fullNode.value) return null;
  
  const node = fullNode.value;
  
  // 如果有templateId，查找对应的模板
  if (node.templateId && vmTemplateStore.templates.length > 0) {
    const template = vmTemplateStore.getTemplateById(node.templateId);
    if (template) return template;
  }
  
  // 否则返回第一个模板
  if (vmTemplateStore.templates.length > 0) {
    return vmTemplateStore.templates[0];
  }
  
  return null;
});

const handleSelectMenu = (menu: string) => {
  if (menu === 'protocolInfo') {
    currentView.value = 'protocolInfo';
  } else if (menu === 'dataManage') {
    currentView.value = 'dataManage';
  }
  emit('selectMenu', menu);
};

const handleBasicInfoHover = (isHovering: boolean) => {
  if (isHovering) {
    showBasicInfo.value = true;
    showProtocolInfo.value = false;
    showHistoryQuery.value = false;
    nextTick(() => adjustCardOffset());
  }
};

const handleBasicInfoCardLeave = () => {
  showBasicInfo.value = false;
};

const handleProtocolMenuHover = (isHovering: boolean) => {
  if (isHovering) {
    showProtocolInfo.value = true;
    showBasicInfo.value = false;
    showHistoryQuery.value = false;
    nextTick(() => adjustCardOffset());
  }
};

const handleProtocolInfoCardLeave = () => {
  showProtocolInfo.value = false;
};

const handleDataManageHover = (isHovering: boolean) => {
  if (!shouldShowDataManageMenu.value) {
    showDataManage.value = false;
    return;
  }

  if (isHovering) {
    // 保存当前节点数据快照，使卡片在菜单关闭后仍能显示
    dataManageNode.value = fullNode.value ? { ...fullNode.value } : null;
    showBasicInfo.value = false;
    showProtocolInfo.value = false;
    showHistoryQuery.value = false;
    // 先计算初始位置，再显示卡片，避免在左上角闪烁
    if (menuWrapperRef.value) {
      const menuEl = menuWrapperRef.value.querySelector('.node-context-menu') as HTMLElement | null;
      const rect = menuEl ? menuEl.getBoundingClientRect() : menuWrapperRef.value.getBoundingClientRect();
      dmDragOffsetX.value = rect.right + 4;
      dmDragOffsetY.value = rect.top;
    }
    showDataManage.value = true;
  } else {
    // 鼠标离开菜单项时，如果未固定则隐藏
    if (!dataManagePinned.value) {
      showDataManage.value = false;
    }
  }
};

// 点击固定数据管理卡片
const handleDataManagePin = () => {
  if (!shouldShowDataManageMenu.value) return;
  dataManageNode.value = fullNode.value ? { ...fullNode.value } : null;
  showBasicInfo.value = false;
  showProtocolInfo.value = false;
  showHistoryQuery.value = false;
  if (menuWrapperRef.value) {
    const menuEl = menuWrapperRef.value.querySelector('.node-context-menu') as HTMLElement | null;
    const rect = menuEl ? menuEl.getBoundingClientRect() : menuWrapperRef.value.getBoundingClientRect();
    dmDragOffsetX.value = rect.right + 4;
    dmDragOffsetY.value = rect.top;
  }
  showDataManage.value = true;
  dataManagePinned.value = true;
};

// 处理历史数据菜单项的悬停（在右键主菜单上）
const handleHistoryHover = (isHovering: boolean) => {
  if (!shouldShowHistoryMenu.value) {
    showHistoryQuery.value = false;
    return;
  }

  // 清除之前的隐藏定时器
  if (historyHideTimer) {
    clearTimeout(historyHideTimer);
    historyHideTimer = null;
  }

  if (isHovering) {
    showHistoryQuery.value = true;
    showBasicInfo.value = false;
    showProtocolInfo.value = false;
    nextTick(() => adjustCardOffset());
  }
  // 鼠标离开菜单项时不立即关闭，等待卡片的 mouseleave 处理
};

const handleHistoryCardEnter = () => {
  // 鼠标进入卡片时，更新交互时间并清除隐藏定时器
  lastHistoryInteractionTime = Date.now();
  if (historyHideTimer) {
    clearTimeout(historyHideTimer);
    historyHideTimer = null;
  }
};

// 历史数据卡片离开处理
const handleHistoryCardLeave = () => {
  // 延迟关闭，在回调中再次检查 pickerOpen（日期选择器的 visible-change 可能晚于 mouseleave）
  const delayMs = 400;
  historyHideTimer = setTimeout(() => {
    if (pickerOpen.value) { historyHideTimer = null; return; }
    showHistoryQuery.value = false;
    historyHideTimer = null;
  }, delayMs);
};

// 关闭历史数据查询卡片
const handleCloseHistoryCard = () => {
  showHistoryQuery.value = false;
  if (historyHideTimer) {
    clearTimeout(historyHideTimer);
    historyHideTimer = null;
  }
};

const handleDataManageCardLeave = () => {
  // 未固定时，鼠标离开卡片则关闭；固定后仅通过关闭按钮关闭
  if (!dataManagePinned.value) {
    showDataManage.value = false;
  }
};

// prevent hiding when datepicker is open
const pickerOpen = ref(false);
const onPickerVisibleChange = (visible: boolean) => {
  pickerOpen.value = visible;
  if (visible) {
    lastHistoryInteractionTime = Date.now();
    // 选择器打开时取消任何正在进行的隐藏定时器
    if (historyHideTimer) {
      clearTimeout(historyHideTimer);
      historyHideTimer = null;
    }
  }
};

const handleWrapperMouseLeave = () => {
  // 延迟检查，避免日期选择器弹出时 pickerOpen 尚未更新
  setTimeout(() => {
    if (pickerOpen.value || isEditingAlias.value) return;
    // 交互型面板（历史数据、数据管理）有关闭按钮，不随鼠标离开关闭
    showBasicInfo.value = false;
    showProtocolInfo.value = false;
  }, 100);
};

const handleClose = () => {
  handleCancelAliasEdit();
  currentView.value = 'menu';
  showBasicInfo.value = false;
  emit('close');
};

// 点击背景遮罩：关闭菜单（数据管理卡片保留，仅通过关闭按钮关闭）
const handleBackdropClick = () => {
  if (showHistoryQuery.value) {
    showHistoryQuery.value = false;
    // 释放图表实例
    if (historyChartInstance.value) {
      try { historyChartInstance.value.dispose(); } catch (e) {}
      historyChartInstance.value = null;
    }
    return;
  }
  handleClose();
};

// 监听 visible 变化，重置视图
watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentView.value = 'menu';
    showBasicInfo.value = false;
    cardOffsetY.value = 0;
    cardFlipLeft.value = false;
    menuAdjustedY.value = props.position?.y ?? 0;
    menuAdjustedX.value = props.position?.x ?? 0;
    // 重置历史数据查询状态，防止切换节点时残留旧数据
    showHistoryQuery.value = false;
    historyChartVisible.value = false;
    historyNoData.value = false;
    historyError.value = null;
    historySummary.value = null;
    lastHistoryRaw.value = null;
    if (historyChartInstance.value) {
      try { historyChartInstance.value.dispose(); } catch (e) {}
      historyChartInstance.value = null;
    }
    // 如果是干扰节点，确保加载干扰配置
    if (isInterferenceNode.value && topoStore.currentSessionId) {
      if (interferenceStore.interferenceConfigs.length === 0) {
        interferenceStore.fetchInterferenceConfigs(topoStore.currentSessionId);
      }
    }
    // nextTick后检测父菜单是否超出屏幕底部
    nextTick(() => {
      adjustMenuY();
    });
  } else {
    handleCancelAliasEdit();
  }
});

// 调整父菜单位置，防止菜单本身超出屏幕底部和右侧
const adjustMenuY = () => {
  if (!menuWrapperRef.value || !props.position) return;
  const menuEl = menuWrapperRef.value.querySelector('.node-context-menu') as HTMLElement | null;
  if (!menuEl) return;
  const menuRect = menuEl.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const margin = 8;

  // 垂直溢出
  const overflowY = menuRect.bottom - (viewportH - margin);
  if (overflowY > 0) {
    menuAdjustedY.value = Math.max(margin, props.position.y - overflowY);
  }

  // 水平溢出：菜单右边超出视口时左移
  const overflowX = menuRect.right - (viewportW - margin);
  if (overflowX > 0) {
    menuAdjustedX.value = Math.max(margin, props.position.x - overflowX);
  }
};

// 调整卡片偏移，防止卡片超出屏幕底部和右侧
const adjustCardOffset = () => {
  if (!menuWrapperRef.value) { cardOffsetY.value = 0; return; }
  const cards = menuWrapperRef.value.querySelectorAll('.basic-info-card, .operation-card, .history-card');
  const card = cards[0] as HTMLElement | undefined;
  if (!card) { cardOffsetY.value = 0; return; }

  const cardRect = card.getBoundingClientRect();
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const margin = 8;

  // 垂直溢出检测
  const overflowY = cardRect.bottom - (viewportH - margin);
  if (overflowY > 0) {
    const maxShift = cardRect.top - margin;
    cardOffsetY.value = -Math.min(overflowY, maxShift);
  } else {
    cardOffsetY.value = 0;
  }

  // 水平溢出检测：卡片右边超出视口时翻转到菜单左侧
  const overflowX = cardRect.right - (viewportW - margin);
  if (overflowX > 0 && !cardFlipLeft.value) {
    cardFlipLeft.value = true;
    // 翻转后重新检测垂直偏移
    nextTick(() => adjustCardOffset());
  }
};

// 监听节点状态变化，同步故障配置
watch(() => fullNode.value?.status, (newStatus) => {
  faultConfig.value.enabled = newStatus === 'DOWN';
}, { immediate: true });
// 节点类型中英文映射（完全复用NodeInfoPanel的逻辑）
const getNodeTypeLabel = (type: string): string => {
  // 根据节点名称前缀来确定类型，不再依赖type字段
  const nodeName = fullNode.value?.name || '';

  // 优先检查更具体的前缀，避免被通用前缀误判
  if (nodeName.includes('BUSINESS_Transmitter') || nodeName.startsWith('业务终端')) {
    return '业务终端';
  }
  if (nodeName.includes('ATTACK_MACHINE') || nodeName.startsWith('攻击机')) {
    return '攻击机';
  }
  if (nodeName.includes('SECURITY_MACHINE') || nodeName.startsWith('安全机')) {
    return '安全机';
  }
  if (nodeName.includes('SDN_CONTROLLER') || nodeName.startsWith('SDN控制器')) {
    return 'SDN控制器';
  }
  if (nodeName.includes('Ovs_SWITCH') || nodeName.startsWith('Ovs交换机')) {
    return 'Ovs交换机';
  }
  if (nodeName.includes('P4') || nodeName.startsWith('P4交换机')) {
    return 'P4交换机';
  }
  if (nodeName.includes('SR') || nodeName.startsWith('SR交换机')) {
    return 'SR交换机';
  }
  if (nodeName.includes('RTSP_RTP') || nodeName.startsWith('视频服务器')) {
    return '视频服务器';
  }
  if (nodeName.includes('VoIP_SIP') || nodeName.startsWith('VoIP')) {
    return 'VoIP服务器';
  }
  if (nodeName.includes('HTTP') || nodeName.startsWith('HTTP')) {
    return 'HTTP服务器';
  }
  if (nodeName.includes('FTP') || nodeName.startsWith('FTP')) {
    return 'FTP服务器';
  }
  if (nodeName.includes('DNS') || nodeName.startsWith('DNS')) {
    return 'DNS服务器';
  }
  if (nodeName.includes('SMTP') || nodeName.startsWith('SMTP')) {
    return 'SMTP服务器';
  }
  if (nodeName.includes('TMV') || nodeName.startsWith('流量终端')) {
    return '流量终端';
  }
  if (nodeName.startsWith('VAN') || nodeName.startsWith('机动车')) {
    return '机动车';
  }
  if (nodeName.startsWith('SATELLITE') || nodeName.startsWith('卫星')) {
    return '卫星';
  }
  if (nodeName.startsWith('DRONE') || nodeName.startsWith('无人机')) {
    return '无人机';
  }
  if (nodeName.startsWith('BASESTATION') || nodeName.startsWith('基站')) {
    return '基站';
  }
  if (nodeName.startsWith('subnet-') || nodeName.startsWith('子网')) {
    return '子网';
  }
  if (nodeName.startsWith('干扰')) {
    return '干扰节点';
  }
  if (nodeName.startsWith('SERVER') || nodeName.startsWith('服务器')) {
    return '服务器';
  }
  if (nodeName.startsWith('ROUTER') || nodeName.startsWith('路由器')) {
    return '路由器';
  }
  if (nodeName.startsWith('SWITCH') || nodeName.startsWith('交换机')) {
    return '交换机';
  }
  if (nodeName.startsWith('VMNODE') || nodeName.startsWith('虚拟机')) {
    return '虚拟机';
  }
  if (nodeName.startsWith('ens52f0') || nodeName.startsWith('半实物')) {
    return '半实物节点';
  }
  if (nodeName.startsWith('DEVICE') || nodeName.startsWith('设备')) {
    return '设备';
  }

  return '设备';
};

// 节点状态文本
const nodeStatusText = computed(() => {
  const status = fullNode.value?.status || 'UP';
  return status === 'UP' ? '正常' : '故障';
});

// 节点状态样式类
const nodeStatusClass = computed(() => {
  const status = fullNode.value?.status || 'UP';
  return status === 'UP' ? 'status-up' : 'status-down';
});

// 根据节点类型获取基本信息字段（完全复用NodeInfoPanel的展示方式）
const getBasicInfoFields = (node: Node | null): Array<{label: string; key: string; value: any}> => {
  if (!node) return [];
  
  const fields: Array<{label: string; key: string; value: any}> = [
    { label: '节点名称', key: 'name', value: node.alias || node.name },
    { label: '节点类型', key: 'type', value: getNodeTypeLabel(node.type) }
  ];
  
  return fields;
};

// 处理故障状态切换
const handleFaultToggle = async (value: boolean) => {
  try {
    const convertRoleToNumber = (role: any): number => {
      if (typeof role === 'number') {
        return role;
      }
      if (typeof role === 'string') {
        const roleMap: Record<string, number> = {
          'WHITE': 1,
          'RED': 2,
          'BLUE': 3
        };
        return roleMap[role.toUpperCase()] || 1;
      }
      return 1;
    };

    const updatedNodeData = {
      ...fullNode.value,
      status: value ? 'DOWN' : 'UP',
      role: convertRoleToNumber(fullNode.value?.role)
    };

    // 立即更新本地节点副本的状态以显示UI变化
    if (localNodeData.value) {
      localNodeData.value.status = value ? 'DOWN' : 'UP';
    }
    faultConfig.value.enabled = value;

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

    // 失败时恢复之前的状态
    if (localNodeData.value) {
      localNodeData.value.status = value ? 'UP' : 'DOWN';
    }
    faultConfig.value.enabled = !value;
  }
};

// 删除节点
const handleDelete = async () => {
  if (isSimulationRunning.value && isWirelessEnvironmentNode.value) {
    ElMessage.warning('对无线环境进行操作请先暂停场景');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除节点"${fullNode.value?.alias || fullNode.value?.name}"吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        center: true,
        customClass: 'delete-confirm-box',
      }
    );
    await (topoStore as any).removeNodeRemote(fullNode.value?.id);
    ElMessage.success('节点已删除');
    handleClose();
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e?.message || '删除失败');
    }
  }
};

// 更改无线参数
// （已删除本文件中重复的短实现，保留在后面较完整的实现）

// 打开终端
const handleOpenTerminal = () => {
  emit('openTerminal', fullNode.value);
  handleClose();
};

// 打开信号级仿真对话框
const handleOpenSignalSimDialog = () => {
  emit('openSignalSim', fullNode.value);
  handleClose();
};

// 启动虚拟机
const handleStartVM = async () => {
  try {
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (!sessionId) {
      ElMessage.error("会话信息不完整，无法启动虚拟机");
      return;
    }

    const userInfo = getUserInfo();
    const userId = userInfo?.id;
    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    const nodeId = fullNode.value?.id;
    if (!nodeId) {
      ElMessage.error("节点信息不完整");
      return;
    }

    const response = await startVMNode(sessionId, nodeId, userId) as any;

    if (response && response.code === 200 && response.data) {
      ElMessage.success('虚拟机启动成功');
      const nodeName = fullNode.value?.alias || fullNode.value?.name || '虚拟机';
      emit('openVnc', {
        nodeId: nodeId,
        nodeName: nodeName,
        wsUrl: response.data
      });
    } else {
      ElMessage.error(response?.msg || '启动虚拟机失败');
    }
  } catch (error: any) {
    console.error('启动虚拟机失败:', error);
    ElMessage.error(error?.message || '启动虚拟机失败，请重试');
  }
};

// 关闭虚拟机
const handleStopVM = async () => {
  try {
    const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
    if (!sessionId) {
      ElMessage.error("会话信息不完整，无法关闭虚拟机");
      return;
    }

    const userInfo = getUserInfo();
    const userId = userInfo?.id;
    if (!userId) {
      ElMessage.error("用户信息不完整，请重新登录");
      return;
    }

    const nodeId = fullNode.value?.id;
    if (!nodeId) {
      ElMessage.error("节点信息不完整");
      return;
    }

    const response = await stopVMNode(sessionId, nodeId, userId) as any;

    if (response && response.code === 200) {
      ElMessage.success('虚拟机已关闭');
    } else {
      ElMessage.error(response?.msg || '关闭虚拟机失败');
    }
  } catch (error: any) {
    console.error('关闭虚拟机失败:', error);
    ElMessage.error(error?.message || '关闭虚拟机失败，请重试');
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
  ElMessage.success('虚拟机参数已更新');
};

// 打开协议配置对话框
const handleOpenProtocolConfig = () => {
  // 获取节点的所有网卡接口
  nodeInterfaces.value = [];
  if (!fullNode.value?.id) return;

  // 获取节点的所有链路
  const nodeLinks = (topoStore.topoData?.links || []).filter(
    (link: any) => link.node1_id === fullNode.value?.id || link.node2_id === fullNode.value?.id
  );

  // 从链路中提取接口信息
  nodeLinks.forEach((link: any) => {
    if (link.node1_id === fullNode.value?.id && link.iface1) {
      if (link.iface1.name && !nodeInterfaces.value.includes(link.iface1.name)) {
        nodeInterfaces.value.push(link.iface1.name);
      }
    } else if (link.node2_id === fullNode.value?.id && link.iface2) {
      if (link.iface2.name && !nodeInterfaces.value.includes(link.iface2.name)) {
        nodeInterfaces.value.push(link.iface2.name);
      }
    }
  });

  showProtocolConfigDialog.value = true;
};

// 处理协议配置保存
const handleProtocolSave = ({ config }: { config: any }) => {
  // 从保存的协议配置中提取已启用的协议，同步到 config_services
  const services: string[] = [];
  if (config.protocolOspf2 === 'on') services.push('OSPFv2');
  if (config.protocolOspf3 === 'on') services.push('OSPFv3');
  if (config.protocolRip === 'on') services.push('RIP');
  if (config.protocolIsis === 'on') services.push('IS-IS');
  if (config.protocolPim === 'on') services.push('PIM');
  if (config.protocolBgp === 'on') services.push('BGP');
  if (config.protocolSnapshot === 'on') services.push('Snapshot');
  if (config.protocolBackpressure === 'on') services.push('Backpressure');
  // 有动态协议时自动加上 zebra 基础服务
  if (services.length > 0) services.unshift('zebra');

  // 更新本地节点副本
  if (localNodeData.value) {
    localNodeData.value = { ...localNodeData.value, config_services: services };
  }
  // 同步到 topoStore
  if (fullNode.value?.id) {
    const storeNode = topoStore.topoData?.nodes?.find((n: any) => n.id === fullNode.value?.id);
    if (storeNode) {
      storeNode.config_services = services;
    }
  }

  ElMessage.success('协议配置已保存');
  showProtocolConfigDialog.value = false;
};

// 打开静态路由配置对话框
const handleOpenStaticRouteConfig = () => {
  // 获取节点的所有网卡接口
  nodeInterfaces.value = [];
  if (!fullNode.value?.id) return;

  // 获取节点的所有链路
  const nodeLinks = (topoStore.topoData?.links || []).filter(
    (link: any) => link.node1_id === fullNode.value?.id || link.node2_id === fullNode.value?.id
  );

  // 从链路中提取接口信息
  nodeLinks.forEach((link: any) => {
    if (link.node1_id === fullNode.value?.id && link.iface1) {
      if (link.iface1.name && !nodeInterfaces.value.includes(link.iface1.name)) {
        nodeInterfaces.value.push(link.iface1.name);
      }
    } else if (link.node2_id === fullNode.value?.id && link.iface2) {
      if (link.iface2.name && !nodeInterfaces.value.includes(link.iface2.name)) {
        nodeInterfaces.value.push(link.iface2.name);
      }
    }
  });

  showStaticRouteDialog.value = true;
};

// 处理静态路由配置保存
const handleStaticRouteSave = ({ config }: { config: any }) => {
  // 静态路由配置保存逻辑
  ElMessage.success('静态路由配置已保存');
  showStaticRouteDialog.value = false;
};

// 子网参数修改相关状态
const subnetConfigData = ref<any>(null);
const slotConfig = ref({
  filePath: '',
  slotCount: 10,
  slotDuration: 1000
});

// 处理子网参数修改
const handleModifySubnetParams = () => {
  if (!fullNode.value) {
    ElMessage.error('节点信息不完整');
    return;
  }

  if (isSimulationRunning.value) {
    ElMessage.warning('仿真运行时无法修改参数，请先停止仿真');
    return;
  }

  subnetConfigData.value = {
    id: fullNode.value.id,
    name: fullNode.value.name,
    alias: fullNode.value.alias,
    geo: fullNode.value.geo || { lon: 0, lat: 0, alt: 0 },
    position: fullNode.value.position || { x: 0, y: 0, z: 0 },
    emane: fullNode.value.emane,
    emane_configs: fullNode.value.emane_configs,
    displayModel: (fullNode.value as any).displayModel,
    phy_type: fullNode.value.phy_type,
    role: fullNode.value.role,
    type: fullNode.value.type,
    model: fullNode.value.model
  };
  showSubnetConfigDialog.value = true;
};

// 处理子网参数修改确认
const handleSubnetConfigSave = (nodeData: any) => {
  if (fullNode.value && nodeData) {
    if (localNodeData.value && localNodeData.value.id === fullNode.value.id) {
      Object.assign(localNodeData.value, nodeData);
    }

    // 同步更新 topo store 中的节点数据，确保重新打开菜单时数据一致
    const storeNode = topoStore.topoData?.nodes?.find((n: Node) => n.id === fullNode.value!.id);
    if (storeNode) {
      Object.assign(storeNode, nodeData);
    }
  }
  showSubnetConfigDialog.value = false;
};

// 处理子网配置对话框关闭
const handleSubnetConfigClose = () => {
  showSubnetConfigDialog.value = false;
};

// 处理打开无线参数配置对话框
const handleOpenWirelessConfig = () => {
  if (!fullNode.value) {
    ElMessage.error('节点信息不完整');
    return;
  }

  if (isSimulationRunning.value) {
    ElMessage.warning('仿真运行时无法修改参数，请先停止仿真');
    return;
  }

  wirelessConfigData.value = {
    id: fullNode.value.id,
    name: fullNode.value.name,
    alias: fullNode.value.alias,
    geo: fullNode.value.geo || { lon: 0, lat: 0, alt: 0 },
    position: fullNode.value.position || { x: 0, y: 0, z: 0 },
    emane: fullNode.value.emane,
    emane_configs: fullNode.value.emane_configs,
    displayModel: (fullNode.value as any).displayModel,
    phy_type: fullNode.value.phy_type,
    role: fullNode.value.role,
    type: fullNode.value.type,
    model: fullNode.value.model
  };
  showWirelessConfigDialog.value = true;
};

// 处理无线参数配置对话框关闭
const handleWirelessConfigClose = () => {
  showWirelessConfigDialog.value = false;
};

// 处理无线参数配置保存
const handleWirelessConfigSave = (nodeData: any) => {
  if (fullNode.value && nodeData) {
    if (localNodeData.value && localNodeData.value.id === fullNode.value.id) {
      Object.assign(localNodeData.value, nodeData);
    }

    // 同步更新 topo store 中的节点数据，确保重新打开菜单时数据一致
    const storeNode = topoStore.topoData?.nodes?.find((n: Node) => n.id === fullNode.value!.id);
    if (storeNode) {
      Object.assign(storeNode, nodeData);
    }
  }
  showWirelessConfigDialog.value = false;
};

// 打开时隙配置对话框
const handleOpenSlotConfig = () => {
  if (!fullNode.value) {
    ElMessage.error('节点信息不完整');
    return;
  }
  showSlotConfigDialog.value = true;
};

// 处理时隙配置确认
const handleSlotConfigConfirm = async (config: any) => {
  try {
    slotConfig.value = { ...config };
    ElMessage.success('时隙配置已保存');
    showSlotConfigDialog.value = false;
  } catch (error: any) {
    ElMessage.error(error?.message || '时隙配置失败');
  }
};

// 处理时隙配置对话框关闭
const handleSlotConfigClose = () => {
  showSlotConfigDialog.value = false;
};

// 打开干扰参数配置对话框
const handleConfigInterference = () => {
  showInterferenceConfigDialog.value = true;
};

// 处理干扰参数配置确认
const handleInterferenceConfigConfirm = async (params: any) => {
  try {
    if (!fullNode.value || !interferenceNodeConfig.value) return;

    let newStatus = interferenceNodeConfig.value.status;
    if (newStatus === 'INSTANTIATION' &&
        (params.interferePowerdb || params.interfereFreq || params.azimuth || params.elevation)) {
      newStatus = 'DEFINITION';
    }

    interferenceStore.updateInterferenceConfig({
      ...interferenceNodeConfig.value,
      interferePowerdb: params.interferePowerdb !== null ? params.interferePowerdb.toString() : '',
      interfereFreq: params.interfereFreq !== null ? params.interfereFreq.toString() : '',
      azimuth: params.azimuth !== null ? params.azimuth.toString() : '',
      elevation: params.elevation !== null ? params.elevation.toString() : '',
      status: newStatus
    });

    ElMessage.success('干扰参数已更新');
  } catch (error: any) {
    console.error('更新干扰参数失败:', error);
    ElMessage.error(error?.message || '更新干扰参数失败');
  }
};

// 格式化内存
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

// 获取协议标签
const getProtocolLabel = (protocol: string): string => {
  const protocolMap: Record<string, string> = {
    'zebra': 'Zebra',
    'OSPFv2': 'OSPFv2',
    'OSPFv3': 'OSPFv3',
    'olsrd': 'OLSR',
    'BGP': 'BGP',
    'RIP': 'RIP',
    'IS-IS': 'IS-IS',
    'PIM': 'PIM',
    'Snapshot': 'Snapshot',
    'Backpressure': 'Backpressure'
  };
  return protocolMap[protocol] || protocol;
};
</script>

<style scoped>
.context-menu-container {
  position: fixed;
  z-index: 2000;
}

.menu-and-card-wrapper {
  position: fixed;
  display: flex;
  gap: 0;
  align-items: flex-start;
  z-index: 2000;
}

.menu-and-card-wrapper > * { flex-shrink: 0; }

/* 翻转时卡片绝对定位到菜单左侧，菜单位置不变 */
.menu-and-card-wrapper.flip-left > .basic-info-card,
.menu-and-card-wrapper.flip-left > .operation-card,
.menu-and-card-wrapper.flip-left > .history-card {
  position: absolute;
  right: 100%;
  top: 0;
}

.node-context-menu {
  position: relative;
  z-index: 2000;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1px solid rgba(0, 234, 255, 0.3);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 234, 255, 0.2);
  min-width: 160px;
  animation: contextMenuAppear 0.15s ease-out;
  backdrop-filter: blur(8px);
}

@keyframes contextMenuAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  padding: 12px 16px;
  color: #00eaff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(0, 234, 255, 0.1);
  font-size: 14px;
  user-select: none;
}

.history-query-block {
  margin: 8px 0 12px 0;
  padding: 8px;
  border-radius: 6px;
  background: rgba(255,255,255,0.02);
}
.history-toggle-btn {
  background: transparent;
  color: #00eaff;
  border: 1px solid rgba(0,234,255,0.08);
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
}

/* ========== 历史数据查询卡片 ========== */
.history-card {
  position: relative;
  z-index: 2000;
  width: 520px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.35);
  border-left: none;
  border-radius: 0 12px 12px 0;
  padding: 0;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 234, 255, 0.15);
  animation: cardAppear 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
  backdrop-filter: blur(10px);
}

/* 头部 */
.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(0, 234, 255, 0.12);
}

.history-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.history-header-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.history-header-title {
  color: #00eaff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.history-header-node {
  color: #9fb8d9;
  font-size: 12px;
  padding: 1px 8px;
  background: rgba(0, 234, 255, 0.08);
  border: 1px solid rgba(0, 234, 255, 0.15);
  border-radius: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.history-close-btn {
  background: transparent;
  border: none;
  color: rgba(0, 234, 255, 0.6);
  font-size: 15px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  line-height: 1;
}

.history-close-btn:hover {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
}

/* 查询表单 */
.history-form {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0, 234, 255, 0.08);
}

.history-form-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.history-form-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 140px;
}

.history-form-field label {
  color: #9fb8d9;
  font-size: 11px;
  letter-spacing: 0.3px;
}

.history-query-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 18px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  color: #fff;
  background: linear-gradient(135deg, #00839e 0%, #00bcd4 100%);
  box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
  transition: all 0.2s ease;
  flex-shrink: 0;
  height: 32px;
}

.history-query-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(0, 188, 212, 0.5);
  transform: translateY(-1px);
}

.history-query-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.history-btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spinBtn 0.6s linear infinite;
}

@keyframes spinBtn {
  to { transform: rotate(360deg); }
}

/* 图表区域 */
.history-chart-area {
  padding: 8px 14px 10px;
}

.history-chart-container {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 234, 255, 0.06);
  overflow: hidden;
}

.history-chart {
  width: 100%;
  height: 320px;
  background: transparent;
  box-sizing: border-box;
}

/* 空数据与错误状态 */
.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: #607d9b;
  font-size: 13px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px dashed rgba(0, 234, 255, 0.1);
}

.history-empty-icon {
  font-size: 28px;
  opacity: 0.5;
}

.history-error-state {
  color: #ff8a80;
  border-color: rgba(255, 107, 107, 0.15);
}

/* 数据摘要统计 */
.history-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 6px;
  padding: 0 14px 12px;
}

.history-summary-item {
  background: rgba(0, 234, 255, 0.04);
  border: 1px solid rgba(0, 234, 255, 0.1);
  border-radius: 6px;
  padding: 6px 8px;
  text-align: center;
  transition: all 0.2s ease;
}

.history-summary-item:hover {
  background: rgba(0, 234, 255, 0.08);
  border-color: rgba(0, 234, 255, 0.2);
}

.history-summary-label {
  font-size: 10px;
  color: #9fb8d9;
  margin-bottom: 3px;
  letter-spacing: 0.2px;
}

.history-summary-value {
  font-size: 14px;
  font-weight: 700;
}

.history-iface-select { margin-top:8px; display:flex; align-items:center; gap:8px; }
.iface-stats { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
.iface-stat { background: rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; min-width:120px; color:#cfeffd; }
.iface-stat .label { font-size:12px; color:#9fb8d9; }
.iface-stat .value { font-weight:700; margin-top:6px; }

.context-menu-item:last-child {
  border-bottom: none;
}

.context-menu-item:hover {
  background: rgba(0, 234, 255, 0.1);
  color: #fff;
  padding-left: 20px;
}

.menu-icon {
  font-size: 16px;
  min-width: 20px;
}

.menu-text {
  flex: 1;
}

/* 基本信息悬浮卡片 */
.basic-info-card {
  position: relative;
  z-index: 2001;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.4);
  border-left: none;
  border-radius: 0 12px 12px 0;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 234, 255, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 340px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 18px;
  animation: cardAppear 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
  backdrop-filter: blur(10px);
}

@keyframes cardAppear {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.info-section {
  margin-bottom: 16px;
}

.info-section:last-child {
  margin-bottom: 0;
}

.section-title {
  color: #00eaff;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 0.8px;
  padding-left: 8px;
  border-left: 3px solid rgba(0, 234, 255, 0.8);
  text-transform: uppercase;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  transition: all 0.2s ease;
}

.info-row:hover {
  background: rgba(0, 234, 255, 0.1);
  border-color: rgba(0, 234, 255, 0.35);
}

.info-row:last-child {
  margin-bottom: 0;
}

.alias-info-row {
  align-items: flex-start;
}

.location-row {
  padding: 10px 12px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  color: #eaf6ff;
  font-size: 13px;
  line-height: 1.5;
}

.info-label {
  color: #4ecfff;
  font-size: 12px;
  font-weight: 600;
  min-width: 65px;
  letter-spacing: 0.3px;
}

.info-value {
  color: #eaf6ff;
  font-size: 13px;
  font-weight: 500;
  text-align: right;
  flex: 1;
  margin-left: 12px;
  word-break: break-all;
}

.alias-info-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.alias-text {
  width: 100%;
}

.alias-action-row {
  display: flex;
  width: 100%;
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
  align-self: flex-end;
  padding: 4px 10px;
  background: linear-gradient(90deg, rgba(0, 234, 255, 0.22), rgba(64, 196, 255, 0.22));
  color: #dff6ff;
  font-size: 12px;
}

.alias-inline-btn:hover {
  box-shadow: 0 0 10px rgba(0, 234, 255, 0.25);
  transform: translateY(-1px);
}

.alias-action-btn {
  flex: 1;
  padding: 6px 0;
  color: #fff;
  font-size: 12px;
}

.alias-action-btn.save {
  background: linear-gradient(to right, #00839e, #00bcd4);
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

.alias-info-value :deep(.el-input) {
  width: 100%;
}

.alias-info-value :deep(.el-input__wrapper) {
  background: rgba(0, 234, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 234, 255, 0.2);
}

.alias-info-value :deep(.el-input__inner) {
  color: #eaf6ff;
  text-align: right;
}

.vm-template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}

.vm-template-item {
  background: rgba(0, 234, 255, 0.06);
  border: 1px solid rgba(0, 234, 255, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
  transition: all 0.2s ease;
}

.vm-template-item:hover {
  background: rgba(0, 234, 255, 0.1);
  border-color: rgba(0, 234, 255, 0.35);
}

.vm-template-item.full-width {
  grid-column: 1 / -1;
}

.item-label {
  color: #4ecfff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.3px;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.item-value {
  color: #eaf6ff;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  min-width: 56px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.role-public {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  color: #e0f2f1;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
}

.role-red {
  background: linear-gradient(135deg, rgba(255, 68, 68, 0.35), rgba(255, 100, 100, 0.15));
  color: #ff8888;
  border: 1.5px solid rgba(255, 68, 68, 0.6);
}

.role-blue {
  background: linear-gradient(135deg, rgba(0, 168, 255, 0.35), rgba(100, 200, 255, 0.15));
  color: #64d9ff;
  border: 1.5px solid rgba(0, 168, 255, 0.6);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  min-width: 56px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.status-up {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.35), rgba(102, 200, 100, 0.15));
  color: #81c784;
  border: 1.5px solid rgba(76, 175, 80, 0.6);
}

.status-down {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.35), rgba(255, 100, 88, 0.15));
  color: #ef5350;
  border: 1.5px solid rgba(244, 67, 54, 0.6);
}

.status-interference-inactive {
  background: linear-gradient(135deg, rgba(158, 158, 158, 0.35), rgba(180, 180, 180, 0.15));
  color: #9e9e9e;
  border: 1.5px solid rgba(158, 158, 158, 0.6);
}

.status-interference-configured {
  background: linear-gradient(135deg, rgba(33, 150, 243, 0.35), rgba(66, 165, 245, 0.15));
  color: #42a5f5;
  border: 1.5px solid rgba(33, 150, 243, 0.6);
}

.status-interference-active {
  background: linear-gradient(135deg, rgba(211, 47, 47, 0.35), rgba(229, 57, 53, 0.15));
  color: #ef5350;
  border: 1.5px solid rgba(211, 47, 47, 0.6);
}

.status-interference-shutdown {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.35), rgba(102, 200, 100, 0.15));
  color: #81c784;
  border: 1.5px solid rgba(76, 175, 80, 0.6);
}

.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1999;
}

.data-manage-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2001;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  width: 90%;
  max-width: 400px;
  backdrop-filter: blur(8px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 234, 255, 0.2);
  color: #00eaff;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #00eaff;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.panel-content {
  padding: 20px;
}

.placeholder {
  text-align: center;
  color: rgba(0, 234, 255, 0.5);
  padding: 40px 20px;
}

/* 故障设置样式 */
.fault-config {
  padding: 12px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(0, 234, 255, 0.2);
}

.fault-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.fault-label {
  color: #4ecfff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

/* 为 ElSwitch 自定义样式 */
:deep(.el-switch) {
  --el-switch-on-color: #ff4949;
  --el-switch-off-color: #13ce66;
}

:deep(.el-switch__label) {
  color: #eaf6ff;
  font-size: 12px;
  font-weight: 500;
  margin-left: 8px;
}

/* 节点操作悬浮卡片 */
.operation-card {
  position: relative;
  z-index: 2001;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.4);
  border-left: none;
  border-radius: 0 12px 12px 0;
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 234, 255, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 360px;
  max-height: 600px;
  padding: 18px;
  animation: cardAppear 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
  backdrop-filter: blur(10px);
  overflow-y: auto;
}

.operation-section {
  margin-bottom: 0;
}

.operation-section:not(:first-child) {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(0, 234, 255, 0.15);
}

.operation-section .section-title {
  color: #00eaff;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: 0.8px;
  padding-left: 8px;
  border-left: 3px solid rgba(0, 234, 255, 0.8);
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.operation-section .section-title svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* 操作按钮组样式 */
.operation-buttons-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1.5px solid rgba(0, 234, 255, 0.3);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(0, 234, 255, 0.08), rgba(100, 200, 255, 0.05));
  color: #64d9ff;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.operation-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
  transition: left 0.5s;
}

.operation-btn:hover {
  border-color: rgba(0, 234, 255, 0.6);
  background: linear-gradient(135deg, rgba(0, 234, 255, 0.15), rgba(100, 200, 255, 0.12));
  box-shadow: 
    0 0 15px rgba(0, 234, 255, 0.25),
    inset 0 0 10px rgba(0, 234, 255, 0.1);
  color: #00eaff;
  transform: translateY(-2px);
}

.operation-btn:hover::before {
  left: 100%;
}

.operation-btn:active {
  transform: translateY(0);
  box-shadow: inset 0 0 10px rgba(0, 234, 255, 0.15);
}

.operation-btn svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* 不同按钮的颜色主题 */
.operation-btn.signal-btn {
  border-color: rgba(255, 200, 0, 0.3);
  background: linear-gradient(135deg, rgba(255, 200, 0, 0.08), rgba(255, 180, 0, 0.05));
  color: #ffc800;
}

.operation-btn.signal-btn:hover {
  border-color: rgba(255, 200, 0, 0.6);
  background: linear-gradient(135deg, rgba(255, 200, 0, 0.15), rgba(255, 180, 0, 0.12));
  box-shadow: 
    0 0 15px rgba(255, 200, 0, 0.25),
    inset 0 0 10px rgba(255, 200, 0, 0.1);
  color: #ffdc4d;
}

.operation-btn.terminal-btn {
  border-color: rgba(76, 175, 80, 0.3);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.08), rgba(56, 142, 60, 0.05));
  color: #81c784;
}

.operation-btn.terminal-btn:hover {
  border-color: rgba(76, 175, 80, 0.6);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(56, 142, 60, 0.12));
  box-shadow: 
    0 0 15px rgba(76, 175, 80, 0.25),
    inset 0 0 10px rgba(76, 175, 80, 0.1);
  color: #a5d6a7;
}

.operation-btn.delete-btn {
  border-color: rgba(244, 67, 54, 0.3);
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.08), rgba(229, 57, 53, 0.05));
  color: #ef5350;
}

.operation-btn.delete-btn:hover {
  border-color: rgba(244, 67, 54, 0.6);
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(229, 57, 53, 0.12));
  box-shadow: 
    0 0 15px rgba(244, 67, 54, 0.25),
    inset 0 0 10px rgba(244, 67, 54, 0.1);
  color: #ff8a80;
}

/* 子网参数修改按钮 */
.operation-btn.subnet-config-btn {
  border-color: rgba(0, 188, 212, 0.3);
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.08), rgba(0, 172, 193, 0.05));
  color: #4dd0e1;
}

.operation-btn.subnet-config-btn:hover {
  border-color: rgba(0, 188, 212, 0.6);
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.15), rgba(0, 172, 193, 0.12));
  box-shadow:
    0 0 15px rgba(0, 188, 212, 0.25),
    inset 0 0 10px rgba(0, 188, 212, 0.1);
  color: #80deea;
}

/* 时隙配置按钮 */
.operation-btn.slot-config-btn {
  border-color: rgba(255, 152, 0, 0.3);
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.08), rgba(245, 124, 0, 0.05));
  color: #ffb74d;
}

.operation-btn.slot-config-btn:hover {
  border-color: rgba(255, 152, 0, 0.6);
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(245, 124, 0, 0.12));
  box-shadow:
    0 0 15px rgba(255, 152, 0, 0.25),
    inset 0 0 10px rgba(255, 152, 0, 0.1);
  color: #ffcc80;
}

/* 干扰参数配置按钮 */
.operation-btn.interference-config-btn {
  border-color: rgba(211, 47, 47, 0.3);
  background: linear-gradient(135deg, rgba(211, 47, 47, 0.08), rgba(183, 28, 28, 0.05));
  color: #ef5350;
}

.operation-btn.interference-config-btn:hover {
  border-color: rgba(211, 47, 47, 0.6);
  background: linear-gradient(135deg, rgba(211, 47, 47, 0.15), rgba(183, 28, 28, 0.12));
  box-shadow:
    0 0 15px rgba(211, 47, 47, 0.25),
    inset 0 0 10px rgba(211, 47, 47, 0.1);
  color: #ef9a9a;
}

/* 干扰功率滑动条 */
.power-slider-section {
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(211, 47, 47, 0.06);
  border: 1px solid rgba(211, 47, 47, 0.2);
  border-radius: 8px;
}

.power-slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.power-slider-label {
  color: #ef5350;
  font-size: 11px;
  font-weight: 600;
}

.power-slider-value {
  color: #eaf6ff;
  font-size: 12px;
  font-weight: 700;
}

.power-slider-container {
  padding: 0 4px;
}

.power-slider-container :deep(.el-slider__runway) {
  background-color: rgba(211, 47, 47, 0.15);
  height: 6px;
}

.power-slider-container :deep(.el-slider__bar) {
  background: linear-gradient(to right, #B71C1C, #D32F2F);
  height: 6px;
}

.power-slider-container :deep(.el-slider__button) {
  width: 16px;
  height: 16px;
  border: 2px solid #D32F2F;
  background-color: #fff;
  transition: all 0.2s ease;
}

.power-slider-container :deep(.el-slider__button:hover) {
  transform: scale(1.2);
  box-shadow: 0 0 8px rgba(211, 47, 47, 0.6);
}

.power-slider-container :deep(.el-slider__button-wrapper) {
  top: -5px;
}

/* 虚拟机启动按钮 */
.operation-btn.vm-start-btn {
  border-color: rgba(76, 175, 80, 0.3);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.08), rgba(56, 142, 60, 0.05));
  color: #81c784;
}

.operation-btn.vm-start-btn:hover {
  border-color: rgba(76, 175, 80, 0.6);
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(56, 142, 60, 0.12));
  box-shadow: 
    0 0 15px rgba(76, 175, 80, 0.25),
    inset 0 0 10px rgba(76, 175, 80, 0.1);
  color: #a5d6a7;
}

/* 虚拟机关闭按钮 */
.operation-btn.vm-stop-btn {
  border-color: rgba(244, 67, 54, 0.3);
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.08), rgba(229, 57, 53, 0.05));
  color: #ef5350;
}

.operation-btn.vm-stop-btn:hover {
  border-color: rgba(244, 67, 54, 0.6);
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.15), rgba(229, 57, 53, 0.12));
  box-shadow: 
    0 0 15px rgba(244, 67, 54, 0.25),
    inset 0 0 10px rgba(244, 67, 54, 0.1);
  color: #ff8a80;
}

/* 虚拟机参数编辑按钮 */
.operation-btn.vm-edit-btn {
  border-color: rgba(255, 200, 0, 0.3);
  background: linear-gradient(135deg, rgba(255, 200, 0, 0.08), rgba(255, 180, 0, 0.05));
  color: #ffc800;
}

.operation-btn.vm-edit-btn:hover {
  border-color: rgba(255, 200, 0, 0.6);
  background: linear-gradient(135deg, rgba(255, 200, 0, 0.15), rgba(255, 180, 0, 0.12));
  box-shadow: 
    0 0 15px rgba(255, 200, 0, 0.25),
    inset 0 0 10px rgba(255, 200, 0, 0.1);
  color: #ffdc4d;
}

/* 协议配置按钮 */
.operation-btn.protocol-btn {
  border-color: rgba(102, 179, 255, 0.3);
  background: linear-gradient(135deg, rgba(102, 179, 255, 0.08), rgba(100, 150, 255, 0.05));
  color: #66b3ff;
}

.operation-btn.protocol-btn:hover {
  border-color: rgba(102, 179, 255, 0.6);
  background: linear-gradient(135deg, rgba(102, 179, 255, 0.15), rgba(100, 150, 255, 0.12));
  box-shadow: 
    0 0 15px rgba(102, 179, 255, 0.25),
    inset 0 0 10px rgba(102, 179, 255, 0.1);
  color: #99ccff;
}

/* 静态路由配置按钮 */
.operation-btn.static-route-btn {
  border-color: rgba(153, 102, 255, 0.3);
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.08), rgba(150, 100, 255, 0.05));
  color: #9966ff;
}

.operation-btn.static-route-btn:hover {
  border-color: rgba(153, 102, 255, 0.6);
  background: linear-gradient(135deg, rgba(153, 102, 255, 0.15), rgba(150, 100, 255, 0.12));
  box-shadow: 
    0 0 15px rgba(153, 102, 255, 0.25),
    inset 0 0 10px rgba(153, 102, 255, 0.1);
  color: #b399ff;
}

/* 无线参数配置按钮 */
.operation-btn.wireless-config-btn {
  border-color: rgba(102, 255, 179, 0.3);
  background: linear-gradient(135deg, rgba(102, 255, 179, 0.08), rgba(100, 255, 150, 0.05));
  color: #66ffb3;
}

.operation-btn.wireless-config-btn:hover {
  border-color: rgba(102, 255, 179, 0.6);
  background: linear-gradient(135deg, rgba(102, 255, 179, 0.15), rgba(100, 255, 150, 0.12));
  box-shadow: 
    0 0 15px rgba(102, 255, 179, 0.25),
    inset 0 0 10px rgba(102, 255, 179, 0.1);
  color: #99ffcc;
}

/* 故障配置样式 */
.fault-config {
  padding: 0;
}

.fault-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 6px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  transition: all 0.2s ease;
}

.fault-item:hover {
  background: rgba(0, 234, 255, 0.1);
  border-color: rgba(0, 234, 255, 0.35);
}

.fault-label {
  font-size: 13px;
  color: #64d9ff;
  font-weight: 500;
}

/* 协议信息悬浮卡片 */
.protocol-info-card {
  position: relative;
  z-index: 2001;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.4);
  border-left: none;
  border-radius: 0 12px 12px 0;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 234, 255, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 320px;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  padding: 18px;
  animation: cardAppear 0.25s cubic-bezier(0.4, 0.0, 0.2, 1);
  backdrop-filter: blur(10px);
}

.protocol-section {
  margin-bottom: 0;
}

.protocol-section .section-title {
  color: #00eaff;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 0.8px;
  padding-left: 8px;
  border-left: 3px solid rgba(0, 234, 255, 0.8);
  text-transform: uppercase;
}

.protocol-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.protocol-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 6px;
  border: 1px solid rgba(0, 234, 255, 0.2);
  transition: all 0.2s ease;
}

.protocol-item:hover {
  background: rgba(0, 234, 255, 0.1);
  border-color: rgba(0, 234, 255, 0.35);
}

.protocol-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(0, 168, 255, 0.35), rgba(100, 200, 255, 0.15));
  color: #64d9ff;
  border: 1.5px solid rgba(0, 168, 255, 0.6);
  letter-spacing: 0.3px;
  flex: 1;
}

.no-protocol {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 10px;
}

.no-protocol-text {
  text-align: center;
  color: rgba(0, 234, 255, 0.5);
  font-size: 12px;
}

/* 数据管理悬浮卡片 */
.data-manage-card {
  position: fixed;
  z-index: 9999;
  background: linear-gradient(135deg, #0f1929 0%, #1a2847 100%);
  border: 1.5px solid rgba(0, 234, 255, 0.4);
  border-radius: 12px;
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 20px rgba(0, 234, 255, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  width: 320px;
  min-width: 260px;
  min-height: 120px;
  max-height: calc(100vh - 24px);
  overflow: auto;
  padding: 18px;
  backdrop-filter: blur(10px);
  resize: both;
}

.data-manage-section {
  margin-bottom: 0;
}

.data-manage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.data-manage-section .section-title {
  color: #00eaff;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  letter-spacing: 0.8px;
  padding-left: 8px;
  border-left: 3px solid rgba(0, 234, 255, 0.8);
  text-transform: uppercase;
}

.data-manage-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  background: rgba(0, 234, 255, 0.06);
  border-radius: 8px;
  border: 1px solid rgba(0, 234, 255, 0.2);
}

.placeholder-text {
  text-align: center;
  color: rgba(0, 234, 255, 0.5);
  font-size: 12px;
}

/* EMANE节点数据样式 */
.emane-node-block {
  margin-bottom: 12px;
}

.emane-node-block:last-of-type {
  margin-bottom: 0;
}

.emane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.emane-label {
  color: #4ecfff;
  font-size: 12px;
  font-weight: 600;
}

.emane-nem-tag {
  background: rgba(0, 234, 255, 0.15);
  border: 1px solid rgba(0, 234, 255, 0.4);
  border-radius: 4px;
  padding: 2px 8px;
  color: #00eaff;
  font-size: 11px;
  font-weight: 600;
}

.emane-nem-tag.small {
  font-size: 10px;
  padding: 1px 5px;
}

.emane-neighbor-block {
  margin-bottom: 10px;
  padding: 8px;
  background: rgba(0, 234, 255, 0.04);
  border: 1px solid rgba(0, 234, 255, 0.12);
  border-radius: 6px;
}

.emane-neighbor-block:last-child {
  margin-bottom: 0;
}

.emane-neighbor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 234, 255, 0.1);
}

.emane-neighbor-name {
  color: #b8d4ff;
  font-size: 11px;
  font-weight: 600;
}

.emane-table-section {
  margin-bottom: 10px;
}

.emane-table-section:last-of-type {
  margin-bottom: 0;
}

.emane-table-title {
  color: rgba(0, 234, 255, 0.8);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 6px;
  padding-left: 2px;
  border-left: 2px solid rgba(0, 234, 255, 0.5);
  padding-left: 6px;
}

.emane-metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.emane-metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 234, 255, 0.06);
  border: 1px solid rgba(0, 234, 255, 0.12);
  border-radius: 6px;
  padding: 5px 10px;
}

.metric-label {
  color: rgba(0, 234, 255, 0.6);
  font-size: 11px;
}

.metric-value {
  color: #eaf6ff;
  font-size: 12px;
  font-weight: 600;
}

.value-warn {
  color: #ff9800;
}

.emane-no-data {
  text-align: center;
  color: rgba(0, 234, 255, 0.4);
  font-size: 11px;
  padding: 8px;
}

.emane-update-time {
  margin-top: 8px;
  text-align: right;
  color: rgba(0, 234, 255, 0.4);
  font-size: 10px;
}

/* 被动测量（网卡）样式 */
.iface-block {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: linear-gradient(180deg, rgba(10,18,30,0.55), rgba(12,26,46,0.6));
  border: 1px solid rgba(0, 234, 255, 0.08);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(2,8,20,0.6), inset 0 1px 0 rgba(255,255,255,0.02);
}

.iface-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.iface-name {
  color: #cfefff;
  font-size: 13px;
  font-weight: 700;
}

.iface-id {
  color: rgba(0,234,255,0.45);
  font-size: 11px;
  background: rgba(0,234,255,0.03);
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid rgba(0,234,255,0.06);
}

.iface-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 12px;
}

.iface-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0,234,255,0.03);
  border: 1px solid rgba(0,234,255,0.04);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: rgba(235,245,255,0.9);
}

.iface-item strong {
  color: #eaf6ff;
  font-weight: 700;
}

.passive-update-time {
  margin-top: 8px;
  text-align: right;
  color: rgba(0, 234, 255, 0.36);
  font-size: 11px;
}
</style>
