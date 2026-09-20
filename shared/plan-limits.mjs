const freezeLimits=limits=>Object.freeze(limits);

export const PLAN_LIMITS=Object.freeze({
 free:freezeLimits({cloudDesigns:50,dynamicLinks:50,hostedPages:50,uploadedAssets:100}),
 pro:freezeLimits({cloudDesigns:200,dynamicLinks:200,hostedPages:200,uploadedAssets:500}),
 brand:freezeLimits({cloudDesigns:500,dynamicLinks:500,hostedPages:500,uploadedAssets:1000})
});

export function limitsForPlan(tier){
 return Object.hasOwn(PLAN_LIMITS,tier)?PLAN_LIMITS[tier]:null;
}
