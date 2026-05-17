// EMANE MAC 相邻节点指标表
export interface NeighborMetricTable {
  nem: number;
  rxPkts: number;
  txPkts: number;
  missedPkts: number;
  bwUtil: number;
  lastRx: number;
  lastTx: number;
  sinrAvg: number;
  sinrStdv: number;
  nfAvg: number;
  nfStdv: number;
  rxRateAvg: number;
  txRateAvg: number;
}

// EMANE MAC 相邻节点状态表
export interface NeighborStatusTable {
  nem: number;
  rxPkts: number;
  txPkts: number;
  missedPkts: number;
  bwUtilRatio: number;
  sinrAvg: number;
  nfAvg: number;
  rxRAge: number;
}

// EMANE MAC RF信号表
export interface RFSignalTable {
  nem: number;
  antennaId: number;
  frequencyHz: number;
  numSamples: number;
  avgRxPower: number;
  avgNoiseFloor: number;
  avgSINR: number;
  avgINR: number;
  
}

// EMANE MAC 信息总体结构
export interface EmaneMacInfo {
  neighborMetricTables: NeighborMetricTable[];
  neighborStatusTables: NeighborStatusTable[];
  rfSignalTables: RFSignalTable[];
}

// 通过NEM ID获取相应数据的映射结构
export interface EmaneDataByNem {
  [nemId: number]: {
    metrics?: NeighborMetricTable;
    status?: NeighborStatusTable;
    rfSignal?: RFSignalTable;
  }
}

// 节点视角下的NEM ID映射结构
export interface NodeLinkNemMap {
  [nodeId: number]: {
    // 节点自身的NEM ID
    ownNemId: number;
    // 该节点能够看到的其他节点的NEM ID映射
    targetNemIds: {
      [targetNodeId: number]: number;
    };
  };
} 