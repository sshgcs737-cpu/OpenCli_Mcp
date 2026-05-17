<template>
  <Teleport to="body">
    <div v-if="visible" class="custom-dialog-overlay" @click.self="handleClose">
      <div class="custom-dialog">
        <div class="custom-dialog-header">
          <span class="custom-dialog-title">修改无线参数</span>
          <button class="custom-dialog-close" @click="handleClose">
            <i class="close-icon">×</i>
          </button>
        </div>

        <div class="custom-dialog-body">
          <div class="config-layout">
            <!-- 左侧：基本信息 -->
            <div class="config-column left-column">
              <div class="config-section">
                <div class="section-title-block">
                  <div class="title-indicator"></div>
                  <span class="section-title">基本信息</span>
                </div>

                <div class="form-content">
                  <div class="form-row">
                    <div class="form-label">节点名称</div>
                    <el-input
                      v-model="localNodeForm.alias"
                      placeholder="请输入节点名称"
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">模型类型</div>
                    <el-input v-model="displayModelName" disabled  class="form-input" />
                  </div>
                  
                  <div class="form-row" v-if="!isNormalMode">
                    <div class="form-label">节点角色</div>
                    <div class="form-input role-radio-group">
                      <el-radio-group v-model="localNodeForm.role">
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
                      :model-value="formatCoord(geoToENU(localNodeForm.geo.lon, localNodeForm.geo.lat, localNodeForm.geo.alt).x)"
                      disabled
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">Y</div>
                    <el-input
                      :model-value="formatCoord(geoToENU(localNodeForm.geo.lon, localNodeForm.geo.lat, localNodeForm.geo.alt).y)"
                      disabled
                      class="form-input"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-label">Z</div>
                    <el-input
                      v-model="localNodeForm.geo.alt"
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
                          <el-input v-model="localConfigs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">延迟 (秒)</div>
                          <el-input v-model="localConfigs.mac.delay" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用混杂模式</div>
                          <el-select
                            v-model="localConfigs.mac.enablepromiscuousmode"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用流量控制</div>
                          <el-select
                            v-model="localConfigs.mac.flowcontrolenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">流量控制令牌</div>
                          <el-input
                            v-model="localConfigs.mac.flowcontroltokens"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">抖动 (秒)</div>
                          <el-input v-model="localConfigs.mac.jitter" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标删除时间 (秒)</div>
                          <el-input
                            v-model="localConfigs.mac.neighbormetricdeletetime"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI文件</div>
                          <div class="form-input-with-button">
                            <el-input
                              v-model="localConfigs.mac.pcrcurveuri"
                              class="form-input"
                            />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用无线电度量</div>
                          <el-select
                            v-model="localConfigs.mac.radiometricenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">无线电度量报告间隔 (秒)</div>
                          <el-input
                            v-model="localConfigs.mac.radiometricreportinterval"
                            class="form-input"
                          />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">RF信号表配置</h4>

                        <div class="form-row">
                          <div class="form-label">平均所有天线</div>
                          <el-select
                            v-model="localConfigs.mac['rfsignaltable.averageallantennas']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">平均所有频率</div>
                          <el-select
                            v-model="localConfigs.mac['rfsignaltable.averageallfrequencies']"
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
                          <el-input v-model="localConfigs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用流量控制</div>
                          <el-select
                            v-model="localConfigs.mac.flowcontrolenable"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">流量控制令牌</div>
                          <el-input
                            v-model="localConfigs.mac.flowcontroltokens"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">碎片检查阈值</div>
                          <el-input
                            v-model="localConfigs.mac.fragmentcheckthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">碎片超时阈值</div>
                          <el-input
                            v-model="localConfigs.mac.fragmenttimeoutthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标删除时间 (秒)</div>
                          <el-input
                            v-model="localConfigs.mac.neighbormetricdeletetime"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居指标更新间隔 (秒)</div>
                          <el-input
                            v-model="localConfigs.mac.neighbormetricupdateinterval"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI文件</div>
                          <div class="form-input-with-button">
                            <el-input
                              v-model="localConfigs.mac.pcrcurveuri"
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
                            v-model="localConfigs.mac['queue.aggregationenable']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列聚合时隙阈值</div>
                          <el-input
                            v-model="localConfigs.mac['queue.aggregationslotthreshold']"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列深度</div>
                          <el-input
                            v-model="localConfigs.mac['queue.depth']"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用队列分片</div>
                          <el-select
                            v-model="localConfigs.mac['queue.fragmentationenable']"
                            class="form-input"
                          >
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用严格出队</div>
                          <el-select
                            v-model="localConfigs.mac['queue.strictdequeueenable']"
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
                            <el-input v-model="localConfigs.mac.schedule" class="form-input" />
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
                          <el-input v-model="localConfigs.mac.datarate" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">模式</div>
                          <el-select v-model="(localConfigs.mac as any).mode" class="form-input">
                            <el-option label="802.11b" value="0" />
                            <el-option label="802.11a" value="1" />
                            <el-option label="802.11g" value="2" />
                            <el-option label="802.11abg" value="3" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">单播速率</div>
                          <el-select v-model="(localConfigs.mac as any).unicastrate" class="form-input">
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
                          <el-select v-model="(localConfigs.mac as any).multicastrate" class="form-input">
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
                          <el-input v-model="(localConfigs.mac as any).rtsthreshold" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">距离 (m)</div>
                          <el-input v-model="(localConfigs.mac as any).distance" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">邻居超时 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).neighbortimeout" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">PCR曲线URI</div>
                          <div class="form-input-with-button">
                            <el-input v-model="localConfigs.mac.pcrcurveuri" class="form-input" />
                            <el-button class="form-button">...</el-button>
                          </div>
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用WMM</div>
                          <el-select v-model="(localConfigs.mac as any).wmmenable" class="form-input">
                            <el-option label="关闭" value="0" />
                            <el-option label="开启" value="1" />
                          </el-select>
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">队列和访问参数</h4>

                        <div class="form-row">
                          <div class="form-label">队列0大小</div>
                          <el-input v-model="(localConfigs.mac as any).queuesize0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列1大小</div>
                          <el-input v-model="(localConfigs.mac as any).queuesize1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列2大小</div>
                          <el-input v-model="(localConfigs.mac as any).queuesize2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">队列3大小</div>
                          <el-input v-model="(localConfigs.mac as any).queuesize3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS0 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).aifs0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS1 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).aifs1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS2 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).aifs2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">AIFS3 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).aifs3" class="form-input" />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">竞争窗口参数</h4>

                        <div class="form-row">
                          <div class="form-label">CWMin0</div>
                          <el-input v-model="(localConfigs.mac as any).cwmin0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin1</div>
                          <el-input v-model="(localConfigs.mac as any).cwmin1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin2</div>
                          <el-input v-model="(localConfigs.mac as any).cwmin2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMin3</div>
                          <el-input v-model="(localConfigs.mac as any).cwmin3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax0</div>
                          <el-input v-model="(localConfigs.mac as any).cwmax0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax1</div>
                          <el-input v-model="(localConfigs.mac as any).cwmax1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax2</div>
                          <el-input v-model="(localConfigs.mac as any).cwmax2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">CWMax3</div>
                          <el-input v-model="(localConfigs.mac as any).cwmax3" class="form-input" />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">其他参数</h4>

                        <div class="form-row">
                          <div class="form-label">TXOP0 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).txop0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP1 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).txop1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP2 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).txop2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">TXOP3 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).txop3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制0</div>
                          <el-input v-model="(localConfigs.mac as any).retrylimit0" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制1</div>
                          <el-input v-model="(localConfigs.mac as any).retrylimit1" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制2</div>
                          <el-input v-model="(localConfigs.mac as any).retrylimit2" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">重试限制3</div>
                          <el-input v-model="(localConfigs.mac as any).retrylimit3" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">活动估计计时器 (秒)</div>
                          <el-input v-model="(localConfigs.mac as any).channelactivityestimationtimer" class="form-input" />
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
                          <el-input v-model="localConfigs.phy.bandwidth" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">通道代码</div>
                          <el-select v-model="localConfigs.phy.channelcode" class="form-input">
                            <el-option label="无" value="none" />
                            <el-option label="LDPC 1/2" value="ldpc12" />
                            <el-option label="LDPC 2/3" value="ldpc23" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">兼容模式</div>
                          <el-select
                            v-model="localConfigs.phy.compatibilitymode"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">频率 (Hz)</div>
                          <el-input v-model="localConfigs.phy.frequency" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">关注频率 (Hz)</div>
                          <el-input
                            v-model="localConfigs.phy.frequencyofinterest"
                            class="form-input" 
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">传播模型</div>
                          <el-select
                            v-model="localConfigs.phy.propagationmodel"
                            class="form-input"
                          >
                            <el-option label="两射线地面反射" value="2ray" />
                            <el-option label="自由空间" value="freespace" />
                            <el-option label="预定义参数" value="precomputed" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">子ID</div>
                          <el-input v-model="localConfigs.phy.subid" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">系统噪声系数</div>
                          <el-input
                            v-model="localConfigs.phy.systemnoisefigure"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">发射功率 (dB)</div>
                          <el-input v-model="localConfigs.phy.txpower" class="form-input" />
                        </div>

                        <div class="form-row">
                          <div class="form-label">时间同步阈值</div>
                          <el-input
                            v-model="localConfigs.phy.timesyncthreshold"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">处理池大小</div>
                          <el-input
                            v-model="localConfigs.phy.processingpoolsize"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">频谱掩码索引</div>
                          <el-input
                            v-model="localConfigs.phy.spectralmaskindex"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">随机损失环境</div>
                          <el-select
                            v-model="localConfigs.phy.randomlossenvironment"
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
                            v-model="localConfigs.phy.dopplershiftenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">排除相同子ID</div>
                          <el-select
                            v-model="localConfigs.phy.excludesamesubidfromfilterenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">固定天线增益启用</div>
                          <el-select
                            v-model="localConfigs.phy.fixedantennagainenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">固定天线增益</div>
                          <el-input
                            v-model="localConfigs.phy.fixedantennagain"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">启用混杂接收敏感性</div>
                          <el-select
                            v-model="localConfigs.phy.rxsensitivitypromiscuousmodeenable"
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
                          <el-select v-model="localConfigs.phy.noisemode" class="form-input">
                            <el-option label="无" value="none" />
                            <el-option label="全部" value="all" />
                            <el-option label="带外" value="outofband" />
                            <el-option label="直通" value="passthrough" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大限制启用</div>
                          <el-select
                            v-model="localConfigs.phy.noisemaxclampenable"
                            class="form-input"
                          >
                            <el-option label="开启" value="1" />
                            <el-option label="关闭" value="0" />
                          </el-select>
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声分箱大小</div>
                          <el-input
                            v-model="localConfigs.phy.noisebinsize"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大消息传播</div>
                          <el-input
                            v-model="localConfigs.phy.noisemaxmessagepropagation"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大段持续时间</div>
                          <el-input
                            v-model="localConfigs.phy.noisemaxsegmentduration"
                            class="form-input"
                          />
                        </div>

                        <div class="form-row">
                          <div class="form-label">噪声最大段偏移</div>
                          <el-input
                            v-model="localConfigs.phy.noisemaxsegmentoffset"
                            class="form-input"
                          />
                        </div>
                      </div>

                      <div class="config-subsection">
                        <h4 class="subsection-title">衰落模型配置</h4>

                        <div class="form-row">
                          <div class="form-label">衰落模型</div>
                          <el-select
                            v-model="localConfigs.phy['fading.model']"
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

                        <template v-if="localConfigs.phy['fading.model'] === 'lognormal'">
                          <div class="form-row">
                            <div class="form-label">对数正态下限阈值</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.dlthresh']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态D均值</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.dmu']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态D标准差</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.dsigma']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态上限阈值</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.duthresh']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态L均值</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.lmean']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态L标准差</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.lstddev']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态最大路径损耗</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.maxpathloss']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">对数正态最小路径损耗</div>
                            <el-input
                              v-model="localConfigs.phy['fading.lognormal.minpathloss']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="['nakagami', 'rician', 'rayleigh'].includes(localConfigs.phy['fading.model'])">
                          <div class="form-row">
                            <div class="form-label">nakagami距离0</div>
                            <el-input
                              v-model="localConfigs.phy['fading.nakagami.distance0']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami路径损耗0</div>
                            <el-input
                              v-model="localConfigs.phy['fading.nakagami.pathloss0']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">nakagami参考距离</div>
                            <el-input
                              v-model="localConfigs.phy['fading.nakagami.referencedistance']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="localConfigs.phy['fading.model'] === 'nakagami'">
                          <div class="form-row">
                            <div class="form-label">纳卡伽米M值</div>
                            <el-input
                              v-model="localConfigs.phy['fading.nakagami.m']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="localConfigs.phy['fading.model'] === 'rician'">
                          <div class="form-row">
                            <div class="form-label">莱斯K因子</div>
                            <el-input
                              v-model="localConfigs.phy['fading.rician.k']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="localConfigs.phy['fading.model'] === 'rayleigh'">
                          <div class="form-row">
                            <div class="form-label">瑞利衰落参数</div>
                            <el-input
                              v-model="localConfigs.phy['fading.rayleigh.parameter']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="localConfigs.phy['fading.model'] === 'terahertz'">
                          <div class="form-row">
                            <div class="form-label">太赫兹衰减系数</div>
                            <el-input
                              v-model="localConfigs.phy['fading.terahertz.attenuation']"
                              class="form-input"
                            />
                          </div>

                          <div class="form-row">
                            <div class="form-label">太赫兹散射系数</div>
                            <el-input
                              v-model="localConfigs.phy['fading.terahertz.scattering']"
                              class="form-input"
                            />
                          </div>
                        </template>

                        <template v-if="localConfigs.phy['fading.model'] === 'timevarying'">
                          <div class="form-row">
                            <div class="form-label">时变衰落类型</div>
                            <el-select
                              v-model="localConfigs.phy['fading.timevarying.type']"
                              class="form-input"
                            >
                              <el-option label="瑞利" value="rayleigh" />
                              <el-option label="莱斯" value="rician" />
                              <el-option label="纳卡伽米" value="nakagami" />
                            </el-select>
                          </div>

                          <div class="form-row">
                            <div class="form-label">时变衰落速率</div>
                            <el-input
                              v-model="localConfigs.phy['fading.timevarying.rate']"
                              class="form-input"
                            />
                          </div>
                        </template>
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
                              v-model="localConfigs.platform.antennaprofilemanifesturi"
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
                              v-model="localConfigs.platform.spectralmaskmanifesturi"
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
                            v-model="localConfigs.platform.eventservicedevice"
                            class="form-input"
                            placeholder="例如: ctrl0"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">事件服务组</div>
                        <el-tooltip content="格式: IPv4/IPv6地址:端口" placement="top">
                          <el-input
                            v-model="localConfigs.platform.eventservicegroup"
                            class="form-input"
                            placeholder="例如: 224.1.2.8:45703"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">事件服务TTL</div>
                        <el-tooltip content="设置TTL值，默认为1" placement="top">
                          <el-input-number
                            v-model="localConfigs.platform.eventservicettl"
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
                          v-model="localConfigs.platform.otamanagerchannelenable"
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
                            v-model="localConfigs.platform.otamanagerdevice"
                            class="form-input"
                            placeholder="例如: ctrl0"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器组</div>
                        <el-tooltip content="格式: IPv4/IPv6地址:端口" placement="top">
                          <el-input
                            v-model="localConfigs.platform.otamanagergroup"
                            class="form-input"
                            placeholder="例如: 224.1.2.8:45702"
                          />
                        </el-tooltip>
                      </div>

                      <div class="form-row">
                        <div class="form-label">OTA管理器环回</div>
                        <el-select
                          v-model="localConfigs.platform.otamanagerloopback"
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
                            v-model="localConfigs.platform.otamanagermtu"
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
                            v-model="localConfigs.platform.otamanagerpartcheckthreshold"
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
                            v-model="localConfigs.platform.otamanagerparttimeoutthreshold"
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
                            v-model="localConfigs.platform.otamanagerttl"
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
                            v-model="localConfigs.platform['stats.event.maxeventcountrows']"
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
                            v-model="localConfigs.platform['stats.ota.maxeventcountrows']"
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
                            v-model="localConfigs.platform['stats.ota.maxpacketcountrows']"
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

        <div class="custom-dialog-footer">
          <button class="dialog-btn cancel-btn" @click="handleCancel">取消</button>
          <button class="dialog-btn confirm-btn" @click="handleConfirm">保存修改</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useTopoStore } from '../../../store/modules/topo';
