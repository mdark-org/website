import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

const sourceRoot = new URL('../src/', import.meta.url).href

// Keep extensionless source imports while using Node's native TypeScript support in tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!specifier.startsWith('.') || !context.parentURL?.startsWith(sourceRoot)) throw error
      const resolved = new URL(specifier, context.parentURL)
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(`${resolved.href}${suffix}`)
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context)
      }
      throw error
    }
  },
})
