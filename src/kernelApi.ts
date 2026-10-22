// Auto-generated TypeScript RPC Server
import { TypeRegistry, TypeDescription, TypeKind } from '@daemonarium/rpc'

// TypeScript type definitions
// type index: 16
export interface rpc_request {
  request_id: bigint
  function_id: bigint
}

// type index: 17
export interface rpc_response {
  request_id: bigint
}

// type index: 18
export interface rpc_error {
  request_id: bigint
}

// type index: 20
export interface read_annotation {}

// type index: 21
export interface member_annotation {}

// type index: 22
export interface kernel {
  "kernel.spawn": any
  "kernel.resurect": any
  "kernel.save": any
  "kernel.kill": any
  "kernel.bind": any
  "kernel.unbind": any
  "kernel.monitor": any
  "kernel.demonitor": any
  "kernel.measure_mana": any
  "kernel.set_mana_limit": any
  "kernel.list_socket_bindings": any
  "kernel.get_rpc_description": any
}

// type index: 26
export interface save_result {
  snapshot_uid: bigint
  memory: Uint8Array
  mana_used: number
  mana_limit: number
}

// type index: 29
export enum direction {
  NONE = 0,
  IN = 1,
  OUT = 2,
  BOTH = 3
}

// type index: 32
export interface monitor_config {
  flags: number
}

// type index: 36
export enum monitor_flag {
  NONE = 0,
  KILLED = 1,
  ERROR = 2,
  COPY = 4,
  COPY_PAYLOAD = 8,
  DATA = 16,
  DRAIN = 32,
  SAVE = 64,
  MEMORY = 128,
  INITIAL_BUFFER_STATE = 256,
  INITIAL_BUFFER_DATA = 512,
  BUFFER_STATE = 1024,
  BUFFER_DATA = 2048,
  MANA = 4096,
  BIND = 8192
}

// type index: 37
export interface process_killed_event {}

// type index: 38
export interface process_event {
  process: number
}

// type index: 39
export interface process_error_event {
  error: string
}

// type index: 40
export interface process_copy_event {
  socket: number
  direction: direction
  amount: number
}

// type index: 41
export interface process_data_event {
  socket: number
  direction: direction
}

// type index: 42
export interface process_drain_event {
  socket: number
  direction: direction
}

// type index: 43
export interface process_save_event {
  snapshot_uid: bigint
}

// type index: 44
export interface process_memory_event {
  size: number
}

// type index: 45
export interface process_socket_state_event {
  socket: number
  direction: direction
  buffer_size: number
  read_offset: number
  write_offset: number
}

// type index: 46
export interface process_measure_mana_event {
  new_mana: number
}

// type index: 47
export interface process_set_mana_limit_event {
  mana_limit: number
}

// type index: 48
export interface process_bind_event {
  socket: number
  peer_process: number
  peer_socket: number
  direction: direction
}

// type index: 49
export interface process_unbind_event {
  socket: number
  peer_process: number
  peer_socket: number
  direction: direction
}

export interface socket_binding {
  socket: number
  peer_process: number
  peer_socket: number
  direction: direction
}


