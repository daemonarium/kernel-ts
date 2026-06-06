export interface BufferStateEntry {
  buffer_size: number
  read_offset: number
  write_offset: number
}

export class ProcessRuntimeState {
  bufferStateCache = new Map<string, BufferStateEntry>()
  nextSnapshotUid = 1n
  pumpPausedDepth = 0

  pendingData = new Set<number>()
  pendingDrain = new Set<number>()
  tickScheduled = false
  inFlight = false

  isPumpPaused(): boolean {
    return this.pumpPausedDepth > 0
  }

  pausePump(): void {
    this.pumpPausedDepth++
  }

  resumePump(): void {
    if (this.pumpPausedDepth > 0) {
      this.pumpPausedDepth--
    }
  }

  bufferStateKey(socket: number, direction: number): string {
    return `${socket}:${direction}`
  }
}