import { geoToENU, formatCoord } from '../../../utils/coordTransform';
import { editNode } from '../../../api/node';
import { ElMessage } from 'element-plus';
import { getUserInfo } from "../../../store/user";
import eventBus from "../../../utils/eventBus";

const topoStore = useTopoStore();

interface Geo {
  lon: number;
  lat: number;
  alt: number;
}

interface nodeForm {
  alias: string;
  role: string;
  geo: Geo;
}

interface Configs {
  mac: any;
  phy: any;
  platform: any;
}

interface Props {
  visible: boolean;
  initialData?: any;
  isEditMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  initialData: () => ({}),
  isEditMode: false
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', data: any): void;
}>();

// 角色选项
const ROLE_OPTIONS = [
  { value: 'NODE', label: '普通节点' },
  { value: 'ROUTER', label: '路由节点' },
  { value: 'GATEWAY', label: '网关节点' }
];

// 状态变量
const activeTab = ref('mac');
const selectedModel = ref('');
const isNormalMode = ref(true);

// 计算属性
const displayModelName = computed(() => {
  const modelMap: Record<string, string> = {
    'bypass': 'Bypass',
    'rfpipe': 'RF Pipe',
    'tdma': 'TDMA',
    'commeffect': 'Comm Effect',
    'ieee80211abg': 'IEEE 802.11a/b/g'
  };
  return modelMap[selectedModel.value] || selectedModel.value;
});


