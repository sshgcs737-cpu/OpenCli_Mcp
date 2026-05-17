import request from '../request';

export function addNode(nodeData: any, sessionId: number | string, userId?: string) {
  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/node/add',
    method: 'post',
    params,
    data: nodeData
  });
}

export function deleteNode(params: { sessionId: number; nodeId: number; userId?: string }, config: any = {}) {
  return request({
    url: '/node/del',
    method: 'post',
    params,
    ...config
  });
}

export function editNode(nodeData: any, sessionId: number | string, userId?: string) {
  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/node/edit',
    method: 'post',
    params,
    data: nodeData
  });
}

// 获取节点的NEM ID
export function getNemIds(sessionId: number | string) {
  return request({
    url: '/node/nemId',
    method: 'get',
    params: { sessionId }
  });
} 

export function getExecDocker(params: { sessionId: number; nodeId: number }, config: any = {}) {
  return request({
    url: '/node/execDocker',
    method: 'get',
    params,
    ...config
  });
}

export function getExecVnode(params: { sessionId: number; nodeName: String }, config: any = {}) {
  return request({
    url: '/node/execVnode',
    method: 'get',
    params,
    ...config
  });
}

export function getVMTemplate() {
  return request({
    url: '/node/getVMTemplate',
    method: 'get'
  });
}

export function addVMNode(vmNodeData: { templateId: number; node: any }, sessionId: number | string, userId?: string) {
  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/node/addVMNode',
    method: 'post',
    params,
    data: vmNodeData
  });
}

export function startVMNode(sessionId: number | string, nodeId: number, userId?: string) {
  const params: any = { sessionId, nodeId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/node/startVMNode',
    method: 'post',
    params
  });
}

export function stopVMNode(sessionId: number | string, nodeId: number, userId?: string) {
  const params: any = { sessionId, nodeId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/node/stopVMNode',
    method: 'post',
    params
  });
}

export function editVMNode(vmEditData: {
  sessionId: number | string;
  userId?: number | string;
  nodeId: number;
  templateId: number;
  cpu: number;
  currentMemory: string;
  memory: string;
}) {
  return request({
    url: '/node/editVMNode',
    method: 'post',
    data: vmEditData
  });
}




