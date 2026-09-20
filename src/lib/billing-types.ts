export type BillingTier = 'pro' | 'brand';
export type BillingPlan = {id:BillingTier;name:string;amount:number;currency:string;interval:'month'|'year';intervalCount:number};
export type BillingStatus = {configured:boolean;signedIn:boolean;plans:BillingPlan[];subscription:null|{tier:BillingTier;status:string;cancelAtPeriodEnd:boolean;currentPeriodEnd:number};canManage:boolean};
