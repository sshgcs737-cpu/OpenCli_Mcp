<template>
  <Teleport to="body">
    <div v-if="dialogVisible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <!-- 标题栏 -->
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">{{ props.isEditMode ? '修改子网参数' : '子网配置' }}</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="custom-dialog-body">
          <!-- 链路层模型选择 -->
          <div v-if="!selectedModel" class="model-selection-container">
            <div class="section-title-block">
              <div class="title-indicator"></div>
              <span class="section-title">请选择链路层模型</span>
            </div>
            <div class="model-selection">
              <div
                v-for="model in linkLayerModels"
                :key="model.value"
                class="model-item"
                :class="{ 'model-item-active': tempSelectedModel === model.value }"
                @click="tempSelectedModel = model.value"
              >
                <h4 class="model-title">{{ model.label }}</h4>
                <p class="model-description">{{ model.description }}</p>
              </div>
            </div>

            <!-- 物理层模型选择 -->
            <div class="section-title-block" style="margin-top: 24px;">
              <div class="title-indicator"></div>
              <span class="section-title">请选择物理层模型</span>
            </div>
            <div class="model-selection">
              <div
                v-for="model in physicalLayerModels"
                :key="model.value"
                class="model-item"
                :class="{ 
                  'model-item-active': tempSelectedPhyModel === model.value,
                  'model-item-disabled': !isPhyModelAvailable(model.value)
                }"
                @click="selectPhyModel(model.value)"
              >
                <h4 class="model-title">{{ model.label }}</h4>
                <p class="model-description">{{ model.description }}</p>
              </div>
            </div>
            
            <div class="model-actions">
              <el-button class="dialog-btn cancel-btn" @click="handleClose"
                >取消</el-button
              >
              <el-button
                class="dialog-btn confirm-btn"
                type="primary"
                @click="confirmModelSelection"
                :disabled="!tempSelectedModel"
              >
                下一步
              </el-button>
            </div>

          </div>

          <!-- 模型配置选项 -->
          <div v-if="selectedModel" class="config-layout">
            <!-- 左侧：基本信息 -->
            <div class="config-column left-column">
              <div class="config-section">
                <div class="section-title-block">
                  <div class="title-indicator"></div>
                  <span class="section-title">基本信息</span>
                </div>

                <div class="form-content">
                  <div class="form-row">
                    <div class="form-label">子网名称</div>
                    <el-input
                      v-model="nodeForm.alias"
                      placeholder="请输入子网名称"
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">模型类型</div>
                    <el-input v-model="displayModelName" disabled class="form-input" />
                  </div>
                  
                  <div class="form-row" v-if="!isNormalMode">
                    <div class="form-label">节点角色</div>
                    <div class="form-input role-radio-group">
                      <el-radio-group v-model="nodeForm.role">
                        <el-radio
                          v-for="option in ROLE_OPTIONS"
                          :key="option.value"
                          :label="option.value"
                        >
                          {{ option.label }}
                        </el-radio>
                      </el-radio-group>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右侧：坐标信息 -->
            <div class="config-column right-column">
              <div class="config-section">
                <div class="section-title-block">
                  <div class="title-indicator"></div>
                  <span class="section-title">坐标信息</span>
                </div>

                <div class="form-content">
                  <div class="form-row">
                    <div class="form-label">X</div>
                    <el-input
                      :model-value="formatCoord(geoToENU(nodeForm.geo.lon, nodeForm.geo.lat, nodeForm.geo.alt).x)"
                      disabled
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">Y</div>
                    <el-input
                      :model-value="formatCoord(geoToENU(nodeForm.geo.lon, nodeForm.geo.lat, nodeForm.geo.alt).y)"
                      disabled
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">Z</div>
                    <el-input
                      v-model="nodeForm.geo.alt"
                      type="number"
                      class="form-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部：配置参数 -->
            <div class="config-section full-width">
              <div class="section-title-block">
                <div class="title-indicator"></div>
                <span class="section-title">模型参数配置</span>
              </div>

              <el-tabs v-model="activeTab" type="card" class="subnet-tabs">

                <!-- MAC参数选项卡 -->
                <el-tab-pane label="MAC参数" name="mac">
                  <div class="tab-content-wrapper">
                    <!-- Bypass模型MAC参数 -->
                    <template v-if="selectedModel === 'bypass'">
                      <div class="empty-config">
                        <el-empty description="Bypass模型没有MAC层参数配置" />
                      </div>
                    </template>

                    <!-- RF Pipe模型MAC参数 -->
                    <template v-else-if="selectedModel === 'rfpipe'">
                      <div class="config-subsection">
                        <h4 class="subsection-title">基本参数</h4>

                        <div class="form-row">
                          <div class="form-label">数据速率 (bps)</div>
                          <el-input v-model="configs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">延迟 (秒)</div>
                          <el-input v-model="configs.mac.delay" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用混杂模式</div>
                          <el-select
                            v-model="configs.mac.enablepromiscuousmode"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用流量控制</div>
                          <el-select
                            v-model="configs.mac.flowcontrolenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">流量控制令牌</div>
                          <el-input
                            v-model="configs.mac.flowcontroltokens"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">抖动 (秒)</div>
                          <el-input v-model="configs.mac.jitter" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标删除时间 (秒)</div>
                          <el-input
                            v-model="configs.mac.neighbormetricdeletetime"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI文件</div>
                          <div class="form-input-with-button">
                            <el-input
                              v-model="configs.mac.pcrcurveuri"
                              class="form-input"
                            />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用无线电度量</div>
                          <el-select
                            v-model="configs.mac.radiometricenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">无线电度量报告间隔 (秒)</div>
                          <el-input
                            v-model="configs.mac.radiometricreportinterval"
                            class="form-input"
                          />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">RF信号表配置</h4>

                        <div class="form-row">
                          <div class="form-label">平均所有天线</div>
                          <el-select
                            v-model="configs.mac['rfsignaltable.averageallantennas']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">平均所有频率</div>
                          <el-select
                            v-model="configs.mac['rfsignaltable.averageallfrequencies']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>
                      </div>
                    </template>

                    <!-- TDMA模型MAC参数 -->
                    <template v-else-if="selectedModel === 'tdma'">
                      <div class="config-subsection">
                        <h4 class="subsection-title">基本参数</h4>

                        <div class="form-row">
                          <div class="form-label">数据速率 (bps)</div>
                          <el-input v-model="configs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用流量控制</div>
                          <el-select
                            v-model="configs.mac.flowcontrolenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">流量控制令牌</div>
                          <el-input
                            v-model="configs.mac.flowcontroltokens"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">碎片检查阈值</div>
                          <el-input
                            v-model="configs.mac.fragmentcheckthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">碎片超时阈值</div>
                          <el-input
                            v-model="configs.mac.fragmenttimeoutthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标删除时间 (秒)</div>
                          <el-input
                            v-model="configs.mac.neighbormetricdeletetime"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标更新间隔 (秒)</div>
                          <el-input
                            v-model="configs.mac.neighbormetricupdateinterval"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI文件</div>
                          <div class="form-input-with-button">
                            <el-input
                              v-model="configs.mac.pcrcurveuri"
                              class="form-input"
                            />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">队列配置</h4>

                        <div class="form-row">
                          <div class="form-label">启用队列聚合</div>
                          <el-select
                            v-model="configs.mac['queue.aggregationenable']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列聚合时隙阈值</div>
                          <el-input
                            v-model="configs.mac['queue.aggregationslotthreshold']"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列深度</div>
                          <el-input
                            v-model="configs.mac['queue.depth']"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用队列分片</div>
                          <el-select
                            v-model="configs.mac['queue.fragmentationenable']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用严格出队</div>
                          <el-select
                            v-model="configs.mac['queue.strictdequeueenable']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">TDMA配置</h4>

                        <div class="form-row">
                          <div class="form-label">TDMA调度文件</div>
                          <div class="form-input-with-button">
                            <el-input v-model="configs.mac.schedule" class="form-input" />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>
                      </div>
                    </template>

                    <!-- Commeffect模型MAC参数 -->
                    <template v-else-if="selectedModel === 'commeffect'">
                      <div class="empty-config">
                        <el-empty description="该模型没有MAC层参数配置" />
                      </div>
                    </template>

                    <!-- IEEE 802.11模型MAC参数 -->
                    <template v-else-if="selectedModel === 'ieee80211abg'">
                      <div class="config-subsection">
                        <h4 class="subsection-title">基本参数</h4>

                        <div class="form-row">
                          <div class="form-label">数据速率 (bps)</div>
                          <el-input v-model="configs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">模式</div>
                          <el-select v-model="(configs.mac as any).mode" class="form-input">
                            <el-option label="802.11b" value="0" />
                            <el-option label="802.11a" value="1" />
                            <el-option label="802.11g" value="2" />
                            <el-option label="802.11abg" value="3" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">单播速率</div>
                          <el-select v-model="(configs.mac as any).unicastrate" class="form-input">
                            <el-option label="1 Mbps" value="1" />
                            <el-option label="2 Mbps" value="2" />
                            <el-option label="5.5 Mbps" value="3" />
                            <el-option label="11 Mbps" value="4" />
                            <el-option label="6 Mbps" value="5" />
                            <el-option label="9 Mbps" value="6" />
                            <el-option label="12 Mbps" value="7" />
                            <el-option label="18 Mbps" value="8" />
                            <el-option label="24 Mbps" value="9" />
                            <el-option label="36 Mbps" value="10" />
                            <el-option label="48 Mbps" value="11" />
                            <el-option label="54 Mbps" value="12" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">组播速率</div>
                          <el-select v-model="(configs.mac as any).multicastrate" class="form-input">
                            <el-option label="1 Mbps" value="1" />
                            <el-option label="2 Mbps" value="2" />
                            <el-option label="5.5 Mbps" value="3" />
                            <el-option label="11 Mbps" value="4" />
                            <el-option label="6 Mbps" value="5" />
                            <el-option label="9 Mbps" value="6" />
                            <el-option label="12 Mbps" value="7" />
                            <el-option label="18 Mbps" value="8" />
                            <el-option label="24 Mbps" value="9" />
                            <el-option label="36 Mbps" value="10" />
                            <el-option label="48 Mbps" value="11" />
                            <el-option label="54 Mbps" value="12" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">RTS阈值</div>
                          <el-input v-model="(configs.mac as any).rtsthreshold" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">距离 (m)</div>
                          <el-input v-model="(configs.mac as any).distance" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居超时 (秒)</div>
                          <el-input v-model="(configs.mac as any).neighbortimeout" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI</div>
                          <div class="form-input-with-button">
                            <el-input v-model="configs.mac.pcrcurveuri" class="form-input" />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用WMM</div>
                          <el-select v-model="(configs.mac as any).wmmenable" class="form-input">
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">队列和访问参数</h4>

                        <div class="form-row">
                          <div class="form-label">队列0大小</div>
                          <el-input v-model="(configs.mac as any).queuesize0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列1大小</div>
                          <el-input v-model="(configs.mac as any).queuesize1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列2大小</div>
                          <el-input v-model="(configs.mac as any).queuesize2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列3大小</div>
                          <el-input v-model="(configs.mac as any).queuesize3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS0 (秒)</div>
                          <el-input v-model="(configs.mac as any).aifs0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS1 (秒)</div>
                          <el-input v-model="(configs.mac as any).aifs1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS2 (秒)</div>
                          <el-input v-model="(configs.mac as any).aifs2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS3 (秒)</div>
                          <el-input v-model="(configs.mac as any).aifs3" class="form-input" />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">竞争窗口参数</h4>

                        <div class="form-row">
                          <div class="form-label">CWMin0</div>
                          <el-input v-model="(configs.mac as any).cwmin0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin1</div>
                          <el-input v-model="(configs.mac as any).cwmin1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin2</div>
                          <el-input v-model="(configs.mac as any).cwmin2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin3</div>
                          <el-input v-model="(configs.mac as any).cwmin3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax0</div>
                          <el-input v-model="(configs.mac as any).cwmax0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax1</div>
                          <el-input v-model="(configs.mac as any).cwmax1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax2</div>
                          <el-input v-model="(configs.mac as any).cwmax2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax3</div>
                          <el-input v-model="(configs.mac as any).cwmax3" class="form-input" />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">其他参数</h4>

                        <div class="form-row">
                          <div class="form-label">TXOP0 (秒)</div>
                          <el-input v-model="(configs.mac as any).txop0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP1 (秒)</div>
                          <el-input v-model="(configs.mac as any).txop1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP2 (秒)</div>
                          <el-input v-model="(configs.mac as any).txop2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP3 (秒)</div>
                          <el-input v-model="(configs.mac as any).txop3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制0</div>
                          <el-input v-model="(configs.mac as any).retrylimit0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制1</div>
                          <el-input v-model="(configs.mac as any).retrylimit1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制2</div>
                          <el-input v-model="(configs.mac as any).retrylimit2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制3</div>
                          <el-input v-model="(configs.mac as any).retrylimit3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">活动估计计时器 (秒)</div>
                          <el-input v-model="(configs.mac as any).channelactivityestimationtimer" class="form-input" />
                        </div>
                      </div>
                    </template>

                    <!-- 其他模型或未选择模型 -->
                    <template v-else>
                      <div class="empty-config">
                        <el-empty description="请先选择链路层模型" />
                      </div>
                    </template>
                  </div>
                </el-tab-pane>

                <!-- 物理层参数选项卡 -->
                <el-tab-pane label="物理层参数" name="phy">
                  <div class="tab-content-wrapper">
                    <!-- 无物理层参数的模型 -->
                    <template v-if="['bypass', 'commeffect'].includes(selectedModel)">
                      <div class="empty-config">
                        <el-empty description="该模型没有物理层参数配置" />
                      </div>
                    </template>

                    <!-- 有物理层参数的模型 -->
                    <template
                      v-else-if="
                        ['rfpipe', 'tdma', 'ieee80211abg'].includes(selectedModel)
                      "
                    >
                      <div class="config-subsection">
                        <h4 class="subsection-title">基本参数</h4>

                        <div class="form-row">
                          <div class="form-label">带宽 (Hz)</div>
                          <el-input v-model="configs.phy.bandwidth" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">通道代码</div>
                          <el-select v-model="configs.phy.channelcode" class="form-input">
                            <el-option label="无" value="none" />
                            <el-option label="LDPC 1/2" value="ldpc12" />
                            <el-option label="LDPC 2/3" value="ldpc23" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">兼容模式</div>
                          <el-select
                            v-model="configs.phy.compatibilitymode"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">频率 (Hz)</div>
                          <el-input v-model="configs.phy.frequency" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">关注频率 (Hz)</div>
                          <el-input
                            v-model="configs.phy.frequencyofinterest"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">传播模型</div>
                          <el-select
                            v-model="configs.phy.propagationmodel"
                            class="form-input"
                          >
                            <el-option label="两射线地面反射" value="2ray" />
                            <el-option label="自由空间" value="freespace" />
                            <el-option label="预定义参数" value="precomputed" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">子ID</div>
                          <el-input v-model="configs.phy.subid" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">系统噪声系数</div>
                          <el-input
                            v-model="configs.phy.systemnoisefigure"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">发射功率 (dB)</div>
                          <el-input v-model="configs.phy.txpower" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">时间同步阈值</div>
                          <el-input
                            v-model="configs.phy.timesyncthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">处理池大小</div>
                          <el-input
                            v-model="configs.phy.processingpoolsize"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">频谱掩码索引</div>
                          <el-input
                            v-model="configs.phy.spectralmaskindex"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">随机损失环境</div>
                          <el-select
                            v-model="configs.phy.randomlossenvironment"
                            class="form-input"
                          >
                            <el-option label="无" value="none" />
                            <el-option label="城市" value="urban" />
                            <el-option label="郊区" value="suburban" />
                          </el-select>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">开关选项</h4>

                        <div class="form-row">
                          <div class="form-label">启用多普勒频移</div>
                          <el-select
                            v-model="configs.phy.dopplershiftenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">排除相同子ID</div>
                          <el-select
                            v-model="configs.phy.excludesamesubidfromfilterenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">固定天线增益启用</div>
                          <el-select
                            v-model="configs.phy.fixedantennagainenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">固定天线增益</div>
                          <el-input
                            v-model="configs.phy.fixedantennagain"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用混杂接收敏感性</div>
                          <el-select
                            v-model="configs.phy.rxsensitivitypromiscuousmodeenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">噪声配置</h4>

                        <div class="form-row">
                          <div class="form-label">噪声模式</div>
                          <el-select v-model="configs.phy.noisemode" class="form-input">
                            <el-option label="无" value="none" />
                            <el-option label="全部" value="all" />
                            <el-option label="带外" value="outofband" />
                            <el-option label="直通" value="passthrough" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大限制启用</div>
                          <el-select
                            v-model="configs.phy.noisemaxclampenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声分箱大小</div>
                          <el-input
                            v-model="configs.phy.noisebinsize"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大消息传播</div>
                          <el-input
                            v-model="configs.phy.noisemaxmessagepropagation"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大段持续时间</div>
                          <el-input
                            v-model="configs.phy.noisemaxsegmentduration"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大段偏移</div>
                          <el-input
                            v-model="configs.phy.noisemaxsegmentoffset"
                            class="form-input"
                          />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">衰落模型配置</h4>

                        <div class="form-row">
                          <div class="form-label">衰落模型</div>
                          <el-select
                            v-model="configs.phy['fading.model']"
                            class="form-input"
                            @change="handleFadingModelChange"
                          >
                            <el-option label="无" value="none" />
                            <el-option label="对数正态" value="lognormal" />
                            <el-option label="纳卡伽米" value="nakagami" />
                            <el-option label="莱斯" value="rician" />
                            <el-option label="瑞利" value="rayleigh" />
                            <el-option label="太赫兹" value="terahertz" />
                            <el-option label="时变" value="timevarying" />
                          </el-select>
                        </div>

                        <template v-if="configs.phy['fading.model'] === 'lognormal'">
                          <div class="form-row">
                            <div class="form-label">对数正态下限阈值</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.dlthresh']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态D均值</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.dmu']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态D标准差</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.dsigma']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态上限阈值</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.duthresh']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态L均值</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.lmean']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态L标准差</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.lstddev']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态最大路径损耗</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.maxpathloss']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态最小路径损耗</div>
                            <el-input
                              v-model="configs.phy['fading.lognormal.minpathloss']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="['nakagami', 'rician', 'rayleigh'].includes(configs.phy['fading.model'])">
                          <div class="form-row">
                            <div class="form-label">nakagami距离0</div>
                            <el-input
                              v-model="configs.phy['fading.nakagami.distance0']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami距离1</div>
                            <el-input
                              v-model="configs.phy['fading.nakagami.distance1']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami m0</div>
                            <el-input
                              v-model="configs.phy['fading.nakagami.m0']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami m1</div>
                            <el-input
                              v-model="configs.phy['fading.nakagami.m1']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami m2</div>
                            <el-input
                              v-model="configs.phy['fading.nakagami.m2']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="configs.phy['fading.model'] === 'terahertz'">
                          <div class="form-row">
                            <div class="form-label">太赫兹大气因子</div>
                            <el-input
                              v-model="configs.phy['fading.terahertz.atmosphericfactor']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">太赫兹频率 (Hz)</div>
                            <el-input
                              v-model="configs.phy['fading.terahertz.frequency']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">太赫兹降雨率 (mm/h)</div>
                            <el-input
                              v-model="configs.phy['fading.terahertz.rainrate']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="configs.phy['fading.model'] === 'timevarying'">
                          <div class="form-row">
                            <div class="form-label">时变多普勒频率 (Hz)</div>
                            <el-input
                              v-model="configs.phy['fading.timevarying.dopplerfrequency']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">时变衰落深度 (dB)</div>
                            <el-input
                              v-model="configs.phy['fading.timevarying.fadingdepth']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">时变路径损耗指数</div>
                            <el-input
                              v-model="configs.phy['fading.timevarying.pathlossexponent']"
                              class="form-input"
                            />
                          </div>
                        </template>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">统计参数</h4>

                        <div class="form-row">
                          <div class="form-label">观测功率表启用</div>
                          <el-select
                            v-model="configs.phy['stats.observedpowertableenable']"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">接收功率表启用</div>
                          <el-select
                            v-model="configs.phy['stats.receivepowertableenable']"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>
                      </div>
                    </template>
                  </div>
                </el-tab-pane>

                <!-- 平台参数选项卡 -->
                <el-tab-pane label="平台参数" name="platform">
                  <div class="tab-content-wrapper">
                    <div class="config-subsection">
                      <h4 class="subsection-title">基本配置</h4>

                      <div class="form-row">
                        <div class="form-label">天线配置文件URI</div>
                        <div class="form-input-with-button">
                          <el-tooltip content="天线配置文件路径，可留空" placement="top">
                            <el-input
                              v-model="configs.platform.antennaprofilemanifesturi"
                              class="form-input"
                              placeholder="可留空"
                            />
                          </el-tooltip>
                          <el-button class="form-button">...</el-button>
                        </div>
                      </div>

                      <div class="form-row">
                        <div class="form-label">频谱掩码清单URI</div>
                        <div class="form-input-with-button">
                          <el-tooltip content="频谱掩码文件路径，可留空" placement="top">
                            <el-input
                              v-model="configs.platform.spectralmaskmanifesturi"
                              class="form-input"
                              placeholder="可留空"
                            />
                          </el-tooltip>
                          <el-button class="form-button">...</el-button>
                        </div>
                      </div>
                    </div>

                    <div class="config-subsection">
                      <h4 class="subsection-title">事件服务配置</h4>

                      <div class="form-row">
                        <div class="form-label">事件服务设备</div>
                        <el-tooltip content="默认值: ctrl0" placement="top">
                          <el-input
                            v-model="configs.platform.eventservicedevice"
                            class="form-input"
                            placeholder="例如: ctrl0"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">事件服务组</div>
                        <el-tooltip content="格式: IPv4/IPv6地址:端口" placement="top">
                          <el-input
                            v-model="configs.platform.eventservicegroup"
                            class="form-input"
                            placeholder="例如: 224.1.2.8:45703"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">事件服务TTL</div>
                        <el-tooltip content="设置TTL值，默认为1" placement="top">
                          <el-input-number
                            v-model="configs.platform.eventservicettl"
                            :min="0"
                            :max="255"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>
                    </div>

                    <div class="config-subsection">
                      <h4 class="subsection-title">OTA管理器配置</h4>

                      <div class="form-row">
                        <div class="form-label">OTA管理器通道启用</div>
                        <el-select
                          v-model="configs.platform.otamanagerchannelenable"
                          class="form-input"
                        >
                          <el-option label="关闭" value="0" />
                          <el-option label="开启" value="1" />
                        </el-select>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器设备</div>
                        <el-tooltip content="默认值: ctrl0" placement="top">
                          <el-input
                            v-model="configs.platform.otamanagerdevice"
                            class="form-input"
                            placeholder="例如: ctrl0"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器组</div>
                        <el-tooltip content="格式: IPv4/IPv6地址:端口" placement="top">
                          <el-input
                            v-model="configs.platform.otamanagergroup"
                            class="form-input"
                            placeholder="例如: 224.1.2.8:45702"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器环回</div>
                        <el-select
                          v-model="configs.platform.otamanagerloopback"
                          class="form-input"
                        >
                          <el-option label="关闭" value="0" />
                          <el-option label="开启" value="1" />
                        </el-select>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器MTU</div>
                        <el-tooltip content="设置MTU值，默认为0" placement="top">
                          <el-input-number
                            v-model="configs.platform.otamanagermtu"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">部分检查阈值</div>
                        <el-tooltip content="设置部分检查阈值，默认为2" placement="top">
                          <el-input-number
                            v-model="configs.platform.otamanagerpartcheckthreshold"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">部分超时阈值</div>
                        <el-tooltip content="设置部分超时阈值，默认为5" placement="top">
                          <el-input-number
                            v-model="configs.platform.otamanagerparttimeoutthreshold"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器TTL</div>
                        <el-tooltip content="设置TTL值，默认为1" placement="top">
                          <el-input-number
                            v-model="configs.platform.otamanagerttl"
                            :min="0"
                            :max="255"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>
                    </div>

                    <div class="config-subsection">
                      <h4 class="subsection-title">统计配置</h4>

                      <div class="form-row">
                        <div class="form-label">事件最大计数行</div>
                        <el-tooltip content="设置事件最大计数行，默认为0" placement="top">
                          <el-input-number
                            v-model="configs.platform['stats.event.maxeventcountrows']"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA最大事件计数行</div>
                        <el-tooltip
                          content="设置OTA最大事件计数行，默认为0"
                          placement="top"
                        >
                          <el-input-number
                            v-model="configs.platform['stats.ota.maxeventcountrows']"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA最大数据包计数行</div>
                        <el-tooltip
                          content="设置OTA最大数据包计数行，默认为0"
                          placement="top"
                        >
                          <el-input-number
                            v-model="configs.platform['stats.ota.maxpacketcountrows']"
                            :min="0"
                            class="form-input"
                            controls-position="right"
                          />
                        </el-tooltip>
                      </div>
                    </div>
                  </div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>
        </div>

        <!-- 底部按钮区 -->
        <div class="custom-dialog-footer">
          <template v-if="selectedModel">
            <!-- <div class="footer-left">
              <el-button
                class="dialog-btn template-btn"
                @click="handleSaveTemplate"
                :disabled="!canSaveTemplate"
              >
                保存为模板
              </el-button>
            </div> -->
            <div class="footer-right">
              <el-button class="dialog-btn back-btn" @click="backToModelSelection"
                >返回</el-button
              >
              <el-button class="dialog-btn cancel-btn" @click="handleClose">取消</el-button>
              <el-button
                class="dialog-btn confirm-btn"
                type="primary"
                @click="handleConfirm"
                >{{ props.isEditMode ? '保存修改' : '确定' }}</el-button
              >
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 保存模板对话框 -->
  <SaveTemplateDialog
    v-model:visible="saveTemplateDialogVisible"
    :subnet-data="currentSubnetData"
    @success="handleTemplateSaved"
  />
