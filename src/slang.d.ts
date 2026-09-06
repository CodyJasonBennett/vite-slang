interface SlangReflectionUserAttribute {
  arguments: (number | string)[]
  name: string
}

type SlangReflectionBinding =
  | {
      kind: 'uniform'
      offset: number | 'unbounded' | 'unknown'
      size: number | 'unbounded' | 'unknown'
      elementStride: number | 'unbounded' | 'unknown'
    }
  | {
      kind: Exclude<SlangReflectionSize['kind'], 'uniform'>
      index: number | 'unbounded' | 'unknown'
      space?: number | 'unbounded' | 'unknown'
      count?: number | 'unbounded' | 'unknown'
    }

type SlangScalarType = `${'uint' | 'int'}${8 | 16 | 32 | 64}` | `${'float'}${16 | 32 | 64}`

type SlangFormat =
  | 'rgba32f'
  | 'rgba16f'
  | 'rg32f'
  | 'rg16f'
  | 'r11f_g11f_b10f'
  | 'r32f'
  | 'r16f'
  | 'rgba16'
  | 'rgb10_a2'
  | 'rgba8'
  | 'rg16'
  | 'rg8'
  | 'r16'
  | 'r8'
  | 'rgba16_snorm'
  | 'rgba8_snorm'
  | 'rg16_snorm'
  | 'rg8_snorm'
  | 'r16_snorm'
  | 'r8_snorm'
  | 'rgba32i'
  | 'rgba16i'
  | 'rgba8i'
  | 'rg32i'
  | 'rg16i'
  | 'rg8i'
  | 'r32i'
  | 'r16i'
  | 'r8i'
  | 'rgba32ui'
  | 'rgba16ui'
  | 'rgb10_a2ui'
  | 'rgba8ui'
  | 'rg32ui'
  | 'rg16ui'
  | 'rg8ui'
  | 'r32ui'
  | 'r16ui'
  | 'r8ui'
  | '64ui'
  | 'r64i'
  | 'bgra8'

type SlangReflectionSize =
  | {
      kind: // 'constantBuffer'
        // | 'shaderResource'
        // | 'unorderedAccess'
        | 'varyingInput'
        | 'varyingOutput'
        // | 'samplerState'
        // | 'pushConstantBuffer'
        | 'descriptorTableSlot'
        | 'specializationConstant'
        // | 'mixed'
        | 'registerSpace'
        | 'subElementRegisterSpace'
        | 'generic'
        // | 'rayPayload'
        // | 'hitAttributes'
        // | 'callablePayload'
        // | 'shaderRecord'
        | 'existentialTypeParam'
        | 'existentialObjectParam'
      // | 'inputAttachmentIndex'
      // | 'metalArgumentBufferElement'
      // | 'metalAttribute'
      // | 'metalPayload'
      value: number | 'unbounded' | 'unknown'
    }
  | {
      kind: 'uniform'
      value: number | 'unbounded' | 'unknown'
      alignment: number | 'unbounded' | 'unknown'
    }

type SlangReflectionType = (
  | {
      kind: 'struct'
      name: string
      fields: SlangReflectionParameter[]
    }
  | {
      kind: 'vector'
      elementCount: 2 | 3 | 4
      elementType: SlangReflectionType
    }
  | {
      kind: 'scalar'
      scalarType: SlangScalarType
    }
  | {
      kind: 'resource'
      baseShape: 'structuredBuffer'
      access?: 'readWrite'
      resultType: SlangReflectionType
    }
  | {
      kind: 'resource'
      baseShape: 'texture2D'
      access?: 'readWrite' | 'write'
      resultType: SlangReflectionType
    }
  | {
      kind: 'samplerState'
    }
) & {
  sizes?: SlangReflectionSize[]
}

interface SlangReflectionParameter {
  binding?: SlangReflectionBinding
  bindings?: SlangReflectionBinding[]
  format?: SlangFormat
  name?: string
  type: SlangReflectionType
  userAttribs?: SlangReflectionUserAttribute[]
  stage?: string
  semanticName?: string
  semanticIndex?: number
}

type SlangReflectionScope =
  | {
      kind: 'none'
      parameters: SlangReflectionParameter[]
    }
  | {
      kind: 'constantBuffer'
      binding?: SlangReflectionBinding
      bindings?: SlangReflectionBinding[]
      parameters: SlangReflectionParameter[]
      stage?: string
    }

interface SlangReflectionEntryPoint {
  name: string
  parameters?: SlangReflectionParameter[]
  stage?: string
  threadGroupSize?: [number, number, number]
  userAttribs?: SlangReflectionUserAttribute[]
  scope: SlangReflectionScope
}

interface SlangReflectionJSON {
  entryPoints?: SlangReflectionEntryPoint[]
  parameters: SlangReflectionParameter[]
  hashedStrings?: Record<string, number>
  version: '1.1'
  globalScope: SlangReflectionScope
}

declare module '*.slang' {
  export const code: string
  export const reflection: SlangReflectionJSON

  export default code
}
