// NoVNC类型声明文件
declare module '@novnc/novnc/core/rfb.js' {
  export default class RFB {
    constructor(target: HTMLElement, url: string, options?: {
      credentials?: {
        password?: string;
        username?: string;
      };
      repeaterID?: string;
      shared?: boolean;
    });

    // 属性
    scaleViewport: boolean;
    resizeSession: boolean;
    viewOnly: boolean;
    focusOnClick: boolean;
    clipViewport: boolean;
    dragViewport: boolean;
    showDotCursor: boolean;
    background: string;
    qualityLevel: number;
    compressionLevel: number;

    // 方法
    disconnect(): void;
    sendCredentials(creds: { username?: string; password?: string }): void;
    sendKey(keysym: number, code?: string, down?: boolean): void;
    sendCtrlAltDel(): void;
    focus(): void;
    blur(): void;
    machineShutdown(): void;
    machineReboot(): void;
    machineReset(): void;
    clipboardPasteFrom(text: string): void;

    // 事件监听
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
  }
}

// 扩展Window接口以支持全屏API
declare global {
  interface Document {
    fullscreenElement?: Element;
    exitFullscreen?: () => Promise<void>;
  }

  interface HTMLElement {
    requestFullscreen?: () => Promise<void>;
  }
}

export {};