</template>

<script setup lang="ts">
import { ref, reactive, defineProps, defineEmits, watch, onMounted, computed } from "vue";
import { useTopoStore } from "../../../store/modules/topo";
import { geoToENU, formatCoord } from "../../../utils/coordTransform";
import type { Node, GeoPosition } from "../../../types/topo";
import { ElMessage } from "element-plus";
import { editNode } from "../../../api/node";
import { getUserInfo } from "../../../store/user";
import eventBus from "../../../utils/eventBus";

// 定义属性
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  position: {
    type: Object as () => GeoPosition,
    default: () => ({ lat: 0, lon: 0, alt: 0 }),
  },
  initialData: {
    type: Object,
    default: null,
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
});

// 定义事件
const emit = defineEmits(["update:visible", "confirm", "cancel", "close"]);

// 获取store
const topoStore = useTopoStore();

// 对话框可见性
const dialogVisible = ref(props.visible);

// 链路层模型列表
const linkLayerModels = [
  {
    value: "bypass",
    label: "Bypass",
    description: "简单的旁路模型，适用于直接测试",
  },
  {
    value: "commeffect",
    label: "CommEffect",
    description: "通信效果模型，提供基础的延迟和丢包功能",
  },
  {
    value: "rfpipe",
    label: "RF Pipe",
    description: "无线频率管道模型，用于模拟基本射频通信",
  },
  {
    value: "tdma",
    label: "TDMA",
    description: "时分多址接入模型，适用于模拟多用户时分接入场景",
  },
  {
    value: "ieee80211abg",
    label: "IEEE 802.11 a/b/g",
    description: "WiFi模型，基于IEEE 802.11 a/b/g标准",
  },
  {
    value: "ieee802.3",
    label: "IEEE 802.3",
    description: "以太网模型，基于IEEE 802.3标准",
  },
  {
    value: "ieee802.15.4",
    label: "IEEE 802.15.4",
    description: "Zigbee模型，支持低功耗设备通信",
  },
  {
    value: "ieee802.1Qbv",
    label: "IEEE 802.1Qbv",
    description: "TSN模型，提供确定性传输调度",
  },
  {
    value: "ieee802.1CB",
    label: "IEEE 802.1CB",
    description: "TSN模型，提升网络可靠性",
  },
  {
    value: "ieee802.1Qbu",
    label: "IEEE 802.1Qbu",
    description: "TSN模型，允许高优先级帧中断低优先级帧",
  },
  {
    value: "ieee802.1AS",
    label: "IEEE 802.1AS",
    description: "TSN模型，实现亚微秒级时钟同步",
  },
  {
    value: "LTE",
    label: "LTE",
    description: "长期演进模型，4G移动通信标准",
  },
];

