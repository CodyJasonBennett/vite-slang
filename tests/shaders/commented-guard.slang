// #ifndef COMMENTED_H
// #define COMMENTED_H
/* 
#ifndef MULTILINE_H 
#define MULTILINE_H 
*/

[shader("compute")]
[numthreads(1, 1, 1)]
void commentGuard(uint2 dispatchThreadId: SV_DispatchThreadID) {}
