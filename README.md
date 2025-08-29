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
import wgslCode from './shader.slang'

const shader = device.createShaderModule({
  code: wgslCode,
})

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
```
