/** Bound read-only startup requests, including parsing their response body.
 * Caller cancellation stays separate from a deadline so mounted UI can show
 * an error after timeout. This never retries or wraps a mutation.
 */
export async function readJson<T>(url:string,signal:AbortSignal,request:typeof fetch=fetch,timeoutMs=15000):Promise<T>{
 const deadline=new AbortController();
 const timer=setTimeout(()=>deadline.abort(new DOMException('Loading took too long. Please refresh to try again.','TimeoutError')),timeoutMs);
 const combined=AbortSignal.any([signal,deadline.signal]);
 let onAbort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{
  onAbort=()=>reject(combined.reason);
  combined.addEventListener('abort',onAbort,{once:true});
 });
 try{
  combined.throwIfAborted();
  const response=await Promise.race([request(url,{cache:'no-store',signal:combined}),cancelled]);
  const data=await Promise.race([response.json(),cancelled]);
  if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'This page could not be loaded. Please refresh to try again.');
  return data as T;
 }finally{clearTimeout(timer);combined.removeEventListener('abort',onAbort);}
}
