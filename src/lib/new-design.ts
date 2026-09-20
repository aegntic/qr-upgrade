import { defaultCaption, defaultImageAdjustments, type EditorDraft } from './editor-draft';
import { templates } from './generator-options';
import proofs from './artwork-proofs.json';
/** Start a separate design without carrying another draft's private content. */
export function newDesign(url: string, name: string): EditorDraft {
  return {version:1,kind:'website',content:{type:'url',url,ssid:'',password:'',name:'',email:'',phone:''},mode:'art',appearance:{...templates[0]},template:templates[0].name,art:'vinyl',studyActive:false,customImage:'',logo:'',logoSize:20,logoFrame:'plain',strength:proofs.vinyl.strength,sizeMm:70,showUtm:false,utm:{source:'',medium:'',campaign:''},adjustments:{...defaultImageAdjustments},caption:{...defaultCaption},name,destinationDrafts:{}};
}
