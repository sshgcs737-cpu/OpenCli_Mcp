<template>
  <div class="opencli-shell" :class="{ collapsed }">
    <button class="opencli-toggle" @click="collapsed = !collapsed">
      {{ collapsed ? 'OpenCLI' : '收起' }}
    </button>

    <div v-if="!collapsed" class="opencli-panel">
      <div class="opencli-header">
        <div>
          <div class="opencli-title">OpenCLI 全局控制台</div>
          <div class="opencli-subtitle">场景 / 拓扑 / 仿真 / 态势</div>
        </div>
        <button class="header-btn" :disabled="running" @click="runPreset('帮助')">帮助</button>
      </div>

      <div class="opencli-history" ref="historyRef">
        <div v-if="history.length === 0" class="empty-tip">
          可以先切换场景，再进入态势展示，例如：
          <br />场景列表
          <br />加载场景 12
          <br />打开态势
        </div>
        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="history-input">&gt; {{ item.input }}</div>
          <pre :class="['history-output', item.result.ok ? 'ok' : 'error']">{{ item.pending ? '执行中...' : item.result.message }}</pre>
        </div>
      </div>

      <div class="preset-row">
        <button :disabled="running" @click="runPreset('场景列表')">场景</button>
        <button :disabled="running" @click="runPreset('刷新拓扑')">刷新</button>
        <button :disabled="running" @click="runPreset('仿真检查')">检查</button>
        <button :disabled="running" @click="runPreset('打开态势')">态势</button>
        <button :disabled="running" @click="runPreset('演示场景')">演示场景</button>
        <button :disabled="running" @click="runPreset('查看节点')">节点</button>
        <button :disabled="running" @click="runPreset('查看链路')">链路</button>
        <button :disabled="running" @click="runPreset('导出')">导出</button>
      </div>

      <div class="input-row">
        <input
          v-model="input"
          :disabled="running"
          placeholder="输入 OpenCLI 命令，Enter 执行"
          @keydown.enter="run"
        />
        <button :disabled="running" @click="run">{{ running ? '执行中' : '执行' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { executeOpenCli } from './commandRegistry';
import type { OpenCliHistoryItem } from './types';

const collapsed = ref(true);
const input = ref('');
const running = ref(false);
const history = ref<OpenCliHistoryItem[]>([]);
const historyRef = ref<HTMLElement | null>(null);

function formatTime(): string {
  const now = new Date();
  return now.toLocaleTimeString();
}

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (historyRef.value) historyRef.value.scrollTop = historyRef.value.scrollHeight;
}

async function pushHistory(commandText: string): Promise<void> {
  if (running.value) return;
  running.value = true;

  const item: OpenCliHistoryItem = {
    id: Date.now() + Math.random(),
    input: commandText,
    result: { ok: true, message: '' },
    time: formatTime(),
    pending: true,
  };
  history.value.push(item);
  await scrollToBottom();

  const result = await executeOpenCli(commandText);
  item.result = result;
  item.pending = false;
  running.value = false;
  await scrollToBottom();
}

function run(): void {
  const commandText = input.value.trim();
  if (!commandText) return;
  input.value = '';
  void pushHistory(commandText);
}

function runPreset(commandText: string): void {
  if (running.value) return;
  input.value = commandText;
  run();
}
</script>

<style scoped>
.opencli-shell {
  position: fixed;
  left: 18px;
  bottom: 18px;
  z-index: 10000;
  font-family: Consolas, Monaco, 'Microsoft YaHei', monospace;
}

.opencli-toggle {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 8px;
  background: linear-gradient(90deg, #00eaff, #0088ff);
  color: #001018;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(0, 234, 255, 0.35);
}

.opencli-panel {
  width: 560px;
  height: 440px;
  border: 1px solid rgba(0, 234, 255, 0.7);
  border-radius: 12px;
  background: rgba(4, 13, 26, 0.92);
  box-shadow: 0 12px 42px rgba(0, 0, 0, 0.55), 0 0 30px rgba(0, 234, 255, 0.18);
  backdrop-filter: blur(10px);
  color: #dff9ff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.opencli-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0, 234, 255, 0.25);
  background: linear-gradient(90deg, rgba(0, 234, 255, 0.16), rgba(0, 136, 255, 0.06));
}

.opencli-title {
  font-size: 15px;
  font-weight: 700;
  color: #00eaff;
}

.opencli-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(223, 249, 255, 0.72);
}

.header-btn,
.preset-row button,
.input-row button {
  border: 1px solid rgba(0, 234, 255, 0.45);
  color: #bdf8ff;
  background: rgba(0, 234, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover,
.preset-row button:hover,
.input-row button:hover {
  background: rgba(0, 234, 255, 0.22);
  box-shadow: 0 0 12px rgba(0, 234, 255, 0.25);
}

.header-btn:disabled,
.preset-row button:disabled,
.input-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-btn {
  padding: 6px 10px;
}

.opencli-history {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
}

.empty-tip {
  color: rgba(223, 249, 255, 0.55);
  line-height: 1.7;
  border: 1px dashed rgba(0, 234, 255, 0.25);
  padding: 14px;
  border-radius: 8px;
}

.history-item {
  margin-bottom: 14px;
}

.history-input {
  color: #00eaff;
  margin-bottom: 6px;
  white-space: pre-wrap;
  word-break: break-word;
}

.history-output {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 12px;
  max-height: 180px;
  overflow: auto;
}

.history-output.ok {
  color: #d8ffe8;
  background: rgba(28, 170, 96, 0.12);
  border: 1px solid rgba(28, 170, 96, 0.2);
}

.history-output.error {
  color: #ffd8d8;
  background: rgba(255, 70, 70, 0.12);
  border: 1px solid rgba(255, 70, 70, 0.24);
}

.preset-row {
  display: flex;
  gap: 7px;
  padding: 9px 10px;
  border-top: 1px solid rgba(0, 234, 255, 0.14);
}

.preset-row button {
  padding: 5px 9px;
  font-size: 12px;
}

.input-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid rgba(0, 234, 255, 0.16);
}

.input-row input {
  flex: 1;
  border: 1px solid rgba(0, 234, 255, 0.4);
  border-radius: 7px;
  padding: 8px 10px;
  color: #dff9ff;
  background: rgba(0, 0, 0, 0.25);
  outline: none;
}

.input-row input:focus {
  border-color: #00eaff;
  box-shadow: 0 0 12px rgba(0, 234, 255, 0.18);
}

.input-row button {
  padding: 0 14px;
  font-weight: 700;
}
</style>
