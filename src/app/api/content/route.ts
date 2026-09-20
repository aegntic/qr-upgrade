import {contentProxy} from '@/lib/server/content';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(r:Request){return contentProxy(r);}
export async function POST(r:Request){return contentProxy(r);}