// 表单数据
const localNodeForm = reactive({
  alias: '',
  role: 'UNKNOWN',
  geo: {
    lon: 0,
    lat: 0,
    alt: 0
  },
  position: {
    x: '0',
    y: '0',
    z: '0'
  }
});

let originalConfigs: {
  external: Record<string, string>;
  mac: Record<string, string>;
  phy: Record<string, string>;
  platform: Record<string, string>;
  alias: string;
  geo: { lon: number; lat: number; alt: number };
  role: string;
  model: string;
} | null = null;

const localConfigs  = reactive({
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
    otamanagerdevice: "ctrl0",
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
  }
});

// 方法

// 查找连接的子网节点
const findConnectedSubnetNode = (nodeId: number) => {
  const topoData = topoStore.topoData;
  if (!topoData || !topoData.links || !topoData.nodes) {
    return null;
  }
  
  for (const link of topoData.links) {
    if (link.node1_id === nodeId || link.node2_id === nodeId) {
      const subnetNodeId = link.node1_id === nodeId ? link.node2_id : link.node1_id;
      const subnetNode = topoData.nodes.find((n: any) => n.id === subnetNodeId);
      if (subnetNode) {
        return subnetNode;
      }
    }
  }
  return null;
};

// 初始化表单数据
const initFormData = () => {
  if (props.initialData) {
    // 子网名称：优先使用alias，如果没有则使用name
    localNodeForm.alias = props.initialData.alias || props.initialData.name || '';

    // 坐标：从position中获取x, y, z
    const pos = props.initialData.position;
    if (pos) {
      localNodeForm.position.x = pos.x !== undefined ? String(pos.x) : '';
      localNodeForm.position.y = pos.y !== undefined ? String(pos.y) : '';
      localNodeForm.position.z = pos.z !== undefined ? String(pos.z) : '';
    } else {
      localNodeForm.position.x = '';
      localNodeForm.position.y = '';
      localNodeForm.position.z = '';
    }

    // 处理坐标数据
    if (props.initialData.geo) {
      localNodeForm.geo = { ...props.initialData.geo };
    }

    //获取节点的role
    localNodeForm.role = props.initialData.role || 'UNKNOWN';

    // 设置模型类型
    if (props.initialData.modelType) {
      selectedModel.value = props.initialData.modelType;
    } else if (props.initialData.displayModel) {
      selectedModel.value = props.initialData.displayModel || 'rfpipe';
    } else {
      // 从连接的子网节点获取模型类型
      const subnetNode = findConnectedSubnetNode(props.initialData.id);
      if (subnetNode) {
        // 首先尝试从 emane 字段获取模型类型
        if (subnetNode.emane) {
          const emaneModel = subnetNode.emane.replace('emane_', '');
          selectedModel.value = emaneModel;
        } 
        // 然后尝试从 emane_configs 数组获取模型类型
        else if (subnetNode.emane_configs && Array.isArray(subnetNode.emane_configs) && subnetNode.emane_configs.length > 0) {
          const firstConfig = subnetNode.emane_configs[0];
          if (firstConfig.model) {
            const model = firstConfig.model.replace('emane_', '');
            selectedModel.value = model;
          }
        } else {
          selectedModel.value = 'rfpipe';
        }
      } else {
        selectedModel.value = 'rfpipe';
      }
    }

    // 处理emane_configs字段
    // 重要：空数组 [] 也是 truthy，需要先判断长度
    if (props.initialData.emane_configs && 
        Array.isArray(props.initialData.emane_configs) && 
        props.initialData.emane_configs.length > 0) {
      // 如果节点有自己的emane_configs，则使用自身的配置
      try {
        // 从emane字段解析模型类型 (格式: "emane_模型名")
        if (props.initialData.emane) {
          const emaneModel = props.initialData.emane.replace('emane_', '');
          selectedModel.value = emaneModel;
        }
        
        // 解析现有配置到localConfigs对象
        props.initialData.emane_configs.forEach((configItem: any) => {
          if (configItem.config) {
            Object.keys(configItem.config).forEach(key => {
              const param = configItem.config[key];
              if (param && param.group) {
                const value = param.value !== undefined ? param.value : '';
                
                // 根据参数组分类存储
                if (param.group === 'MAC Parameters') {
                  if (key in localConfigs.mac) {
                    (localConfigs.mac as any)[key] = value;
                  }
                } else if (param.group === 'PHY Parameters') {
                  if (key in localConfigs.phy) {
                    (localConfigs.phy as any)[key] = value;
                  }
                } else if (param.group === 'Platform Parameters') {
                  if (key in localConfigs.platform) {
                    (localConfigs.platform as any)[key] = value;
                  }
                } else if (param.group === 'External Parameters') {
                  if (key in localConfigs.external) {
                    (localConfigs.external as any)[key] = value;
                  }
                }
              }
            });
          }
        });
      } catch (error) {
        console.warn('恢复EMANE配置时出错，将重新开始配置:', error);
      }
    } else if (props.initialData.configs) {
      // 使用configs字段
      Object.assign(localConfigs.mac, props.initialData.configs.mac || {});
      Object.assign(localConfigs.phy, props.initialData.configs.phy || {});
      Object.assign(localConfigs.external, props.initialData.configs.external || {});
      Object.assign(localConfigs.platform, props.initialData.configs.platform || {});
    } else {
      // 如果节点没有emane_configs，则使用连接的子网节点的配置
      const subnetNodeConfig = findConnectedSubnetNode(props.initialData.id);
      if (subnetNodeConfig) {
        if (Array.isArray(subnetNodeConfig)) {
          // 处理子网节点的emane_configs数组
          subnetNodeConfig.forEach((configItem: any) => {
            if (configItem.config) {
              Object.keys(configItem.config).forEach(key => {
                const param = configItem.config[key];
                if (param && param.group) {
                  const value = param.value !== undefined ? param.value : '';
                  
                  // 根据参数组分类存储
                  if (param.group === 'MAC Parameters') {
                    if (key in localConfigs.mac) {
                      (localConfigs.mac as any)[key] = value;
                    }
                  } else if (param.group === 'PHY Parameters') {
                    if (key in localConfigs.phy) {
                      (localConfigs.phy as any)[key] = value;
                    }
                  } else if (param.group === 'Platform Parameters') {
                    if (key in localConfigs.platform) {
                      (localConfigs.platform as any)[key] = value;
                    }
                  } else if (param.group === 'External Parameters') {
                    if (key in localConfigs.external) {
                      (localConfigs.external as any)[key] = value;
                    }
                  }
                }
              });
            }
            
            // 从configItem.model中获取模型类型
            if (configItem.model) {
              const model = configItem.model.replace('emane_', '');
              if (!selectedModel.value) {
                selectedModel.value = model;
              }
            }
          });
        } else {
          // 处理子网节点的emane_configs对象
          Object.assign(localConfigs.mac, subnetNodeConfig.mac || {});
          Object.assign(localConfigs.phy, subnetNodeConfig.phy || {});
          Object.assign(localConfigs.external, subnetNodeConfig.external || {});
          Object.assign(localConfigs.platform, subnetNodeConfig.platform || {});
        }
      }
    }

    // 保存原始配置用于比较
    originalConfigs = {
      external: { ...localConfigs.external },
      mac: { ...localConfigs.mac },
      phy: { ...localConfigs.phy },
      platform: { ...localConfigs.platform },
      alias: localNodeForm.alias,
      geo: { ...localNodeForm.geo },
      role: localNodeForm.role,
      model: selectedModel.value
    };
  }
};

