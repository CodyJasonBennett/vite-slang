import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'

const DEFAULT_VERSION = '2026.3'

const GITHUB_RELEASES_URL = 'https://github.com/shader-slang/slang/releases/download'
const GITHUB_API_LATEST = 'https://api.github.com/repos/shader-slang/slang/releases/latest'

function getCacheDir() {
  try {
    const require = createRequire(import.meta.url)
    const pkg = require.resolve('vite-slang/package.json')
    return path.join(path.dirname(pkg), '..', '.cache', 'vite-slang')
  } catch {
    return path.join(process.cwd(), 'node_modules', '.cache', 'vite-slang')
  }
}

function getVersionDir(version) {
  return path.join(getCacheDir(), `slang-${version}-wasm`)
}

function hasWasmFiles(dir) {
  return (
    fs.existsSync(path.join(dir, 'slang-wasm.js')) &&
    fs.existsSync(path.join(dir, 'slang-wasm.wasm'))
  )
}

async function downloadSlangWasm(version, dir) {
  const zipUrl = `${GITHUB_RELEASES_URL}/v${version}/slang-${version}-wasm.zip`

  console.log(`\x1b[36m[vite-slang]\x1b[0m Downloading Slang WASM v${version}...`)
  console.log(`\x1b[36m[vite-slang]\x1b[0m ${zipUrl}`)

  const res = await fetch(zipUrl, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(
      `[vite-slang] Failed to download Slang WASM v${version}: ${res.status} ${res.statusText}\n` +
      `URL: ${zipUrl}\n` +
      `Make sure version "${version}" exists at https://github.com/shader-slang/slang/releases`,
    )
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  const entries = parseZipEntries(buffer)

  fs.mkdirSync(dir, { recursive: true })

  const WASM_FILES = ['slang-wasm.js', 'slang-wasm.wasm', 'slang-wasm.d.ts']
  let extracted = 0
  for (const entry of entries) {
    const basename = path.basename(entry.name)
    if (WASM_FILES.includes(basename)) {
      fs.writeFileSync(path.join(dir, basename), entry.data)
      extracted++
    }
  }

  if (extracted < 2) {
    fs.rmSync(dir, { recursive: true, force: true })
    throw new Error(
      `[vite-slang] Downloaded zip for v${version} did not contain expected WASM files (slang-wasm.js, slang-wasm.wasm).`,
    )
  }

  // emscripten JS uses `export default` - node needs ESM context for it
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}')

  console.log(`\x1b[32m[vite-slang]\x1b[0m Slang WASM v${version} cached at ${dir}`)
}

// zip parse for stored (0) and deflated (8) entries
function parseZipEntries(buf) {
  const { inflateRawSync } = createRequire(import.meta.url)('node:zlib')
  const entries = []
  let offset = 0

  while (offset < buf.length - 4) {
    const sig = buf.readUInt32LE(offset)
    if (sig !== 0x04034b50) break

    const method = buf.readUInt16LE(offset + 8)
    const compressedSize = buf.readUInt32LE(offset + 18)
    const nameLen = buf.readUInt16LE(offset + 26)
    const extraLen = buf.readUInt16LE(offset + 28)
    const name = buf.toString('utf8', offset + 30, offset + 30 + nameLen)
    const dataStart = offset + 30 + nameLen + extraLen
    const raw = buf.subarray(dataStart, dataStart + compressedSize)

    if (!name.endsWith('/')) {
      if (method === 0) entries.push({ name, data: raw })
      else if (method === 8) entries.push({ name, data: inflateRawSync(raw) })
    }

    offset = dataStart + compressedSize
  }

  return entries
}

/**
 * @param {string} [version]
 * @param {string} [wasmDir] - override path to pre-downloaded WASM directory
 * @returns {Promise<string>}
 */
export async function ensureSlangWasm(version = DEFAULT_VERSION, wasmDir) {
  if (wasmDir) {
    const resolved = path.resolve(wasmDir)
    if (!hasWasmFiles(resolved)) {
      throw new Error(
        `[vite-slang] slangWasmDir "${wasmDir}" does not contain required files (slang-wasm.js, slang-wasm.wasm).`,
      )
    }
    return resolved
  }

  const dir = getVersionDir(version)
  if (!hasWasmFiles(dir)) await downloadSlangWasm(version, dir)
  return dir
}

/** @param {string} wasmDir */
export async function loadSlangModule(wasmDir) {
  const jsPath = path.join(wasmDir, 'slang-wasm.js')
  const { default: factory } = await import(/* @vite-ignore */ `file://${jsPath}`)
  return factory({ locateFile: (f) => path.join(wasmDir, f) })
}

/**
 * Check for newer Slang - results cached for 24h.
 * @param {string} currentVersion
 */
export async function checkForUpdates(currentVersion) {
  try {
    const cacheDir = getCacheDir()
    const cacheFile = path.join(cacheDir, '.latest-version-check')
    const ONE_DAY = 24 * 60 * 60 * 1000

    if (fs.existsSync(cacheFile)) {
      const age = Date.now() - fs.statSync(cacheFile).mtimeMs
      if (age < ONE_DAY) {
        const { latestVersion } = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
        printUpdateNotice(currentVersion, latestVersion)
        return
      }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return

    const { tag_name } = await res.json()
    const latestVersion = tag_name.replace(/^v/, '')

    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify({ latestVersion, checkedAt: new Date().toISOString() }))

    printUpdateNotice(currentVersion, latestVersion)
  } catch {
    // idk, don't block builds on network issues
  }
}

function printUpdateNotice(current, latest) {
  if (compareVersions(current, latest) >= 0) return

  console.log(
    `\n\x1b[33m[vite-slang]\x1b[0m Using Slang \x1b[1mv${current}\x1b[0m` +
    ` — newer \x1b[1m\x1b[32mv${latest}\x1b[0m is available.` +
    `\n\x1b[33m[vite-slang]\x1b[0m Update: \x1b[36mslangVersion: '${latest}'\x1b[0m in plugin options` +
    `\n\x1b[33m[vite-slang]\x1b[0m Changelog: \x1b[36mhttps://github.com/shader-slang/slang/releases/tag/v${latest}\x1b[0m\n`,
  )
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

export { DEFAULT_VERSION }
