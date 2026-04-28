#ifndef CIRCULAR_A_H
#define CIRCULAR_A_H
#include "circular-b.slang"
#endif

[shader("compute")]
[numthreads(1, 1, 1)]
void mainA(uint2 dispatchThreadId: SV_DispatchThreadID) {}
