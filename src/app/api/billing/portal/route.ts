import {billingAction} from '@/lib/server/billing';
export const runtime='nodejs';
export function POST(r:Request){return billingAction(r,'portal');}
