import React from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';

type Props={signedIn:boolean;busy:boolean;subscribed:boolean;planName:string;onChoose:()=>void};

/** Anonymous visitors get a real next step, never a disabled purchase button. */
export function BillingPlanAction({signedIn,busy,subscribed,planName,onChoose}:Props){
 if(!signedIn)return <Link className="primary-button" href="/account">Sign in to choose {planName}<ArrowUpRight size={17}/></Link>;
 return <button className="primary-button" disabled={busy} onClick={onChoose}>{busy?'Opening…':subscribed?'Manage your plan':`Choose ${planName}`}<ArrowUpRight size={17}/></button>;
}
