import { ref, reactive } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

// 告警类型定义
export interface AlertMessage {
  data: string;
  action: number;
  type: 'warn' | 'error';
}

// 告警状态管理
class AlertService {
  private static instance: AlertService;
  private alertHandlers = new Map<string, (alert: AlertMessage) => void>();

  private constructor() {}

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  // 注册告警处理器
  onAlert(key: string, handler: (alert: AlertMessage) => void): void {
    this.alertHandlers.set(key, handler);
  }

  // 移除告警处理器
  offAlert(key: string): void {
    this.alertHandlers.delete(key);
  }

  // 触发告警
  triggerAlert(alert: AlertMessage): void {
    console.log('触发告警:', alert);
    
    // 通知所有注册的处理器
    this.alertHandlers.forEach((handler) => {
      try {
        handler(alert);
      } catch (error) {
        console.error('处理告警时出错:', error);
      }
    });
  }

  // 处理磁盘告警
  handleDiskAlert(alert: AlertMessage): void {
    if (alert.type === 'warn') {
      // warn: 提醒用户停止场景
      ElMessageBox.alert(
        alert.data,
        '磁盘告警',
        {
          confirmButtonText: '确定',
          type: 'warning',
          callback: () => {
            // 用户确认后，可以触发停止场景的操作
            this.triggerAlert({
              ...alert,
              action: 999, // 自定义action表示用户已确认告警
            });
          },
        }
      );
    } else if (alert.type === 'error') {
      // error: 告知后台已将所有场景停止
      ElMessageBox.alert(
        alert.data,
        '磁盘告警 - 严重',
        {
          confirmButtonText: '确定',
          type: 'error',
          callback: () => {
            // 用户确认后，可以触发相关操作
            this.triggerAlert({
              ...alert,
              action: 999, // 自定义action表示用户已确认告警
            });
          },
        }
      );
    }
  }
}

export const alertService = AlertService.getInstance();

export default alertService;
