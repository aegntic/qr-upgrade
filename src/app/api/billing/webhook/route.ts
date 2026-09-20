import {billingWebhook} from '@/lib/server/billing';
export const runtime='nodejs';
export function POST(r:Request){return billingWebhook(r);}
