import {linksProxy} from '@/lib/server/links';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(r:Request){return linksProxy(r);}
export function POST(r:Request){return linksProxy(r);}
