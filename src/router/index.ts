import {createRouter, createWebHistory} from 'vue-router';
import {constRoutes} from './constRoute';

const router = createRouter({
    history: createWebHistory(),
    routes: constRoutes
});

export default router;