import {
 LP_SAMPLES, INQUIRY_TOPICS, initialState, prettyDate, addDaysISO, eventParticipants,
 stats, lpReceptionStats, registerEvent, submitInquiry, setInquiryHandled, cancelRegistration, saveEvent,
 setEventOpen, selectMode
} from "./state.mjs";

const $=id=>document.getElementById(id);
const create=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=String(text);if(cls)e.className=cls;return e};
const pages={dashboard:"ダッシュボード",lp:"LP管理",events:"ワークショップ管理",leads:"申込・オーダー相談",settings:"フォームの設定",mail:"自動返信メール",profile:"作家プロフィール"};
const modeLabel={event:"ワークショップ申込",contact:"オーダー相談"};
const CONTACT_PREVIEW="デモのお客様 様\n作品のご相談をお寄せいただきありがとうございます。\n内容を受け付けました。確認後にご案内します。\n（このメールは実際には送信されません）";
let s=initialState(),activePage="dashboard",leadTab="event";
let flow={mode:"event",step:0,eventId:null,attendeeCount:1,lpId:"lp-event",topic:INQUIRY_TOPICS[0],resultId:null};
let toastTimer=null;

function showToast(message){
 const el=$("toast");el.textContent=message;el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4000);
}
function go(id){
 if(!pages[id])return;
 activePage=id;
 for(const el of document.querySelectorAll(".page"))el.hidden=el.dataset.page!==id;
 for(const el of document.querySelectorAll("[data-page-go].nav"))el.classList.toggle("active",el.dataset.pageGo===id);
 $("page-name").textContent=pages[id];
 window.scrollTo({top:0,behavior:"instant"});
}
function lpName(id){return LP_SAMPLES.find(x=>x.id===id)?.title||"見本LP";}
function evById(id){return s.events.find(e=>e.id===id);}
function eventLabel(ev){return prettyDate(ev.date)+" "+ev.time;}
function totalSeats(ev){return Math.max(0,ev.capacity-eventParticipants(s,ev.id));}
function chip(label,kind="neutral"){return create("span",label,"pill "+kind)}
function safeButton(label,cls,callback){
 const b=create("button",label,cls);b.type="button";b.addEventListener("click",callback);return b;
}
function chooseExperience(mode,lpId){
 flow={mode,step:0,eventId:null,attendeeCount:1,lpId:lpId||LP_SAMPLES.find(x=>x.mode===mode)?.id||"lp-event",topic:INQUIRY_TOPICS[0],resultId:null};
 const modal=$("experience-dialog");
 renderExperience();
 if(!modal.open)modal.showModal();
 modal.scrollTop=0;
}
function openEventEditor(ev){
 $("edit-id").value=ev?.id||"";
 $("edit-title").textContent=ev?"ワークショップを編集":"新しいワークショップを作成";
 $("edit-name").value=ev?.title||"";
 $("edit-date").value=ev?.date||addDaysISO(14);
 $("edit-time").value=ev?.time||"10:00";
 $("edit-capacity").value=ev?.capacity||10;
 $("edit-status").textContent="";
 $("event-dialog").showModal();
}
function renderDashboard(){
 const x=stats(s);
 $("sidebar-name").textContent=s.businessName;
 $("stat-events").textContent=x.events+"件";
 $("stat-register").textContent=x.registrations+"件";
 $("stat-inquiry").textContent=x.inquiries+"件";
 const box=$("recent-leads");box.replaceChildren();
 const all=[
  ...s.registrations.map(r=>({kind:"event",id:r.id,person:r.customer,summary:evById(r.eventId)?.title||"ワークショップ",status:r.status})),
  ...s.inquiries.map(q=>({kind:"contact",id:q.id,person:q.customer,summary:q.topic,status:q.status}))
 ].sort((a,b)=>parseInt(b.id.replace(/\D/g,""))-parseInt(a.id.replace(/\D/g,""))).slice(0,5);
 for(const row of all){
  const el=create("div",null,"recent-row");
  const first=create("div",null,"recent-main");
  first.append(chip(modeLabel[row.kind],row.kind==="event"?"green":"blue"),create("strong",row.summary));
  first.append(create("small",row.person));
  el.append(first,chip(row.status,row.status==="未対応"?"amber":"neutral"));
  box.append(el);
 }
 const lpRows=lpReceptionStats(s);
 const max=Math.max(1,...lpRows.map(row=>row.total));
 const breakdown=$("lp-breakdown");
 breakdown.replaceChildren();
 for(const lp of lpRows){
  const entry=create("div",null,"lp-performance-row");
  entry.dataset.lpId=lp.id;
  const heading=create("div",null,"lp-performance-heading");
  const name=create("div",null,"lp-performance-name");
  name.append(create("strong",lp.title),create("small",lp.mode==="event"?"ワークショップ申込":"オーダー相談"));
  heading.append(name,create("strong",lp.total+"件","lp-performance-count"));
  const track=create("div",null,"lp-performance-track");
  const fill=create("span",null,"lp-performance-fill");
  fill.style.width=(lp.total/max*100)+"%";
  track.append(fill);
  entry.append(heading,track);
  breakdown.append(entry);
 }
}
function lpCard(lp,small=false){
 const card=create("article",null,small?"lp-tile":"lp-card");
 const visual=create("div",null,"lp-visual "+lp.id);
 visual.append(create("span","LOOK "+String(LP_SAMPLES.indexOf(lp)+1).padStart(2,"0"),"lp-visual-number"),create("span",lp.id==="lp-content"?"✿":lp.id==="lp-craft"?"✧":"❋","lp-ornament"),create("strong",lp.copy,"lp-visual-copy"));
 const info=create("div",null,"lp-card-details");
 info.append(create("span",lp.category,"kicker"),create("h3",lp.title));

 const actions=create("div",null,"lp-actions");

 actions.append(safeButton(lp.mode==="event"?"参加フォームへ →":"相談フォームへ →","text-action",()=>chooseExperience(lp.mode,lp.id)));
 info.append(actions);card.append(visual,info);
 return card;
}
function renderLps(){
 $("lp-cards").replaceChildren(...LP_SAMPLES.map(lp=>lpCard(lp,false)));
}
function renderEvents(){
 const root=$("events-list");root.replaceChildren();
 for(const ev of [...s.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))){
  const participants=eventParticipants(s,ev.id);
  const remaining=totalSeats(ev);
  const row=create("article",null,"event-row");
  const calendar=create("div",null,"event-date");
  const month=Number(ev.date.slice(5,7)),day=Number(ev.date.slice(8,10));
  calendar.append(create("small",month+"月"),create("strong",day));
  const details=create("div",null,"event-details");
  details.append(create("h3",ev.title),create("p",eventLabel(ev)+"　 / 定員 "+ev.capacity+"名 ・ 申込 "+participants+"名"));
  const bottom=create("div",null,"event-meta");
  bottom.append(chip(ev.open?(remaining?"受付中":"満席"):"受付停止",ev.open&&remaining?"green":"neutral"));
  bottom.append(create("span","残り "+remaining+"席","subtle"));
  details.append(bottom);
  const actions=create("div",null,"event-actions");
  actions.append(safeButton("編集","btn btn-light btn-small",()=>openEventEditor(ev)));
  actions.append(safeButton(ev.open?"受付を止める":"受付を再開","btn btn-outline btn-small",()=>{setEventOpen(s,ev.id,!ev.open);renderAll();showToast("受付状態を変更しました（デモ）。");}));
  actions.append(safeButton("申込を試す","btn btn-primary btn-small",()=>chooseExperience("event","lp-event")));
  row.append(calendar,details,actions);root.append(row);
 }
}
function renderLeads(){
 const isEvent=leadTab==="event";
 for(const b of document.querySelectorAll("[data-lead-tab]")){const active=b.dataset.leadTab===leadTab;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))}
 const rows=isEvent?s.registrations:s.inquiries;
 $("lead-count").textContent=rows.length+"件";
 const h=$("lead-headings");h.replaceChildren();
 const hr=create("tr");
 for(const t of (isEvent?["参加申込者（架空）","ワークショップ","流入LP","状態","操作"]:["ご相談者（架空）","オーダー相談内容","流入LP","状態","操作"]))hr.append(create("th",t));
 h.append(hr);
 const body=$("lead-rows");body.replaceChildren();
 for(const row of rows){
  const tr=create("tr");
  if(s.latest?.id===row.id)tr.classList.add("highlight");
  tr.append(create("td",row.customer,"bold-cell"));
  tr.append(create("td",isEvent?evById(row.eventId)?.title||"ワークショップ":row.topic));
  tr.append(create("td",lpName(row.lpId)));
  tr.append(create("td",null));
  tr.lastChild.append(chip(row.status,row.status==="未対応"?"amber":row.status==="参加予定"?"green":"neutral"));
  const cell=create("td");
  const action=isEvent?(row.status==="参加予定"?"キャンセル":"元に戻す"):(row.status==="未対応"?"対応済みにする":"未対応に戻す");
  cell.append(safeButton(action,"text-action",()=>{
   try{if(isEvent)cancelRegistration(s,row.id);else setInquiryHandled(s,row.id,row.status==="未対応");
    renderAll();showToast("状態を更新しました（デモ）。");
   }catch{showToast("定員・受付状態を確認してください。")}
  }));
  tr.append(cell);body.append(tr);
 }
 $("lead-empty").hidden=rows.length!==0;
}
function renderSettings(){
 for(const radio of document.querySelectorAll('[name="default-mode"]'))radio.checked=radio.value===s.selectedMode;
 $("setting-status").textContent="現在の既定フォーム：" + modeLabel[s.selectedMode] + "（このブラウザ内だけの設定です）";
}
function renderMails(){
 const reg=s.registrations[0],event=evById(reg?.eventId),inq=s.inquiries[0];
 $("event-mail").textContent=reg&&event?reg.customer+" 様\n"+event.title+" へのお申し込みありがとうございます。\n開催日：" + eventLabel(event)+"\n（実際には送信されません）":"参加申込を受け付けました（デモ）。";
 $("contact-mail").textContent=inq?inq.customer+" 様\n作品のご相談をお寄せいただきありがとうございます。\n内容："+inq.topic+"\n（実際には送信されません）":CONTACT_PREVIEW;
}
function renderAll(){
 renderDashboard();renderLps();renderEvents();renderLeads();renderSettings();renderMails();
 $("business-name").value=s.businessName;
}
function renderEventChoices(){
 const root=$("event-choices");root.replaceChildren();
 const choices=[...s.events].filter(e=>e.open).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 if(!choices.some(e=>e.id===flow.eventId&&totalSeats(e)>0))flow.eventId=choices.find(e=>totalSeats(e)>0)?.id||null;
 for(const ev of choices){
  const remaining=totalSeats(ev),active=flow.eventId===ev.id;
  const row=safeButton("","event-choice"+(active?" selected":""),()=>{
   if(!remaining)return;flow.eventId=ev.id;renderEventChoices();renderModalButtons();
  });
  row.disabled=remaining===0;
  row.setAttribute("aria-pressed",String(active));
  row.append(create("strong",ev.title),create("small",eventLabel(ev)+" ・ "+(remaining?"残り"+remaining+"席":"満席")));
  root.append(row);
 }
 if(!root.childElementCount)root.append(create("p","受付中のワークショップはありません。管理画面でワークショップを公開してください。","subtle"));
}
function validAttendees(){
 return flow.mode!=="event" || (
  Number.isInteger(flow.attendeeCount)&&flow.attendeeCount>=1&&flow.attendeeCount<=20&&
  flow.attendeeCount<=(evById(flow.eventId)?totalSeats(evById(flow.eventId)):0)
 );
}
function renderModalButtons(){
 const finalStep=flow.step===3;
 $("step-back").hidden=flow.step===0||flow.step===4;
 $("step-next").hidden=finalStep||flow.step===4;
 $("step-next").disabled=flow.step===0&&flow.mode==="event"&&(!flow.eventId||!validAttendees());
 $("step-send").hidden=!finalStep;
 $("experience-actions").hidden=flow.step===4;
}
function renderReview(){
 const rows=[["お名前","デモのお客様",1],["メール","demo@example.invalid",2]];
 if(flow.mode==="event"){
  const ev=evById(flow.eventId);
  rows.unshift(["ワークショップ",ev?.title||"未選択",0]);
  rows.push(["日時",ev?eventLabel(ev):"未選択",0],["人数",flow.attendeeCount+"名",0]);
 }else rows.unshift(["ご相談",flow.topic,0]);
 $("review-content").replaceChildren(...rows.map(([key,val,editStep])=>{
  const div=create("div",null,"review-row");
  const title=create("dt",key);
  const content=create("dd",val);
  const edit=safeButton("修正","review-edit",()=>{flow.step=editStep;renderExperience()});
  div.append(title,content,edit);return div;
 }));
}
function renderExperience(){
 for(let i=0;i<=4;i++)$("experience-step-"+i).hidden=flow.step!==i;
 $("experience-title").textContent=modeLabel[flow.mode];
 $("question-heading").textContent=flow.mode==="event"?"ワークショップを選ぶ":"ご相談内容を選ぶ";
 $("modal-topic").value=flow.topic;
 $("event-selection").hidden=flow.mode!=="event";
 $("contact-selection").hidden=flow.mode!=="contact";
 $("event-attendees").value=String(flow.attendeeCount);
 $("progress-bar").style.width=(flow.step===4?100:(flow.step+1)*25)+"%";
 $("progress-label").textContent=flow.step===4?"完了":(flow.step+1)+" / 4";
 $("progress-bar").parentElement.hidden=flow.step===4;
 $("progress-label").hidden=flow.step===4;
 $("select-status").textContent="";
 if(flow.mode==="event")renderEventChoices();
 if(flow.step===3)renderReview();
 renderModalButtons();
}
function submit(){
 if(flow.step!==3||!validAttendees())return;
 try{
  let result;
  if(flow.mode==="event"){
   result=registerEvent(s,{eventId:flow.eventId,lpId:flow.lpId,attendeeCount:flow.attendeeCount});
   const ev=evById(result.eventId);
   $("success-heading").textContent="ワークショップ申込を受け付けました";
   $("success-summary").textContent=ev.title;
   $("success-detail").textContent=eventLabel(ev)+" / 残り"+totalSeats(ev)+"席";
   $("success-mail").textContent=result.customer+" 様\nお申し込みありがとうございます。\n"+ev.title+"\n"+eventLabel(ev)+"\n（メール送信なし）";
  }else{
   result=submitInquiry(s,{topic:flow.topic,lpId:flow.lpId});
   $("success-heading").textContent="オーダー相談を受け付けました";
   $("success-summary").textContent=result.topic;
   $("success-detail").textContent="ご相談一覧に新着が1件追加されました";
   $("success-mail").textContent=result.customer+" 様\n作品のご相談をお寄せいただきありがとうございます。\n"+result.topic+"\n（メール送信なし）";
  }
  flow.resultId=result.id;flow.step=4;renderAll();renderExperience();
  $("experience-dialog").scrollTop=0;
 }catch(e){
  flow.step=0;renderExperience();
  $("select-status").textContent=e.message==="event_full"?"満席のため別のワークショップを選んでください。":"この内容では受け付けできません。選択を確認してください。";
 }
}
function bind(){
 document.querySelectorAll("[data-page-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.pageGo)));
 document.querySelectorAll("[data-try]").forEach(b=>b.addEventListener("click",()=>chooseExperience(b.dataset.try)));
 $("new-event").addEventListener("click",()=>openEventEditor());
 $("close-experience").addEventListener("click",()=>$("experience-dialog").close());
 $("close-event").addEventListener("click",()=>$("event-dialog").close());
 $("cancel-event").addEventListener("click",()=>$("event-dialog").close());


 $("modal-topic").addEventListener("change",e=>{flow.topic=e.target.value});
 $("step-next").addEventListener("click",()=>{if(flow.step===0&&flow.mode==="event"&&(!flow.eventId||!validAttendees()))return;if(flow.step<3){flow.step++;renderExperience();$("experience-dialog").scrollTop=0}});
 $("step-back").addEventListener("click",()=>{flow.step=Math.max(0,flow.step-1);renderExperience();$("experience-dialog").scrollTop=0});
 $("event-attendees").addEventListener("input",e=>{flow.attendeeCount=Number(e.target.value);renderModalButtons()});
 $("step-send").addEventListener("click",submit);
 $("view-result").addEventListener("click",()=>{
  $("experience-dialog").close();leadTab=flow.mode;renderLeads();go("leads");
  const highlighted=document.querySelector("#lead-rows tr.highlight");highlighted?.scrollIntoView({behavior:"smooth",block:"center"});
  showToast("受付が反映されました");
 });
 $("again").addEventListener("click",()=>chooseExperience(flow.mode==="event"?"contact":"event"));
 document.querySelectorAll("[data-lead-tab]").forEach(b=>b.addEventListener("click",()=>{leadTab=b.dataset.leadTab;renderLeads()}));
 document.querySelectorAll('[name="default-mode"]').forEach(r=>r.addEventListener("change",e=>{selectMode(s,e.target.value);renderSettings();showToast("フォームの既定値を変更しました（デモ）。")}));
 $("try-default").addEventListener("click",()=>chooseExperience(s.selectedMode));
 $("event-form").addEventListener("submit",e=>{
  e.preventDefault();
  try{saveEvent(s,{id:$("edit-id").value||null,title:$("edit-name").value,date:$("edit-date").value,time:$("edit-time").value,capacity:Number($("edit-capacity").value)});
   $("event-dialog").close();renderAll();showToast("ワークショップ設定を保存しました（デモ）。");
  }catch(err){
   const errors={invalid_title:"ワークショップ名を2〜80文字で入力してください。",invalid_date:"開催日が正しくありません。",invalid_capacity:"定員は1〜1,000名で、申込人数以上にしてください。",capacity_below_bookings:"定員は申込済み人数より少なくできません。"};
   $("edit-status").textContent=errors[err.message]||"入力内容を確認してください。";
  }
 });
 $("save-business").addEventListener("click",()=>{const v=$("business-name").value.trim();
  if(!v||v.length>40){showToast("事業者名は1〜40文字で設定してください。");return}
  s.businessName=v;renderAll();showToast("表示名を更新しました（デモ）。");
 });
 $("reset").addEventListener("click",()=>{
  if(!window.confirm("このブラウザで体験した変更を消して初期状態に戻しますか？"))return;
  s=initialState();leadTab="event";renderAll();go("dashboard");showToast("初期データに戻しました。");
 });
}
function init(){

 for(const topic of INQUIRY_TOPICS){const opt=create("option",topic);opt.value=topic;$("modal-topic").append(opt)}
 bind();renderAll();go("dashboard");
}
init();