// 实际实现的模型（用于后端）
const implementedModels = ["rfpipe", "ieee80211abg", "tdma"];

// 未实现模型到实现模型的映射
const modelMappings: Record<string, string> = {
  "ieee802.3": "tdma",
  "ieee802.15.4": "tdma",
  "ieee802.1Qbv": "ieee80211abg",
  "ieee802.1CB": "ieee80211abg",
  "ieee802.1Qbu": "tdma",
  "ieee802.1AS": "ieee80211abg",
  "LTE": "tdma"
};

// 存储显示模型与实际模型的映射关系
const displayModelToActual = ref("");

// 物理层模型列表（仅展示用途）
const physicalLayerModels = [
  {
    value: "fhss",
    label: "FHSS",
    description: "跳频扩频技术，通过快速改变载波频率提高抗干扰能力",
  },
  {
    value: "dsss",
    label: "DSSS",
    description: "直接序列扩频技术，提供更高的数据传输安全性和抗干扰能力",
  },
  {
    value: "ofdm",
    label: "OFDM",
    description: "正交频分复用技术，高效利用频谱资源，提高传输速率",
  },
  {
    value: "pdcch",
    label: "PDCCH",
    description: "物理下行控制信道，用于LTE和5G网络的控制信息传输",
  },
  {
    value: "pbch",
    label: "PBCH",
    description: "物理广播信道，用于传输主要系统信息和网络配置",
  },
  {
    value: "cdma",
    label: "CDMA",
    description: "码分多址技术，使用直接扩频实现多用户同频共享，具有抗干扰和软切换能力",
  },
  {
    value: "zigbee",
    label: "ZigBee",
    description: "基于IEEE 802.15.4的低功耗无线网状网络技术，支持O-QPSK调制和DSSS扩频",
  },
  {
    value: "prach",
    label: "PRACH",
    description: "物理随机接入信道，使用Zadoff-Chu序列实现LTE/5G网络的初始接入和同步",
  },
];

// 临时选择的物理层模型
const tempSelectedPhyModel = ref("");
// 临时选择的模型
const tempSelectedModel = ref("");
// 最终选择的模型
const selectedModel = ref("");
// 最终选择的物理层模型（多选）
const selectedPhyModel = ref("");
// 当前活动的选项卡
const activeTab = ref("mac");

// 子网配置数据
const configs = reactive({
  external: {
    external: "0",
    platformendpoint: "127.0.0.1:40001",
    transportendpoint: "127.0.0.1:50002",
  },
  mac: {
    // Bypass模型参数
    bitrate: "1000000",
    delay: "0.0",
    jitter: "0.0",

    // RF Pipe和TDMA模型参数
    datarate: "1000000",
    enablepromiscuousmode: "0",
    flowcontrolenable: "0",
    flowcontroltokens: "10",
    neighbormetricdeletetime: "60.0",
    pcrcurveuri: "/usr/share/emane/xml/models/mac/rfpipe/rfpipepcr.xml",
    radiometricenable: "0",
    radiometricreportinterval: "1.000000",

    // RF信号表配置
    "rfsignaltable.averageallantennas": "0",
    "rfsignaltable.averageallfrequencies": "0",

    // TDMA特有参数
    fragmentcheckthreshold: "2",
    fragmenttimeoutthreshold: "5",
    neighbormetricupdateinterval: "1.0",
    schedule: "",
    

    // 队列配置
    "queue.aggregationenable": "0",
    "queue.aggregationslotthreshold": "5",
    "queue.depth": "256",
    "queue.fragmentationenable": "0",
    "queue.strictdequeueenable": "0",

    // Bypass空值占位符
    none: "0",
  },
  phy: {
    bandwidth: "1000000",
    frequency: "2400000000",
    txpower: "30.0",
    channelcode: "none",
    compatibilitymode: "1",
    frequencyofinterest: "2400000000",
    propagationmodel: "freespace",
    subid: "1",
    systemnoisefigure: "7.0",
    timesyncthreshold: "0.0005",
    processingpoolsize: "8",
    spectralmaskindex: "0",
    randomlossenvironment: "none",

    // 开关选项
    dopplershiftenable: "0",
    excludesamesubidfromfilterenable: "0",
    fixedantennagainenable: "0",
    fixedantennagain: "0.0",
    rxsensitivitypromiscuousmodeenable: "0",

    // 噪声配置
    noisemode: "none",
    noisemaxclampenable: "0",
    noisebinsize: "20",
    noisemaxmessagepropagation: "100",
    noisemaxsegmentduration: "1.0",
    noisemaxsegmentoffset: "300.0",

    // 衰落模型配置
    "fading.model": "none",

    // 对数正态衰落模型参数
    "fading.lognormal.dlthresh": "126.0",
    "fading.lognormal.dmu": "10.3",
    "fading.lognormal.dsigma": "10.9",
    "fading.lognormal.duthresh": "178.0",
    "fading.lognormal.lmean": "0.0",
    "fading.lognormal.lstddev": "11.0",
    "fading.lognormal.maxpathloss": "230.0",
    "fading.lognormal.minpathloss": "85.0",

    // 纳加米衰落模型参数
    "fading.nakagami.distance0": "30.0",
    "fading.nakagami.distance1": "100.0",
    "fading.nakagami.m0": "1.5",
    "fading.nakagami.m1": "0.75",
    "fading.nakagami.m2": "0.75",

    // 太赫兹衰落模型参数
    "fading.terahertz.atmosphericfactor": "0.1",
    "fading.terahertz.frequency": "300000000000",
    "fading.terahertz.rainrate": "0.0",

    // 时变衰落模型参数  
    "fading.timevarying.dopplerfrequency": "100.0",
    "fading.timevarying.fadingdepth": "10.0",
    "fading.timevarying.pathlossexponent": "2.0",

    // 统计参数
    "stats.observedpowertableenable": "0",
    "stats.receivepowertableenable": "0",
  },
  platform: {
    antennaprofilemanifesturi: "",
    spectralmaskmanifesturi: "",

    // 事件服务配置
    eventservicedevice: "ctrl0",
    eventservicegroup: "224.1.2.8:45703",
    eventservicettl: "1",

    // OTA管理器配置
    otamanagerchannelenable: "1",
    otamanagerdevice: "ctrl0",//TAP0
    otamanagergroup: "224.1.2.8:45702",
    otamanagerloopback: "0",
    otamanagermtu: "0",
    otamanagerpartcheckthreshold: "2",
    otamanagerparttimeoutthreshold: "5",
    otamanagerttl: "1",

    // 统计配置
    "stats.event.maxeventcountrows": "0",
    "stats.ota.maxeventcountrows": "0",
    "stats.ota.maxpacketcountrows": "0",
  },
});

