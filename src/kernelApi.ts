// Auto-generated TypeScript RPC Server
import { TypeRegistry, TypeDescription, TypeKind } from '@wa-os/ts-rpc'

// TypeScript type definitions
export interface rpc_request_16 {
  request_id: bigint
  function_id: bigint
}

export interface rpc_response_17 {
  request_id: bigint
  success: boolean
}

export interface rpc_error_18 {
  request_id: bigint
  success: boolean
  error: string
}

export interface read_annotation_19 {}

export interface member_annotation_20 {}

export interface kernel_21 {
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
}

export enum direction_27 {
  NONE = 0,
  IN = 1,
  OUT = 2,
  BOTH = 3
}

export interface process_event_pointer_33 {
  event_pointer: any | null
}

export interface process_killed_event_34 {}

export interface process_event_35 {
  process: number
}

export interface process_error_event_36 {
  error: string
}


export function createGeneratedTypeRegistry(): { registry: TypeRegistry, types: { [key: string]: TypeDescription } } {
  const registry = new TypeRegistry()
  const types: { [key: string]: TypeDescription } = {}

  // Declare types (without members/item/key yet)
  const void_0 = TypeDescription.create({
    name: "void",
    kind: TypeKind.Void,
  })
  types['void_0'] = void_0

  const bool_1 = TypeDescription.create({
    name: "bool",
    kind: TypeKind.Boolean,
  })
  types['bool_1'] = bool_1

  const uint8_2 = TypeDescription.create({
    name: "uint8",
    kind: TypeKind.UnsignedInteger8,
  })
  types['uint8_2'] = uint8_2

  const sint8_3 = TypeDescription.create({
    name: "sint8",
    kind: TypeKind.SignedInteger8,
  })
  types['sint8_3'] = sint8_3

  const uint16_4 = TypeDescription.create({
    name: "uint16",
    kind: TypeKind.UnsignedInteger16,
  })
  types['uint16_4'] = uint16_4

  const sint16_5 = TypeDescription.create({
    name: "sint16",
    kind: TypeKind.SignedInteger16,
  })
  types['sint16_5'] = sint16_5

  const uint32_6 = TypeDescription.create({
    name: "uint32",
    kind: TypeKind.UnsignedInteger32,
  })
  types['uint32_6'] = uint32_6

  const sint32_7 = TypeDescription.create({
    name: "sint32",
    kind: TypeKind.SignedInteger32,
  })
  types['sint32_7'] = sint32_7

  const uint64_8 = TypeDescription.create({
    name: "uint64",
    kind: TypeKind.UnsignedInteger64,
  })
  types['uint64_8'] = uint64_8

  const sint64_9 = TypeDescription.create({
    name: "sint64",
    kind: TypeKind.SignedInteger64,
  })
  types['sint64_9'] = sint64_9

  const float32_10 = TypeDescription.create({
    name: "float32",
    kind: TypeKind.FloatingPoint32,
  })
  types['float32_10'] = float32_10

  const float64_11 = TypeDescription.create({
    name: "float64",
    kind: TypeKind.FloatingPoint64,
  })
  types['float64_11'] = float64_11

  const string_12 = TypeDescription.create({
    name: "string",
    kind: TypeKind.String,
  })
  types['string_12'] = string_12

  const binary_13 = TypeDescription.create({
    name: "binary",
    kind: TypeKind.Binary,
  })
  types['binary_13'] = binary_13

  const pointer_14 = TypeDescription.create({
    name: "pointer",
    kind: TypeKind.Pointer,
  })
  types['pointer_14'] = pointer_14

  const map_15 = TypeDescription.create({
    name: "map",
    kind: TypeKind.Map,
  })
  types['map_15'] = map_15

  const rpc_request_16 = TypeDescription.create({
    name: "rpc_request",
    kind: TypeKind.Message,
  })
  types['rpc_request_16'] = rpc_request_16

  const rpc_response_17 = TypeDescription.create({
    name: "rpc_response",
    kind: TypeKind.Message,
  })
  types['rpc_response_17'] = rpc_response_17

  const rpc_error_18 = TypeDescription.create({
    name: "rpc_error",
    kind: TypeKind.Message,
  })
  types['rpc_error_18'] = rpc_error_18

  const read_annotation_19 = TypeDescription.create({
    name: "read_annotation",
    kind: TypeKind.DynamicObject,
    bases: [],
  })
  types['read_annotation_19'] = read_annotation_19

  const member_annotation_20 = TypeDescription.create({
    name: "member_annotation",
    kind: TypeKind.DynamicObject,
  })
  types['member_annotation_20'] = member_annotation_20

  const kernel_21 = TypeDescription.create({
    name: "kernel",
    kind: TypeKind.Object,
  })
  types['kernel_21'] = kernel_21

  const kernel_spawn_22 = TypeDescription.create({
    name: "kernel.spawn",
    kind: TypeKind.Function,
  })
  types['kernel_spawn_22'] = kernel_spawn_22

  const kernel_resurect_23 = TypeDescription.create({
    name: "kernel.resurect",
    kind: TypeKind.Function,
  })
  types['kernel_resurect_23'] = kernel_resurect_23

  const kernel_save_24 = TypeDescription.create({
    name: "kernel.save",
    kind: TypeKind.Function,
  })
  types['kernel_save_24'] = kernel_save_24

  const kernel_kill_25 = TypeDescription.create({
    name: "kernel.kill",
    kind: TypeKind.Function,
  })
  types['kernel_kill_25'] = kernel_kill_25

  const kernel_bind_26 = TypeDescription.create({
    name: "kernel.bind",
    kind: TypeKind.Function,
  })
  types['kernel_bind_26'] = kernel_bind_26

  const direction_27 = TypeDescription.create({
    name: "direction",
    kind: TypeKind.Enum,
    enumMembers: [],
  })
  types['direction_27'] = direction_27

  const kernel_unbind_28 = TypeDescription.create({
    name: "kernel.unbind",
    kind: TypeKind.Function,
  })
  types['kernel_unbind_28'] = kernel_unbind_28

  const kernel_monitor_29 = TypeDescription.create({
    name: "kernel.monitor",
    kind: TypeKind.Function,
  })
  types['kernel_monitor_29'] = kernel_monitor_29

  const kernel_demonitor_30 = TypeDescription.create({
    name: "kernel.demonitor",
    kind: TypeKind.Function,
  })
  types['kernel_demonitor_30'] = kernel_demonitor_30

  const kernel_measure_mana_31 = TypeDescription.create({
    name: "kernel.measure_mana",
    kind: TypeKind.Function,
  })
  types['kernel_measure_mana_31'] = kernel_measure_mana_31

  const kernel_set_mana_limit_32 = TypeDescription.create({
    name: "kernel.set_mana_limit",
    kind: TypeKind.Function,
  })
  types['kernel_set_mana_limit_32'] = kernel_set_mana_limit_32

  const process_event_pointer_33 = TypeDescription.create({
    name: "process_event_pointer",
    kind: TypeKind.Object,
  })
  types['process_event_pointer_33'] = process_event_pointer_33

  const process_killed_event_34 = TypeDescription.create({
    name: "process_killed_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_killed_event_34'] = process_killed_event_34

  const process_event_35 = TypeDescription.create({
    name: "process_event",
    kind: TypeKind.Object,
  })
  types['process_event_35'] = process_event_35

  const process_error_event_36 = TypeDescription.create({
    name: "process_error_event",
    kind: TypeKind.Message,
    bases: [],
  })
  types['process_error_event_36'] = process_error_event_36

  // Register all types to preserve indices
  registry.registerType(void_0)
  registry.registerType(bool_1)
  registry.registerType(uint8_2)
  registry.registerType(sint8_3)
  registry.registerType(uint16_4)
  registry.registerType(sint16_5)
  registry.registerType(uint32_6)
  registry.registerType(sint32_7)
  registry.registerType(uint64_8)
  registry.registerType(sint64_9)
  registry.registerType(float32_10)
  registry.registerType(float64_11)
  registry.registerType(string_12)
  registry.registerType(binary_13)
  registry.registerType(pointer_14)
  registry.registerType(map_15)
  registry.registerType(rpc_request_16)
  registry.registerType(rpc_response_17)
  registry.registerType(rpc_error_18)
  registry.registerType(read_annotation_19)
  registry.registerType(member_annotation_20)
  registry.registerType(kernel_21)
  registry.registerType(kernel_spawn_22)
  registry.registerType(kernel_resurect_23)
  registry.registerType(kernel_save_24)
  registry.registerType(kernel_kill_25)
  registry.registerType(kernel_bind_26)
  registry.registerType(direction_27)
  registry.registerType(kernel_unbind_28)
  registry.registerType(kernel_monitor_29)
  registry.registerType(kernel_demonitor_30)
  registry.registerType(kernel_measure_mana_31)
  registry.registerType(kernel_set_mana_limit_32)
  registry.registerType(process_event_pointer_33)
  registry.registerType(process_killed_event_34)
  registry.registerType(process_event_35)
  registry.registerType(process_error_event_36)

  // Fill enumMembers, bases, item/key
  read_annotation_19.bases = [
    member_annotation_20,
  ]

  kernel_spawn_22.item = uint32_6

  kernel_resurect_23.item = uint32_6

  kernel_save_24.item = binary_13

  kernel_kill_25.item = void_0

  kernel_bind_26.item = void_0

  direction_27.enumMembers = [
    { name: "NONE", value: 0 },
    { name: "IN", value: 1 },
    { name: "OUT", value: 2 },
    { name: "BOTH", value: 3 },
  ]

  kernel_unbind_28.item = void_0

  kernel_monitor_29.item = void_0

  kernel_demonitor_30.item = void_0

  kernel_measure_mana_31.item = uint32_6

  kernel_set_mana_limit_32.item = void_0

  process_killed_event_34.bases = [
    process_event_35,
  ]

  process_error_event_36.bases = [
    process_event_35,
  ]

  // Fill members (after all types exist)
  rpc_request_16.members = [
    {
      name: "request_id",
      type: uint64_8,
      annotations: [],
    },
    {
      name: "function_id",
      type: uint64_8,
      annotations: [],
    },
  ]

  rpc_response_17.members = [
    {
      name: "request_id",
      type: uint64_8,
      annotations: [],
    },
    {
      name: "success",
      type: bool_1,
      annotations: [],
    },
  ]

  rpc_error_18.members = [
    {
      name: "request_id",
      type: uint64_8,
      annotations: [],
    },
    {
      name: "success",
      type: bool_1,
      annotations: [],
    },
    {
      name: "error",
      type: string_12,
      annotations: [],
    },
  ]

  kernel_21.members = [
    {
      name: "kernel.spawn",
      type: kernel_spawn_22,
      annotations: [],
    },
    {
      name: "kernel.resurect",
      type: kernel_resurect_23,
      annotations: [],
    },
    {
      name: "kernel.save",
      type: kernel_save_24,
      annotations: [],
    },
    {
      name: "kernel.kill",
      type: kernel_kill_25,
      annotations: [],
    },
    {
      name: "kernel.bind",
      type: kernel_bind_26,
      annotations: [],
    },
    {
      name: "kernel.unbind",
      type: kernel_unbind_28,
      annotations: [],
    },
    {
      name: "kernel.monitor",
      type: kernel_monitor_29,
      annotations: [],
    },
    {
      name: "kernel.demonitor",
      type: kernel_demonitor_30,
      annotations: [],
    },
    {
      name: "kernel.measure_mana",
      type: kernel_measure_mana_31,
      annotations: [],
    },
    {
      name: "kernel.set_mana_limit",
      type: kernel_set_mana_limit_32,
      annotations: [],
    },
  ]

  kernel_spawn_22.members = [
    {
      name: "code",
      type: binary_13,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_resurect_23.members = [
    {
      name: "code",
      type: binary_13,
      annotations: [],
    },
    {
      name: "memory",
      type: binary_13,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_save_24.members = [
    {
      name: "id",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_kill_25.members = [
    {
      name: "id",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_bind_26.members = [
    {
      name: "process_from",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "socket_from",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "socket_to",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "direction",
      type: direction_27,
      annotations: [],
    },
  ]

  kernel_unbind_28.members = [
    {
      name: "process_from",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "socket_from",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "socket_to",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "direction",
      type: direction_27,
      annotations: [],
    },
  ]

  kernel_monitor_29.members = [
    {
      name: "target",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "monitor_socket",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_demonitor_30.members = [
    {
      name: "target",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "monitor_socket",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_measure_mana_31.members = [
    {
      name: "process",
      type: uint32_6,
      annotations: [],
    },
    {
      name: "new_mana",
      type: uint32_6,
      annotations: [],
    },
  ]

  kernel_set_mana_limit_32.members = [
    {
      name: "mana_limit",
      type: uint32_6,
      annotations: [],
    },
  ]

  process_event_pointer_33.members = [
    {
      name: "event_pointer",
      type: pointer_14,
      annotations: [],
    },
  ]

  process_event_35.members = [
    {
      name: "process",
      type: uint32_6,
      annotations: [],
    },
  ]

  process_error_event_36.members = [
    {
      name: "error",
      type: string_12,
      annotations: [],
    },
  ]

  return { registry, types }
}

// Empty method implementations
async function kernel_spawn_22_impl(
  code: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_resurect_23_impl(
  code: Uint8Array,
  memory: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_save_24_impl(
  id: number
): Promise<Uint8Array> {
  /// TODO: implement
  return Promise.resolve(null as any as Uint8Array)
}

async function kernel_kill_25_impl(
  id: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_bind_26_impl(
  process_from: number,
  socket_from: number,
  process_to: number,
  socket_to: number,
  direction: direction_27
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_unbind_28_impl(
  process_from: number,
  socket_from: number,
  process_to: number,
  socket_to: number,
  direction: direction_27
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_monitor_29_impl(
  target: number,
  monitor: number,
  monitor_socket: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_demonitor_30_impl(
  target: number,
  monitor: number,
  monitor_socket: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_measure_mana_31_impl(
  process: number,
  new_mana: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_set_mana_limit_32_impl(
  mana_limit: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

export function implementMethods(result: ReturnType<typeof createGeneratedTypeRegistry>): void {
  const { registry, types } = result
  types['kernel_spawn_22'].implementation = kernel_spawn_22_impl
  types['kernel_resurect_23'].implementation = kernel_resurect_23_impl
  types['kernel_save_24'].implementation = kernel_save_24_impl
  types['kernel_kill_25'].implementation = kernel_kill_25_impl
  types['kernel_bind_26'].implementation = kernel_bind_26_impl
  types['kernel_unbind_28'].implementation = kernel_unbind_28_impl
  types['kernel_monitor_29'].implementation = kernel_monitor_29_impl
  types['kernel_demonitor_30'].implementation = kernel_demonitor_30_impl
  types['kernel_measure_mana_31'].implementation = kernel_measure_mana_31_impl
  types['kernel_set_mana_limit_32'].implementation = kernel_set_mana_limit_32_impl
}

export function setupServer(): TypeRegistry {
  const result = createGeneratedTypeRegistry()
  implementMethods(result)
  result.registry.assignMethodIds()
  return result.registry
}

