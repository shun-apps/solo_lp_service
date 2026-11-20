import test from "node:test";
import assert from "node:assert/strict";
import {emptyCustomerState,publicFormOptions,transitionCustomerState,customerLpCounts} from "../delivery/customer-rules.mjs";
import {INQUIRY_TOPICS} from "../src/state.mjs";

const update=(state,action,payload)=>transitionCustomerState(state,action,payload);
const event={title:"刺繍の体験レッスン",date:"2027-01-16",time:"13:00",capacity:2};

test("納品版の初期状態に架空の個人情報や予約を混入させない",()=>{
 const s=emptyCustomerState();
 assert.deepEqual(s.registrations,[]);
 assert.deepEqual(s.inquiries,[]);
 assert.deepEqual(s.events,[]);
 assert.equal(s.businessName,"");
 assert.deepEqual(customerLpCounts(s).map(x=>x.total),[0,0,0]);
});

test("公開フォームの情報は受付状況と連動し、実個人情報を公開しない",()=>{
 let s=emptyCustomerState();
 let r=update(s,"create_or_update_event",event);s=r.state;
 const id=r.result.id;
 const first=publicFormOptions(s,"lp-event");
 assert.equal(first.events[0].remaining,2);
 assert.equal(first.events[0].date,"2027-01-16");
 const registered=update(s,"submit_public_registration",{
   lpId:"lp-event",eventId:id,attendeeCount:2,name:"山田 花子",email:"Hana@example.com"
 });s=registered.state;
 assert.equal(s.registrations[0].customer,"山田 花子");
 assert.equal(s.registrations[0].email,"hana@example.com");
 assert.equal(registered.result.email,undefined);
 assert.equal(publicFormOptions(s,"lp-event").events[0].remaining,0);
 assert.equal(customerLpCounts(s)[2].total,1,"2人申込でも受付件数は1件");
 assert.doesNotMatch(JSON.stringify(publicFormOptions(s,"lp-event")),/Hana|山田|example\.com/);
 assert.throws(()=>update(s,"submit_public_registration",{
  lpId:"lp-event",eventId:id,attendeeCount:1,name:"別のお客様",email:"b@example.com"
 }),/event_full/);
 s=update(s,"set_event_open",{id,open:false}).state;
 assert.deepEqual(publicFormOptions(s,"lp-event").events,[]);
 assert.throws(()=>update(s,"submit_public_registration",{
  lpId:"lp-event",eventId:id,attendeeCount:1,name:"別のお客様",email:"b@example.com"
 }),/event_unavailable/);
 s=update(s,"set_event_open",{id,open:true}).state;
 assert.equal(publicFormOptions(s,"lp-event").events.length,1);
 const cancel=update(s,"toggle_registration",{id:registered.result.id});s=cancel.state;
 assert.equal(customerLpCounts(s)[2].total,0);
 assert.equal(publicFormOptions(s,"lp-event").events[0].remaining,2);
});

test("同じLPでイベント日程や人数を変更でき、公開フォームに直ちに反映される状態設計",()=>{
 let s=emptyCustomerState();
 const create=update(s,"create_or_update_event",event);s=create.state;
 s=update(s,"create_or_update_event",{id:create.result.id,title:event.title,date:"2027-02-07",time:"15:00",capacity:12}).state;
 const options=publicFormOptions(s,"lp-event");
 assert.equal(options.events[0].date,"2027-02-07");
 assert.equal(options.events[0].time,"15:00");
 assert.equal(options.events[0].remaining,12);
 assert.equal(s.events.length,1);
});

test("問い合わせは注文ではなく相談としてカウントし、対応済みにしても総数を保つ",()=>{
 let s=emptyCustomerState();
 const created=update(s,"submit_public_inquiry",{
  lpId:"lp-content",topic:INQUIRY_TOPICS[0],name:"相談者",email:"c@example.com"
 });s=created.state;
 assert.equal(customerLpCounts(s)[0].inquiries,1);
 s=update(s,"set_inquiry_handled",{id:created.result.id,handled:true}).state;
 assert.equal(customerLpCounts(s)[0].inquiries,1);
 assert.equal(s.inquiries[0].status,"対応済み");
 assert.throws(()=>update(s,"submit_public_inquiry",{lpId:"lp-event",topic:INQUIRY_TOPICS[0],name:"A",email:"a@example.com"}),/invalid_lp_or_form/);
});

test("納品するLPのURLをHTTPSだけで設定",()=>{
 let s=emptyCustomerState();
 s=update(s,"set_lp_url",{lpId:"lp-content",url:"https://example.com/s/1111"}).state;
 assert.equal(s.lpUrls["lp-content"],"https://example.com/s/1111");
 assert.throws(()=>update(s,"set_lp_url",{lpId:"lp-content",url:"javascript:alert(1)"}),/invalid_lp_url/);
 assert.throws(()=>update(s,"set_lp_url",{lpId:"lp-content",url:"http://example.com"}),/invalid_lp_url/);
 assert.throws(()=>update(s,"set_lp_url",{lpId:"lp-bogus",url:"https://example.com"}),/invalid_lp_or_form/);
});

test("架空デモから本番へ実個人情報が流入する経路を作らない",()=>{
 const s=emptyCustomerState();
 assert.throws(()=>update(s,"submit_public_inquiry",{lpId:"lp-content",topic:INQUIRY_TOPICS[0],name:"",email:"invalid"}),/invalid_customer_name/);
 assert.throws(()=>update(s,"submit_public_inquiry",{lpId:"lp-content",topic:INQUIRY_TOPICS[0],name:"name",email:"invalid"}),/invalid_customer_email/);
 assert.deepEqual(s.inquiries,[]);
});
