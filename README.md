[![Size](https://img.shields.io/badge/dynamic/json?label=gzip&style=flat&colorA=000000&colorB=000000&query=$.size.compressedSize&url=https://deno.bundlejs.com/?q=vite-slang)](https://unpkg.com/vite-slang)
[![Version](https://img.shields.io/npm/v/vite-slang?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/vite-slang)
[![Downloads](https://img.shields.io/npm/dt/vite-slang.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/vite-slang)

# vite-slang

Vite plugin for importing and compiling Slang shaders to run on the web (WebGL/WebGPU).

```js
// vite.config.js
import { defineConfig } from 'vite'
import slang from 'vite-slang'

export default defineConfig({
  plugins: [slang()],
})
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
