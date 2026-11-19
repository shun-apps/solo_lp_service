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

test("3つのLPと受付サンプルは架空のハンドメイドアトリエに統一",async()=>{
  const s=baseline();
  assert.equal(s.businessName,"糸と花のアトリエ（架空）");
  assert.deepEqual(LP_SAMPLES.map(x=>x.title),["作品販売LP","オーダー受付LP","ワークショップ募集LP"]);
  assert.ok(s.events.every(x=>/刺繍|布花/.test(x.title)));
  assert.ok(INQUIRY_TOPICS.some(x=>x.includes("オーダー制作")));
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const theme=await readFile(new URL("../theme-handmade.css",import.meta.url),"utf8");
  const base=await readFile(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(html,/ハンドメイド作家/);
  assert.match(html,/ワークショップ申込/);
  assert.match(html,/オーダー相談/);
  assert.match(html,/theme-handmade\.css/);
  assert.match(theme,/#964A64/i);
  assert.match(theme,/#F2F0EF/i);
  assert.match(theme,/#397C7D/i);
  assert.doesNotMatch(theme,/#F1EAF3|#D9C9DE|#C8B6D4|#F3EDF5|#F0E9F4|#FFFDFC|#FFFCFB|radial-gradient/i);
  assert.match(html,/class="business-id shop-header"/);
  assert.doesNotMatch(html,/class="brand"/);
  assert.doesNotMatch(html,/class="brand-icon"/);
  assert.match(theme,/\.lp-ornament/);
  assert.match(base,/\.sidebar/);
  assert.match(base,/\.metrics/);
});

test("読みやすい文字サイズと配色は独立テーマで維持",async()=>{
  const theme=await readFile(new URL("../theme-handmade.css",import.meta.url),"utf8");
  assert.match(theme,/\.shop-header \.shop-header-text strong\s*\{ font-size: 16px/);
  assert.match(theme,/\.nav\s*\{ font-size: 15px/);
  assert.match(theme,/h1, \.page-head h1\s*\{ font-size: 26px/);
  assert.match(theme,/\.page-head p, \.panel-head p\s*\{ font-size: 14px/);
  assert.match(theme,/\.metric>p\s*\{ font-size: 13px/);
  assert.match(theme,/@media \(max-width: 480px\)/);
  assert.match(theme,/#F2F0EF/i);
  assert.match(theme,/#397C7D/i);
  assert.match(theme,/#964A64/i);
});

test("V2に合わせた1問1画面フォームと動画前段が存在し、個人情報は架空データのみ",async()=>{
 const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
 const css=await readFile(new URL("../experience.css",import.meta.url),"utf8");
 const worker=await readFile(new URL("../worker/index.mjs",import.meta.url),"utf8");
 assert.match(html,/id="demo-intro"/);
 assert.match(html,/id="intro-video"/);
 assert.match(html,/id="start-experience"/);
 assert.match(html,/id="demo-shell" hidden/);
 for(let i=0;i<=4;i++)assert.match(html,new RegExp('id="experience-step-'+i+'"'));
 assert.match(html,/id="demo-name"[^>]+readonly/);
 assert.match(html,/id="demo-email"[^>]+readonly/);
 assert.match(html,/id="review-content"/);
 assert.match(css,/experience-mode/);
 assert.match(worker,/media-src 'self'/);
 assert.doesNotMatch(html,/type="email"|type="tel"/);
});
test("イベント参加人数の選択が残席とキャンセルに反映される",()=>{
 const s=baseline();
 const id=s.events[0].id;
 const before=eventParticipants(s,id);
 const reg=registerEvent(s,{eventId:id,attendeeCount:3});
 assert.equal(reg.attendeeCount,3);
 assert.equal(eventParticipants(s,id),before+3);
 cancelRegistration(s,reg.id);
 assert.equal(eventParticipants(s,id),before);
 assert.throws(()=>registerEvent(s,{eventId:id,attendeeCount:11}),/invalid_attendees/);
 assert.throws(()=>registerEvent(s,{eventId:id,attendeeCount:0}),/invalid_attendees/);
});
