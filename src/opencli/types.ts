export type OpenCliNodeType =
  | 'DRONE'
  | 'EMANE'
  | 'BASESTATION'
  | 'DEFAULT'
  | 'VMNODE'
  | 'RJ45'
  | 'SWITCH'
  | 'INODE'
  | 'DOCKER';

export type OpenCliRole = 1 | 2 | 3; // 1 公共/白方，2 红方，3 蓝方

export type OpenCliCommand =
  | { kind: 'help' }
  | { kind: 'listScenes'; scope?: 'private' | 'public' | 'all'; name?: string }
  | { kind: 'currentScene' }
  | { kind: 'openViewer' }
  | { kind: 'exitCurrentScene' }
  | { kind: 'refreshTopo' }
  | { kind: 'simulationCheck' }
  | { kind: 'initScene'; name?: string }
  | { kind: 'loadScene'; sessionId?: number; name?: string }
  | { kind: 'closeScene'; sessionId?: number; name?: string }
  | { kind: 'sampleScene' }
  | { kind: 'clearScene' }
  | { kind: 'listNodes' }
  | { kind: 'listLinks' }
  | { kind: 'exportScene' }
  | { kind: 'startSession'; duration?: number }
  | { kind: 'pauseSession' }
  | { kind: 'stopSession' }
  | {
      kind: 'addNode';
      nodeType: OpenCliNodeType;
      name?: string;
      lat?: number;
      lon?: number;
      alt?: number;
      role?: OpenCliRole;
    }
  | {
      kind: 'addNodesGrid';
      nodeType: OpenCliNodeType;
      count: number;
      prefix?: string;
      centerLat?: number;
      centerLon?: number;
      alt?: number;
      role?: OpenCliRole;
    }
  | {
      kind: 'addNodesBatch';
      nodeType: OpenCliNodeType;
      names: string[];
      centerLat?: number;
      centerLon?: number;
      alt?: number;
      role?: OpenCliRole;
    }
  | { kind: 'connectNodes'; from: string; to: string; linkType?: 'WIRED' | 'WIRELESS' }
  | { kind: 'addLinksBatch'; pairs: Array<{ from: string; to: string }>; linkType?: 'WIRED' | 'WIRELESS' }
  | { kind: 'deleteNode'; target: string }
  | { kind: 'deleteNodesBatch'; targets: string[] }
  | { kind: 'deleteLinksBatch'; pairs: Array<{ from: string; to: string }> }
  | { kind: 'moveNode'; target: string; lat: number; lon: number; alt?: number }
  | { kind: 'setNodeStatus'; target: string; status: 'UP' | 'DOWN' };

export interface OpenCliResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

export interface OpenCliHistoryItem {
  id: number;
  input: string;
  result: OpenCliResult;
  time: string;
  pending?: boolean;
}
