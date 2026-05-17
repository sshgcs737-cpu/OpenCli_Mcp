import { defineStore } from 'pinia';
import { getVMTemplate } from '@/api/node/index';
import type { VMTemplate, VMTemplateResponse, ParsedXMLTemplate } from '@/types/vmTemplate';

/**
 * VM模板Store状态接口
 */
interface VMTemplateState {
  templates: VMTemplate[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * VM模板Store
 */
export const useVMTemplateStore = defineStore('vmTemplate', {
  state: (): VMTemplateState => ({
    templates: [],
    loading: false,
    error: null,
    lastUpdated: null
  }),

  getters: {
    /**
     * 是否有模板数据
     */
    hasTemplates: (state): boolean => state.templates.length > 0,

    /**
     * 根据ID获取模板
     */
    getTemplateById: (state) => (id: number): VMTemplate | undefined => {
      return state.templates.find(template => template.id === id);
    },

    /**
     * 根据名称获取模板
     */
    getTemplateByName: (state) => (name: string): VMTemplate | undefined => {
      return state.templates.find(template => template.name === name);
    },

    /**
     * 获取模板选项列表（用于下拉选择）
     */
    templateOptions: (state) => state.templates.map(template => ({
      label: `${template.name} - ${template.description}`,
      value: template.id,
      template
    }))
  },

  actions: {
    /**
     * 获取VM模板列表
     */
    async fetchVMTemplates(): Promise<void> {
      if (this.loading) return;

      this.loading = true;
      this.error = null;

      try {
        const response: VMTemplateResponse = await getVMTemplate();
        
        if (response.code === 200 && response.data) {
          this.templates = response.data;
          this.lastUpdated = new Date();
          
          // 存储到localStorage作为缓存
          this.saveToStorage();
          
        } else {
          throw new Error(response.msg || 'Failed to fetch VM templates');
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch VM templates';
        console.error('获取VM模板失败:', error);
        
        // 如果API失败，尝试从localStorage恢复
        this.restoreFromStorage();
      } finally {
        this.loading = false;
      }
    },

    /**
     * 保存数据到localStorage
     */
    saveToStorage(): void {
      try {
        localStorage.setItem('vmTemplates', JSON.stringify(this.templates));
        localStorage.setItem('vmTemplatesLastUpdated', this.lastUpdated?.toISOString() || '');
      } catch (error) {
        console.warn('保存VM模板到localStorage失败:', error);
      }
    },

    /**
     * 从localStorage恢复数据
     */
    restoreFromStorage(): void {
      try {
        const stored = localStorage.getItem('vmTemplates');
        const lastUpdated = localStorage.getItem('vmTemplatesLastUpdated');
        
        if (stored) {
          this.templates = JSON.parse(stored);
          this.lastUpdated = lastUpdated ? new Date(lastUpdated) : null;
        }
      } catch (error) {
        console.warn('从localStorage恢复VM模板数据失败:', error);
      }
    },

    /**
     * 清除模板数据
     */
    clearTemplates(): void {
      this.templates = [];
      this.lastUpdated = null;
      this.error = null;
      
      // 清除localStorage
      localStorage.removeItem('vmTemplates');
      localStorage.removeItem('vmTemplatesLastUpdated');
    },

    /**
     * 解析XML模板内容
     */
    parseXMLTemplate(xmlString: string): ParsedXMLTemplate | null {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        // 检查解析错误
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
          console.error('XML解析错误:', parseError.textContent);
          return null;
        }

        const domain = xmlDoc.querySelector('domain');
        if (!domain) return null;

        return {
          name: domain.querySelector('name')?.textContent || '',
          uuid: domain.querySelector('uuid')?.textContent || '',
          memory: domain.querySelector('memory')?.textContent || '',
          currentMemory: domain.querySelector('currentMemory')?.textContent || '',
          vcpu: domain.querySelector('vcpu')?.textContent || '',
          osType: domain.querySelector('os type')?.getAttribute('arch') || '',
          machine: domain.querySelector('os type')?.getAttribute('machine') || ''
        };
      } catch (error) {
        console.error('解析XML模板失败:', error);
        return null;
      }
    },

    /**
     * 检查是否需要刷新数据（超过一定时间）
     */
    shouldRefresh(maxAgeMinutes: number = 30): boolean {
      if (!this.lastUpdated) return true;
      
      const now = new Date();
      const diffMinutes = (now.getTime() - this.lastUpdated.getTime()) / (1000 * 60);
      
      return diffMinutes > maxAgeMinutes;
    },

    /**
     * 确保模板数据可用（如果没有数据或数据过期则获取）
     */
    async ensureTemplatesAvailable(): Promise<void> {
      if (!this.hasTemplates || this.shouldRefresh()) {
        await this.fetchVMTemplates();
      }
    }
  }
});
