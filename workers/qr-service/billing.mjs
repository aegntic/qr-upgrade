// Dispatcher must verify SERVICE_SECRET before calling this private handler.
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const customer=/^cus_[A-Za-z0-9]{1,180}$/;
const token=/^[a-f0-9]{32}$/;
const events=new Set(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed']);
export async function billingRequest(r,env){
 try {
  const path=new URL(r.url).pathname;
  if(path==='/billing/events'&&r.method==='POST'){
   const b=await r.json();
   if(!/^evt_[A-Za-z0-9]{1,180}$/.test(b.id)||!events.has(b.type)||!Number.isSafeInteger(b.created)||b.created<0||!customer.test(b.customerId)||!['test','live'].includes(b.mode)||(b.subscriptionId!==null&&!/^sub_[A-Za-z0-9]{1,180}$/.test(b.subscriptionId)))return reply({error:'Invalid event'},400);
   const binding=await env.DB.prepare('SELECT owner FROM billing_customers WHERE customer_id=? AND mode=?').bind(b.customerId,b.mode).first();
   if(!binding)return reply({ignored:true});
   await env.DB.prepare('INSERT INTO billing_events(id,type,created,customer_id,subscription_id,mode) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(b.id,b.type,b.created,b.customerId,b.subscriptionId,b.mode).first();
   return reply({recorded:true});
  }
  const owner=r.headers.get('x-qr-user');
  if(!/^[a-f0-9]{64}$/.test(owner||''))return reply({error:'Invalid owner'},401);
  if(path==='/billing'&&r.method==='GET')return reply({binding:await env.DB.prepare('SELECT * FROM billing_customers WHERE owner=?').bind(owner).first()});
  if(path==='/billing/customer'&&r.method==='PUT'){
   const b=await r.json();if(!customer.test(b.customerId)||!['test','live'].includes(b.mode))return reply({error:'Invalid customer'},400);
   await env.DB.prepare('INSERT INTO billing_customers(owner,customer_id,mode) VALUES(?,?,?) ON CONFLICT DO NOTHING RETURNING owner').bind(owner,b.customerId,b.mode).first();
   const row=await env.DB.prepare('SELECT * FROM billing_customers WHERE owner=?').bind(owner).first();
   return row?.customer_id===b.customerId&&row?.mode===b.mode?reply({binding:row}):reply({error:'Customer binding conflict'},409);
  }
  if(path==='/billing/checkout'&&r.method==='POST'){
   const b=await r.json(),now=Math.floor(Date.now()/1000);
   if(!token.test(b.token))return reply({error:'Invalid reservation'},400);
   let row;
   if(b.action==='reserve'&&['pro','brand'].includes(b.tier)){
    // A retry takes over the lease but preserves the original reservation and tier.
    row=await env.DB.prepare('UPDATE billing_customers SET reservation=COALESCE(reservation,?),tier=COALESCE(tier,?),reserved_at=COALESCE(reserved_at,?),lease_until=? WHERE owner=? AND lease_until<=? RETURNING *').bind(b.token,b.tier,now,now+60,owner,now).first();
   }else if(b.action==='finalize'&&/^cs_[A-Za-z0-9_]{1,200}$/.test(b.sessionId)){
    row=await env.DB.prepare('UPDATE billing_customers SET session_id=?,lease_until=0 WHERE owner=? AND reservation=? RETURNING *').bind(b.sessionId,owner,b.token).first();
   }else if(b.action==='release'){
    row=await env.DB.prepare('UPDATE billing_customers SET reservation=NULL,tier=NULL,reserved_at=NULL,session_id=NULL,lease_until=0 WHERE owner=? AND reservation=? RETURNING *').bind(owner,b.token).first();
   }else return reply({error:'Invalid action'},400);
   return row?reply({binding:row}):reply({error:'Checkout busy'},409);
  }
  return reply({error:'Not found'},404);
 }catch{return reply({error:'Billing storage unavailable'},503);}
}
