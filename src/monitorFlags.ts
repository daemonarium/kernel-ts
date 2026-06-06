import { monitor_flag } from './kernelApi.js'

export { monitor_flag }

export interface MonitorConfig {
  flags: number
}

export function hasMonitorFlag(flags: number, flag: monitor_flag): boolean {
  return (flags & flag) !== 0
}

export const DEFAULT_MONITOR_FLAGS =
  monitor_flag.KILLED | monitor_flag.ERROR
