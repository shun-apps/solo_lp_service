/* 納品版：同じ管理画面マークアップとCSSを、認証済みD1データで動かす。 */
const $=id=>document.getElementById(id);
const elem=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const btn=(text,cls,fn)=>{const b=elem("button",text,cls);b.type="button";b.onclick=fn;return b};
const LP=[{id:"lp-content",name:"作品販売LP",mode:"contact",copy:"ひと針ずつ、想いを込めて。"},
 {id:"lp-craft",name:"オーダー受付LP",mode:"contact",copy:"世界にひとつ、あなたのために。"},
 {id:"lp-event",name:"ワークショップ募集LP",mode:"event",copy:"つくる時間が、好きになる。"}];
const pages={dashboard:"ダッシュボード",lp:"LP管理",events:"ワークショップ管理",leads:"申込・オーダー相談",settings:"フォームの設定",mail:"メール通知",profile:"作家プロフィール"};
let s=null,current="dashboard",leadTab="event",saving=false;
function notice(message){const t=$("toast");t.textContent=message;t.hidden=false;setTimeout(()=>t.hidden=true,4000)}
async function api(path,config={}){
 const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...config});
 const data=await r.json().catch(()=>({error:"server_unavailable"}));
 if(!r.ok||data.error)throw Error(data.error||"request_failed");return data;
}
async function reload(){const d=await api("/api/admin/state");s=d.state;render()}
async function change(action,payload){
 if(saving)return;saving=true;
 try{await api("/api/admin/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload})});await reload();notice("保存しました")}
 catch(e){notice("保存できません："+e.message);throw e}
 finally{saving=false}
}
function go(page){
 if(!pages[page])return;current=page;
 document.querySelectorAll(".page").forEach(n=>n.hidden=n.dataset.page!==page);
 document.querySelectorAll(".nav[data-page-go]").forEach(n=>n.classList.toggle("active",n.dataset.pageGo===page));
 $("page-name").textContent=pages[page];window.scrollTo({top:0,behavior:"instant"});
}
const seats=e=>s.registrations.filter(r=>r.eventId===e.id&&r.status==="参加予定").reduce((a,r)=>a+(r.attendeeCount||1),0);
const lpCount=lp=>s.registrations.filter(r=>r.lpId===lp.id&&r.status==="参加予定").length+s.inquiries.filter(q=>q.lpId===lp.id).length;
function badge(status){return elem("span",status,"pill "+(status==="未対応"?"amber":status==="参加予定"?"green":"neutral"))}
function dashboard(){
 $("stat-events").textContent=s.events.filter(e=>e.open).length+"件";
 $("stat-register").textContent=s.registrations.filter(r=>r.status==="参加予定").length+"件";
 $("stat-inquiry").textContent=s.inquiries.filter(q=>q.status==="未対応").length+"件";
 const all=[...s.registrations.map(r=>({id:r.id,summary:s.events.find(e=>e.id===r.eventId)?.title||"ワークショップ",kind:"ワークショップ",person:r.customer,status:r.status})),...s.inquiries.map(q=>({id:q.id,summary:q.topic,kind:"相談",person:q.customer,status:q.status}))];
 all.sort((a,b)=>Number(String(b.id).replace(/\D/g,""))-Number(String(a.id).replace(/\D/g,"")));
 const recent=$("recent-leads");recent.replaceChildren();
 for(const x of all.slice(0,5)){
  const row=elem("div",null,"recent-row"),info=elem("div",null,"recent-main");
  info.append(elem("span",x.kind,"pill neutral"),elem("strong",x.summary),elem("small",x.person));
  row.append(info,badge(x.status));recent.append(row);
 }
 if(!all.length)recent.append(elem("p","まだ受付はありません。","panel-body subtle"));
 const chart=$("lp-breakdown"),max=Math.max(1,...LP.map(lpCount));chart.replaceChildren();
 for(const lp of LP){
  const count=lpCount(lp),row=elem("div",null,"lp-performance-row"),head=elem("div",null,"lp-performance-heading"),name=elem("div",null,"lp-performance-name");
  row.dataset.lpId=lp.id;name.append(elem("strong",lp.name),elem("small",lp.mode==="event"?"ワークショップ申込":"オーダー相談"));
  head.append(name,elem("strong",count+"件","lp-performance-count"));
  const track=elem("div",null,"lp-performance-track"),fill=elem("span",null,"lp-performance-fill");
  fill.style.width=count/max*100+"%";track.append(fill);row.append(head,track);chart.append(row);
 }
}
function lps(){
 const root=$("lp-cards");root.replaceChildren();
 for(const lp of LP){
  const card=elem("article",null,"lp-card"),visual=elem("div",null,"lp-visual "+lp.id);
  visual.append(elem("span","LOOK "+(LP.indexOf(lp)+1).toString().padStart(2,"0"),"lp-visual-number"),elem("span","✿","lp-ornament"),elem("strong",lp.copy,"lp-visual-copy"));
  const details=elem("div",null,"lp-card-details"),link=s.lpUrls?.[lp.id];
  details.append(elem("span","公開LP","kicker"),elem("h3",lp.name));
  const actions=elem("div",null,"lp-actions");
  if(link){const a=elem("a","LPを見る →","text-action lp-view-action");a.href=link;a.target="_blank";a.rel="noopener noreferrer";actions.append(a)}
  else actions.append(elem("span","公開LP未登録","subtle"));
  details.append(actions);
  const lab=elem("label","納品済みLPのURL","field-label"),input=elem("input",null,"field");
  input.type="url";input.value=link||"";input.placeholder="https://...";
  lab.append(input);details.append(lab);
  details.append(btn("URLを保存","btn btn-outline btn-small",async()=>{try{await change("set_lp_url",{lpId:lp.id,url:input.value})}catch{}}));
  const form=elem("div",null,"lp-live-form");
  form.append(elem("p","このLPに設置する受付フォームURL","subtle"));
  const f=elem("input",null,"field");f.readOnly=true;f.value=location.origin+"/form/"+lp.id;
  form.append(f);details.append(form);card.append(visual,details);root.append(card);
 }
}
function editEvent(e){
 $("edit-id").value=e?.id||"";$("edit-title").textContent=e?"ワークショップを編集":"ワークショップを追加";
 $("edit-name").value=e?.title||"";$("edit-date").value=e?.date||"";$("edit-time").value=e?.time||"10:00";
 $("edit-capacity").value=e?.capacity||10;$("edit-status").textContent="";$("event-dialog").showModal();
}
function events(){
 const root=$("events-list");root.replaceChildren();
 for(const e of [...s.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))){
  const item=elem("article",null,"event-row"),date=elem("div",null,"event-date");
  date.append(elem("small",Number(e.date.slice(5,7))+"月"),elem("strong",Number(e.date.slice(8,10))));
  const info=elem("div",null,"event-details"),rem=Math.max(0,e.capacity-seats(e));
  info.append(elem("h3",e.title),elem("p",e.date+"　"+e.time+" / 定員"+e.capacity+"名 ・申込"+seats(e)+"名"));
  const meta=elem("div",null,"event-meta");meta.append(badge(!e.open?"受付停止":rem?"受付中":"満席"),elem("span","残り"+rem+"席","subtle"));info.append(meta);
  const actions=elem("div",null,"event-actions");
  actions.append(btn("編集","btn btn-light btn-small",()=>editEvent(e)));
  actions.append(btn(e.open?"受付を止める":"受付を再開","btn btn-outline btn-small",async()=>{try{await change("set_event_open",{id:e.id,open:!e.open})}catch{}}));
  item.append(date,info,actions);root.append(item);
 }
 if(!s.events.length)root.append(elem("p","イベントを追加すると、公開フォームに反映されます。","panel-body subtle"));
}
function leads(){
 const isEvent=leadTab==="event",records=isEvent?s.registrations:s.inquiries;
 document.querySelectorAll("[data-lead-tab]").forEach(b=>{b.classList.toggle("active",b.dataset.leadTab===leadTab);b.setAttribute("aria-pressed",String(b.dataset.leadTab===leadTab))});
 $("lead-count").textContent=records.length+"件";const tr=elem("tr");
 for(const heading of (isEvent?["申込者","イベント","流入LP","状態","操作"]:["相談者","相談内容","流入LP","状態","操作"]))tr.append(elem("th",heading));
 $("lead-headings").replaceChildren(tr);
 const body=$("lead-rows");body.replaceChildren();
 for(const r of records){
  const row=elem("tr"),topic=isEvent?s.events.find(e=>e.id===r.eventId)?.title||"イベント":r.topic,lp=LP.find(l=>l.id===r.lpId)?.name||"—";
  row.append(elem("td",r.customer,"bold-cell"),elem("td",topic),elem("td",lp));
  const status=elem("td");status.append(badge(r.status));row.append(status);
  const action=elem("td");
  action.append(btn(isEvent?(r.status==="参加予定"?"キャンセル":"元に戻す"):(r.status==="未対応"?"対応済みにする":"未対応に戻す"),"text-action",async()=>{
   try{await change(isEvent?"toggle_registration":"set_inquiry_handled",isEvent?{id:r.id}:{id:r.id,handled:r.status==="未対応"})}catch{}
  }));
  row.append(action);body.append(row);
 }
 $("lead-empty").hidden=records.length!==0;
}
function forms(){
 const root=$("page-settings");if(root.dataset.deliveryInitialized)return;root.dataset.deliveryInitialized="1";
 root.querySelector(".split")?.remove();
 const split=elem("div",null,"split");
 for(const config of [{id:"lp-event",name:"イベント予約フォーム"},{id:"lp-content",name:"お問い合わせフォーム"},{id:"lp-craft",name:"オーダー受付フォーム"}]){
  const card=elem("section",null,"panel"),header=elem("div",null,"panel-head"),body=elem("div",null,"panel-body");
  header.append(elem("h2",config.name));body.append(elem("p","このURLを納品するLPの予約・お問い合わせボタンに設定します。","subtle"));
  const f=elem("input",null,"field");f.readOnly=true;f.value=location.origin+"/form/"+config.id;
  const a=elem("a","公開フォームを見る →","text-action");a.href="/form/"+config.id;a.target="_blank";a.rel="noopener noreferrer";
  body.append(f,a);card.append(header,body);split.append(card);
 }
 root.append(split);
}
function profile(){
 $("business-name").value=s.businessName||"";
 $("sidebar-name").textContent=s.businessName||"ショップ名未設定";
 document.querySelector(".business-avatar").textContent=(s.businessName||"店").slice(0,1);
}
function emails(){
 const root=$("page-mail");root.querySelector(".split")?.remove();
 root.querySelector(".guide-band").textContent="自動メール送信は現在準備中です。設定・実送信はまだできません。";
}
function render(){dashboard();lps();events();leads();forms();profile();emails();go(current)}
async function init(){
 document.querySelectorAll("[data-page-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.pageGo)));
 $("new-event").addEventListener("click",()=>editEvent());
 $("close-event").onclick=()=>$("event-dialog").close();
 $("cancel-event").onclick=()=>$("event-dialog").close();
 $("event-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const p={id:$("edit-id").value||null,title:$("edit-name").value,date:$("edit-date").value,time:$("edit-time").value,capacity:Number($("edit-capacity").value)};
  try{await change("create_or_update_event",p);$("event-dialog").close()}catch{$("edit-status").textContent="申込者がいるイベントの日時は変更できません。新しい日程はイベントを追加してください。"}
 });
 document.querySelectorAll("[data-lead-tab]").forEach(b=>b.onclick=()=>{leadTab=b.dataset.leadTab;leads()});
 $("save-business").onclick=async()=>{try{await change("set_shop_name",{name:$("business-name").value})}catch{}};
 try{await reload()}catch(e){$("main").replaceChildren(elem("p","データを読み込めません："+e.message,"subtle"))}
}
init();