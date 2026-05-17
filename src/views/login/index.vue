<template>
  <div class="login-container">
    <!-- 背景大标题 -->
    <div class="system-title">
      <h1 class="system-title-main">机动网络环境仿真系统</h1>
      <span class="system-title-version">V2.0</span>
      <div class="system-title-line"></div>
    </div>

    <div class="form-container" v-show="!modeDialogVisible">
      <el-form
        class="login-form"
        :model="loginForm"
        :rules="rules"
        ref="loginFormRef"
        @keyup.enter="submitForm"
      >
        <h2 class="title">用户登录</h2>

        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            type="password"
            show-password
            placeholder="请输入密码"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 验证码 -->
        <el-form-item prop="captcha">
          <div class="captcha-row">
            <el-input
              v-model="loginForm.captcha"
              placeholder="请输入验证码"
              class="captcha-input"
            >
              <template #prefix>
                <el-icon><Key /></el-icon>
              </template>
            </el-input>
            <div class="captcha-box" @click="refreshCaptcha" title="点击刷新验证码">
              <canvas ref="captchaCanvas" width="110" height="38"></canvas>
            </div>
          </div>
        </el-form-item>

        <el-form-item>
          <el-button
            class="login-btn"
            type="primary"
            @click="submitForm"
            size="default"
            :loading="loading"
          >登录</el-button>
        </el-form-item>

        <div class="forgot-password">
          <span @click="showForgotTip">忘记密码？</span>
        </div>
      </el-form>
    </div>

    <!-- 仿真模式选择对话框 -->
    <el-dialog
      v-model="modeDialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      width="560px"
      :style="{ '--el-dialog-bg-color': 'transparent' }"
      class="mode-dialog"
    >
      <template #header>
        <div class="mode-dialog-title">
          <span v-if="selectionStep === 1">选择仿真模式</span>
          <span v-else>选择角色</span>
        </div>
      </template>

      <!-- Step 1: 选择仿真模式 -->
      <div v-if="selectionStep === 1" class="mode-cards">
        <div class="mode-card" @click="handleModeSelect('normal')">
          <div class="mode-card-icon normal-icon">
            <el-icon :size="40"><Monitor /></el-icon>
          </div>
          <div class="mode-card-title">普通仿真</div>
        </div>
        <div class="mode-card" @click="handleModeSelect('attack-defense')">
          <div class="mode-card-icon attack-icon">
            <el-icon :size="40"><Aim /></el-icon>
          </div>
          <div class="mode-card-title">攻防仿真</div>
        </div>
      </div>

      <!-- Step 2: 选择角色 -->
      <div v-else class="role-cards">
        <div class="role-card role-white" @click="handleRoleSelect('white')">
          <div class="role-card-color white-color"></div>
          <div class="role-card-info">
            <div class="role-card-title">白 方</div>
          </div>
          <div class="role-card-arrow">&rsaquo;</div>
        </div>
        <div class="role-card role-red" @click="handleRoleSelect('red')">
          <div class="role-card-color red-color"></div>
          <div class="role-card-info">
            <div class="role-card-title">红 方</div>
          </div>
          <div class="role-card-arrow">&rsaquo;</div>
        </div>
        <div class="role-card role-blue" @click="handleRoleSelect('blue')">
          <div class="role-card-color blue-color"></div>
          <div class="role-card-info">
            <div class="role-card-title">蓝 方</div>
          </div>
          <div class="role-card-arrow">&rsaquo;</div>
        </div>
        <div class="role-back">
          <el-button @click="selectionStep = 1">&larr; 返回选择模式</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { User, Lock, Key, Monitor, Aim } from "@element-plus/icons-vue";
