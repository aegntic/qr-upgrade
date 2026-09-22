export type PlanTier='free'|'pro'|'brand';
export type PlanLimits={readonly cloudDesigns:number;readonly dynamicLinks:number;readonly hostedPages:number;readonly uploadedAssets:number};
export const PLAN_LIMITS:Readonly<Record<PlanTier,Readonly<PlanLimits>>>;
export function limitsForPlan(tier:string):Readonly<PlanLimits>|null;