const handleFadingModelChange = () => {
  // 处理衰落模型变化的逻辑
};

// 比较配置是否有变化（进行标准化比较，统一转换为字符串）
const hasConfigChanged = (): boolean => {
  if (!originalConfigs) {
    return true;
  }

  const compareObjects = (obj1: Record<string, string | number>, obj2: Record<string, string | number>): boolean => {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return true;
    }

    for (const key of keys1) {
      const val1 = String(obj1[key] ?? '');
      const val2 = String(obj2[key] ?? '');
      if (val1 !== val2) {
        return true;
      }
    }

    return false;
  };

  const compareGeo = (geo1: { lon: number; lat: number; alt: number }, geo2: { lon: number; lat: number; alt: number }): boolean => {
    return geo1.lon !== geo2.lon || geo1.lat !== geo2.lat || geo1.alt !== geo2.alt;
  };

  return compareObjects(localConfigs.external, originalConfigs.external) ||
         compareObjects(localConfigs.mac, originalConfigs.mac) ||
         compareObjects(localConfigs.phy, originalConfigs.phy) ||
         compareObjects(localConfigs.platform, originalConfigs.platform) ||
         localNodeForm.alias !== originalConfigs.alias ||
         compareGeo(localNodeForm.geo, originalConfigs.geo) ||
         localNodeForm.role !== originalConfigs.role ||
         selectedModel.value !== originalConfigs.model;
};


