import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  initialState,LP_SAMPLES,INQUIRY_TOPICS,stats,registerEvent,submitInquiry,
  eventParticipants,saveEvent,setEventOpen,setInquiryHandled,cancelRegistration,
  prettyDate,selectMode
} from "../src/state.mjs";

const baseline=()=>initialState(new Date("2026-11-18T12:00:00Z"));
test("個人事業主向け初期状態はLP3本・イベント3件・申込3件・問い合わせ2件",()=>{
  const s=baseline();
  assert.equal(LP_SAMPLES.length,3);
  assert.deepEqual(LP_SAMPLES.map(x=>x.mode),["contact","contact","event"]);
  assert.equal(s.events.length,3);
  assert.equal(s.registrations.length,3);
  assert.equal(s.inquiries.length,2);
  assert.equal(stats(s).inquiries,1);
  assert.equal(stats(s).registrations,3);
  assert.equal(s.events[0].date,"2026-11-26");
});
test("イベント申込で参加数が増えて定員を超えず、キャンセルも管理画面へ反映",()=>{
  const s=baseline();
  const ev=s.events[0],before=eventParticipants(s,ev.id);
  const r=registerEvent(s,{eventId:ev.id,lpId:"lp-event"});
  assert.equal(eventParticipants(s,ev.id),before+1);
  assert.equal(s.registrations[0].id,r.id);
  assert.equal(s.latest.id,r.id);
  cancelRegistration(s,r.id);
  assert.equal(eventParticipants(s,ev.id),before);
  cancelRegistration(s,r.id);
  assert.equal(eventParticipants(s,ev.id),before+1);
});
test("定員と受付ON/OFFが実イベント予約をブロック",()=>{
  const s=baseline();
  const ev=s.events[0];
  saveEvent(s,{id:ev.id,title:ev.title,date:ev.date,time:ev.time,capacity:eventParticipants(s,ev.id)});
  assert.throws(()=>registerEvent(s,{eventId:ev.id}),/event_full/);
  setEventOpen(s,ev.id,false);
  assert.throws(()=>registerEvent(s,{eventId:ev.id}),/event_unavailable/);
  assert.throws(()=>saveEvent(s,{id:ev.id,title:ev.title,date:ev.date,time:ev.time,capacity:1}),/capacity_below_bookings/);
});
test("デモお問い合わせが新着一覧に追加される・架空情報のみを扱う",()=>{
  const s=baseline(),before=stats(s).inquiries;
  const item=submitInquiry(s,{topic:INQUIRY_TOPICS[0],lpId:"lp-content"});
  assert.equal(s.inquiries[0].id,item.id);
  assert.equal(stats(s).inquiries,before+1);
  assert.match(item.customer,/体験用のお客様/);
  setInquiryHandled(s,item.id,true);
  assert.equal(stats(s).inquiries,before);
  assert.throws(()=>submitInquiry(s,{topic:"<script>alert(1)</script>"}),/invalid_topic/);
});
test("イベント追加・編集はUIと同じ制約を守る",()=>{
  const s=baseline();
  const ev=saveEvent(s,{title:"試作ワークショップ",date:"2027-01-10",time:"11:00",capacity:20});
  assert.equal(s.events[0].title,"試作ワークショップ");
  const result=saveEvent(s,{id:ev.id,title:"新しいイベント",date:"2027-01-11",time:"14:30",capacity:10});
  assert.equal(result.title,"新しいイベント");
  assert.throws(()=>saveEvent(s,{title:"",date:"2027-01-10",time:"10:00",capacity:10}),/invalid_title/);
  assert.throws(()=>saveEvent(s,{title:"イベント名",date:"2027-02-30",time:"10:00",capacity:10}),/invalid_date/);
  assert.equal(prettyDate("2026-11-26"),"11月26日(木)");
});
test("フォーム種別は2種類のみ、操作はメモリ内",async()=>{
  const s=baseline();
  selectMode(s,"contact");assert.equal(s.selectedMode,"contact");
  assert.throws(()=>selectMode(s,"payments"),/invalid_mode/);
  const app=await readFile(new URL("../src/app.mjs",import.meta.url),"utf8");
  const state=await readFile(new URL("../src/state.mjs",import.meta.url),"utf8");
  for(const source of [app,state]){
    assert.doesNotMatch(source,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bXMLHttpRequest\b|\bsendBeacon\s*\(/);
  }
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  assert.match(html,/data-modal-mode="event"/);
  assert.match(html,/data-modal-mode="contact"/);
  assert.match(html,/demo@example.invalid/);
  assert.doesNotMatch(html,/type="email"|type="tel"/);
});
