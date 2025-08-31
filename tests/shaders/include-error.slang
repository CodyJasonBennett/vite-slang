// cbuffer Globals: register(b0, space0) {
//   float time;
// };
#include "include-2.slang"

[shader("vertex")]
float4 vmain(uint vertexIndex: SV_VertexID): SV_Position {
  float2 uv = float2((vertexIndex << 1) & 2, vertexIndex & 2);
  return float4(uv * 2.0 - 1.0, 0.0, 1.0);
}

[shader("fragment")]
float4 fmain(float4 position: SV_Position): SV_Target {
  float2 coord = position.xy / position.w;
  float3 color = float3(0.8, 0.7, 1.0) + 0.3 * cos(normalize(coord).xyx + time);
  return float4(color, 1.0);
}
