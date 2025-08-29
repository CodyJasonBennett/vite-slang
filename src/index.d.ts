/// <reference path="./slang.d.ts" />
import { PluginOption } from 'vite'

export interface ViteSlangOptions {
  // TODO: add GLSL option when GLES (+web) is upstreamed into Slang https://github.com/shader-slang/slang/issues/6142
  target: 'WGSL' // | 'GLSL'
}

declare function viteSlang(options?: ViteSlangOptions): PluginOption

export default viteSlang
