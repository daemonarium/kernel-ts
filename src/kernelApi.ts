// Auto-generated TypeScript RPC Server
import { TypeRegistry, TypeDescription, TypeKind } from '@wa-os/ts-rpc'

// TypeScript type definitions
export interface kernel_9 {
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

export enum direction_15 {
  NONE = 0,
  IN = 1,
  OUT = 2,
  BOTH = 3
}

export interface process_event_pointer_21 {
  event_pointer: any | null
}

export interface process_killed_event_22 {}

export interface process_event_23 {
  process: number
}

export interface process_error_event_24 {
  error: string
}

export interface read_annotation_25 {}

export interface member_annotation_26 {}


export function createGeneratedTypeRegistry(): { registry: TypeRegistry, types: { [key: string]: TypeDescription } } {
  const registry = new TypeRegistry()
  const types: { [key: string]: TypeDescription } = {}

  // Declare types (without members/item/key yet)
  const void_0 = TypeDescription.create({
    name: "void",
    kind: TypeKind.Void,
  })
  types['void_0'] = void_0

  const uint_1 = TypeDescription.create({
    name: "uint",
    kind: TypeKind.UnsignedInteger,
  })
  types['uint_1'] = uint_1

  const sint_2 = TypeDescription.create({
    name: "sint",
    kind: TypeKind.SignedInteger,
  })
  types['sint_2'] = sint_2

  const float_3 = TypeDescription.create({
    name: "float",
    kind: TypeKind.FloatingPoint,
  })
  types['float_3'] = float_3

  const bool_4 = TypeDescription.create({
    name: "bool",
    kind: TypeKind.Boolean,
  })
  types['bool_4'] = bool_4

  const string_5 = TypeDescription.create({
    name: "string",
    kind: TypeKind.String,
  })
  types['string_5'] = string_5

  const binary_6 = TypeDescription.create({
    name: "binary",
    kind: TypeKind.Binary,
  })
  types['binary_6'] = binary_6

  const pointer_7 = TypeDescription.create({
    name: "pointer",
    kind: TypeKind.Pointer,
  })
  types['pointer_7'] = pointer_7

  const map_8 = TypeDescription.create({
    name: "map",
    kind: TypeKind.Map,
  })
  types['map_8'] = map_8

  const kernel_9 = TypeDescription.create({
    name: "kernel",
    kind: TypeKind.Object,
  })
  types['kernel_9'] = kernel_9

  const kernel_spawn_10 = TypeDescription.create({
    name: "kernel.spawn",
    kind: TypeKind.Function,
  })
  types['kernel_spawn_10'] = kernel_spawn_10

  const kernel_resurect_11 = TypeDescription.create({
    name: "kernel.resurect",
    kind: TypeKind.Function,
  })
  types['kernel_resurect_11'] = kernel_resurect_11

  const kernel_save_12 = TypeDescription.create({
    name: "kernel.save",
    kind: TypeKind.Function,
  })
  types['kernel_save_12'] = kernel_save_12

  const kernel_kill_13 = TypeDescription.create({
    name: "kernel.kill",
    kind: TypeKind.Function,
  })
  types['kernel_kill_13'] = kernel_kill_13

  const kernel_bind_14 = TypeDescription.create({
    name: "kernel.bind",
    kind: TypeKind.Function,
  })
  types['kernel_bind_14'] = kernel_bind_14

  const direction_15 = TypeDescription.create({
    name: "direction",
    kind: TypeKind.Enum,
    enumMembers: [],
  })
  types['direction_15'] = direction_15

  const kernel_unbind_16 = TypeDescription.create({
    name: "kernel.unbind",
    kind: TypeKind.Function,
  })
  types['kernel_unbind_16'] = kernel_unbind_16

  const kernel_monitor_17 = TypeDescription.create({
    name: "kernel.monitor",
    kind: TypeKind.Function,
  })
  types['kernel_monitor_17'] = kernel_monitor_17

  const kernel_demonitor_18 = TypeDescription.create({
    name: "kernel.demonitor",
    kind: TypeKind.Function,
  })
  types['kernel_demonitor_18'] = kernel_demonitor_18

  const kernel_measure_mana_19 = TypeDescription.create({
    name: "kernel.measure_mana",
    kind: TypeKind.Function,
  })
  types['kernel_measure_mana_19'] = kernel_measure_mana_19

  const kernel_set_mana_limit_20 = TypeDescription.create({
    name: "kernel.set_mana_limit",
    kind: TypeKind.Function,
  })
  types['kernel_set_mana_limit_20'] = kernel_set_mana_limit_20

  const process_event_pointer_21 = TypeDescription.create({
    name: "process_event_pointer",
    kind: TypeKind.Object,
  })
  types['process_event_pointer_21'] = process_event_pointer_21

  const process_killed_event_22 = TypeDescription.create({
    name: "process_killed_event",
    kind: TypeKind.DynamicObject,
    bases: [],
  })
  types['process_killed_event_22'] = process_killed_event_22

  const process_event_23 = TypeDescription.create({
    name: "process_event",
    kind: TypeKind.Object,
  })
  types['process_event_23'] = process_event_23

  const process_error_event_24 = TypeDescription.create({
    name: "process_error_event",
    kind: TypeKind.DynamicObject,
    bases: [],
  })
  types['process_error_event_24'] = process_error_event_24

  const read_annotation_25 = TypeDescription.create({
    name: "read_annotation",
    kind: TypeKind.DynamicObject,
    bases: [],
  })
  types['read_annotation_25'] = read_annotation_25

  const member_annotation_26 = TypeDescription.create({
    name: "member_annotation",
    kind: TypeKind.DynamicObject,
  })
  types['member_annotation_26'] = member_annotation_26

  // Register all types to preserve indices
  registry.registerType(void_0)
  registry.registerType(uint_1)
  registry.registerType(sint_2)
  registry.registerType(float_3)
  registry.registerType(bool_4)
  registry.registerType(string_5)
  registry.registerType(binary_6)
  registry.registerType(pointer_7)
  registry.registerType(map_8)
  registry.registerType(kernel_9)
  registry.registerType(kernel_spawn_10)
  registry.registerType(kernel_resurect_11)
  registry.registerType(kernel_save_12)
  registry.registerType(kernel_kill_13)
  registry.registerType(kernel_bind_14)
  registry.registerType(direction_15)
  registry.registerType(kernel_unbind_16)
  registry.registerType(kernel_monitor_17)
  registry.registerType(kernel_demonitor_18)
  registry.registerType(kernel_measure_mana_19)
  registry.registerType(kernel_set_mana_limit_20)
  registry.registerType(process_event_pointer_21)
  registry.registerType(process_killed_event_22)
  registry.registerType(process_event_23)
  registry.registerType(process_error_event_24)
  registry.registerType(read_annotation_25)
  registry.registerType(member_annotation_26)

  // Fill enumMembers, bases, item/key
  kernel_spawn_10.item = uint_1

  kernel_resurect_11.item = uint_1

  kernel_save_12.item = binary_6

  kernel_kill_13.item = void_0

  kernel_bind_14.item = void_0

  direction_15.enumMembers = [
    { name: "NONE", value: 0 },
    { name: "IN", value: 1 },
    { name: "OUT", value: 2 },
    { name: "BOTH", value: 3 },
  ]

  kernel_unbind_16.item = void_0

  kernel_monitor_17.item = void_0

  kernel_demonitor_18.item = void_0

  kernel_measure_mana_19.item = uint_1

  kernel_set_mana_limit_20.item = void_0

  process_killed_event_22.bases = [
    process_event_23,
  ]

  process_error_event_24.bases = [
    process_event_23,
  ]

  read_annotation_25.bases = [
    member_annotation_26,
  ]

  // Fill members (after all types exist)
  kernel_9.members = [
    {
      name: "kernel.spawn",
      type: kernel_spawn_10,
      annotations: [],
    },
    {
      name: "kernel.resurect",
      type: kernel_resurect_11,
      annotations: [],
    },
    {
      name: "kernel.save",
      type: kernel_save_12,
      annotations: [],
    },
    {
      name: "kernel.kill",
      type: kernel_kill_13,
      annotations: [],
    },
    {
      name: "kernel.bind",
      type: kernel_bind_14,
      annotations: [],
    },
    {
      name: "kernel.unbind",
      type: kernel_unbind_16,
      annotations: [],
    },
    {
      name: "kernel.monitor",
      type: kernel_monitor_17,
      annotations: [],
    },
    {
      name: "kernel.demonitor",
      type: kernel_demonitor_18,
      annotations: [],
    },
    {
      name: "kernel.measure_mana",
      type: kernel_measure_mana_19,
      annotations: [],
    },
    {
      name: "kernel.set_mana_limit",
      type: kernel_set_mana_limit_20,
      annotations: [],
    },
  ]

  kernel_spawn_10.members = [
    {
      name: "code",
      type: binary_6,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint_1,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_resurect_11.members = [
    {
      name: "code",
      type: binary_6,
      annotations: [],
    },
    {
      name: "memory",
      type: binary_6,
      annotations: [],
    },
    {
      name: "memory_limit",
      type: uint_1,
      annotations: [],
    },
    {
      name: "mana_limit",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_save_12.members = [
    {
      name: "id",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_kill_13.members = [
    {
      name: "id",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_bind_14.members = [
    {
      name: "process_from",
      type: uint_1,
      annotations: [],
    },
    {
      name: "channel_from",
      type: uint_1,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint_1,
      annotations: [],
    },
    {
      name: "channel_to",
      type: uint_1,
      annotations: [],
    },
    {
      name: "direction",
      type: direction_15,
      annotations: [],
    },
  ]

  kernel_unbind_16.members = [
    {
      name: "process_from",
      type: uint_1,
      annotations: [],
    },
    {
      name: "channel_from",
      type: uint_1,
      annotations: [],
    },
    {
      name: "process_to",
      type: uint_1,
      annotations: [],
    },
    {
      name: "channel_to",
      type: uint_1,
      annotations: [],
    },
    {
      name: "direction",
      type: direction_15,
      annotations: [],
    },
  ]

  kernel_monitor_17.members = [
    {
      name: "target",
      type: uint_1,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint_1,
      annotations: [],
    },
    {
      name: "monitor_channel",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_demonitor_18.members = [
    {
      name: "target",
      type: uint_1,
      annotations: [],
    },
    {
      name: "monitor",
      type: uint_1,
      annotations: [],
    },
    {
      name: "monitor_channel",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_measure_mana_19.members = [
    {
      name: "process",
      type: uint_1,
      annotations: [],
    },
    {
      name: "new_mana",
      type: uint_1,
      annotations: [],
    },
  ]

  kernel_set_mana_limit_20.members = [
    {
      name: "mana_limit",
      type: uint_1,
      annotations: [],
    },
  ]

  process_event_pointer_21.members = [
    {
      name: "event_pointer",
      type: pointer_7,
      annotations: [],
    },
  ]

  process_event_23.members = [
    {
      name: "process",
      type: uint_1,
      annotations: [],
    },
  ]

  process_error_event_24.members = [
    {
      name: "error",
      type: string_5,
      annotations: [],
    },
  ]

  return { registry, types }
}

// Empty method implementations
async function kernel_spawn_10_impl(
  code: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_resurect_11_impl(
  code: Uint8Array,
  memory: Uint8Array,
  memory_limit: number,
  mana_limit: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_save_12_impl(
  id: number
): Promise<Uint8Array> {
  /// TODO: implement
  return Promise.resolve(null as any as Uint8Array)
}

async function kernel_kill_13_impl(
  id: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_bind_14_impl(
  process_from: number,
  channel_from: number,
  process_to: number,
  channel_to: number,
  direction: direction_15
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_unbind_16_impl(
  process_from: number,
  channel_from: number,
  process_to: number,
  channel_to: number,
  direction: direction_15
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_monitor_17_impl(
  target: number,
  monitor: number,
  monitor_channel: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_demonitor_18_impl(
  target: number,
  monitor: number,
  monitor_channel: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

async function kernel_measure_mana_19_impl(
  process: number,
  new_mana: number
): Promise<number> {
  /// TODO: implement
  return Promise.resolve(0)
}

async function kernel_set_mana_limit_20_impl(
  mana_limit: number
): Promise<void> {
  /// TODO: implement
  return Promise.resolve()
}

export function implementMethods(result: ReturnType<typeof createGeneratedTypeRegistry>): void {
  const { registry, types } = result
  types['kernel_spawn_10'].implementation = kernel_spawn_10_impl
  types['kernel_resurect_11'].implementation = kernel_resurect_11_impl
  types['kernel_save_12'].implementation = kernel_save_12_impl
  types['kernel_kill_13'].implementation = kernel_kill_13_impl
  types['kernel_bind_14'].implementation = kernel_bind_14_impl
  types['kernel_unbind_16'].implementation = kernel_unbind_16_impl
  types['kernel_monitor_17'].implementation = kernel_monitor_17_impl
  types['kernel_demonitor_18'].implementation = kernel_demonitor_18_impl
  types['kernel_measure_mana_19'].implementation = kernel_measure_mana_19_impl
  types['kernel_set_mana_limit_20'].implementation = kernel_set_mana_limit_20_impl
}

export function setupServer(): TypeRegistry {
  const result = createGeneratedTypeRegistry()
  implementMethods(result)
  result.registry.assignMethodIds()
  return result.registry
}