// 角色选项
const ROLE_OPTIONS = [
  { label: '公共', value: 1 },
  { label: '红方', value: 2 },
  { label: '蓝方', value: 3 }
];

// 普通仿真模式下不需要分配角色，默认公共
const isNormalMode = computed(() => getUserInfo().mode === 'normal');

// 节点表单数据
const nodeForm = reactive({
  name: `subnet-${Date.now().toString().slice(-4)}`,
  alias: "",
  type: "EMANE",
  model: "emane",
  emane: "emane_bypass",
  geo: {
    lat: props.position.lat,
    lon: props.position.lon,
    alt: props.position.alt,
  },
  role: isNormalMode.value ? 1 : 2, // 普通模式默认公共，攻防模式默认红方
});

// 获取当前类型最大序号
const getMaxSubnetNumber = (): number => {
  if (!topoStore.topoData?.nodes || topoStore.topoData.nodes.length === 0) {
    return 0;
  }

  const regex = new RegExp(`^subnet-(\\d+)$`);
  let maxNumber = 0;

  topoStore.topoData.nodes.forEach((node: Node) => {
    const match = node.name.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  return maxNumber;
};

// 生成唯一名称
const generateUniqueSubnetName = (): string => {
  const maxNumber = getMaxSubnetNumber();
  return `subnet-${maxNumber + 1}`;
};

// 生成中文别名
const generateChineseAlias = (): string => {
  const maxNumber = getMaxSubnetNumber();
  return `子网${maxNumber + 1}`;
};

const hasDuplicateSubnetAlias = (alias: string, currentNodeId?: number): boolean => {
  if (!topoStore.topoData?.nodes) {
    return false;
  }

  return topoStore.topoData.nodes.some((node: Node) => node.id !== currentNodeId && node.alias === alias);
};

// 初始化节点名称
const initNodeName = () => {
  nodeForm.name = generateUniqueSubnetName();
  nodeForm.alias = generateChineseAlias();
};

// 链路层模型与物理层模型的映射关系
const modelMappingPhyMap: Record<string, string[]> = {
  "bypass": ["cdma"],
  "commeffect": ["cdma"],
  "rfpipe": ["fhss", "dsss","cdma"],
  "tdma": ["fhss", "ofdm"],
  "ieee80211abg": ["dsss", "fhss", "ofdm"],
  "ieee802.3": ["wired"],
  "ieee802.15.4": ["dsss","zigbee"],
  "ieee802.1Qbv": ["wired"],
  "ieee802.1CB": ["wired"],
  "ieee802.1Qbu": ["wired"],
  "ieee802.1AS": ["wired"],
  "LTE": ["ofdm", "pdcch", "pbch","prach"],
};

// 参数清理函数：移除可能导致后端错误的参数
const sanitizeEmaneConfigs = (emaneConfigs: any) => {
  if (!emaneConfigs || !Array.isArray(emaneConfigs)) {
    return emaneConfigs;
  }
  
  return emaneConfigs.map((config: any) => {
    if (!config.config) return config;
    
    const sanitizedConfig = { ...config };
    const cleanedConfigData: any = {};
    
    // 遍历配置参数，移除可能有问题的值
    Object.keys(config.config).forEach(key => {
      const param = config.config[key];
      if (param && typeof param === 'object') {
        // 确保参数值是字符串类型
        const cleanedParam = {
          ...param,
          value: String(param.value || ''),
          type: typeof param.type === 'number' ? param.type : 10,
          select: Array.isArray(param.select) ? param.select : []
        };
        cleanedConfigData[key] = cleanedParam;
      }
    });
    
    sanitizedConfig.config = cleanedConfigData;
    return sanitizedConfig;
  });
};

// 使用现有数据初始化表单（编辑模式）
const initializeFormWithData = (data: any) => {
  const existingNode = topoStore.topoData?.nodes?.find((node: Node) => node.id === data.id);
  // 保留基本信息和位置信息
  nodeForm.name = data.name || nodeForm.name;
  nodeForm.alias = existingNode?.alias || data.alias || data.name || nodeForm.alias;
  
  if (data.geo) {
    nodeForm.geo = { ...data.geo };
  }
  
  // 角色保持原有设置
  nodeForm.role = data.role || nodeForm.role;
  
  // 如果节点已有EMANE配置，则初始化现有配置
  if (data.emane_configs && data.emane) {
    try {
      // 从emane字段解析模型类型 (格式: "emane_模型名")
      const emaneModel = data.emane.replace('emane_', '');
      
      // 设置已选择的模型
      selectedModel.value = emaneModel;
      tempSelectedModel.value = emaneModel;
      
      // 如果有显示模型映射，恢复显示模型
      if (data.displayModel) {
        displayModelToActual.value = data.displayModel;
        tempSelectedModel.value = data.displayModel;
      }
      
      // 恢复物理层模型选择
      if (data.phy_type) {
        selectedPhyModel.value = data.phy_type;
        tempSelectedPhyModel.value = data.phy_type;
      }
      
      // 安全地恢复现有的配置参数
      if (data.emane_configs && Array.isArray(data.emane_configs)) {
        // 解析现有配置到configs对象
        data.emane_configs.forEach((configItem: any) => {
          if (configItem.config) {
            Object.keys(configItem.config).forEach(key => {
              const param = configItem.config[key];
              if (param && param.group) {
                const value = String(param.value || '');
                
                // 根据参数组分类存储
                if (param.group === 'External Parameters') {
                  if (key in configs.external) {
                    (configs.external as any)[key] = value;
                  }
                } else if (param.group === 'MAC Parameters') {
                  if (key in configs.mac) {
                    (configs.mac as any)[key] = value;
                  }
                } else if (param.group === 'PHY Parameters') {
                  if (key in configs.phy) {
                    (configs.phy as any)[key] = value;
                  }
                } else if (param.group === 'Platform Parameters') {
                  if (key in configs.platform) {
                    (configs.platform as any)[key] = value;
                  }
                }
              }
            });
          }
        });
      }

    } catch (error) {
      console.warn('恢复EMANE配置时出错，将重新开始配置:', error);
      // 如果恢复配置出错，则重新开始
      selectedModel.value = "";
      tempSelectedModel.value = "";
      selectedPhyModel.value = "";
      tempSelectedPhyModel.value = "";
      displayModelToActual.value = "";
    }
  } else {
    // 如果没有现有配置，重新开始配置
    selectedModel.value = "";
    tempSelectedModel.value = "";
    selectedPhyModel.value = "";
    tempSelectedPhyModel.value = "";
    displayModelToActual.value = "";
  }
};

// 初始挂载时设置节点名称
onMounted(() => {
  // 如果是编辑模式且对话框可见，立即初始化
  if (props.visible && props.isEditMode && props.initialData) {
    initializeFormWithData(props.initialData);
  } else {
    initNodeName();
  }
});

// 用于显示的模型名称（计算属性）
const displayModelName = computed(() => {
  return displayModelToActual.value || selectedModel.value;
});

const selectPhyModel = (phyModel: string) => {
  // 如果模型不可用，直接返回
  if (!isPhyModelAvailable(phyModel)) {
    return;
  }
  
  // 如果是同一个模型，则取消选择；否则选择新模型
  if (tempSelectedPhyModel.value === phyModel) {
    tempSelectedPhyModel.value = "";
  } else {
    tempSelectedPhyModel.value = phyModel;
  }
};

// 确认模型选择
const confirmModelSelection = () => {
  // 保存用户显示的模型选择
  selectedModel.value = tempSelectedModel.value;
  
  // 检查是否是未实现的模型，如果是则使用映射的已实现模型
  if (Object.prototype.hasOwnProperty.call(modelMappings, selectedModel.value)) {
    // 保存显示模型名称，用于前端展示
    displayModelToActual.value = selectedModel.value;
    // 替换为实际模型（后端使用）
    selectedModel.value = modelMappings[displayModelToActual.value];
  } else {
    // 如果是已实现的模型，清空映射记录
    displayModelToActual.value = "";
  }
  
  // 设置emane模型名
  nodeForm.emane = `emane_${selectedModel.value}`;
  
  // 保存物理层模型选择（单选）
  selectedPhyModel.value = tempSelectedPhyModel.value;
  
  // 如果选择的是有线模型，清空物理层模型选择
  if (modelMappingPhyMap[tempSelectedModel.value]?.includes("wired")) {
    selectedPhyModel.value = "";
  }

  // 根据模型类型设置默认值
  if (selectedModel.value === "bypass") {
    // 为bypass模型设置默认参数
    configs.external = {
      external: "0",
      platformendpoint: "127.0.0.1:40001",
      transportendpoint: "127.0.0.1:50002",
    };

    configs.platform = {
      antennaprofilemanifesturi: "",
      spectralmaskmanifesturi: "",
      eventservicedevice: "ctrl0",
      eventservicegroup: "224.1.2.8:45703",
      eventservicettl: "1",
      otamanagerchannelenable: "1",
      otamanagerdevice: "ctrl0",
      otamanagergroup: "224.1.2.8:45702",
      otamanagerloopback: "0",
      otamanagermtu: "0",
      otamanagerpartcheckthreshold: "2",
      otamanagerparttimeoutthreshold: "5",
      otamanagerttl: "1",
      "stats.event.maxeventcountrows": "0",
      "stats.ota.maxeventcountrows": "0",
      "stats.ota.maxpacketcountrows": "0",
    };
  } else if (selectedModel.value === "rfpipe") {
    // 为rfpipe模型设置默认参数
    // 外部参数
    configs.external = {
      external: "0",
      platformendpoint: "127.0.0.1:40001",
      transportendpoint: "127.0.0.1:50002",
    };

    // MAC层参数
    configs.mac = {
      bitrate: "1000000",
      datarate: "1000000",
      delay: "0.000000",
      enablepromiscuousmode: "0",
      flowcontrolenable: "0",
      flowcontroltokens: "10",
      jitter: "0.000000",
      neighbormetricdeletetime: "60.000000",
      pcrcurveuri: "/usr/share/emane/xml/models/mac/rfpipe/rfpipepcr.xml",
      radiometricenable: "0",
      radiometricreportinterval: "1.000000",
      "rfsignaltable.averageallantennas": "0",
      "rfsignaltable.averageallfrequencies": "0",
      fragmentcheckthreshold: "2",
      fragmenttimeoutthreshold: "5",
      neighbormetricupdateinterval: "1.0",
      "queue.aggregationenable": "0",
      "queue.aggregationslotthreshold": "5",
      "queue.depth": "256",
      "queue.fragmentationenable": "0",
      "queue.strictdequeueenable": "0",
      none: "0",
      schedule: "", // 添加缺失的schedule属性
    };

    // 物理层参数
    configs.phy = {
      bandwidth: "1000000",
      compatibilitymode: "1",
      dopplershiftenable: "1",
      excludesamesubidfromfilterenable: "1",
      "fading.lognormal.dlthresh": "0.250000",
      "fading.lognormal.dmu": "5.000000",
      "fading.lognormal.dsigma": "1.000000",
      "fading.lognormal.duthresh": "0.750000",
      "fading.lognormal.lmean": "0.005000",
      "fading.lognormal.lstddev": "0.001000",
      "fading.lognormal.maxpathloss": "100.000000",
      "fading.lognormal.minpathloss": "0.000000",
      "fading.model": "none",
      "fading.nakagami.distance0": "100.000000",
      "fading.nakagami.distance1": "250.000000",
      "fading.nakagami.m0": "0.750000",
      "fading.nakagami.m1": "1.000000",
      "fading.nakagami.m2": "200.000000",
      "fading.terahertz.atmosphericfactor": "0.1",
      "fading.terahertz.frequency": "300000000000",
      "fading.terahertz.rainrate": "0.0",
      "fading.timevarying.dopplerfrequency": "100.0",
      "fading.timevarying.fadingdepth": "10.0",
      "fading.timevarying.pathlossexponent": "2.0",
      fixedantennagain: "0.000000",
      fixedantennagainenable: "1",
      frequency: "2347000000",
      frequencyofinterest: "2347000000",
      noisebinsize: "20",
      noisemaxclampenable: "0",
      noisemaxmessagepropagation: "200000",
      noisemaxsegmentduration: "1000000",
      noisemaxsegmentoffset: "300000",
      noisemode: "none",
      processingpoolsize: "0",
      propagationmodel: "2ray",
      rxsensitivitypromiscuousmodeenable: "0",
      spectralmaskindex: "0",
      "stats.observedpowertableenable": "1",
      "stats.receivepowertableenable": "1",
      subid: "1",
      systemnoisefigure: "4.000000",
      timesyncthreshold: "10000",
      txpower: "30.0",
      channelcode: "none",
      randomlossenvironment: "none",
    };

    // 平台参数
    configs.platform = {
      antennaprofilemanifesturi: "",
      eventservicedevice: "ctrl0",
      eventservicegroup: "224.1.2.8:45703",
      eventservicettl: "1",
      otamanagerchannelenable: "1",
      otamanagerdevice: "ctrl0",
      otamanagergroup: "224.1.2.8:45702",
      otamanagerloopback: "0",
      otamanagermtu: "0",
      otamanagerpartcheckthreshold: "2",
      otamanagerparttimeoutthreshold: "5",
      otamanagerttl: "1",
      spectralmaskmanifesturi: "",
      "stats.event.maxeventcountrows": "0",
      "stats.ota.maxeventcountrows": "0",
      "stats.ota.maxpacketcountrows": "0",
    };
  } else if (selectedModel.value === "tdma") {
    // 外部参数
    configs.external = {
      external: "0",
      platformendpoint: "127.0.0.1:40001",
      transportendpoint: "127.0.0.1:50002",
    };

    // MAC层参数
    configs.mac = {
      bitrate: "1000000",
      datarate: "1000000",
      delay: "0.000000",
      enablepromiscuousmode: "0",
      flowcontrolenable: "0",
      flowcontroltokens: "10",
      jitter: "0.000000",
      neighbormetricdeletetime: "60.000000",
      pcrcurveuri: "/usr/share/emane/xml/models/mac/tdmaeventscheduler/tdmabasemodelpcr.xml",
      radiometricenable: "0",
      radiometricreportinterval: "1.000000",
      "rfsignaltable.averageallantennas": "0",
      "rfsignaltable.averageallfrequencies": "0",
      fragmentcheckthreshold: "2",
      fragmenttimeoutthreshold: "5",
      neighbormetricupdateinterval: "1.0",
      "queue.aggregationenable": "1",
      "queue.aggregationslotthreshold": "90",
      "queue.depth": "256",
      "queue.fragmentationenable": "1",
      "queue.strictdequeueenable": "0",
      none: "0",
      schedule: "", // 添加缺失的schedule属性
    };

    // 物理层参数
    configs.phy = {
      bandwidth: "1000000",
      compatibilitymode: "1",
      dopplershiftenable: "1",
      excludesamesubidfromfilterenable: "1",
      "fading.lognormal.dlthresh": "0.250000",
      "fading.lognormal.dmu": "5.000000",
      "fading.lognormal.dsigma": "1.000000",
      "fading.lognormal.duthresh": "0.750000",
      "fading.lognormal.lmean": "0.005000",
      "fading.lognormal.lstddev": "0.001000",
      "fading.lognormal.maxpathloss": "100.000000",
      "fading.lognormal.minpathloss": "0.000000",
      "fading.model": "none",
      "fading.nakagami.distance0": "100.000000",
      "fading.nakagami.distance1": "250.000000",
      "fading.nakagami.m0": "0.750000",
      "fading.nakagami.m1": "1.000000",
      "fading.nakagami.m2": "200.000000",
      "fading.terahertz.atmosphericfactor": "0.1",
      "fading.terahertz.frequency": "300000000000",
      "fading.terahertz.rainrate": "0.0",
      "fading.timevarying.dopplerfrequency": "100.0",
      "fading.timevarying.fadingdepth": "10.0",
      "fading.timevarying.pathlossexponent": "2.0",
      fixedantennagain: "0.000000",
      fixedantennagainenable: "1",
      frequency: "2347000000",
      frequencyofinterest: "2347000000",
      noisebinsize: "20",
      noisemaxclampenable: "0",
      noisemaxmessagepropagation: "200000",
      noisemaxsegmentduration: "1000000",
      noisemaxsegmentoffset: "300000",
      noisemode: "none",
      processingpoolsize: "0",
      propagationmodel: "2ray",
      rxsensitivitypromiscuousmodeenable: "0",
      spectralmaskindex: "0",
      "stats.observedpowertableenable": "1",
      "stats.receivepowertableenable": "1",
      subid: "1",
      systemnoisefigure: "4.000000",
      timesyncthreshold: "10000",
      txpower: "30",
      channelcode: "none",
      randomlossenvironment: "none",
    };

    // 平台参数
    configs.platform = {
      antennaprofilemanifesturi: "",
      eventservicedevice: "ctrl0",
      eventservicegroup: "224.1.2.8:45703",
      eventservicettl: "1",
      otamanagerchannelenable: "1",
      otamanagerdevice: "ctrl0",
      otamanagergroup: "224.1.2.8:45702",
      otamanagerloopback: "0",
      otamanagermtu: "0",
      otamanagerpartcheckthreshold: "2",
      otamanagerparttimeoutthreshold: "5",
      otamanagerttl: "1",
      spectralmaskmanifesturi: "",
      "stats.event.maxeventcountrows": "0",
      "stats.ota.maxeventcountrows": "0",
      "stats.ota.maxpacketcountrows": "0",
    };
  } else if (selectedModel.value === "ieee80211abg") {
    // 外部参数
    configs.external = {
      external: "0",
      platformendpoint: "127.0.0.1:40001",
      transportendpoint: "127.0.0.1:50002",
    };

    // MAC层参数 - 使用类型断言绕过TypeScript限制
    configs.mac = {
      // 基本参数
      bitrate: "1000000",
      datarate: "1000000",
      delay: "0.000000",
      jitter: "0.000000",
      enablepromiscuousmode: "0",
      flowcontrolenable: "0",
      flowcontroltokens: "10",
      neighbormetricdeletetime: "60.000000",
      pcrcurveuri: "/usr/share/emane/xml/models/mac/ieee80211abg/ieee80211pcr.xml",
      radiometricenable: "0",
      radiometricreportinterval: "1.000000",
      "rfsignaltable.averageallantennas": "0",
      "rfsignaltable.averageallfrequencies": "0",
      none: "0",
      neighbormetricupdateinterval: "1.0",
      
      // IEEE 802.11 a/b/g特有参数 - 通过索引符号访问添加属性
    } as any;

    // 添加IEEE 802.11特有参数
    (configs.mac as any).aifs0 = "0.000002";
    (configs.mac as any).aifs1 = "0.000002";
    (configs.mac as any).aifs2 = "0.000002";
    (configs.mac as any).aifs3 = "0.000001";
    (configs.mac as any).channelactivityestimationtimer = "0.100000";
    (configs.mac as any).cwmax0 = "1024";
    (configs.mac as any).cwmax1 = "1024";
    (configs.mac as any).cwmax2 = "64";
    (configs.mac as any).cwmax3 = "16";
    (configs.mac as any).cwmin0 = "32";
    (configs.mac as any).cwmin1 = "32";
    (configs.mac as any).cwmin2 = "16";
    (configs.mac as any).cwmin3 = "8";
    (configs.mac as any).distance = "1000";
    (configs.mac as any).mode = "0";
    (configs.mac as any).msdu0 = "65535";
    (configs.mac as any).msdu1 = "65535";
    (configs.mac as any).msdu2 = "65535";
    (configs.mac as any).msdu3 = "65535";
    (configs.mac as any).multicastrate = "1";
    (configs.mac as any).neighbortimeout = "30.000000";
    (configs.mac as any).queuesize0 = "255";
    (configs.mac as any).queuesize1 = "255";
    (configs.mac as any).queuesize2 = "255";
    (configs.mac as any).queuesize3 = "255";
    (configs.mac as any).retrylimit0 = "2";
    (configs.mac as any).retrylimit1 = "2";
    (configs.mac as any).retrylimit2 = "2";
    (configs.mac as any).retrylimit3 = "2";
    (configs.mac as any).rtsthreshold = "255";
    (configs.mac as any).txop0 = "0.000000";
    (configs.mac as any).txop1 = "0.000000";
    (configs.mac as any).txop2 = "0.000000";
    (configs.mac as any).txop3 = "0.000000";
    (configs.mac as any).unicastrate = "4";
    (configs.mac as any).wmmenable = "0";

    // 物理层参数
    configs.phy = {
      bandwidth: "1000000",
      compatibilitymode: "1",
      dopplershiftenable: "1",
      excludesamesubidfromfilterenable: "1",
      "fading.lognormal.dlthresh": "0.250000",
      "fading.lognormal.dmu": "5.000000",
      "fading.lognormal.dsigma": "1.000000",
      "fading.lognormal.duthresh": "0.750000",
      "fading.lognormal.lmean": "0.005000",
      "fading.lognormal.lstddev": "0.001000",
      "fading.lognormal.maxpathloss": "100.000000",
      "fading.lognormal.minpathloss": "0.000000",
      "fading.model": "none",
      "fading.nakagami.distance0": "100.000000",
      "fading.nakagami.distance1": "250.000000",
      "fading.nakagami.m0": "0.750000",
      "fading.nakagami.m1": "1.000000",
      "fading.nakagami.m2": "200.000000",
      "fading.terahertz.atmosphericfactor": "0.1",
      "fading.terahertz.frequency": "300000000000",
      "fading.terahertz.rainrate": "0.0",
      "fading.timevarying.dopplerfrequency": "100.0",
      "fading.timevarying.fadingdepth": "10.0",
      "fading.timevarying.pathlossexponent": "2.0",
      fixedantennagain: "0.000000",
      fixedantennagainenable: "1",
      frequency: "2347000000",
      frequencyofinterest: "2347000000",
      noisebinsize: "20",
      noisemaxclampenable: "0",
      noisemaxmessagepropagation: "200000",
      noisemaxsegmentduration: "1000000",
      noisemaxsegmentoffset: "300000",
      noisemode: "none",
      processingpoolsize: "0",
      propagationmodel: "2ray",
      rxsensitivitypromiscuousmodeenable: "0",
      spectralmaskindex: "0",
      "stats.observedpowertableenable": "1",
      "stats.receivepowertableenable": "1",
      subid: "1",
      systemnoisefigure: "4.000000",
      timesyncthreshold: "10000",
      txpower: "30",
      channelcode: "none",
      randomlossenvironment: "none",
    };

    // 平台参数
    configs.platform = {
      antennaprofilemanifesturi: "",
      eventservicedevice: "ctrl0",
      eventservicegroup: "224.1.2.8:45703",
      eventservicettl: "1",
      otamanagerchannelenable: "1",
      otamanagerdevice: "ctrl0",
      otamanagergroup: "224.1.2.8:45702",
      otamanagerloopback: "0",
      otamanagermtu: "0",
      otamanagerpartcheckthreshold: "2",
      otamanagerparttimeoutthreshold: "5",
      otamanagerttl: "1",
      spectralmaskmanifesturi: "",
      "stats.event.maxeventcountrows": "0",
      "stats.ota.maxeventcountrows": "0",
      "stats.ota.maxpacketcountrows": "0",
    };
  }
};

// 返回模型选择
const backToModelSelection = () => {
  selectedModel.value = "";
  // 同时重置物理层模型选择
  tempSelectedPhyModel.value = "";
};

// 监听外部可见性变化
watch(
  () => props.visible,
  (val) => {
    dialogVisible.value = val;
    if (val) {
      if (props.isEditMode && props.initialData) {
        // 编辑模式：使用现有数据初始化表单
        initializeFormWithData(props.initialData);
      } else {
        // 新建模式：重置为默认值
        // 重置模型选择
        tempSelectedModel.value = "";
        selectedModel.value = "";
        tempSelectedPhyModel.value = "";
        selectedPhyModel.value = "";
        // 重新计算唯一节点名称
        initNodeName();
      }
    }
  },
  { immediate: true, flush: 'post' }
);

// 监听内部可见性变化
watch(dialogVisible, (val) => {
  emit("update:visible", val);
});

// 监听位置变化，更新表单
watch(
  () => props.position,
  (newPosition) => {
    if (newPosition) {
      // 使用解构赋值简化
      const { lat, lon, alt } = newPosition;
      nodeForm.geo = { lat, lon, alt };
    }
  },
  { immediate: true, deep: true }
);

// 处理关闭对话框
const handleClose = () => {
  dialogVisible.value = false;
  emit("close");
  emit("cancel");
};

// 监听tempSelectedModel变化，重置物理层模型选择
watch(tempSelectedModel, (newModel) => {
  if (newModel) {
    // 清空已选物理层模型
    tempSelectedPhyModel.value = " ";
  }
});

// 处理衰落模型变化
const handleFadingModelChange = (value: string) => {
  if (value === 'rician') {
    // 莱斯分布：设置m0、m1、m2为5
    configs.phy['fading.nakagami.m0'] = "5.0";
    configs.phy['fading.nakagami.m1'] = "5.0";
    configs.phy['fading.nakagami.m2'] = "5.0";
  } else if (value === 'rayleigh') {
    // 瑞利分布：设置m0、m1、m2为1
    configs.phy['fading.nakagami.m0'] = "1.0";
    configs.phy['fading.nakagami.m1'] = "1.0";
    configs.phy['fading.nakagami.m2'] = "1.0";
  } else if (value === 'terahertz') {
    // 太赫兹模型：使用专用的太赫兹参数
    configs.phy['fading.terahertz.atmosphericfactor'] = "0.1";
    configs.phy['fading.terahertz.frequency'] = "300000000000";
    configs.phy['fading.terahertz.rainrate'] = "0.0";
  } else if (value === 'timevarying') {
    // 时变模型：使用专用的时变参数
    configs.phy['fading.timevarying.dopplerfrequency'] = "100.0";
    configs.phy['fading.timevarying.fadingdepth'] = "10.0";
    configs.phy['fading.timevarying.pathlossexponent'] = "2.0";
  }
  // nakagami和其他模型保持原有值不变
};

// 创建EMANE配置
const createEmaneConfig = () => {
  const emaneConfigs: Array<{
    ifaceId: number;
    model: string;
    config: {
      [key: string]: {
        label: string;
        name: string;
        value: string;
        type: number;
        select: string[];
        group: string;
      };
    };
  }> = [];

  const modelName = `emane_${selectedModel.value}`;

  // 处理外部参数配置
  if (Object.keys(configs.external).length > 0) {
    Object.keys(configs.external).forEach((key) => {
      if (key in configs.external) {
        // 根据提供的JSON格式配置参数类型和选项
        let paramType = 10; // 默认为字符串类型
        let selectOptions: string[] = [];

        // 特殊处理external参数
        if (key === "external") {
          paramType = 11; // 布尔类型
          selectOptions = ["On", "Off"];
        }

        emaneConfigs.push({
          ifaceId: -1,
          model: modelName,
          config: {
            [key]: {
              label: key,
              name: key,
              value: configs.external[key as keyof typeof configs.external],
              type: paramType,
              select: selectOptions,
              group: "External Parameters",
            },
          },
        });
      }
    });
  }

  // 处理MAC参数配置
  if (selectedModel.value === "bypass") {
    // bypass模型特殊处理，添加none占位符参数
    emaneConfigs.push({
      ifaceId: -1,
      model: modelName,
      config: {
        none: {
          label: "There are no parameters for the bypass model",
          name: "none",
          value: "0",
          type: 11,
          select: ["On", "Off"],
          group: "MAC Parameters",
        },
      },
    });
  } else if (Object.keys(configs.mac).length > 0) {
    Object.keys(configs.mac).forEach((key) => {
      if (key in configs.mac && key !== "none") {
        // 跳过空值
        const value = configs.mac[key as keyof typeof configs.mac];
        if (value === undefined || value === "") return;

        // 确定参数类型和选择项
        let paramType = 4; // 默认为数字类型
        let selectOptions: string[] = [];

        // 为布尔类型参数设置类型和选项
        if (
          [
            "enablepromiscuousmode",
            "flowcontrolenable",
            "radiometricenable",
            "queue.aggregationenable",
            "queue.fragmentationenable",
            "queue.strictdequeueenable",
          ].includes(key)
        ) {
          paramType = 2;
          selectOptions = ["0", "1"];
        }

        emaneConfigs.push({
          ifaceId: -1,
          model: modelName,
          config: {
            [key]: {
              label: key,
              name: key,
              value: value,
              type: paramType,
              select: selectOptions,
              group: "MAC Parameters",
            },
          },
        });
      }
    });
  }

  // 处理物理层参数配置 - bypass模型没有物理层参数
  if (
    Object.keys(configs.phy).length > 0 &&
    !["bypass", "commeffect"].includes(selectedModel.value)
  ) {
    Object.keys(configs.phy).forEach((key) => {
      if (key in configs.phy) {
        // 跳过空值
        let value = configs.phy[key as keyof typeof configs.phy];
        if (value === undefined || value === "") return;

        // 特殊处理：将莱斯、瑞利、太赫兹和时变模型转换为对应的后端模型
        if (key === "fading.model" && (value === "rician" || value === "rayleigh")) {
          value = "nakagami";
        } else if (key === "fading.model" && value === "terahertz") {
          value = "terahertz";
        } else if (key === "fading.model" && value === "timevarying") {
          value = "timevarying";
        }

        // 确定参数类型和选择项
        let paramType = 4; // 默认为数字类型
        let selectOptions: string[] = [];

        // 为布尔类型参数设置类型和选项
        if (
          [
            "dopplershiftenable",
            "excludesamesubidfromfilterenable",
            "fixedantennagainenable",
            "rxsensitivitypromiscuousmodeenable",
            "noisemaxclampenable",
            "stats.observedpowertableenable",
            "stats.receivepowertableenable",
          ].includes(key)
        ) {
          paramType = 11;
          selectOptions = ["On", "Off"];
        }
        // 为选择型参数设置类型和选项
        else if (key === "channelcode") {
          paramType = 10;
          selectOptions = ["none", "ldpc12", "ldpc23"];
        } else if (key === "randomlossenvironment") {
          paramType = 10;
          selectOptions = ["none", "urban", "suburban"];
        } else if (key === "noisemode") {
          paramType = 10;
          selectOptions = ["none", "all", "outofband", "passthrough"];
        } else if (key === "propagationmodel") {
          paramType = 10;
          selectOptions = ["precomputed", "2ray", "freespace"];
        }
        // 为浮点型参数设置类型
        else if (
          ["systemnoisefigure", "txpower", "neighbormetricdeletetime"].includes(key) ||
          key.startsWith("fading.lognormal") ||
          key.startsWith("fading.nakagami") ||
          key.startsWith("fading.terahertz") ||
          key.startsWith("fading.timevarying")
        ) {
          paramType = 9;
        }
        // 为整数型参数设置类型
        else if (
          [
            "noisebinsize",
            "noisemaxmessagepropagation",
            "noisemaxsegmentduration",
            "noisemaxsegmentoffset",
          ].includes(key)
        ) {
          paramType = 9;
        }

        emaneConfigs.push({
          ifaceId: -1,
          model: modelName,
          config: {
            [key]: {
              label: key,
              name: key,
              value: value,
              type: paramType,
              select: selectOptions,
              group: "PHY Parameters",
            },
          },
        });
      }
    });
  }

  // 处理平台参数配置
  if (Object.keys(configs.platform).length > 0) {
    Object.keys(configs.platform).forEach((key) => {
      if (key in configs.platform) {
        // 跳过空值
        const value = configs.platform[key as keyof typeof configs.platform];
        if (value === undefined || value === "") return;

        // 根据提供的JSON设置正确的参数类型
        let paramType = 10; // 默认为字符串类型
        let selectOptions: string[] = [];

        // 特殊处理不同参数类型
        if (["otamanagerchannelenable", "otamanagerloopback"].includes(key)) {
          paramType = 11; // 布尔类型
          selectOptions = ["On", "Off"];
        } else if (["eventservicettl", "otamanagerttl"].includes(key)) {
          paramType = 1; // 小整数
        } else if (
          ["otamanagerpartcheckthreshold", "otamanagerparttimeoutthreshold"].includes(key)
        ) {
          paramType = 2; // 整数
        } else if (
          [
            "otamanagermtu",
            "stats.event.maxeventcountrows",
            "stats.ota.maxeventcountrows",
            "stats.ota.maxpacketcountrows",
          ].includes(key)
        ) {
          paramType = 3; // 无符号整数
        }

        emaneConfigs.push({
          ifaceId: -1,
          model: modelName,
          config: {
            [key]: {
              label: key,
              name: key,
              value: value,
              type: paramType,
              select: selectOptions,
              group: "Platform Parameters",
            },
          },
        });
      }
    });
  }

  return emaneConfigs;
};

// 处理确认添加/编辑节点
const handleConfirm = async () => {
  try {
    const trimmedAlias = nodeForm.alias.trim();

    if (!trimmedAlias) {
      ElMessage.warning("子网名称不能为空");
      return;
    }

    if (!selectedModel.value) {
      ElMessage.warning("请选择链路层模型");
      return;
    }

    // 确保所有数值参数都是字符串类型
    Object.keys(configs.mac).forEach((key) => {
      if (configs.mac[key as keyof typeof configs.mac] !== undefined) {
        configs.mac[key as keyof typeof configs.mac] = String(
          configs.mac[key as keyof typeof configs.mac]
        );
      }
    });

    Object.keys(configs.phy).forEach((key) => {
      if (configs.phy[key as keyof typeof configs.phy] !== undefined) {
        configs.phy[key as keyof typeof configs.phy] = String(
          configs.phy[key as keyof typeof configs.phy]
        );
      }
    });

    Object.keys(configs.external).forEach((key) => {
      if (configs.external[key as keyof typeof configs.external] !== undefined) {
        configs.external[key as keyof typeof configs.external] = String(
          configs.external[key as keyof typeof configs.external]
        );
      }
    });

    Object.keys(configs.platform).forEach((key) => {
      if (configs.platform[key as keyof typeof configs.platform] !== undefined) {
        configs.platform[key as keyof typeof configs.platform] = String(
          configs.platform[key as keyof typeof configs.platform]
        );
      }
    });

    if (props.isEditMode && props.initialData) {
      if (hasDuplicateSubnetAlias(trimmedAlias, props.initialData.id)) {
        ElMessage.warning(`子网名称\"${trimmedAlias}\"已存在，请修改后重试`);
        return;
      }

      // 编辑模式：更新现有节点 - 先获取完整的节点数据，保留所有原始字段
      const existingNode = topoStore.topoData?.nodes?.find((node: Node) => node.id === props.initialData.id);
      const editData = {
        ...(existingNode || props.initialData),
        id: props.initialData.id,
        name: existingNode?.name ?? props.initialData.name ?? nodeForm.name,
        type: "EMANE",
        model: "emane",
        emane: `emane_${selectedModel.value}`, // 使用实际模型
        geo: { ...nodeForm.geo },
        role: nodeForm.role,
        alias: trimmedAlias,
        // 物理层模型类型，全小写
        phy_type: selectedPhyModel.value ? selectedPhyModel.value.toLowerCase() : (
          (() => {
            const availablePhyModels = modelMappingPhyMap[selectedModel.value] || [];
            return availablePhyModels.length > 0 && !availablePhyModels.includes("wired") 
              ? availablePhyModels[0].toLowerCase() 
              : "";
          })()
        ),
        // 显示模型信息
        displayModel: displayModelToActual.value || null,
        // EMANE配置
        emane_configs: createEmaneConfig(),
        // 是否是有线模型
        isWired: modelMappingPhyMap[tempSelectedModel.value]?.includes("wired") || false
      };

      // 清理EMANE配置参数，避免后端错误
      if (editData.emane_configs) {
        editData.emane_configs = sanitizeEmaneConfigs(editData.emane_configs);
      }

      // 调用编辑节点API（使用topoStore的方法以确保topoData自动更新）
      const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
      if (sessionId) {
        await topoStore.editNodeRemote(editData);
        ElMessage.success(`子网 ${trimmedAlias} 修改成功`);
        eventBus.emit('refreshLinks');
      } else {
        throw new Error('无法获取会话ID');
      }

      dialogVisible.value = false;
      emit("confirm", editData);
    } else {
      // 创建模式：检查名称是否重复
      if (hasDuplicateSubnetAlias(trimmedAlias)) {
        ElMessage.warning(`子网名称\"${trimmedAlias}\"已存在，请修改后重试`);
        return;
      }

      // 获取下一个可用节点ID
      const nodes = topoStore.topoData?.nodes || [];
      const links = topoStore.topoData?.links || [];
      const maxNodeId = nodes.length > 0 ? Math.max(...nodes.map((n: Node) => n.id)) : 0;
      const nodeId = maxNodeId + links.length + 1;

      // 创建EMANE节点数据
      const nodeData = {
        id: nodeId,
        name: nodeForm.name,
        type: "EMANE",
        model: "emane",
        position: { x: 0, y: 0, z: 0 },
        emane: `emane_${selectedModel.value}`, // 使用实际模型
        icon: "",
        image: "",
        server: "",
        config_services: [],
        geo: { ...nodeForm.geo },
        dir: "",
        channel: "",
        canvas: 0,
        wlan_config: {},
        mobility_config: {},
        service_configs: {},
        emane_configs: createEmaneConfig(),
        role: nodeForm.role, // 添加角色字段
        status: "UP", // 默认节点状态为正常
        alias: trimmedAlias,
        // 如果使用了映射模型，添加显示模型信息
        displayModel: displayModelToActual.value || null,
        // 物理层模型类型，全小写
        phy_type: selectedPhyModel.value ? selectedPhyModel.value.toLowerCase() : "",
        // 是否是有线模型
        isWired: modelMappingPhyMap[tempSelectedModel.value]?.includes("wired") || false
      };

      // 调用API添加节点
      await (topoStore as any).addNodeRemote(nodeData);

      ElMessage.success(`子网 ${trimmedAlias} 创建成功`);
      dialogVisible.value = false;
      emit("confirm", nodeData);
    }
  } catch (error: any) {
    console.error(`${props.isEditMode ? '修改' : '创建'}子网失败:`, error);
    ElMessage.error(error?.message || `${props.isEditMode ? '修改' : '创建'}子网失败，请重试`);
  }
};

// 检查物理层模型是否可用
const isPhyModelAvailable = (phyModel: string): boolean => {
  if (!tempSelectedModel.value) return true;
  
  const availableModels = modelMappingPhyMap[tempSelectedModel.value] || [];
  
  // 如果是有线模型，则不可选择任何物理层模型
  if (availableModels.includes("wired")) {
    return false;
  }
  
  // 其他情况检查是否在可用列表中
  return availableModels.includes(phyModel);
};


// 监听tempSelectedModel变化，重置物理层模型选择
watch(tempSelectedModel, (newModel) => {
  if (newModel) {
    // 清空已选物理层模型
    tempSelectedPhyModel.value = "";
    
    // 如果选择的是有线模型，不需要选择物理层模型
    if (modelMappingPhyMap[newModel]?.includes("wired")) {
      // 无需操作，保持空数组
    }
  }
});
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
  width: 900px;
  background: rgba(30, 39, 54, 0.95);
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-family: "Microsoft YaHei", sans-serif;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  animation: slideIn 0.3s ease;
  position: relative;
  overflow: hidden;
  max-height: 90vh;
}

.custom-dialog::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(12, 196, 204, 0.5), transparent);
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
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 16px;
  background: #0cc4cc;
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
  scrollbar-color: rgba(12, 196, 204, 0.3) transparent;
}

