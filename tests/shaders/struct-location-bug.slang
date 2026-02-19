struct FullscreenTriangle {
    float4 position : SV_Position;
    float2 uv : TEXCOORD0;
};

[shader("vertex")]
FullscreenTriangle vertexMain(uint vertexIndex: SV_VertexID) {
    float2 uv = float2(vertexIndex >> 1, vertexIndex & 1) * 2;
    float4 position = float4(uv * 2 - 1, 0, 1);
    return FullscreenTriangle(position, uv);
}

Texture2D<float4> blitTexture : register(t0, space0);
SamplerState linearClampSampler : register(s1, space0);

[shader("fragment")]
float4 fragmentMain(FullscreenTriangle input): SV_Target {
    return blitTexture.Sample(linearClampSampler, input.uv);
}
