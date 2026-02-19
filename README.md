# vite-slang

Vite plugin for importing and compiling [Slang](https://github.com/shader-slang/slang) shaders to run on the web (WebGL/WebGPU).

The Slang WASM compiler is automatically downloaded from [GitHub releases](https://github.com/shader-slang/slang/releases) and cached locally — no binary files are bundled with the plugin.

```js
// vite.config.js
import { defineConfig } from 'vite'
import slang from 'vite-slang'

export default defineConfig({
  plugins: [slang()],
})
```

### Options

- `target`
  - Type: `'WGSL'`
  - Default: `'WGSL'`
  - Description: Compilation target for Slang shaders.
- `filter`
  - Type: `string | RegExp | Array`
  - Default: `/\.slang$/`
  - Description: File filter for Slang shader files.
- `slangVersion`
  - Type: `string`
  - Default: `'2026.3'`
  - Description: Slang version to use. Downloaded from [GitHub releases](https://github.com/shader-slang/slang/releases) on first run, cached in `node_modules/.cache/vite-slang/`.
- `slangWasmDir`
  - Type: `string`
  - Default: none
  - Description: Path to a pre-downloaded WASM directory. Overrides `slangVersion`. Useful for offline or custom builds.
- `checkForUpdates`
  - Type: `boolean`
  - Default: `true`
  - Description: Check GitHub for newer Slang versions and log a notice.

```js
slang({ slangVersion: '2026.3' })

// or use a local WASM build
slang({ slangWasmDir: './vendor/slang-wasm' })
```

### Usage

```slang
// shader.slang
struct VertexStageInput
{
    float4 position : POSITION0;
};

struct VertexStageOutput
{
    float4 positionClipSpace : SV_POSITION;
};

struct FragmentStageOutput
{
    float4 color : SV_TARGET;
};

[shader("vertex")]
VertexStageOutput vertexMain(VertexStageInput input) : SV_Position
{
	VertexStageOutput output;
    output.positionClipSpace = float4(input.position.xy, 1);
    return output;
}

[shader("fragment")]
FragmentStageOutput fragmentMain() : SV_Target
{
    FragmentStageOutput output;
    output.color = float4(0, 1, 0, 1);
    return output;
}
```

```js
// app.js
import code from './shader.slang'
import { code, reflection } from './shader.slang'

const shader = device.createShaderModule({ code })

const pipeline = device.createRenderPipeline({
  vertex: {
    module: shader,
    entryPoint: 'vertexMain',
  },
  fragment: {
    module: shader,
    entryPoint: 'fragmentMain',
    targets: [{ format: 'bgra8unorm' }],
  },
  layout: 'auto',
})

console.log(reflection) // metadata about entry points, bindings, etc.
```
