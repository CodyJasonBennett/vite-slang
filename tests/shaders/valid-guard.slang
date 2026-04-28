#ifndef VALID_GUARD_H
#define VALID_GUARD_H
struct Data { float val; };
#endif

[shader("compute")]
[numthreads(1, 1, 1)]
void validGuard(uint2 dispatchThreadId: SV_DispatchThreadID) {}
