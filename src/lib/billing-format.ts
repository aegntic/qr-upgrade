// Stripe charge units differ from ISO display units for these legacy currencies.
// https://docs.stripe.com/currencies#special-cases
export function formatBillingAmount(amount:number,currency:string,locale?:string){
 const formatter=new Intl.NumberFormat(locale,{style:'currency',currency});
 const decimals=['isk','ugx','huf','twd'].includes(currency.toLowerCase())?2:(formatter.resolvedOptions().maximumFractionDigits??2);
 return formatter.format(amount/10**decimals);
}