import { useRouter } from "vue-router";
import { reactive, ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { setUserInfo, setUserRole, setUserMode, setDisturbPermission } from "../../store/user";
import { login, parseComplexResponse } from "../../api/auth";
import { setUserToken } from "../../api/request";
import { useSystemLogStore } from "../../store/modules/systemLog";

const router = useRouter();
const systemLogStore = useSystemLogStore();
const loginFormRef = ref(null);
const loading = ref(false);
const captchaCanvas = ref(null);
const captchaCode = ref("");

// 模式选择状态
const modeDialogVisible = ref(false);
const selectionStep = ref(1); // 1 = 选模式, 2 = 选角色

const loginForm = reactive({
  username: "",
  password: "",
  captcha: ""
});

// 生成随机验证码并绘制到canvas
function generateCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  captchaCode.value = code;
  drawCaptcha(code);
}

function drawCaptcha(code) {
  const canvas = captchaCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  // 背景
  ctx.fillStyle = "#1a3a5c";
  ctx.fillRect(0, 0, w, h);

  // 干扰线
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(${Math.random()*100+100},${Math.random()*100+100},${Math.random()*100+200},0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.stroke();
  }

  // 干扰点
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${Math.random()*255},${Math.random()*255},${Math.random()*255},0.4)`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1, 0, 2 * Math.PI);
    ctx.fill();
  }

  // 验证码文字
  const colors = ["#00d4ff", "#7ecfff", "#ffffff", "#a0e4ff"];
  for (let i = 0; i < code.length; i++) {
    ctx.font = `bold ${20 + Math.random() * 6}px Arial`;
    ctx.fillStyle = colors[i % colors.length];
    ctx.save();
    ctx.translate(16 + i * 24, h / 2 + 6);
    ctx.rotate((Math.random() - 0.5) * 0.4);
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }
}

function refreshCaptcha() {
  loginForm.captcha = "";
  generateCaptcha();
}

onMounted(() => {
  generateCaptcha();
});

const rules = computed(() => ({
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 3, max: 20, message: "长度在 3 到 20 个字符", trigger: "blur" }
  ],
  captcha: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value.toLowerCase() !== captchaCode.value.toLowerCase()) {
          callback(new Error("验证码错误"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
}));

// 根据用户名判断用户类型：admin为管理员，其他为普通用户
function resolveUserType(username) {
  return username === "admin" ? 1 : 2;
}

const submitForm = async () => {
  if (!loginFormRef.value) return;
  try {
    loading.value = true;
    await loginFormRef.value.validate();
    await handleLogin();
  } catch (error) {
    if (error && error.message) {
      ElMessage.error("登录失败，请检查用户名和密码");
    }
    refreshCaptcha();
  } finally {
    loading.value = false;
  }
};

const handleLogin = async () => {
  const userType = resolveUserType(loginForm.username);

  systemLogStore.addLog({
    type: "normal",
    module: "auth",
    action: "用户登录尝试",
    information: "用户登录",
    details: `用户 "${loginForm.username}" 尝试登录，用户类型: ${userType === 1 ? "管理员" : "普通用户"}`
  });

  const response = await login(loginForm.username, loginForm.password, userType);
  const parsedResponse = parseComplexResponse(response);

  let userId = parsedResponse?.id || response?.id || "";
  let username = parsedResponse?.username || response?.username || loginForm.username;
  let disturb = parsedResponse?.disturb ?? response?.disturb ?? 0;

  setUserInfo("", userId, username, userType);
  
  // 保存分布式场景权限
  setDisturbPermission(disturb);

  const token = response?.token || parsedResponse?.token;
  if (token) setUserToken(token);

  systemLogStore.addLog({
    type: "important",
    module: "auth",
    action: "用户登录成功",
    information: "用户登录成功",
    details: `用户 "${username}" (ID: ${userId}) 成功登录，类型: ${userType === 1 ? "管理员" : "普通用户"}`
  });

  ElMessage.success("登录成功");

  // 弹出仿真模式选择
  selectionStep.value = 1;
  modeDialogVisible.value = true;
};

// 选择仿真模式
const handleModeSelect = (mode) => {
  if (mode === 'normal') {
    setUserMode('normal');
    modeDialogVisible.value = false;
    router.push("/simu");
  } else {
    // 攻防模式 → 进入角色选择
    selectionStep.value = 2;
  }
};

// 选择角色
const handleRoleSelect = (role) => {
  setUserMode('attack-defense');
  setUserRole(role);
  modeDialogVisible.value = false;
  router.push("/simu");
};

const showForgotTip = () => {
  ElMessageBox.alert("请联系管理员重置密码", "忘记密码", {
    confirmButtonText: "确定",
    type: "info"
  });
};
</script>

<style lang="scss" scoped>
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  background: url("../../assets/image/bg1.jpg") no-repeat center center fixed;
  background-size: cover;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  overflow: hidden;

  // 左侧暗色渐变遮罩，突出右侧登录框
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to right,
      rgba(0, 10, 30, 0.55) 0%,
      rgba(0, 10, 30, 0.15) 55%,
      rgba(0, 10, 30, 0.6) 100%
    );
    pointer-events: none;
  }
}

/* ===== 背景大标题 ===== */
.system-title {
  position: absolute;
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  text-align: center;
  pointer-events: none;
  user-select: none;
}

.system-title-main {
  font-size: 52px;
  font-weight: 700;
  color: #e8f4ff;
  letter-spacing: 20px;
  text-shadow:
    0 0 30px rgba(0, 180, 255, 0.6),
    0 0 60px rgba(0, 120, 255, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.5);
  margin: 0;
  white-space: nowrap;
  line-height: 1.3;
}

.system-title-version {
  display: inline-block;
  margin-top: 10px;
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 200, 255, 0.8);
  letter-spacing: 6px;
  padding: 4px 18px;
  border: 1px solid rgba(0, 180, 255, 0.3);
  border-radius: 20px;
  background: rgba(0, 100, 200, 0.1);
  text-shadow: 0 0 10px rgba(0, 180, 255, 0.5);
}

.system-title-line {
  margin: 16px auto 0;
  width: 260px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 180, 255, 0.5), transparent);
}

.form-container {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 420px;
  margin-right: 8%;
}

.login-form {
  width: 100%;
  background: rgba(4, 20, 48, 0.82);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 44px 40px 36px;
  border-radius: 12px;
  border: 1px solid rgba(0, 180, 255, 0.18);
  box-shadow:
    0 0 0 1px rgba(0, 180, 255, 0.08),
    0 8px 40px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.title {
  color: #e8f4ff;
  font-size: 18px;
  font-weight: 500;
  text-align: center;
  margin-bottom: 28px;
  letter-spacing: 4px;
  position: relative;
  padding-bottom: 16px;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 50px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00b4ff, transparent);
  }
}

// 覆盖 el-input 样式适配深色背景
:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.06) !important;
  border: 1px solid rgba(0, 180, 255, 0.25) !important;
  box-shadow: none !important;
  border-radius: 6px;
  transition: border-color 0.2s;

  &:hover, &.is-focus {
    border-color: rgba(0, 180, 255, 0.6) !important;
    background: rgba(255, 255, 255, 0.09) !important;
  }
}

:deep(.el-input__inner) {
  color: #d0eaff;
  caret-color: #00b4ff;

  &::placeholder {
    color: rgba(160, 200, 230, 0.45);
  }
}

:deep(.el-input__prefix-inner .el-icon) {
  color: rgba(0, 180, 255, 0.7);
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;

  .captcha-input {
    flex: 1;
  }

  .captcha-box {
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(0, 180, 255, 0.25);
    flex-shrink: 0;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:hover {
      border-color: rgba(0, 180, 255, 0.6);
      box-shadow: 0 0 8px rgba(0, 180, 255, 0.2);
    }

    canvas {
      display: block;
    }
  }
}

.login-btn {
  width: 100%;
  margin-top: 6px;
  height: 40px;
  font-size: 15px;
  letter-spacing: 2px;
  background: linear-gradient(135deg, #0066cc, #0099ff);
  border: none;
  border-radius: 6px;
  box-shadow: 0 4px 15px rgba(0, 153, 255, 0.3);
  transition: all 0.25s;

  &:hover {
    background: linear-gradient(135deg, #0077dd, #00aaff);
    box-shadow: 0 4px 20px rgba(0, 153, 255, 0.5);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.forgot-password {
  text-align: right;
  margin-top: -4px;

  span {
    color: rgba(160, 200, 230, 0.6);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: #00b4ff;
    }
  }
}

@media screen and (max-width: 900px) {
  .login-container {
    justify-content: center;
  }

  .form-container {
    margin-right: 0;
    padding: 0 20px;
    width: 100%;
    max-width: 420px;
  }
}
</style>

<style lang="scss">

.el-overlay:has(.mode-dialog) {
  background-color: rgba(0, 5, 15, 0.75) !important;
  backdrop-filter: blur(6px);
}

.mode-dialog .el-dialog,
.el-dialog.mode-dialog,
div.mode-dialog {
  background: rgba(2, 12, 35, 0.96) !important;
  border: 1px solid rgba(0, 160, 255, 0.3) !important;
  border-radius: 14px !important;
  box-shadow:
    0 0 0 1px rgba(0, 120, 255, 0.1),
    0 12px 50px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(0, 120, 255, 0.08),
    inset 0 1px 0 rgba(0, 200, 255, 0.08) !important;
  backdrop-filter: blur(20px);
  overflow: hidden;
}

.mode-dialog .el-dialog__header,
.el-dialog.mode-dialog .el-dialog__header {
  background: linear-gradient(180deg, rgba(0, 60, 140, 0.25) 0%, transparent 100%) !important;
  border-bottom: 1px solid rgba(0, 150, 255, 0.12) !important;
  padding: 22px 28px 16px !important;
  margin-right: 0 !important;
}

.mode-dialog .el-dialog__body,
.el-dialog.mode-dialog .el-dialog__body {
  padding: 28px !important;
  background: transparent !important;
}

/* ===== 标题 ===== */
.mode-dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #e0f0ff;
  text-align: center;
  letter-spacing: 3px;
  text-shadow: 0 0 16px rgba(0, 180, 255, 0.5);
  position: relative;

  &::after {
    content: '';
    display: block;
    width: 50px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #00c8ff, transparent);
    margin: 10px auto 0;
  }
}

/* ===== 模式卡片 ===== */
.mode-cards {
  display: flex;
  gap: 22px;
}

.mode-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 20px 28px;
  background: linear-gradient(160deg, rgba(0, 50, 120, 0.3) 0%, rgba(0, 25, 70, 0.2) 100%);
  border: 1px solid rgba(0, 150, 255, 0.18);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  /* 顶部光线 */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0, 200, 255, 0.5), transparent);
    transition: all 0.4s;
  }

  &:hover {
    background: linear-gradient(160deg, rgba(0, 80, 180, 0.35) 0%, rgba(0, 40, 110, 0.25) 100%);
    border-color: rgba(0, 200, 255, 0.45);
    transform: translateY(-4px);
    box-shadow:
      0 8px 30px rgba(0, 120, 255, 0.2),
      0 0 20px rgba(0, 180, 255, 0.08),
      inset 0 0 30px rgba(0, 150, 255, 0.04);

    &::before {
      left: 5%;
      right: 5%;
      background: linear-gradient(90deg, transparent, rgba(0, 230, 255, 0.8), transparent);
    }
  }

  .mode-card-icon {
    width: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.4s;
  }

  .normal-icon {
    color: #00e5ff;
    background: radial-gradient(circle, rgba(0, 180, 255, 0.15) 0%, transparent 70%);
    border: 1px solid rgba(0, 200, 255, 0.2);
    filter: drop-shadow(0 0 8px rgba(0, 229, 255, 0.3));
  }

  .attack-icon {
    color: #ffa940;
    background: radial-gradient(circle, rgba(255, 169, 64, 0.12) 0%, transparent 70%);
    border: 1px solid rgba(255, 169, 64, 0.2);
    filter: drop-shadow(0 0 8px rgba(255, 169, 64, 0.25));
  }

  &:hover .normal-icon {
    border-color: rgba(0, 229, 255, 0.5);
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.2);
  }

  &:hover .attack-icon {
    border-color: rgba(255, 169, 64, 0.5);
    box-shadow: 0 0 20px rgba(255, 169, 64, 0.2);
  }

  .mode-card-title {
    font-size: 17px;
    font-weight: 600;
    color: #e0f0ff;
    letter-spacing: 2px;
  }

  .mode-card-desc {
    font-size: 12px;
    color: rgba(140, 200, 255, 0.55);
    text-align: center;
    line-height: 1.5;
  }
}

/* ===== 角色卡片 ===== */
.role-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: rgba(0, 30, 80, 0.25);
  border: 1px solid rgba(0, 150, 255, 0.12);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateX(6px);
  }

  .role-card-color {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .white-color {
    background: linear-gradient(135deg, #e8e8e8, #ffffff);
    box-shadow: 0 0 12px rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .red-color {
    background: linear-gradient(135deg, #d44040, #F56C6C);
    box-shadow: 0 0 12px rgba(245, 108, 108, 0.3);
    border: 1px solid rgba(245, 108, 108, 0.4);
  }

  .blue-color {
    background: linear-gradient(135deg, #1565c0, #1E90FF);
    box-shadow: 0 0 12px rgba(30, 144, 255, 0.3);
    border: 1px solid rgba(30, 144, 255, 0.4);
  }

  .role-card-info {
    flex: 1;
  }

  .role-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #d0e8ff;
    margin-bottom: 2px;
    letter-spacing: 4px;
  }

  .role-card-desc {
    font-size: 12px;
    color: rgba(140, 200, 255, 0.5);
  }

  .role-card-arrow {
    font-size: 24px;
    color: rgba(140, 200, 255, 0.3);
    transition: all 0.3s;
    flex-shrink: 0;
  }

  &:hover .role-card-arrow {
    color: rgba(140, 200, 255, 0.7);
    transform: translateX(4px);
  }

  /* 白方 hover */
  &.role-white:hover {
    border-color: rgba(200, 200, 200, 0.35);
    background: rgba(255, 255, 255, 0.06);

    .role-card-title { color: #ffffff; }
    .role-card-arrow { color: rgba(255, 255, 255, 0.5); }
  }

  /* 红方 hover */
  &.role-red:hover {
    border-color: rgba(245, 108, 108, 0.4);
    background: rgba(245, 108, 108, 0.06);

    .role-card-title { color: #F56C6C; }
    .role-card-arrow { color: rgba(245, 108, 108, 0.5); }
  }

  /* 蓝方 hover */
  &.role-blue:hover {
    border-color: rgba(30, 144, 255, 0.4);
    background: rgba(30, 144, 255, 0.06);

    .role-card-title { color: #1E90FF; }
    .role-card-arrow { color: rgba(30, 144, 255, 0.5); }
  }
}

.role-back {
  display: flex;
  justify-content: center;
  margin-top: 8px;

  .el-button {
    background: rgba(0, 40, 100, 0.3) !important;
    border-color: rgba(0, 150, 255, 0.2) !important;
    color: rgba(140, 200, 255, 0.7) !important;
    letter-spacing: 1px;

    &:hover {
      background: rgba(0, 60, 140, 0.4) !important;
      border-color: rgba(0, 180, 255, 0.35) !important;
      color: #ffffff !important;
    }
  }
}
</style>
