import { parseOpenCli } from './parser';
import { executeRemoteTopoCommand } from './remoteTopoActions';
import type { OpenCliResult } from './types';

function getCommandErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (typeof data === 'string') return data;

  return (
    data?.msg ||
    data?.message ||
    data?.error ||
    error?.msg ||
    error?.message ||
    '命令执行失败'
  );
}

export async function executeOpenCli(input: string): Promise<OpenCliResult> {
  try {
    const command = parseOpenCli(input);
    return await executeRemoteTopoCommand(command);
  } catch (error: any) {
    console.error('[OpenCLI] 命令执行失败：', error);

    return {
      ok: false,
      message: getCommandErrorMessage(error),
      data: error?.response?.data,
    };
  }
}
