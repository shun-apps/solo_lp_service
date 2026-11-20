/**
 * 納品版の業務ルール。架空デモとは異なり実データを扱うため、認証・保存の境界より内側でのみ利用する。
 * 管理画面と公開フォームは、このモジュールと同じ状態に対して操作する。
 * まだサーバー/API/UI接続は未実装。誤って本番提供しないこと。
 */
import {
  LP_SAMPLES,INQUIRY_TOPICS,eventParticipants,
  registerEvent,submitInquiry,saveEvent,setEventOpen,
  setInquiryHandled,cancelRegistration,selectMode,lpReceptionStats
} from "../src/state.mjs";

const clone=value=>JSON.parse(JSON.stringify(value));
const allLPIds=new Set(LP_SAMPLES.map(lp=>lp.id));
const validName=value=>typeof value==="string"&&value.trim().length>=1&&value.trim().length<=80;
const validEmail=value=>typeof value==="string"&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const requireLP=(id,mode)=>{
  const lp=LP_SAMPLES.find(item=>item.id===id);
  if(!lp||mode&&lp.mode!==mode)throw Error("invalid_lp_or_form");
  return lp;
};
const validatedCustomer=({name,email})=>{
  if(!validName(name))throw Error("invalid_customer_name");
  if(!validEmail(email))throw Error("invalid_customer_email");
  return {name:name.trim(),email:email.trim().toLowerCase()};
};

export function emptyCustomerState(){
  return {
    businessName:"",
    selectedMode:"event",
    events:[],
    registrations:[],
    inquiries:[],
    seq:1,
    latest:null,
    lpUrls:{},
    businessIcon:null
  };
}

/** 公開予約フォームへ渡してよい情報だけを返す。顧客名やメールは絶対に含めない。 */
export function publicFormOptions(state,lpId){
  const lp=requireLP(lpId);
  return {
    lp:{id:lp.id,title:lp.title,mode:lp.mode},
    events:lp.mode==="event"?state.events.filter(event=>event.open).map(event=>({
      id:event.id,title:event.title,date:event.date,time:event.time,
      remaining:Math.max(0,event.capacity-eventParticipants(state,event.id))
    })):[],
    topics:lp.mode==="contact"?[...INQUIRY_TOPICS]:[]
  };
}

/** 同じ操作仕様で管理画面と公開フォームを接続するための純粋な状態遷移。 */
export function transitionCustomerState(original,action,payload={}){
  const state=clone(original);
  let result=null;
  switch(action){
    case "create_or_update_event":{
      result=saveEvent(state,{
        id:payload.id??null,title:payload.title,date:payload.date,
        time:payload.time,capacity:payload.capacity
      });
      break;
    }
    case "set_event_open":{
      if(typeof payload.open!=="boolean")throw Error("invalid_open");
      result=setEventOpen(state,payload.id,payload.open);
      break;
    }
    case "toggle_registration":{
      result=cancelRegistration(state,payload.id);
      break;
    }
    case "set_inquiry_handled":{
      if(typeof payload.handled!=="boolean")throw Error("invalid_handled");
      result=setInquiryHandled(state,payload.id,payload.handled);
      break;
    }
    case "set_shop_name":{
      if(typeof payload.name!=="string"||!payload.name.trim()||payload.name.trim().length>40)throw Error("invalid_shop_name");
      state.businessName=payload.name.trim();
      result=state.businessName;
      break;
    }
    case "set_default_form":{
      selectMode(state,payload.mode);
      result=state.selectedMode;
      break;
    }
    case "set_lp_url":{
      requireLP(payload.lpId);
      if(typeof payload.url!=="string")throw Error("invalid_lp_url");
      const url=payload.url.trim();
      if(url){
        let parsed;
        try{parsed=new URL(url)}catch{throw Error("invalid_lp_url")}
        if(parsed.protocol!=="https:"||parsed.username||parsed.password||!parsed.hostname)throw Error("invalid_lp_url");
        state.lpUrls[payload.lpId]=parsed.href;
      }else delete state.lpUrls[payload.lpId];
      result=state.lpUrls[payload.lpId]||null;
      break;
    }
    case "submit_public_registration":{
      requireLP(payload.lpId,"event");
      const customer=validatedCustomer(payload);
      result=registerEvent(state,{
        eventId:payload.eventId,lpId:payload.lpId,attendeeCount:payload.attendeeCount
      });
      const record=state.registrations.find(entry=>entry.id===result.id);
      // 架空の氏名で顧客情報を上書きするのではなく、サーバー保存する実情報を明示する。
      record.customer=customer.name;
      record.email=customer.email;
      result={id:record.id,eventId:record.eventId,status:record.status};
      break;
    }
    case "submit_public_inquiry":{
      requireLP(payload.lpId,"contact");
      const customer=validatedCustomer(payload);
      result=submitInquiry(state,{topic:payload.topic,lpId:payload.lpId});
      const record=state.inquiries.find(entry=>entry.id===result.id);
      record.customer=customer.name;
      record.email=customer.email;
      result={id:record.id,status:record.status};
      break;
    }
    default:throw Error("unknown_action");
  }
  return {state,result};
}
export const customerLpCounts=state=>lpReceptionStats(state);