.custom-dialog-body::-webkit-scrollbar {
  width: 6px;
}

.custom-dialog-body::-webkit-scrollbar-track {
  background: transparent;
}

.custom-dialog-body::-webkit-scrollbar-thumb {
  background-color: rgba(12, 196, 204, 0.3);
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
  margin-bottom: 20px; /* 从28px减小到20px */
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 15px; /* 从20px减小到15px */
  border: 1px solid rgba(12, 196, 204, 0.1);
  transition: all 0.3s ease;
}

.config-section:hover {
  border-color: rgba(12, 196, 204, 0.3);
  box-shadow: 0 0 20px rgba(12, 196, 204, 0.1);
}

.section-title-block {
  display: flex;
  align-items: center;
  margin-bottom: 10px; /* 从16px减小到10px */
}

.title-indicator {
  width: 4px;
  height: 16px;
  background: linear-gradient(180deg, #0cc4cc, #00a8ff);
  margin-right: 10px;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(12, 196, 204, 0.3);
}

.section-title {
  font-size: 14px;
  color: #0cc4cc;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.form-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start; /* 改为从顶部开始排列 */
  padding: 5px 0;
}

.form-row {
  display: flex;
  margin-bottom: 8px; /* 从10px进一步减小到8px */
  align-items: center;
  transition: all 0.3s ease;
  padding: 4px; /* 从5px进一步减小到4px */
}

.form-row:hover {
  background: rgba(12, 196, 204, 0.05);
  border-radius: 6px;
}

.right-column .form-content .form-row {
  margin-bottom: 8px; /* 保持一致 */
}

.right-column .form-content .form-row:last-child,
.left-column .form-content .form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 70px; /* 从100px减小到70px */
  text-align: right;
  padding-right: 10px; /* 从16px减小到10px */
  color: #a0aec0;
  font-size: 13px;
  font-weight: 500;
}

