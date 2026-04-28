void test() {}

#ifndef INTERNAL_CONFIG
#define INTERNAL_CONFIG
#endif

[shader("compute")]
[numthreads(1, 1, 1)]
void main(uint2 dispatchThreadId: SV_DispatchThreadID) {
  #ifdef INTERNAL_CONFIG
      dispatchThreadId.x++;
  #else
      dispatchThreadId.y++;
  #endif
}
