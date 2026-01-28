export function toHex(value: Uint8Array): string {
  return Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ')
}