const handleClose = () => {
  emit('close');
};

const handleCancel = () => {
  emit('close');
};

// 处理确认编辑节点
const handleConfirm = async () => {
  try {
    // 处理节点名称为空
    const trimmedAlias = localNodeForm.alias.trim();

    if (!trimmedAlias) {
      ElMessage.warning("节点名称不能为空");
      return;
    }

    if (!selectedModel.value) {
      ElMessage.warning("请选择链路层模型");
      return;
    }

    if (props.isEditMode && props.initialData) {
      // 检查配置是否有变化（在转换为字符串之前比较）
      if (!hasConfigChanged()) {
        ElMessage.info('参数未修改，无需保存');
        handleClose();
        return;
      }

      // 确保所有数值参数都是字符串类型（在比较之后修改）
      Object.keys(localConfigs.mac).forEach((key) => {
        if (localConfigs.mac[key as keyof typeof localConfigs.mac] !== undefined) {
          localConfigs.mac[key as keyof typeof localConfigs.mac] = String(
            localConfigs.mac[key as keyof typeof localConfigs.mac]
          );
        }
      });

      Object.keys(localConfigs.phy).forEach((key) => {
        if (localConfigs.phy[key as keyof typeof localConfigs.phy] !== undefined) {
          localConfigs.phy[key as keyof typeof localConfigs.phy] = String(
            localConfigs.phy[key as keyof typeof localConfigs.phy]
          );
        }
      });

      Object.keys(localConfigs.external).forEach((key) => {
        if (localConfigs.external[key as keyof typeof localConfigs.external] !== undefined) {
          localConfigs.external[key as keyof typeof localConfigs.external] = String(
            localConfigs.external[key as keyof typeof localConfigs.external]
          );
        }
      });

      Object.keys(localConfigs.platform).forEach((key) => {
        if (localConfigs.platform[key as keyof typeof localConfigs.platform] !== undefined) {
          localConfigs.platform[key as keyof typeof localConfigs.platform] = String(
            localConfigs.platform[key as keyof typeof localConfigs.platform]
          );
        }
      });

      // 编辑 - 先获取完整的节点数据，保留所有原始字段
      const existingNode = topoStore.topoData?.nodes?.find((node: any) => node.id === props.initialData.id);
      const editData = {
        ...(existingNode || props.initialData),
        id: props.initialData.id,
        name: props.initialData.name ?? localNodeForm.alias,
        type: props.initialData.type,
        model: props.initialData.model,
        emane: `emane_${selectedModel.value}`,
        geo: { ...localNodeForm.geo },
        role: localNodeForm.role,
        alias: trimmedAlias,
        emane_configs: createEmaneConfig()
      };

      // 清理EMANE配置参数，避免后端错误
      if (editData.emane_configs) {
        editData.emane_configs = sanitizeEmaneConfigs(editData.emane_configs);
      }

      // 调用编辑节点API（使用topoStore的方法以确保topoData自动更新）
      const sessionId = topoStore.currentSessionId ?? topoStore.topoData?.id;
      if (sessionId) {
        await topoStore.editNodeRemote(editData);
        ElMessage.success(`节点 ${trimmedAlias} 无线参数修改成功`);
        eventBus.emit('refreshLinks');
      } else {
        throw new Error('无法获取会话ID');
      }
      emit('confirm', editData);
      // 关闭对话框
      handleClose();
    } 
  } catch (error: any) {
    console.error('保存节点配置失败:', error);
    ElMessage.error(error?.message || '保存节点配置失败，请重试');
  }
};

