function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

export function mcpTimestamp(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainderMinutes = absoluteOffset % 60;

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`,
    `${offsetSign}${pad(offsetHours)}:${pad(offsetRemainderMinutes)}`,
  ].join(' ');
}

function prefix(message: string): string {
  return `[${mcpTimestamp()}] ${message}`;
}

export function mcpLog(message: string, ...args: unknown[]): void {
  console.log(prefix(message), ...args);
}

export function mcpWarn(message: string, ...args: unknown[]): void {
  console.warn(prefix(message), ...args);
}

export function mcpError(message: string, ...args: unknown[]): void {
  console.error(prefix(message), ...args);
}
