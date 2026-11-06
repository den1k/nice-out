import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// GHSA-c4j6-fc7j-m34r (WebSocket upgrade SSRF) is patched in 15.5.16 and 16.2.5.
describe('installed Next', () => {
  it('includes the WebSocket upgrade SSRF fix', () => {
    const { version } = JSON.parse(
      readFileSync(
        path.resolve(__dirname, '../../node_modules/next/package.json'),
        'utf8',
      ),
    )
    const [major, minor, patch] = version.split('.').map(Number)
    const patched =
      major > 16 ||
      (major === 16 && (minor > 2 || (minor === 2 && patch >= 5))) ||
      (major === 15 && minor === 5 && patch >= 16)
    expect(patched, `next ${version}`).toBe(true)
  })
})
