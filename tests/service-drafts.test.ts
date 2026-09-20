import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {blankContent,contentDirty,linkDirty,newContentEditor,newLinkEditor} from '../src/lib/service-drafts';
import {decodeSignInDraft,encodeSignInDraft,SIGN_IN_DRAFT_TTL} from '../src/lib/sign-in-drafts';
import HostedPageView from '../src/components/hosted-page-view';
test('every editable new page field is included in unsaved detection',()=>{
 for(const kind of ['links','menu','gallery','document','form'] as const){
  const editor=newContentEditor(kind);assert.equal(contentDirty(editor),false);
  for(const patch of [{title:'hello'},{description:'intro'},{accent:'#112233'},{formMessage:'Thanks!'},{fileId:'asset1'},{items:[{title:'A',description:'',price:'',url:'https://example.com',assetId:''}]}])assert.equal(contentDirty({...editor,draft:{...editor.draft,...patch}}),true);
 }
});
test('new link edits are dirty and successful save baseline is clean',()=>{
 const editor=newLinkEditor();assert.equal(linkDirty(editor),false);
 assert.equal(linkDirty({...editor,name:'New'}),true);assert.equal(linkDirty({...editor,target:'https://example.com'}),true);
 assert.equal(linkDirty({...editor,name:'Saved',target:'https://example.com',baseline:{name:'Saved',target:'https://example.com'}}),false);
});
test('opt-in transfer retains multi-item text and both editors without accepting arbitrary fields',()=>{
 const c=newContentEditor();c.draft.title='Draft';c.draft.items=[{title:'First',description:'one',url:'https://example.com',price:'',assetId:''},{title:'Second',description:'two',url:'https://example.org',price:'',assetId:''}];
 const l={...newLinkEditor(),name:'Link',target:'https://example.com'};
 const raw=encodeSignInDraft(null,{...c,binary:'do not store'} as typeof c,l,1000);
 assert.equal(raw.includes('do not store'),false);
 const recovered=decodeSignInDraft(raw,'verified@example.com',1100);assert.deepEqual(recovered?.content,c);assert.deepEqual(recovered?.link,l);
});
test('expired, oversized, invalid and cross-account transfers are rejected',()=>{
 const raw=encodeSignInDraft('first@example.com',newContentEditor(),newLinkEditor(),1000);
 assert.equal(decodeSignInDraft(raw,'second@example.com',1100),null);assert.equal(decodeSignInDraft(raw,null,1100),null);
 assert.ok(decodeSignInDraft(raw,'first@example.com',1100));assert.equal(decodeSignInDraft(raw,'first@example.com',1000+SIGN_IN_DRAFT_TTL),null);
 const large=newContentEditor();large.draft.items=Array.from({length:12},()=>({title:'x'.repeat(80),description:'x'.repeat(300),price:'',url:'x'.repeat(2048),assetId:''}));large.baseline=large.draft;assert.throws(()=>encodeSignInDraft(null,large,newLinkEditor()));
 assert.equal(decodeSignInDraft('{bad','first@example.com',1100),null);assert.equal(decodeSignInDraft(' '.repeat(32769),null),null);
 assert.equal(decodeSignInDraft(JSON.stringify({owner:null,expires:1200,content:{},link:{}}),null,1100),null);
 const c=newContentEditor();c.draft.description='x'.repeat(1001);assert.throws(()=>encodeSignInDraft(null,c,newLinkEditor()));
});
test('every preview format renders no navigable anchor, public footer retains its link',()=>{
 for(const kind of ['links','menu','gallery','document','form'] as const){
  const content={...blankContent(kind),fileId:'asset',items:[{title:'Example',description:'',url:'https://example.com',price:'',assetId:''}]};
  assert.doesNotMatch(renderToStaticMarkup(createElement(HostedPageView,{content,preview:true})),/<a\s/);
  assert.match(renderToStaticMarkup(createElement(HostedPageView,{content,slug:'example'})),/href="https:\/\/qrupgrade.com"/);
 }
});
