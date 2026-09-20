export type BillingTier = 'pro' | 'brand';
export type EntitlementTier = 'free' | BillingTier;
export type PlanLimits = {readonly cloudDesigns:number;readonly dynamicLinks:number;readonly hostedPages:number;readonly uploadedAssets:number};
export type Entitlement = {tier:EntitlementTier;limits:PlanLimits};
export type BillingPlan = {id:BillingTier;name:string;amount:number;currency:string;interval:'month'|'year';intervalCount:number;limits:PlanLimits};
export type BillingStatus = {configured:boolean;signedIn:boolean;plans:BillingPlan[];subscription:null|{tier:BillingTier;status:string;cancelAtPeriodEnd:boolean;currentPeriodEnd:number};canManage:boolean;entitlement?:Entitlement};