// 创建无线参数配置
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
  if (Object.keys(localConfigs.external).length > 0) {
    Object.keys(localConfigs.external).sort().forEach((key) => {
      if (key in localConfigs.external) {
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
              value: String(localConfigs.external[key as keyof typeof localConfigs.external] || ''),
              type: paramType,
              select: selectOptions.sort(),
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
  } else if (Object.keys(localConfigs.mac).length > 0) {
    Object.keys(localConfigs.mac).sort().forEach((key) => {
      if (key in localConfigs.mac && key !== "none") {
        // 跳过空值
        const value = localConfigs.mac[key as keyof typeof localConfigs.mac];
        if (value === undefined || value === "" || value === null || value === "null") return;

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
              value: String(value),
              type: paramType,
              select: selectOptions.sort(),
              group: "MAC Parameters",
            },
          },
        });
      }
    });
  }

  // 处理物理层参数配置 - bypass模型没有物理层参数
  if (
    Object.keys(localConfigs.phy).length > 0 &&
    !["bypass", "commeffect"].includes(selectedModel.value)
  ) {
    Object.keys(localConfigs.phy).sort().forEach((key) => {
      if (key in localConfigs.phy) {
        // 跳过空值
        let value = localConfigs.phy[key as keyof typeof localConfigs.phy];
        if (value === undefined || value === "" || value === null || value === "null") return;

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
              value: String(value),
              type: paramType,
              select: selectOptions.sort(),
              group: "PHY Parameters",
            },
          },
        });
      }
    });
  }

  // 处理平台参数配置
  if (Object.keys(localConfigs.platform).length > 0) {
    Object.keys(localConfigs.platform).sort().forEach((key) => {
      if (key in localConfigs.platform) {
        // 跳过空值
        const value = localConfigs.platform[key as keyof typeof localConfigs.platform];
        if (value === undefined || value === "" || value === null || value === "null") return;

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
              value: String(value),
              type: paramType,
              select: selectOptions.sort(),
              group: "Platform Parameters",
            },
          },
        });
      }
    });
  }

  return emaneConfigs.sort((a, b) => {
    const groupOrder = ["External Parameters", "MAC Parameters", "PHY Parameters", "Platform Parameters"];
    const groupA = Object.values(a.config)[0]?.group || "";
    const groupB = Object.values(b.config)[0]?.group || "";
    const orderA = groupOrder.indexOf(groupA);
    const orderB = groupOrder.indexOf(groupB);
    if (orderA !== orderB) return orderA - orderB;
    return 0;
  });
};

