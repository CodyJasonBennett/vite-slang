/// <reference path="./slang.d.ts" />
import { PluginOption } from 'vite'

// TODO: overload GLSL option when GLES (+web) is upstreamed into Slang https://github.com/shader-slang/slang/issues/6142
export type SlangCompileTarget = 'WGSL' // 'SPIRV' | 'HLSL' | 'GLSL' | 'METAL' | 'WGSL' | 'CUDA'

// TODO: Vite should probably export this
type StringFilter<Value = string | RegExp> =
  | Value
  | Array<Value>
  | {
      include?: Value | Array<Value>
      exclude?: Value | Array<Value>
    }

// TODO: How to support GLSL + WGSL compilation as an API? Filter to allow platform-specific code?
export interface ViteSlangOptions {
  /**
   * The output {@link SlangCompileTarget} to transform Slang shaders to.
   *
   * Default is `WGSL`.
   */
  target?: SlangCompileTarget
  /**
   * The filter to use when finding Slang shader files by file path.
   *
   * Default is `/\.slang$/`.
   */
  filter?: StringFilter<string | RegExp>
}

declare function viteSlang(options?: ViteSlangOptions): PluginOption

export default viteSlang
