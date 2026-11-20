import {readCustomerState,performCustomerAction} from "./store.mjs";
import {publicFormOptions} from "./customer-rules.mjs";

const HEADERS={
  "X-Robots-Tag":"noindex, nofollow",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":[
    "default-src 'none'","base-uri 'none'","frame-ancestors 'none'",
    "script-src 'self'","style-src 'self'","style-src-attr 'unsafe-inline'","img-src 'self' data:",
    "font-src 'self'","connect-src 'self'","form-action 'self'","object-src 'none'"
  ].join("; "),
  "Cache-Control":"no-store"
};
const secure=(res,extra={})=>{
  const h=new Headers(res.headers);
  for(const [k,v] of Object.entries(HEADERS))h.set(k,v);
  for(const [k,v] of Object.entries(extra))h.set(k,v);
  return new Response(res.body,{status:res.status,statusText:res.statusText,headers:h});
};
const json=(data,status=200)=>secure(new Response(JSON.stringify(data),{
  status,headers:{"Content-Type":"application/json; charset=utf-8"}
}));
const failure=(code,status)=>json({error:code},status);
async function equalDigest(a,b){
  const e=new TextEncoder(),cryptoApi=crypto.subtle;
  const [one,two]=await Promise.all([cryptoApi.digest("SHA-256",e.encode(a)),cryptoApi.digest("SHA-256",e.encode(b))]);
  const x=new Uint8Array(one),y=new Uint8Array(two);let mismatch=0;
  for(let i=0;i<x.length;i++)mismatch|=x[i]^y[i];
  return mismatch===0;
}
async function authorized(request,env){
  if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD)return false;
  const raw=request.headers.get("Authorization")||"";
  if(!raw.startsWith("Basic "))return false;
  let parsed;
  try{parsed=atob(raw.slice(6));}catch{return false;}
  const sep=parsed.indexOf(":");
  if(sep<1)return false;
  const user=parsed.slice(0,sep),pass=parsed.slice(sep+1);
  return (await equalDigest(user,env.ADMIN_USERNAME)) && (await equalDigest(pass,env.ADMIN_PASSWORD));
}
const denyAdmin=()=>secure(new Response("Authentication required",{status:401}),{
  "WWW-Authenticate":'Basic realm="Atelier Admin", charset="UTF-8"'
});
async function parseBody(request){
  if(!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json"))throw Error("invalid_content_type");
  if(Number(request.headers.get("Content-Length")||0)>16384)throw Error("payload_too_large");
  const text=await request.text();
  if(text.length>16384)throw Error("payload_too_large");
  let data;
  try{data=JSON.parse(text)}catch{throw Error("invalid_json")}
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_json");
  return data;
}
const allowedAdmin=new Set([
  "create_or_update_event","set_event_open","toggle_registration",
  "set_inquiry_handled","set_shop_name","set_business_icon","set_default_form","set_lp_url"
]);
const allowedPublic=new Set(["submit_public_registration","submit_public_inquiry"]);
function errorStatus(code){
  if(code==="event_full"||code==="event_unavailable"||code==="event_has_bookings"||code==="concurrent_update_retry")return 409;
  if(code==="invalid_customer_email"||code==="invalid_customer_name"||code.startsWith("invalid_")||code==="unknown_action")return 400;
  return 500;
}
async function handleAction(request,env,type,id){
  if(!env.DB)return failure("database_not_configured",503);
  const origin=request.headers.get("Origin");
  if(origin!==new URL(request.url).origin)return failure("origin_required",403);
  let data;
  try{data=await parseBody(request)}
  catch(e){return failure(e.message,400)}
  const action=type==="admin"?data.action:id==="lp-event"?"submit_public_registration":"submit_public_inquiry";
  if(type==="admin"&&!allowedAdmin.has(action))return failure("action_forbidden",403);
  if(type==="public"&&!allowedPublic.has(action))return failure("action_forbidden",403);
  const payload=type==="public"?{...data,lpId:id}:data.payload;
  try{
    const saved=await performCustomerAction(env.DB,action,payload);
    return json({ok:true,result:saved.result});
  }catch(e){return failure(e.message==="database_not_initialized"?"database_not_initialized":errorStatus(e.message)===500?"internal_error":e.message,errorStatus(e.message))}
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    const admin=path==="/admin"||path==="/admin/"||path==="/admin.html"||path.startsWith("/api/admin/");
    if(admin){
      if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD)return failure("admin_credentials_not_configured",503);
      if(!await authorized(request,env))return denyAdmin();
    }
    if(path==="/")return secure(Response.redirect(new URL("/admin/",request.url),302));
    if(path==="/admin"||path==="/admin/"){
      if(request.method!=="GET"&&request.method!=="HEAD")return failure("method_not_allowed",405);
      return secure(await env.ASSETS.fetch(new Request(new URL("/admin.html",request.url),request)));
    }
    if(path==="/api/admin/state"&&request.method==="GET"){
      if(!env.DB)return failure("database_not_configured",503);
      try{return json({state:(await readCustomerState(env.DB)).state})}catch{return failure("state_unavailable",503)}
    }
    if(path==="/api/admin/action"&&request.method==="POST")return handleAction(request,env,"admin");
    if(path.startsWith("/api/admin/"))return failure("not_found",404);

    const formPath=path.match(/^\/form\/(lp-content|lp-craft|lp-event)\/?$/);
    if(formPath&&(request.method==="GET"||request.method==="HEAD")){
      return secure(await env.ASSETS.fetch(new Request(new URL("/public-form.html",request.url),request)));
    }
    const formApi=path.match(/^\/api\/public\/form\/(lp-content|lp-craft|lp-event)$/);
    if(formApi&&request.method==="GET"){
      if(!env.DB)return failure("database_not_configured",503);
      try{return json(publicFormOptions((await readCustomerState(env.DB)).state,formApi[1]))}
      catch{return failure("form_unavailable",503)}
    }
    const submitPath=path.match(/^\/api\/public\/submit\/(lp-content|lp-craft|lp-event)$/);
    if(submitPath&&request.method==="POST")return handleAction(request,env,"public",submitPath[1]);
    if(path.startsWith("/api/"))return failure("not_found",404);
    if(!["GET","HEAD"].includes(request.method))return failure("method_not_allowed",405);
    const permitted=new Set(["/admin.html","/public-form.html","/delivery/admin-app.mjs","/delivery/public-form.mjs","/delivery/public-form.css","/styles.css","/theme-handmade.css","/demo-journey.css","/robots.txt"]);
    if(!permitted.has(path))return failure("not_found",404);
    if(path==="/public-form.html")return secure(Response.redirect(new URL("/form/lp-content",request.url),302));
    return secure(await env.ASSETS.fetch(request));
  }
};