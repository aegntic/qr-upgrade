import type {ContentDraft,ContentKind} from './content-types';
export const blankContent=(kind:ContentKind):ContentDraft=>({kind,title:'',description:'',accent:'#b8cbed',items:[],fileId:'',formMessage:'Thank you for taking a moment to share.'});
export type ContentEditor={selected:string|null;draft:ContentDraft;baseline:ContentDraft};
export type LinkEditor={selected:string|null;name:string;target:string;baseline:{name:string;target:string}};
export const newContentEditor=(kind:ContentKind='links'):ContentEditor=>({selected:null,draft:blankContent(kind),baseline:blankContent(kind)});
export const newLinkEditor=():LinkEditor=>({selected:null,name:'',target:'',baseline:{name:'',target:''}});
export const contentDirty=(editor:ContentEditor)=>JSON.stringify(editor.draft)!==JSON.stringify(editor.baseline);
export const linkDirty=(editor:LinkEditor)=>editor.name!==editor.baseline.name||editor.target!==editor.baseline.target;
