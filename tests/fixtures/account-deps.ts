import assert from 'node:assert/strict';
import type {AccountDeps} from '../../src/lib/server/account';
// Explicit central-authorization dependency for non-auth feature tests.
export function validAccountDeps(owner:string):AccountDeps{return {fetch:async(input,init)=>{
 assert.equal(new URL(String(input)).pathname,'/account/session');
 assert.equal(new Headers(init?.headers).get('x-qr-user'),owner);
 return Response.json({owner,version:1});
}};}
