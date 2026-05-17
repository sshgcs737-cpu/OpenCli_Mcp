<template>
    <div class="semi-physical-container">
        <el-container>
            <!-- 左侧侧边栏 -->
            <el-aside width="220px" class="side-menu">
                <el-menu :default-active="activeMenuItem" class="vertical-menu" @select="handleMenuSelect">
                    <el-sub-menu index="1">
                        <template #title>
                            <el-icon>
                                <Cpu />
                            </el-icon>
                            <span>半物理仿真</span>
                        </template>
                        <el-menu-item index="1-1">环境配置</el-menu-item>
                        <el-menu-item index="1-2">设备接入</el-menu-item>
                        <el-menu-item index="1-3">运行监控</el-menu-item>
                    </el-sub-menu>
                </el-menu>
            </el-aside>

            <!-- 右侧内容区 -->
            <el-main class="content-area">
                <h2>半物理仿真</h2>
                <div v-if="activeMenuItem === '1-1'">
                    <h3>环境配置</h3>
                    <!-- 环境配置相关内容 -->
                </div>
                <div v-else-if="activeMenuItem === '1-2'">
                    <h3>设备接入</h3>
                    <!-- 设备接入相关内容 -->
                </div>
                <div v-else-if="activeMenuItem === '1-3'">
                    <h3>运行监控</h3>
                    <!-- 运行监控相关内容 -->
                </div>
            </el-main>
        </el-container>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Cpu } from '@element-plus/icons-vue';

const activeMenuItem = ref('1-1');

const handleMenuSelect = (index: string) => {
    activeMenuItem.value = index;
};
</script>

<style scoped lang="scss">
.semi-physical-container {
    height: 100%;
    display: flex;

    .el-container {
        width: 100%;
        height: 100%;
    }

    .side-menu {
        height: 100%;
        border-right: 1px solid #e6e6e6;
        background-color: #fff;
        transition: width 0.3s;
    }

    .content-area {
        background-color: #f5f7fa;
        padding: 20px;
        overflow: auto;
    }
}
</style>