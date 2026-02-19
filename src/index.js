import { transformWithEsbuild } from 'vite'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ensureSlangWasm as fsSlangWasm, loadSlangModule, checkForUpdates, DEFAULT_VERSION } from './wasm-manager.js'

/**
 * @param {String} id
 * @param {Exclude<import('./index.js').ViteSlangOptions['filter'], undefined>} filter
 */
function testFilter(id, filter) {
  if (typeof filter === 'string') {
    return id === filter
  } else if (filter instanceof RegExp) {
    return filter.test(id)
  } else if (Array.isArray(filter)) {
    for (const test of filter) {
      if (testFilter(id, test)) return true
    }
    return false
  } else if (filter.exclude || filter.include) {
    if (filter.exclude && testFilter(id, filter.exclude)) return false
    if (filter.include && !testFilter(id, filter.include)) return false
    return true
  }
}

const SLANG_STAGES = {
  vertex: 1,
  fragment: 5,
  compute: 6,
}

const IMPORT_REGEX = /^\s*#include\s+"([^"]+)"/gm

/** @type {Promise<any> | null} */
let slangPromise = null

/** @type {any} */
let globalSession = null

/**
 * @param {import('./index.js').ViteSlangOptions} options
 * @returns {import('vite').PluginOption}
 */
function viteSlang(options) {
  options = { target: 'WGSL', filter: /\.slang$/, slangVersion: DEFAULT_VERSION, checkForUpdates: true, ...options }

  /** @type {string | null} */
  let wasmDir = null

  return {
    name: 'vite-slang',
    async configResolved() {
      wasmDir = await fsSlangWasm(options.slangVersion, options.slangWasmDir)

      if (options.checkForUpdates) {
        checkForUpdates(options.slangVersion)
      }
    },
    transform: {
      // NOTE: ideally, we can evaluate and parse Slang written in JS (e.g., /* slang */ `...`),
      // but Slang expects a full program which does not allow for this dynamic compilation at run-time.
      // For now, we only handle files with a .slang file extension (default). These are transformed as source code.
      filter: {
        id: options.filter,
      },
      async handler(code, id) {
        // Backwards compat for non-Rolldown clients
        // https://github.com/CodyJasonBennett/vite-slang/issues/1
        if (!testFilter(id, options.filter)) return

        /** @type {any} */
        let session = null

        try {
          // Lazy load Slang WASM (no top-level-await so this works in ESM/CJS/UMD)
          if (!slangPromise) {
            if (!wasmDir) wasmDir = await fsSlangWasm(options.slangVersion, options.slangWasmDir)
            slangPromise = loadSlangModule(wasmDir)
          }
          const slang = await slangPromise
          if (!globalSession) globalSession = slang.createGlobalSession()

          // Initialize compiler target
          let wasmCompileTarget = null
          for (const target of slang.getCompileTargets()) {
            if (target.name == options.target) {
              wasmCompileTarget = target.value
            }
          }
          if (wasmCompileTarget === null) {
            throw new Error(`Unsupported Slang target: ${options.target}.`)
          }

          session = globalSession.createSession(wasmCompileTarget)
          if (!session) {
            throw new Error(`Unable to create Slang session for ${options.target} target. Please file an issue.`)
          }


          const module = session.loadModuleFromSource(
            // Resolve #include directives
            code.replaceAll(IMPORT_REGEX, (match, specifier) => {
              try {
                const file = path.resolve(path.dirname(id), specifier)
                this.addWatchFile(file)
                return fs.readFileSync(file, { encoding: 'utf8' })
              } catch {
                return match
              }
            }),
            'shader',
            id,
          )

          // Surface compilation errors
          if (!module) {
            const error = slang.getLastError()
            throw new Error(`${error.type} error: ${error.message}`)
          }

          // Entrypoints must be defined with shader decoration to remove ambiguity (e.g., [shader("fragment")])
          const count = module.getDefinedEntryPointCount()
          if (count === 0) {
            throw new Error(
              'An entrypoint must be defined with a shader stage attribute! Try adding [shader("fragment")] before your entrypoint method.',
            )
          }

          // Link shader entrypoints
          // TODO: surely, there's a better way to reflect the program and get a top-level layout?
          const components = [module]
          for (let i = 0; i < count; i++) {
            const entryPoint = module.getDefinedEntryPoint(i)
            const program = session.createCompositeComponentType([entryPoint, 1])
            const layout = program.getLayout(0).toJsonObject()
            const { name, stage } = layout.entryPoints[0]
            components.push(module.findAndCheckEntryPoint(name, SLANG_STAGES[stage]))
          }

          // Compile shader with reflection
          const linkedProgram = session.createCompositeComponentType(components).link()
          const shader = linkedProgram.getTargetCode(0)
          const reflection = linkedProgram.getLayout(0).toJsonObject()

          // Handle link errors
          if (shader.length === 0) {
            const error = slang.getLastError()
            throw new Error(`${error.type} error: ${error.message}`)
          }

          // Export with overloads for default export or named exports for reflection (see slang.d.ts)
          const reflectionJson = JSON.stringify(reflection)
          code = `export const code = \`${shader}\`;export const reflection = ${reflectionJson};export default code;`

          return transformWithEsbuild(code, id, {
            format: 'esm',
            loader: 'js',
            sourcemap: 'external', // TODO: pass to WebGPU API?
          })
        } finally {
          if (session) session.delete()
        }
      },
    },
  }
}

export default viteSlang