export function createGeneratedTypeRegistry(): { registry: TypeRegistry, types: { [key: string]: TypeDescription } } {
  const registry = new TypeRegistry()
  const types: { [key: string]: TypeDescription } = {}

  // Declare types (without members/item/key yet)
  // type index: 0
  const void_ = TypeDescription.create({
    name: "void",
    kind: TypeKind.Void,
  })
  types['void_'] = void_

  // type index: 1
  const bool = TypeDescription.create({
    name: "bool",
    kind: TypeKind.Boolean,
  })
  types['bool'] = bool

  // type index: 2
  const uint8 = TypeDescription.create({
    name: "uint8",
    kind: TypeKind.UnsignedInteger8,
  })
  types['uint8'] = uint8

  // type index: 3
  const sint8 = TypeDescription.create({
    name: "sint8",
    kind: TypeKind.SignedInteger8,
  })
  types['sint8'] = sint8

  // type index: 4
  const uint16 = TypeDescription.create({
    name: "uint16",
    kind: TypeKind.UnsignedInteger16,
  })
  types['uint16'] = uint16

  // type index: 5
  const sint16 = TypeDescription.create({
    name: "sint16",
    kind: TypeKind.SignedInteger16,
  })
  types['sint16'] = sint16

  // type index: 6
  const uint32 = TypeDescription.create({
    name: "uint32",
    kind: TypeKind.UnsignedInteger32,
  })
  types['uint32'] = uint32

  // type index: 7
  const sint32 = TypeDescription.create({
    name: "sint32",
    kind: TypeKind.SignedInteger32,
  })
  types['sint32'] = sint32

  // type index: 8
  const uint64 = TypeDescription.create({
    name: "uint64",
    kind: TypeKind.UnsignedInteger64,
  })
  types['uint64'] = uint64

  // type index: 9
  const sint64 = TypeDescription.create({
    name: "sint64",
    kind: TypeKind.SignedInteger64,
  })
  types['sint64'] = sint64

  // type index: 10
  const float32 = TypeDescription.create({
    name: "float32",
    kind: TypeKind.FloatingPoint32,
  })
  types['float32'] = float32

  // type index: 11
  const float64 = TypeDescription.create({
    name: "float64",
    kind: TypeKind.FloatingPoint64,
  })
  types['float64'] = float64

  // type index: 12
  const string_ = TypeDescription.create({
    name: "string",
    kind: TypeKind.String,
  })
  types['string_'] = string_

  // type index: 13
  const binary = TypeDescription.create({
    name: "binary",
    kind: TypeKind.Binary,
  })
  types['binary'] = binary

  // type index: 14
  const pointer = TypeDescription.create({
    name: "pointer",
    kind: TypeKind.Pointer,
  })
  types['pointer'] = pointer

  // type index: 15
  const map = TypeDescription.create({
    name: "map",
    kind: TypeKind.Map,
  })
  types['map'] = map

  // type index: 16
  const rpc_request = TypeDescription.create({
    name: "rpc_request",
    kind: TypeKind.Message,
  })
  types['rpc_request'] = rpc_request

  // type index: 17
  const rpc_response = TypeDescription.create({
    name: "rpc_response",
    kind: TypeKind.Message,
  })
  types['rpc_response'] = rpc_response

  // type index: 18
  const rpc_error = TypeDescription.create({
    name: "rpc_error",
    kind: TypeKind.Message,
  })
  types['rpc_error'] = rpc_error

  // type index: 19
  const unknown_exception = TypeDescription.create({
    name: "unknown_exception",
    kind: TypeKind.Exception,
  })
  types['unknown_exception'] = unknown_exception

  // type index: 20
  const read_annotation = TypeDescription.create({
    name: "read_annotation",
    kind: TypeKind.DynamicObject,
    bases: [],
  })
  types['read_annotation'] = read_annotation

  // type index: 21
  const member_annotation = TypeDescription.create({
    name: "member_annotation",
    kind: TypeKind.DynamicObject,
  })
  types['member_annotation'] = member_annotation

  // type index: 22
  const kernel = TypeDescription.create({
    name: "kernel",
    kind: TypeKind.Object,
  })
  types['kernel'] = kernel

  // type index: 23
  const kernel_spawn = TypeDescription.create({
    name: "kernel.spawn",
    kind: TypeKind.Function,
  })
  types['kernel_spawn'] = kernel_spawn

  // type index: 24
  const kernel_resurect = TypeDescription.create({
    name: "kernel.resurect",
    kind: TypeKind.Function,
  })
  types['kernel_resurect'] = kernel_resurect

  // type index: 25
  const kernel_save = TypeDescription.create({
    name: "kernel.save",
    kind: TypeKind.Function,
  })
  types['kernel_save'] = kernel_save

  // type index: 26
  const save_result = TypeDescription.create({
    name: "save_result",
    kind: TypeKind.Object,
  })
  types['save_result'] = save_result

  // type index: 27
  const kernel_kill = TypeDescription.create({
    name: "kernel.kill",
    kind: TypeKind.Function,
  })
  types['kernel_kill'] = kernel_kill

  // type index: 28
  const kernel_bind = TypeDescription.create({
    name: "kernel.bind",
    kind: TypeKind.Function,
  })
  types['kernel_bind'] = kernel_bind

  // type index: 29
  const direction = TypeDescription.create({
    name: "direction",
    kind: TypeKind.Enum,
    enumMembers: [],
  })
  types['direction'] = direction

  // type index: 30
  const kernel_unbind = TypeDescription.create({
    name: "kernel.unbind",
    kind: TypeKind.Function,
  })
  types['kernel_unbind'] = kernel_unbind

  // type index: 31
  const kernel_monitor = TypeDescription.create({
    name: "kernel.monitor",
    kind: TypeKind.Function,
  })
  types['kernel_monitor'] = kernel_monitor

  // type index: 32
  const monitor_config = TypeDescription.create({
    name: "monitor_config",
    kind: TypeKind.Object,
  })
  types['monitor_config'] = monitor_config

  // type index: 33
  const kernel_demonitor = TypeDescription.create({
    name: "kernel.demonitor",
    kind: TypeKind.Function,
  })
  types['kernel_demonitor'] = kernel_demonitor

  // type index: 34
  const kernel_measure_mana = TypeDescription.create({
    name: "kernel.measure_mana",
    kind: TypeKind.Function,
  })
  types['kernel_measure_mana'] = kernel_measure_mana

  // type index: 35
  const kernel_set_mana_limit = TypeDescription.create({
    name: "kernel.set_mana_limit",
    kind: TypeKind.Function,
  })
  types['kernel_set_mana_limit'] = kernel_set_mana_limit

  const kernel_list_socket_bindings = TypeDescription.create({
    name: "kernel.list_socket_bindings",
    kind: TypeKind.Function,
  })
  types['kernel_list_socket_bindings'] = kernel_list_socket_bindings

  const vector_socket_binding_allocator_socket_binding = TypeDescription.create({
    name: "vector<socket_binding, allocator<socket_binding>>",
    kind: TypeKind.Array,
  })
  types['vector_socket_binding_allocator_socket_binding'] = vector_socket_binding_allocator_socket_binding

  const socket_binding = TypeDescription.create({
    name: "socket_binding",
    kind: TypeKind.Object,
  })
  types['socket_binding'] = socket_binding

  const kernel_get_rpc_description = TypeDescription.create({
    name: "kernel.get_rpc_description",
    kind: TypeKind.Function,
  })
  types['kernel_get_rpc_description'] = kernel_get_rpc_description

  // type index: 36
  const monitor_flag = TypeDescription.create({
    name: "monitor_flag",
    kind: TypeKind.Enum,
    enumMembers: [],
  })
  types['monitor_flag'] = monitor_flag

  // type index: 37
  const process_killed_event = TypeDescription.create({
    name: "process_killed_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_killed_event'] = process_killed_event

  // type index: 38
  const process_event = TypeDescription.create({
    name: "process_event",
    kind: TypeKind.Object,
  })
  types['process_event'] = process_event

  // type index: 39
  const process_error_event = TypeDescription.create({
    name: "process_error_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_error_event'] = process_error_event

  // type index: 40
  const process_copy_event = TypeDescription.create({
    name: "process_copy_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_copy_event'] = process_copy_event

  // type index: 41
  const process_data_event = TypeDescription.create({
    name: "process_data_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_data_event'] = process_data_event

  // type index: 42
  const process_drain_event = TypeDescription.create({
    name: "process_drain_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_drain_event'] = process_drain_event

  // type index: 43
  const process_save_event = TypeDescription.create({
    name: "process_save_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_save_event'] = process_save_event

  // type index: 44
  const process_memory_event = TypeDescription.create({
    name: "process_memory_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_memory_event'] = process_memory_event

  // type index: 45
  const process_socket_state_event = TypeDescription.create({
    name: "process_socket_state_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_socket_state_event'] = process_socket_state_event

  // type index: 46
  const process_measure_mana_event = TypeDescription.create({
    name: "process_measure_mana_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_measure_mana_event'] = process_measure_mana_event

  // type index: 47
  const process_set_mana_limit_event = TypeDescription.create({
    name: "process_set_mana_limit_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_set_mana_limit_event'] = process_set_mana_limit_event

  // type index: 48
  const process_bind_event = TypeDescription.create({
    name: "process_bind_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_bind_event'] = process_bind_event

  // type index: 49
  const process_unbind_event = TypeDescription.create({
    name: "process_unbind_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_unbind_event'] = process_unbind_event

  // Register all types to preserve indices
  registry.registerType(void_)
  registry.registerType(bool)
  registry.registerType(uint8)
  registry.registerType(sint8)
  registry.registerType(uint16)
  registry.registerType(sint16)
  registry.registerType(uint32)
  registry.registerType(sint32)
  registry.registerType(uint64)
  registry.registerType(sint64)
  registry.registerType(float32)
  registry.registerType(float64)
  registry.registerType(string_)
  registry.registerType(binary)
  registry.registerType(pointer)
  registry.registerType(map)
  registry.registerType(rpc_request)
  registry.registerType(rpc_response)
  registry.registerType(rpc_error)
  registry.registerType(unknown_exception)
  registry.registerType(read_annotation)
  registry.registerType(member_annotation)
  registry.registerType(kernel)
  registry.registerType(kernel_spawn)
  registry.registerType(kernel_resurect)
  registry.registerType(kernel_save)
  registry.registerType(save_result)
  registry.registerType(kernel_kill)
  registry.registerType(kernel_bind)
  registry.registerType(direction)
  registry.registerType(kernel_unbind)
  registry.registerType(kernel_monitor)
  registry.registerType(monitor_config)
  registry.registerType(kernel_demonitor)
  registry.registerType(kernel_measure_mana)
  registry.registerType(kernel_set_mana_limit)
  registry.registerType(kernel_list_socket_bindings)
  registry.registerType(vector_socket_binding_allocator_socket_binding)
  registry.registerType(socket_binding)
  registry.registerType(kernel_get_rpc_description)
  registry.registerType(monitor_flag)
  registry.registerType(process_killed_event)
  registry.registerType(process_event)
  registry.registerType(process_error_event)
  registry.registerType(process_copy_event)
  registry.registerType(process_data_event)
  registry.registerType(process_drain_event)
  registry.registerType(process_save_event)
  registry.registerType(process_memory_event)
  registry.registerType(process_socket_state_event)
  registry.registerType(process_measure_mana_event)
  registry.registerType(process_set_mana_limit_event)
  registry.registerType(process_bind_event)
  registry.registerType(process_unbind_event)

  // Fill enumMembers, bases, item/key
  read_annotation.bases = [
    member_annotation,
  ]

  kernel_spawn.item = uint32

  kernel_resurect.item = uint32

  kernel_save.item = save_result

  kernel_kill.item = void_

  kernel_bind.item = void_

  direction.enumMembers = [
    { name: "NONE", value: 0 },
    { name: "IN", value: 1 },
    { name: "OUT", value: 2 },
    { name: "BOTH", value: 3 },
  ]

  kernel_unbind.item = void_

  kernel_monitor.item = void_

  kernel_demonitor.item = void_

  kernel_measure_mana.item = uint32

  kernel_set_mana_limit.item = void_

  kernel_list_socket_bindings.item = vector_socket_binding_allocator_socket_binding

  vector_socket_binding_allocator_socket_binding.item = socket_binding

  kernel_get_rpc_description.item = binary

  monitor_flag.enumMembers = [
    { name: "NONE", value: 0 },
    { name: "KILLED", value: 1 },
    { name: "ERROR", value: 2 },
    { name: "COPY", value: 4 },
    { name: "COPY_PAYLOAD", value: 8 },
    { name: "DATA", value: 16 },
    { name: "DRAIN", value: 32 },
    { name: "SAVE", value: 64 },
    { name: "MEMORY", value: 128 },
    { name: "INITIAL_BUFFER_STATE", value: 256 },
    { name: "INITIAL_BUFFER_DATA", value: 512 },
    { name: "BUFFER_STATE", value: 1024 },
    { name: "BUFFER_DATA", value: 2048 },
    { name: "MANA", value: 4096 },
    { name: "BIND", value: 8192 },
  ]

  process_killed_event.bases = [
    process_event,
  ]

  process_error_event.bases = [
    process_event,
  ]

  process_copy_event.bases = [
    process_event,
  ]

  process_data_event.bases = [
    process_event,
  ]

  process_drain_event.bases = [
    process_event,
  ]

  process_save_event.bases = [
    process_event,
  ]

  process_memory_event.bases = [
    process_event,
  ]

  process_socket_state_event.bases = [
    process_event,
  ]

  process_measure_mana_event.bases = [
    process_event,
  ]

  process_set_mana_limit_event.bases = [
    process_event,
  ]

  process_bind_event.bases = [
    process_event,
  ]

  process_unbind_event.bases = [
    process_event,
  ]

  // Fill members (after all types exist)
  rpc_request.members = [
    {
      name: "request_id",
      type: uint64,
      annotations: [],
    },
    {
      name: "function_id",
      type: uint64,
      annotations: [],
    },
  ]

  rpc_response.members = [
    {
      name: "request_id",
      type: uint64,
      annotations: [],
    },
  ]

  rpc_error.members = [
    {
      name: "request_id",
      type: uint64,
      annotations: [],
    },
  ]

  unknown_exception.members = [
    {
      name: "what",
      type: string_,
      annotations: [],
    },
  ]

  kernel.members = [
    {
      name: "kernel.spawn",
      type: kernel_spawn,
      annotations: [],
    },
    {
      name: "kernel.resurect",
      type: kernel_resurect,
      annotations: [],
    },
    {
      name: "kernel.save",
      type: kernel_save,
      annotations: [],
    },
    {
      name: "kernel.kill",
      type: kernel_kill,
      annotations: [],
    },
    {
      name: "kernel.bind",
      type: kernel_bind,
      annotations: [],
    },
    {
      name: "kernel.unbind",
      type: kernel_unbind,
      annotations: [],
    },
    {
      name: "kernel.monitor",
      type: kernel_monitor,
      annotations: [],
    },
    {
      name: "kernel.demonitor",
      type: kernel_demonitor,
      annotations: [],
    },
    {
      name: "kernel.measure_mana",
      type: kernel_measure_mana,
      annotations: [],
    },
    {
      name: "kernel.set_mana_limit",
      type: kernel_set_mana_limit,
      annotations: [],
    },
    {
      name: "kernel.list_socket_bindings",
      type: kernel_list_socket_bindings,
      annotations: [],
    },
    {
      name: "kernel.get_rpc_description",
      type: kernel_get_rpc_description,
      annotations: [],
    },
  ]

  kernel_spawn.members = [
    {
      name: "code",
      type: binary,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint32,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_resurect.members = [
    {
      name: "code",
      type: binary,
      annotations: [],
    },
    {
      name: "memory",
      type: binary,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint32,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_save.members = [
    {
      name: "id",
      type: uint32,
      annotations: [],
    },
  ]

  save_result.members = [
    {
      name: "snapshot_uid",
      type: uint64,
      annotations: [],
    },
    {
      name: "memory",
      type: binary,
      annotations: [],
    },
    {
      name: "mana_used",
      type: uint32,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_kill.members = [
    {
      name: "id",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_bind.members = [
    {
      name: "process_from",
      type: uint32,
      annotations: [],
    },
    {
      name: "socket_from",
      type: uint32,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint32,
      annotations: [],
    },
    {
      name: "socket_to",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  kernel_unbind.members = [
    {
      name: "process_from",
      type: uint32,
      annotations: [],
    },
    {
      name: "socket_from",
      type: uint32,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint32,
      annotations: [],
    },
    {
      name: "socket_to",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  kernel_monitor.members = [
    {
      name: "target",
      type: uint32,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint32,
      annotations: [],
    },
    {
      name: "monitor_socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "config",
      type: monitor_config,
      annotations: [],
    },
  ]

  monitor_config.members = [
    {
      name: "flags",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_demonitor.members = [
    {
      name: "target",
      type: uint32,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint32,
      annotations: [],
    },
    {
      name: "monitor_socket",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_measure_mana.members = [
    {
      name: "process",
      type: uint32,
      annotations: [],
    },
    {
      name: "new_mana",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_set_mana_limit.members = [
    {
      name: "process",
      type: uint32,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32,
      annotations: [],
    },
  ]

  kernel_list_socket_bindings.members = [
    {
      name: "process",
      type: uint32,
      annotations: [],
    },
  ]

  socket_binding.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_process",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  kernel_get_rpc_description.members = [
    {
      name: "process",
      type: uint32,
      annotations: [],
    },
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
  ]

  process_event.members = [
    {
      name: "process",
      type: uint32,
      annotations: [],
    },
  ]

  process_error_event.members = [
    {
      name: "error",
      type: string_,
      annotations: [],
    },
  ]

  process_copy_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
    {
      name: "amount",
      type: uint32,
      annotations: [],
    },
  ]

  process_data_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  process_drain_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  process_save_event.members = [
    {
      name: "snapshot_uid",
      type: uint64,
      annotations: [],
    },
  ]

  process_memory_event.members = [
    {
      name: "size",
      type: uint32,
      annotations: [],
    },
  ]

  process_socket_state_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
    {
      name: "buffer_size",
      type: uint32,
      annotations: [],
    },
    {
      name: "read_offset",
      type: uint32,
      annotations: [],
    },
    {
      name: "write_offset",
      type: uint32,
      annotations: [],
    },
  ]

  process_measure_mana_event.members = [
    {
      name: "new_mana",
      type: uint32,
      annotations: [],
    },
  ]

  process_set_mana_limit_event.members = [
    {
      name: "mana_limit",
      type: uint32,
      annotations: [],
    },
  ]

  process_bind_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_process",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  process_unbind_event.members = [
    {
      name: "socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_process",
      type: uint32,
      annotations: [],
    },
    {
      name: "peer_socket",
      type: uint32,
      annotations: [],
    },
    {
      name: "direction",
      type: direction,
      annotations: [],
    },
  ]

  return { registry, types }
}

// Empty method implementations
async function kernel_spawn_impl(
  code: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_resurect_impl(
  code: Uint8Array,
  memory: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_save_impl(
  id: number
): Promise<save_result> {
  /// TODO: implement
  return Promise.resolve(null as any as save_result)
}

async function kernel_kill_impl(
  id: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_bind_impl(
  process_from: number,
  socket_from: number,
  process_to: number,
  socket_to: number,
  direction: direction
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_unbind_impl(
  process_from: number,
  socket_from: number,
  process_to: number,
  socket_to: number,
  direction: direction
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_monitor_impl(
  target: number,
  monitor: number,
  monitor_socket: number,
  config: monitor_config
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_demonitor_impl(
  target: number,
  monitor: number,
  monitor_socket: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_measure_mana_impl(
  process: number,
  new_mana: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_set_mana_limit_impl(
  process: number,
  mana_limit: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_list_socket_bindings_impl(
  process: number
): Promise<socket_binding[]> {
  /// TODO: implement
  return Promise.resolve([])
}

async function kernel_get_rpc_description_impl(
  process: number,
  socket: number
): Promise<Uint8Array> {
  /// TODO: implement
  return Promise.resolve(new Uint8Array(0))
}

export function implementMethods(result: ReturnType<typeof createGeneratedTypeRegistry>): void {
  const { registry, types } = result
  types['kernel_spawn'].implementation = kernel_spawn_impl
  types['kernel_resurect'].implementation = kernel_resurect_impl
  types['kernel_save'].implementation = kernel_save_impl
  types['kernel_kill'].implementation = kernel_kill_impl
  types['kernel_bind'].implementation = kernel_bind_impl
  types['kernel_unbind'].implementation = kernel_unbind_impl
  types['kernel_monitor'].implementation = kernel_monitor_impl
  types['kernel_demonitor'].implementation = kernel_demonitor_impl
  types['kernel_measure_mana'].implementation = kernel_measure_mana_impl
  types['kernel_set_mana_limit'].implementation = kernel_set_mana_limit_impl
  types['kernel_list_socket_bindings'].implementation = kernel_list_socket_bindings_impl
  types['kernel_get_rpc_description'].implementation = kernel_get_rpc_description_impl
}

export function setupServer(): TypeRegistry {
  const result = createGeneratedTypeRegistry()
  implementMethods(result)
  result.registry.assignMethodIds()
  return result.registry
}

