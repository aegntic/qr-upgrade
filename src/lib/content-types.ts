export type ContentKind='links'|'menu'|'gallery'|'document'|'form';
export type ContentItem={title:string;description:string;price:string;url:string;assetId:string};
export type ContentDraft={kind:ContentKind;title:string;description:string;accent:string;items:ContentItem[];fileId:string;formMessage:string};
export type ContentPage={id:string;slug:string;url:string;draft:ContentDraft;status:'draft'|'published'|'paused';archived:boolean;hasUnpublishedChanges:boolean;createdAt:string;updatedAt:string};
export type PublicContentPage={slug:string;url:string;content:ContentDraft};
export type ContentAsset={id:string;name:string;mime:string;size:number;url?:string};
export type ContentSubmission={id:string;name:string;email:string;message:string;createdAt:string};
