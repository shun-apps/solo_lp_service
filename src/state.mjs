/** ハンドメイド作家向け操作デモ。架空のアトリエを想定し、データはブラウザメモリ内のみ。 */
export const LP_SAMPLES = Object.freeze([
  {id:"lp-content",title:"作品販売LP",category:"刺繍ブローチ・一点ものの作品販売",copy:"ひと針ずつ、想いを込めて。",mode:"contact"},
  {id:"lp-craft",title:"オーダー受付LP",category:"名入れ・色変更・大切な人への贈り物",copy:"世界にひとつ、あなたのために。",mode:"contact"},
  {id:"lp-event",title:"ワークショップ募集LP",category:"刺繍体験・オンラインレッスン",copy:"つくる時間が、好きになる。",mode:"event"}
]);
export const INQUIRY_TOPICS=Object.freeze([
  "作品のサイズ・素材について質問したい",
  "ギフト包装・発送について相談したい",
  "作品のオーダー制作について相談したい",
  "ワークショップの参加について質問したい"
]);
const clone=(x)=>JSON.parse(JSON.stringify(x));
const pad=(n)=>String(n).padStart(2,"0");
export function addDaysISO(dayOffset, now=new Date()){
  const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+dayOffset));
  return [d.getUTCFullYear(),pad(d.getUTCMonth()+1),pad(d.getUTCDate())].join("-");
}
export function prettyDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))throw Error("invalid_date");
  const [y,m,d]=iso.split("-").map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.toISOString().slice(0,10)!==iso)throw Error("invalid_date");
  return date.toLocaleDateString("ja-JP",{timeZone:"UTC",month:"long",day:"numeric",weekday:"short"});
}
const DEMO_NAME="糸と花のアトリエ（架空）";
export function initialState(now=new Date()){
  const dates=[addDaysISO(8,now),addDaysISO(16,now),addDaysISO(25,now)];
  return {
    businessName:DEMO_NAME,
    selectedMode:"event",
    events:[
      {id:"event1",title:"刺繍ブローチづくり体験会",date:dates[0],time:"10:00",capacity:8,open:true},
      {id:"event2",title:"はじめての手刺繍オンラインレッスン",date:dates[1],time:"14:00",capacity:12,open:true},
      {id:"event3",title:"季節の布花アクセサリーづくり",date:dates[2],time:"13:00",capacity:6,open:true}
    ],
    registrations:[
      {id:"reg1",eventId:"event1",lpId:"lp-event",customer:"体験用のお客様 A",status:"参加予定"},
      {id:"reg2",eventId:"event2",lpId:"lp-event",customer:"体験用のお客様 B",status:"参加予定"},
      {id:"reg3",eventId:"event1",lpId:"lp-event",customer:"体験用のお客様 C",status:"参加予定"}
    ],
    inquiries:[
      {id:"inq1",lpId:"lp-content",customer:"体験用のお客様 D",topic:INQUIRY_TOPICS[0],status:"未対応"},
      {id:"inq2",lpId:"lp-craft",customer:"体験用のお客様 E",topic:INQUIRY_TOPICS[2],status:"対応済み"}
    ],
    seq:10,
    latest:{type:"registration",id:"reg3"}
  };
}
export const eventParticipants=(s,id)=>s.registrations.filter(x=>x.eventId===id&&x.status==="参加予定").length;
export const stats=(s)=>({
  lps:LP_SAMPLES.length,
  events:s.events.filter(x=>x.open).length,
  registrations:s.registrations.filter(x=>x.status==="参加予定").length,
  inquiries:s.inquiries.filter(x=>x.status==="未対応").length
});
const eventById=(s,id)=>s.events.find(x=>x.id===id);
export function registerEvent(s,{eventId,lpId="lp-event"}){
  const ev=eventById(s,eventId);
  if(!ev||!ev.open)throw Error("event_unavailable");
  if(eventParticipants(s,eventId)>=ev.capacity)throw Error("event_full");
  if(!LP_SAMPLES.some(x=>x.id===lpId))throw Error("invalid_lp");
  const number=s.seq++;
  const reg={id:"reg"+number,eventId,lpId,customer:"体験用のお客様 "+number,status:"参加予定"};
  s.registrations.unshift(reg);
  s.latest={type:"registration",id:reg.id};
  return clone(reg);
}
export function submitInquiry(s,{topic,lpId="lp-content"}){
  if(!INQUIRY_TOPICS.includes(topic))throw Error("invalid_topic");
  if(!LP_SAMPLES.some(x=>x.id===lpId))throw Error("invalid_lp");
  const number=s.seq++;
  const inquiry={id:"inq"+number,lpId,customer:"体験用のお客様 "+number,topic,status:"未対応"};
  s.inquiries.unshift(inquiry);
  s.latest={type:"inquiry",id:inquiry.id};
  return clone(inquiry);
}
export function setInquiryHandled(s,id,handled){
  const q=s.inquiries.find(x=>x.id===id);
  if(!q)throw Error("inquiry_not_found");
  q.status=handled?"対応済み":"未対応";return q;
}
export function cancelRegistration(s,id){
  const r=s.registrations.find(x=>x.id===id);
  if(!r)throw Error("registration_not_found");
  r.status=r.status==="参加予定"?"キャンセル":"参加予定";
  if(r.status==="参加予定"){
    const ev=eventById(s,r.eventId);
    if(!ev?.open||eventParticipants(s,r.eventId)>ev.capacity){r.status="キャンセル";throw Error("event_full");}
  }
  return r;
}
function validTime(t){return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);}
export function saveEvent(s,{id,title,date,time,capacity}){
  if(typeof title!=="string"||title.trim().length<2||title.trim().length>80)throw Error("invalid_title");
  prettyDate(date);
  if(!validTime(time))throw Error("invalid_time");
  if(!Number.isInteger(capacity)||capacity<1||capacity>1000)throw Error("invalid_capacity");
  let ev=eventById(s,id);
  if(ev){
    if(capacity<eventParticipants(s,id))throw Error("capacity_below_bookings");
    Object.assign(ev,{title:title.trim(),date,time,capacity});
  }else{
    ev={id:"event"+s.seq++,title:title.trim(),date,time,capacity,open:true};
    s.events.unshift(ev);
  }
  return clone(ev);
}
export function setEventOpen(s,id,open){
  const ev=eventById(s,id);if(!ev)throw Error("event_not_found");
  ev.open=Boolean(open);return ev;
}
export function selectMode(s,mode){
  if(!["event","contact"].includes(mode))throw Error("invalid_mode");
  s.selectedMode=mode;
}