.form-input {
  flex: 1;
}

.form-input-with-button {
  flex: 1;
  display: flex;
  gap: 8px;
}

.form-button {
  padding: 0 8px;
}

/* 模型选择样式 */
.model-selection {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

@media (max-width: 1200px) {
  .model-selection {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .model-selection {
    grid-template-columns: 1fr;
  }

  .config-layout {
    flex-direction: column;
  }

  .left-column,
  .right-column {
    flex-basis: 100%;
    width: 100%;
  }

  .left-column .config-section,
  .right-column .config-section {
    height: auto;
    min-height: 150px; /* 从160px减小到150px */
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .left-column .form-content,
  .right-column .form-content {
    padding: 8px 0; /* 统一两边的内边距 */
    justify-content: flex-start; /* 统一对齐方式 */
  }

  .custom-dialog {
    width: 95%;
    max-width: 600px;
  }
}

.model-item {
  background: rgba(40, 57, 80, 0.5);
  border: 1px solid rgba(12, 196, 204, 0.1);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.model-item:hover {
  border-color: rgba(12, 196, 204, 0.5);
  box-shadow: 0 0 15px rgba(12, 196, 204, 0.2);
  transform: translateY(-2px);
}

.model-item-active {
  background: rgba(12, 196, 204, 0.1);
  border-color: rgba(12, 196, 204, 0.6);
  box-shadow: 0 0 15px rgba(12, 196, 204, 0.3);
}

.model-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.model-item-disabled:hover {
  border-color: rgba(12, 196, 204, 0.1);
  transform: none;
  box-shadow: none;
}

.model-title {
  color: #0cc4cc;
  font-size: 14px;
  margin: 0 0 8px 0;
}

.model-description {
  color: #a0aec0;
  font-size: 12px;
  margin: 0;
  line-height: 1.4;
}

.model-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* 子节标题 */
.config-subsection {
  margin-bottom: 20px;
}

.subsection-title {
  font-size: 13px;
  color: #0cc4cc;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(12, 196, 204, 0.2);
}

/* Tab样式 */
.subnet-tabs {
  margin-top: 8px;
}

:deep(.el-tabs--card > .el-tabs__header) {
  border-bottom: 1px solid rgba(12, 196, 204, 0.2);
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__nav) {
  border: none;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
  border: 1px solid rgba(12, 196, 204, 0.2);
  background: rgba(40, 57, 80, 0.3);
  margin-right: 5px;
  height: 32px;
  line-height: 32px;
  transition: all 0.3s ease;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  background: rgba(12, 196, 204, 0.1);
  border-color: rgba(12, 196, 204, 0.4);
  color: #0cc4cc;
}

:deep(.el-tabs__item:hover) {
  color: #0cc4cc;
  border-color: rgba(12, 196, 204, 0.3) !important;
}

.tab-content-wrapper {
  padding-top: 16px;
  animation: fadeIn 0.3s ease;
}

.empty-config {
  padding: 24px 0;
  display: flex;
  justify-content: center;
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
  margin-left: 8px;
}

.dialog-btn::after {
  content: "";
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
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cancel-btn:hover {
  background: rgba(53, 70, 92, 0.8);
  transform: translateY(-1px);
}

.back-btn {
  background: rgba(40, 57, 80, 0.8);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.back-btn:hover {
  background: rgba(53, 70, 92, 0.8);
  transform: translateY(-1px);
}

.confirm-btn {
  background: linear-gradient(135deg, #105f95, #0e87cd);
  color: #fff;
  box-shadow: 0 4px 15px rgba(14, 135, 205, 0.3);
}

.confirm-btn:hover {
  background: linear-gradient(135deg, #0e87cd, #105f95);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(14, 135, 205, 0.4);
}

/* Element Plus样式覆盖 */
:deep(.el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
  box-shadow: none !important;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  border-color: rgba(12, 196, 204, 0.3);
}

:deep(.el-input__wrapper.is-focus) {
  border-color: #0cc4cc;
  box-shadow: 0 0 0 1px rgba(12, 196, 204, 0.2) !important;
}

:deep(.el-input__inner) {
  color: #fff;
  height: 32px; /* 从36px减小到32px */
  font-size: 13px;
}

:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: rgba(40, 57, 80, 0.3) !important;
  opacity: 1;
  border-color: rgba(255, 255, 255, 0.05);
}

:deep(.el-tabs__item) {
  color: #a0aec0;
}

:deep(.el-tabs__item.is-active) {
  color: #0cc4cc;
}

:deep(.el-tabs__active-bar) {
  background-color: #0cc4cc;
}

:deep(.el-select__wrapper) {
  background-color: rgba(40, 57, 80, 0.5) !important;
}

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
:deep(.el-input__inner[type="number"])::-webkit-inner-spin-button,
:deep(.el-input__inner[type="number"])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
:deep(.el-input__inner[type="number"]) {
  -moz-appearance: textfield;
}

/* 新布局样式 */
.model-selection-container {
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(12, 196, 204, 0.1);
  transition: all 0.3s ease;
  margin-bottom: 28px;
}

.model-selection-container:hover {
  border-color: rgba(12, 196, 204, 0.3);
  box-shadow: 0 0 20px rgba(12, 196, 204, 0.1);
}

.config-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.config-column {
  flex: 1;
  min-width: 350px;
}

.left-column,
.right-column {
  flex-basis: calc(50% - 10px);
}

.left-column .config-section,
.right-column .config-section {
  height: auto;
  min-height: 150px; /* 从160px减小到150px */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.left-column .form-content,
.right-column .form-content {
  padding: 8px 0; /* 统一两边的内边距 */
  justify-content: flex-start; /* 统一对齐方式 */
}

.full-width {
  width: 100%;
  flex-basis: 100%;
}

/* 修复下拉框样式 */
:deep(.el-select) {
  width: 100%;
}

:deep(.el-select__popper) {
  z-index: 10000 !important;
}

:deep(.el-popper) {
  z-index: 10000 !important;
}

:deep(.el-select-dropdown) {
  z-index: 10000 !important;
}

:deep(.el-select .el-input) {
  position: relative;
  z-index: 1;
}

:deep(.el-select .el-select__wrapper) {
  width: 100%;
}

/* 确保下拉菜单可见 */
:deep(.select-dropdown__wrap) {
  max-height: 274px;
  overflow-y: auto;
}

/* 确保tooltip正常显示 */
:deep(.el-tooltip__popper) {
  z-index: 10001 !important;
}

:deep(.el-popper.is-light) {
  z-index: 10001 !important;
}

/* 确保下拉选项的样式 */
:deep(.el-select-dropdown__item) {
  color: #fff;
  background: transparent;
}

:deep(.el-select-dropdown__item.hover), 
:deep(.el-select-dropdown__item:hover) {
  background-color: rgba(12, 196, 204, 0.1);
  color: #0cc4cc;
}

:deep(.el-select-dropdown__item.selected) {
  color: #0cc4cc !important;
  background-color: rgba(12, 196, 204, 0.2) !important;
  font-weight: bold;
}

/* 修复下拉菜单的滚动区域 */
:deep(.el-select-dropdown .el-scrollbar__wrap) {
  background-color: transparent !important;
}

:deep(.el-select-dropdown .el-scrollbar__view) {
  background-color: transparent !important;
}

/* 解决teleport和弹出层的冲突问题 */
:global(.el-select__popper) {
  position: absolute !important;
}

/* 自定义对话框中的下拉菜单样式 */
.custom-dialog .el-select-dropdown__item {
  position: relative !important;
  z-index: auto !important;
  margin: 0 !important;
}

/* 确保滚动区域的背景色一致 */
.custom-dialog :deep(.el-scrollbar__view),
.custom-dialog :deep(.el-select-dropdown__wrap),
.custom-dialog :deep(.el-select-dropdown__list) {
  background-color: rgba(40, 57, 80, 0.95) !important;
}

/* 解决边界处选项被覆盖的问题 */
.custom-dialog :deep(.el-select-dropdown__item):first-child,
.custom-dialog :deep(.el-select-dropdown__item):last-child {
  position: relative !important;
  z-index: 1 !important;
  background-color: rgba(40, 57, 80, 0.95) !important;
}

.custom-dialog :deep(.el-select-dropdown__item):first-child:hover,
.custom-dialog :deep(.el-select-dropdown__item):last-child:hover {
  background-color: rgba(12, 196, 204, 0.1) !important;
}

/* 角色单选按钮组样式 */
.role-radio-group {
  display: flex;
}

:deep(.el-radio) {
  margin-right: 20px;
  color: #a0aec0;
}

:deep(.el-radio.is-checked) {
  color: #0cc4cc;
}

:deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #0cc4cc;
  border-color: #0cc4cc;
}

:deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #0cc4cc;
}

:deep(.el-radio__inner:hover) {
  border-color: #0cc4cc;
}
</style>

<!-- 全局样式，确保下拉菜单正确显示 -->
<style>
.el-select-dropdown {
  z-index: 10000 !important;
  position: absolute !important;
  background-color: rgba(40, 57, 80, 0.95) !important;
  border: 1px solid rgba(12, 196, 204, 0.2) !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  overflow: hidden !important;
  border-radius: 4px !important;
}

.el-popper {
  z-index: 10000 !important;
  position: absolute !important;
}

.el-tooltip__popper {
  z-index: 10001 !important;
  position: absolute !important;
}

/* 修复选项悬停和选中样式 */
.el-select-dropdown__item {
  color: #fff !important;
  background-color: transparent !important;
  transition: background-color 0.2s ease !important;
  padding: 0 20px !important;
  height: 34px !important;
  line-height: 34px !important;
}

.el-select-dropdown__item:hover, 
.el-select-dropdown__item.hover {
  background-color: rgba(12, 196, 204, 0.1) !important;
  color: #0cc4cc !important;
}

.el-select-dropdown__item.selected {
  color: #0cc4cc !important;
  background-color: rgba(12, 196, 204, 0.2) !important;
  font-weight: bold !important;
}

/* 修复下拉菜单容器样式 */
.el-select-dropdown .el-scrollbar__wrap {
  background-color: rgba(40, 57, 80, 0.95) !important;
  margin-bottom: 0 !important;
  margin-right: 0 !important;
}

.el-select-dropdown .el-scrollbar__view {
  background-color: rgba(40, 57, 80, 0.95) !important;
}

.el-select-dropdown .el-select-dropdown__list {
  background-color: rgba(40, 57, 80, 0.95) !important;
  padding: 6px 0 !important;
  box-sizing: border-box !important;
}

/* 修复箭头样式 */
.el-popper .el-popper__arrow {
  background-color: rgba(40, 57, 80, 0.95) !important;
  border-color: rgba(12, 196, 204, 0.2) !important;
}

/* 弹出层内容 */
.el-popper .el-popper__content {
  background-color: rgba(40, 57, 80, 0.95) !important;
  border: 1px solid rgba(12, 196, 204, 0.2) !important;
}

/* 防止下拉菜单内容被截断 */
.el-select-dropdown .el-scrollbar {
  overflow: visible !important;
}

/* 防止多个下拉菜单重叠时的样式问题 */
.el-select-dropdown.is-multiple .el-select-dropdown__item {
  padding-right: 40px !important;
}

.el-select-dropdown.is-multiple .el-select-dropdown__item.selected {
  padding-right: 40px !important;
}

/* 修复多个下拉菜单同时打开时的样式 */
body > .el-popper {
  background-color: rgba(40, 57, 80, 0.95) !important;
}

/* 修复悬停覆盖问题 */
.el-select-dropdown__wrap,
.el-scrollbar__wrap {
  margin-bottom: 0 !important;
  overflow-x: hidden !important;
}

.el-scrollbar__view {
  padding: 0 !important;
}

/* 确保下拉菜单的最后一项和第一项不被覆盖 */
.el-select-dropdown__item:first-child,
.el-select-dropdown__item:last-child {
  background-color: rgba(40, 57, 80, 0.95) !important;
}

.el-select-dropdown__item:first-child:hover,
.el-select-dropdown__item:last-child:hover {
  background-color: rgba(12, 196, 204, 0.1) !important;
}
</style>
