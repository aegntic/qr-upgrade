import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readJson} from '../src/lib/read-json';
const never=()=>new Promise<Response>(()=>{});
test('read deadline reports error without cancelling caller lifetime',async()=>{
 const caller=new AbortController();
 await assert.rejects(readJson('/api/account',caller.signal,never,15),{name:'TimeoutError'});
 assert.equal(caller.signal.aborted,false);
});
test('deadline also bounds a stalled response body',async()=>{
 const request=async()=>new Response(new ReadableStream({start(){}}));
 await assert.rejects(readJson('/api/account',new AbortController().signal,request,15),{name:'TimeoutError'});
});
test('unmount abort wins and no retry is made',async()=>{
 const caller=new AbortController();let calls=0;
 const result=readJson('/api/account',caller.signal,async()=>{calls++;return never();},1000);
 caller.abort();await assert.rejects(result,{name:'AbortError'});assert.equal(calls,1);
});
test('unavailable differs from signed out and successful reads remain intact',async()=>{
 const signal=new AbortController().signal;
 await assert.rejects(readJson('/api/account',signal,async()=>Response.json({error:'Service unavailable'}, {status:503})),/Service unavailable/);
 assert.deepEqual(await readJson('/api/account',signal,async()=>Response.json({configured:true,signedIn:false})),{configured:true,signedIn:false});
});
