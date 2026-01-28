export interface Range {
  gt_key: Uint8Array
  gt_inclusive: boolean
  lt_key: Uint8Array
  lt_inclusive: boolean
  limit: number
}

export enum BatchOperationType {
  SET = 0,
  REMOVE = 1
}

export interface BatchOperation {
  range: Range
  value: Uint8Array
  type: 'set' | 'remove'
}

export interface DatabaseBackend {
  set(database: String, table: String, key: Uint8Array, value: Uint8Array): Promise<void>
  get(database: String, table: String, key: Uint8Array): Promise<Uint8Array>
  remove(database: String, table: String, key: Uint8Array): Promise<void>
  range_get(database: String, table: String, range: Range): Promise<Uint8Array[]>
  range_remove(database: String, table: String, range: Range): Promise<void>
  batch_update(database: String, table: String, operations: BatchOperation[]): Promise<void>

}

export type process_id = number
export type channel_id = number
export type module_id = number

export enum ModuleFlags {
  MEASURE_GAS = 1 << 0,
  SOFT_FLOAT = 1 << 1
}

export enum Direction {
  NONE = 0,
  IN = 1,
  OUT = 2,
  BOTH = 3,
}