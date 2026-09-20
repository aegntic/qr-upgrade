import { logout } from '@/lib/server/account';
export const runtime='nodejs';
export async function POST(request:Request) { return logout(request); }
