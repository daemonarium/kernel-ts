import type Process from './Process.js'
import { direction, type socket_binding } from './kernelApi.js'

/**
 * Build socket_binding rows for one process from socketConnections.
 * Direction is relative to that process (connectedTo = OUT, connectedFrom = IN).
 */
export function listBindingsForProcess(process: Process): socket_binding[] {
  const rows: socket_binding[] = []

  for (let socket = 0; socket < process.socketConnections.length; socket++) {
    const connection = process.socketConnections[socket]
    if (!connection) {
      continue
    }

    const to = connection.connectedTo
    const from = connection.connectedFrom

    if (to && from
      && to.processId === from.processId
      && to.socketIndex === from.socketIndex) {
      rows.push({
        socket,
        peer_process: to.processId,
        peer_socket: to.socketIndex,
        direction: direction.BOTH,
      })
      continue
    }

    if (to) {
      rows.push({
        socket,
        peer_process: to.processId,
        peer_socket: to.socketIndex,
        direction: direction.OUT,
      })
    }
    if (from) {
      rows.push({
        socket,
        peer_process: from.processId,
        peer_socket: from.socketIndex,
        direction: direction.IN,
      })
    }
  }

  rows.sort((a, b) => {
    if (a.socket !== b.socket) {
      return a.socket - b.socket
    }
    // OUT before IN when two rows share a socket
    return b.direction - a.direction
  })

  return rows
}
