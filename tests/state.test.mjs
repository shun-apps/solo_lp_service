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
  assert.match(html,/id="experience-step-0"/);
  assert.match(html,/id="experience-step-4"/);
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

test("動画なしでダッシュボード直行、7メニュー全てに同トーンの説明帯",async()=>{
 const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
 const app=await readFile(new URL("../src/app.mjs",import.meta.url),"utf8");
 const css=await readFile(new URL("../demo-journey.css",import.meta.url),"utf8");
 const build=await readFile(new URL("../scripts/build.mjs",import.meta.url),"utf8");
 assert.match(html,/id="demo-shell"/);
 assert.doesNotMatch(html,/id="demo-shell" hidden/);
 assert.doesNotMatch(html,/<video|id="intro-video"|id="demo-intro"|id="start-demo"|id="back-to-intro"/);
 assert.doesNotMatch(build,/atelier-demo\.webm/);
 assert.doesNotMatch(app,/showIntro|showDemo|intro-video|start-demo|back-to-intro/);
 const descriptions={
  dashboard:"LPからどのくらい予約が入ったかが表示されます。",
  lp:"制作するLPの見本を確認できます。",
  events:"ワークショップの開催日時と定員を設定できます。",
  leads:"申込やオーダー相談を一覧で確認できます。",
  settings:"受付フォームの種類を切り替えられます。",
  mail:"自動返信メールの見本を確認できます。",
  profile:"ショップ名を変更できます。"
 };
 for(const [id,message] of Object.entries(descriptions)){
  const page=html.slice(html.indexOf('id="page-'+id+'"'));
  assert.match(page,new RegExp('class="guide-band guide-band--'+id+'"'));
  assert.ok(page.includes(message));
  assert.match(css,new RegExp('\\.guide-band--'+id+'\\s*\\{'));
 }
 assert.match(css,/guide-band--dashboard\s*\{ --guide-bg:#E3F0E8/);
 assert.doesNotMatch(css,/\.demo-intro|\.intro-video-wrap/);
 assert.match(html,/id="experience-step-0"/);
 assert.match(html,/id="experience-step-4"/);
 assert.match(html,/demo@example\.invalid/);
 assert.doesNotMatch(html,/id="confirm-checkbox"|id="modal-lp"|type="email"|type="tel"/);
 assert.match(app,/review-edit/);
 assert.match(app,/function validAttendees/);
 assert.match(css,/\.review-edit/);
 assert.doesNotMatch(html,/class="notice"/);
});
test("イベント受付の参加人数は残席と定員を超えない",()=>{
 const s=baseline(),ev=s.events[0],before=eventParticipants(s,ev.id);
 const r=registerEvent(s,{eventId:ev.id,lpId:"lp-event",attendeeCount:2});
 assert.equal(r.attendeeCount,2);
 assert.equal(eventParticipants(s,ev.id),before+2);
 assert.throws(()=>registerEvent(s,{eventId:ev.id,lpId:"lp-event",attendeeCount:ev.capacity}),/event_full/);
 assert.throws(()=>registerEvent(s,{eventId:ev.id,lpId:"lp-event",attendeeCount:0}),/invalid_attendee_count/);
});
