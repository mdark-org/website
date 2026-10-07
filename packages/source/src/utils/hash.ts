import XXH from 'xxhashjs'

export async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function quickHash(value: string): string {
  return XXH.h64(new TextEncoder().encode(value).buffer, 0).toString(16).padEnd(16, '0')
}
