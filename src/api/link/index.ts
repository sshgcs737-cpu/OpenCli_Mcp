import request from '../request';

import type { Link } from '../../types/topo';

// 添加链路
export function addLink(linkData: Partial<Link>, sessionId: number | string, userId?: string) {
  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/link/add',
    method: 'post',
    params,
    data: linkData
  });
}

// 删除链路
export function deleteLink(linkData: Partial<Link>, sessionId: number | string, userId?: string) {
  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/link/del',
    method: 'post',
    params,
    data: linkData
  });
}

export function modifyLink(linkData: Partial<Link>, sessionId: number | string, userId?: string) {
  const requestData = { ...linkData };
  if (requestData.label && typeof requestData.label === 'object') {
    // 使用类型断言处理TypeScript类型检查
    (requestData as any).label = JSON.stringify(requestData.label);
  }

  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/link/modify',
    method: 'post',
    params,
    data: requestData
  });
}

export function signalStart(linkData: Partial<Link>, sessionId: number | string, userId?: string) {
  const requestData = { ...linkData };
  if (requestData.label && typeof requestData.label === 'object') {
    // 使用类型断言处理TypeScript类型检查
    (requestData as any).label = JSON.stringify(requestData.label);
  }

  const params: any = { sessionId };
  if (userId) {
    params.userId = userId;
  }

  return request({
    url: '/link/signalStart',
    method: 'post',
    params,
    data: requestData
  });
}