// 清理EMANE配置参数
const sanitizeEmaneConfigs = (emaneConfigs: any) => {
  if (!emaneConfigs || !Array.isArray(emaneConfigs)) {
    return emaneConfigs;
  }
  
  return emaneConfigs.map((config: any) => {
    if (!config.config) return config;
    
    const sanitizedConfig = { ...config };
    const cleanedConfigData: any = {};
    
    Object.keys(config.config).forEach(key => {
      const param = config.config[key];
      if (param && typeof param === 'object') {
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

// 生命周期
onMounted(() => {
  initFormData();
});

// 监听initialData变化，当对话框重新打开时更新数据
watch(() => props.initialData, () => {
  initFormData();
}, { deep: true });
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
  margin-bottom: 20px;
  background: rgba(40, 57, 80, 0.3);
  border-radius: 8px;
  padding: 15px;
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
  margin-bottom: 10px;
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
  justify-content: flex-start;
  padding: 5px 0;
}

.form-row {
  display: flex;
  margin-bottom: 8px;
  align-items: center;
  transition: all 0.3s ease;
  padding: 4px;
}

.form-row:hover {
  background: rgba(12, 196, 204, 0.05);
  border-radius: 6px;
}

.right-column .form-content .form-row {
  margin-bottom: 8px;
}

.right-column .form-content .form-row:last-child,
.left-column .form-content .form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  width: 70px;
  text-align: right;
  padding-right: 10px;
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
  height: 32px;
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
  min-height: 150px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.left-column .form-content,
.right-column .form-content {
  padding: 8px 0;
  justify-content: flex-start;
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

/* 响应式设计 */
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
    min-height: 150px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .left-column .form-content,
  .right-column .form-content {
    padding: 8px 0;
    justify-content: flex-start;
  }

  .custom-dialog {
    width: 95%;
    max-width: 600px;
  }
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