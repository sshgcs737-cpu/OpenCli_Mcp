<template>
    <div class="offense-defense-container">
        <el-container>
            <!-- 左侧侧边栏 -->
            <el-aside width="220px" class="side-menu">
                <el-menu :default-active="activeMenuItem" class="vertical-menu" @select="handleMenuSelect">
                    <el-sub-menu index="1">
                        <template #title>
                            <el-icon>
                                <Aim />
                            </el-icon>
                            <span>攻防对抗</span>
                        </template>
                        <el-menu-item index="1-1">场景设置</el-menu-item>
                        <el-menu-item index="1-2">攻击模型</el-menu-item>
                        <el-menu-item index="1-3">防御策略</el-menu-item>
                    </el-sub-menu>
                </el-menu>
            </el-aside>

            <!-- 右侧内容区 -->
            <el-main class="content-area">
                <div v-if="activeMenuItem === '1-1'">
                    <h3>场景设置</h3>
                    <!-- 场景设置相关内容 -->
                </div>
                <div v-else-if="activeMenuItem === '1-2'" class="content-box">
                    <SceneList />
                </div>
                <div v-else-if="activeMenuItem === '1-3'">
                    <SceneList />
                </div>
            </el-main>
        </el-container>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Aim } from '@element-plus/icons-vue';
import SceneList from '../../components/SceneList.vue';

const activeMenuItem = ref('1-1');

const handleMenuSelect = (index: string) => {
    activeMenuItem.value = index;
};
</script>

<style scoped lang="scss">
.offense-defense-container {
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

    .content-box {
        height: calc(100% - 40px);
        
        h3 {
            margin-top: 0;
            margin-bottom: 20px;
        }
    }
}
</style>