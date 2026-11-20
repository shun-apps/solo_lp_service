import test from "node:test";
import assert from "node:assert/strict";
import worker from "../delivery/worker.mjs";
import {emptyCustomerState} from "../delivery/customer-rules.mjs";

function mockEnv(){
 let row={version:0,data:JSON.stringify(emptyCustomerState())};
 const DB={prepare(sql){
  if(sql.startsWith("SELECT"))return {first:async()=>({...row})};
  if(sql.startsWith("UPDATE"))return {bind(data,version){return {run:async()=>{
   if(row.version!==version)return {success:true,meta:{changes:0}};
   row={version:version+1,data};
   return {success:true,meta:{changes:1}};
  }}}};
  throw Error("unsupported mock query");
 }};
 const ASSETS={fetch:async request=>new Response("ASSET "+new URL(request.url).pathname)};
 return {DB,ASSETS,ADMIN_USERNAME:"owner",ADMIN_PASSWORD:"example-secret"};
}
const base="https://atelier.test";
const credentials="Basic "+btoa("owner:example-secret");
const authorized={Authorization:credentials};
const call=(env,path,method="GET",data,headers={})=>worker.fetch(new Request(base+path,{
 method,
 headers:{...(data===undefined?{}:{"Content-Type":"application/json",Origin:base}),...headers},
 ...(data===undefined?{}:{body:JSON.stringify(data)})
}),env);
test("顧客の管理画面・状態APIに認証が必要",async()=>{
 const env=mockEnv();
 assert.equal((await call(env,"/admin/")).status,401);
 assert.equal((await call(env,"/api/admin/state")).status,401);
 const allowed=await call(env,"/api/admin/state","GET",undefined,authorized);
 assert.equal(allowed.status,200);
 const data=await allowed.json();
 assert.deepEqual(data.state.events,[]);
 assert.deepEqual(data.state.registrations,[]);
 const unconfigured={...env,ADMIN_PASSWORD:undefined};
 assert.equal((await call(unconfigured,"/admin/")).status,503);
});

test("納品版APIでイベントを更新すると公開フォームの残席・日時も更新",async()=>{
 const env=mockEnv();
 const created=await call(env,"/api/admin/action","POST",{
  action:"create_or_update_event",payload:{title:"刺繍教室",date:"2027-06-10",time:"11:00",capacity:2}
 },authorized);
 assert.equal(created.status,200);
 const id=(await created.json()).result.id;
 const publicBefore=await (await call(env,"/api/public/form/lp-event")).json();
 assert.equal(publicBefore.events[0].remaining,2);
 const registered=await call(env,"/api/public/submit/lp-event","POST",{
  eventId:id,attendeeCount:1,name:"本物のお客様",email:"customer@example.com"
 });
 assert.equal(registered.status,200);
 const publicAfter=await (await call(env,"/api/public/form/lp-event")).json();
 assert.equal(publicAfter.events[0].remaining,1);
 assert.doesNotMatch(JSON.stringify(publicAfter),/customer@example\.com|本物のお客様/);
 const stop=await call(env,"/api/admin/action","POST",{action:"set_event_open",payload:{id,open:false}},authorized);
 assert.equal(stop.status,200);
 assert.deepEqual((await (await call(env,"/api/public/form/lp-event")).json()).events,[]);
 const blocked=await call(env,"/api/public/submit/lp-event","POST",{
  eventId:id,attendeeCount:1,name:"二人目",email:"second@example.com"
 });
 assert.equal(blocked.status,409);
 const bookingState=await (await call(env,"/api/admin/state","GET",undefined,authorized)).json();
 assert.equal(bookingState.state.registrations.length,1);
 assert.equal(bookingState.state.registrations[0].customer,"本物のお客様");
});

test("公開フォームのPOSTは同一オリジン必須・APIと静的ファイル以外を拒否",async()=>{
 const env=mockEnv();
 const untrusted=await call(env,"/api/public/submit/lp-content","POST",{
  topic:"作品のサイズ・素材について質問したい",name:"相談者",email:"c@example.com"
 },{Origin:"https://evil.test"});
 assert.equal(untrusted.status,403);
 assert.equal((await call(env,"/form/lp-event")).status,200);
 assert.equal((await call(env,"/delivery/worker.mjs")).status,404);
 assert.equal((await call(env,"/delivery/customer-rules.mjs")).status,404);
 const adminBad=await call(env,"/api/admin/action","POST",{
  action:"submit_public_inquiry",payload:{}
 },authorized);
 assert.equal(adminBad.status,403);
});
