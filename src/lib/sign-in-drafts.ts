import type {ContentDraft} from './content-types';
import type {ContentEditor,LinkEditor} from './service-drafts';
export const SIGN_IN_DRAFT_KEY='qr-upgrade:sign-in-draft:v1';
export const SIGN_IN_DRAFT_TTL=30*60*1000;
const LIMIT=32*1024;
type Transfer={owner:string|null;content:ContentEditor;link:LinkEditor;expires:number};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const id=(value:unknown)=>value===null||text(value,100);
function validDraft(value:unknown):value is ContentDraft{
 if(!record(value)||!['links','menu','gallery','document','form'].includes(String(value.kind))||!text(value.title,80)||!text(value.description,1000)||!text(value.accent,7)||!/^#[\da-f]{6}$/i.test(value.accent)||!text(value.fileId,100)||!text(value.formMessage,300)||!Array.isArray(value.items)||value.items.length>12)return false;
 return value.items.every(item=>record(item)&&text(item.title,80)&&text(item.description,300)&&text(item.price,30)&&text(item.url,2048)&&text(item.assetId,100));
}
function validTransfer(value:unknown):value is Transfer{
 if(!record(value)||!(value.owner===null||text(value.owner,254))||typeof value.expires!=='number'||!record(value.content)||!record(value.link))return false;
 const c=value.content,l=value.link;
 return id(c.selected)&&validDraft(c.draft)&&validDraft(c.baseline)&&id(l.selected)&&text(l.name,80)&&text(l.target,2048)&&record(l.baseline)&&text(l.baseline.name,80)&&text(l.baseline.target,2048);
}
// Serialize only the bounded structured editor fields. Uploaded binaries never enter this store.
export function encodeSignInDraft(owner:string|null,content:ContentEditor,link:LinkEditor,now=Date.now()):string{
 const draft=(d:ContentDraft):ContentDraft=>({kind:d.kind,title:d.title,description:d.description,accent:d.accent,fileId:d.fileId,formMessage:d.formMessage,items:d.items.map(i=>({title:i.title,description:i.description,price:i.price,url:i.url,assetId:i.assetId}))});
 const value:Transfer={owner,expires:now+SIGN_IN_DRAFT_TTL,content:{selected:content.selected,draft:draft(content.draft),baseline:draft(content.baseline)},link:{selected:link.selected,name:link.name,target:link.target,baseline:{name:link.baseline.name,target:link.baseline.target}}};
 const raw=JSON.stringify(value);
 if(!validTransfer(value)||new TextEncoder().encode(raw).length>LIMIT)throw new Error('This draft is too large to keep for sign-in. Stay here and copy your text before continuing.');
 return raw;
}
export function decodeSignInDraft(raw:string,currentOwner:string|null,now=Date.now()):Transfer|null{
 if(new TextEncoder().encode(raw).length>LIMIT)return null;
 try{const value:unknown=JSON.parse(raw);if(!validTransfer(value)||value.expires<=now||value.expires>now+SIGN_IN_DRAFT_TTL||value.owner!==null&&value.owner!==currentOwner)return null;return value;}catch{return null;}
}
