import {billingStatus} from '@/lib/server/billing';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(r:Request){return billingStatus(r);}
