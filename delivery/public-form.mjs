/* 公開フォーム：デモの架空入力ではなく、お客様が実際に入力して保存する画面。 */
const $=id=>document.getElementById(id);
const lpId=location.pathname.match(/^\/form\/(lp-content|lp-craft|lp-event)\/?$/)?.[1];
let config=null,step=0,submitting=false;
const dom=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const err=text=>{$("error").textContent=text||""};
const chosen=()=>document.querySelector('input[name="item"]:checked')?.value;
function show(){
 for(let i=0;i<5;i++)$("step-"+i).hidden=step!==i;
 $("back").hidden=step===0||step===4;
 $("next").hidden=step>=3;
 $("submit").hidden=step!==3;
 $("actions").hidden=step===4;
 $("progress-label").textContent=step===4?"完了":(step+1)+" / 4";
 $("progress-bar").style.width=(step===4?100:(step+1)*25)+"%";
 err("");
}
function makeChoice(value,label,description,disabled=false){
 const outer=dom("label",null,"public-option"),input=dom("input");
 input.type="radio";input.name="item";input.value=value;input.required=true;input.disabled=disabled;
 const content=dom("div");
 content.append(dom("strong",label),dom("p",description,"subtle"));
 outer.append(input,content);return outer;
}
function renderChoices(){
 const root=$("choices");root.replaceChildren();
 if(config.lp.mode==="event"){
  for(const e of config.events){
   root.append(makeChoice(e.id,e.title,e.date+"　"+e.time+"　残り"+e.remaining+"席",e.remaining===0));
  }
  if(!config.events.length)root.append(dom("p","現在、受付中のワークショップはありません。","subtle"));
  $("attendee-row").hidden=false;
  $("type-heading").textContent="ワークショップを選ぶ";
 }else{
  config.topics.forEach((topic,i)=>root.append(makeChoice(topic,topic,"")));
  $("attendee-row").hidden=true;
  $("type-heading").textContent="ご相談の内容を選ぶ";
 }
}
function review(){
 const root=$("review");root.replaceChildren();
 const rows=[
  [config.lp.mode==="event"?"イベント":"ご相談",config.lp.mode==="event"?(config.events.find(e=>e.id===chosen())?.title||"未選択"):chosen()],
  ...(config.lp.mode==="event"?[["参加人数",$("attendees").value+"名"]]:[]),
  ["お名前",$("customer-name").value.trim()],
  ["メールアドレス",$("customer-email").value.trim()]
 ];
 for(const [label,value] of rows){
  const row=dom("div",null,"review-row");row.append(dom("dt",label),dom("dd",value));root.append(row);
 }
}
function validate(){
 if(step===0){
  if(!chosen())return "内容を選んでください。";
  if(config.lp.mode==="event"){
   const participants=Number($("attendees").value),event=config.events.find(e=>e.id===chosen());
   if(!Number.isInteger(participants)||participants<1||participants>20||!event||participants>event.remaining)return "残席数以内の参加人数を入力してください。";
  }
 }
 if(step===1&&(!$("customer-name").value.trim()||$("customer-name").value.trim().length>80))return "お名前を入力してください。";
 if(step===2&&!$("customer-email").checkValidity())return "メールアドレスを確認してください。";
 return "";
}
async function fetchJson(url,options={}){
 const r=await fetch(url,{cache:"no-store",...options});
 const data=await r.json().catch(()=>({error:"server_unavailable"}));
 if(!r.ok||data.error)throw Error(data.error||"request_failed");
 return data;
}
async function load(){
 if(!lpId){err("無効なフォームURLです。");$("actions").hidden=true;return}
 try{
  config=await fetchJson("/api/public/form/"+lpId);
  $("form-title").textContent=config.lp.mode==="event"?"ワークショップ申込":"お問い合わせ";
  $("form-notice").textContent=config.lp.mode==="event"?"開催日と人数をお選びください。":"お問い合わせ内容をご入力ください。";
  renderChoices();show();
 }catch(e){err("現在受付できません。時間をおいてお試しください。");$("actions").hidden=true}
}
$("next").addEventListener("click",()=>{
 const message=validate();if(message){err(message);return}
 step++;if(step===3)review();show();
});
$("back").addEventListener("click",()=>{step=Math.max(0,step-1);show()});
$("form").addEventListener("submit",async e=>{
 e.preventDefault();if(submitting||step!==3)return;
 submitting=true;$("submit").disabled=true;err("");
 const item={
  name:$("customer-name").value.trim(),
  email:$("customer-email").value.trim(),
  ...(config.lp.mode==="event"?{eventId:chosen(),attendeeCount:Number($("attendees").value)}:{topic:chosen()})
 };
 try{
  await fetchJson("/api/public/submit/"+lpId,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item)});
  step=4;show();
 }catch(e){
  if(e.message==="event_full"||e.message==="event_unavailable"){
   step=0;
   try{config=await fetchJson("/api/public/form/"+lpId);renderChoices()}catch{}
   show();err("受付枠が変更されました。イベントと人数を選び直してください。");
  }else err("送信できませんでした。内容をご確認のうえ再度お試しください。");
 }finally{submitting=false;$("submit").disabled=false}
});
load();