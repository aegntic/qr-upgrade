import type { Metadata } from 'next';
import AccountPanel from '@/components/account-panel';
import '../account.css';
export const metadata:Metadata={title:'Your account | QR Upgrade',robots:{index:false,follow:false}};
export default function AccountPage(){return <AccountPanel/>;}
