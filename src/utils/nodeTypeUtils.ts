// 节点类型映射表
export const NODE_TYPE_LABELS_CN: { [key: string]: string } = {
  'ROUTER': '路由器',
  'RJ45': '半实物节点',
  'TMV': '流量终端',
  'ATTACK_MACHINE': '攻击机',
  'SECURITY_MACHINE': '安全机',
  'SDN_CONTROLLER': 'SDN控制器',
  'Ovs_SWITCH': 'Ovs交换机',
  'P4_SWITCH': 'P4交换机',
  'SR_SWITCH': 'SR交换机',
  'DRONE': '无人机',
  'VAN': '机动车',
  'SATELLITE': '卫星',
  'DEFAULT': '路由器',
  'BASESTATION': '基站',
  'SWITCH': '交换机',
  'EMANE': '子网',
  'HTTP': 'HTTP',
  'FTP': 'FTP',
  'DNS': 'DNS',
  'SMTP': 'SMTP',
  'VoIP-SIP': 'VoIP-SIP',
  'TLS': 'TLS',
  'RTSP-RTP': '视频服务器',
  'MQTT': 'MQTT',
  'CoAP': 'CoAP',
  'DDS': 'DDS',
  'SSH': 'SSH',
  'PKI': 'PKI模型',
  'BUSINESS_Transmitter': '业务终端',
  'VMNODE': '虚拟机',
  'OTHER': '其他'
};

// 节点英文名称映射表（用于生成name字段）
export const NODE_TYPE_LABELS_EN: { [key: string]: string } = {
  'RJ45': 'RJ45',
  'TMV': 'TMV',
  'ATTACK_MACHINE': 'ATTACK_MACHINE',
  'SECURITY_MACHINE': 'SECURITY_MACHINE',
  'SDN_CONTROLLER': 'SDN_CONTROLLER',
  'Ovs_SWITCH': 'Ovs_SWITCH',
  'P4_SWITCH': 'P4_SWITCH',
  'SR_SWITCH': 'SR_SWITCH',
  'DRONE': 'DRONE',
  'VAN': 'VAN',
  'SATELLITE': 'SATELLITE',
  'DEFAULT': 'ROUTER',
  'BASESTATION': 'BASESTATION',
  'SWITCH': 'SWITCH',
  'EMANE': 'EMANE',
  'HTTP': 'HTTP',
  'FTP': 'FTP',
  'DNS': 'DNS',
  'SMTP': 'SMTP',
  'VoIP-SIP': 'VoIP_SIP',
  'TLS': 'TLS',
  'RTSP-RTP': 'RTSP_RTP',
  'MQTT': 'MQTT',
  'CoAP': 'CoAP',
  'DDS': 'DDS',
  'SSH': 'SSH',
  'PKI': 'PKI',
  'BUSINESS_Transmitter': 'BUSINESS_Transmitter',
  'VMNODE': 'VMNODE',
  'OTHER': 'OTHER'
};

/**
 * 将节点类型代码转换为中文标签
 * @param typeCode 节点类型代码
 * @returns 对应的中文标签，如果没有找到则返回原始代码
 */
export function getNodeTypeLabelCN(typeCode: string): string {
  return NODE_TYPE_LABELS_CN[typeCode] || typeCode;
}

/**
 * 将节点类型代码转换为英文标签
 * @param typeCode 节点类型代码
 * @returns 对应的英文标签，如果没有找到则返回原始代码
 */
export function getNodeTypeLabelEN(typeCode: string): string {
  return NODE_TYPE_LABELS_EN[typeCode] || typeCode;
}

/**
 * 获取所有可用的节点类型
 * @returns 节点类型数组，每个元素包含 code 和 label
 */
export const getAvailableNodeTypes = () => {
  return Object.entries(NODE_TYPE_LABELS_CN).map(([code, label]) => ({
    code,
    label
  }));
}; 