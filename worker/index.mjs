/**
 * 個人事業主向け独立デモのWorker。静的ファイル以外は受け付けない。
 * 整体院版のWorker、V2本体、APIやGoogle連携を使用しない。
 */
const SECURITY_HEADERS={
  "X-Robots-Tag":"noindex, nofollow",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":[
    "default-src 'none'","base-uri 'none'","frame-ancestors 'none'",
    "script-src 'self'","style-src 'self'","img-src 'self'",
    "font-src 'self'","connect-src 'none'","form-action 'none'","object-src 'none'"
  ].join("; ")
};
function secure(response,extra={}){
  const headers=new Headers(response.headers);
  for(const [k,v] of Object.entries(SECURITY_HEADERS))headers.set(k,v);
  for(const [k,v] of Object.entries(extra))headers.set(k,v);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(!["GET","HEAD"].includes(request.method))return secure(new Response("Method not allowed",{status:405}),{"Allow":"GET, HEAD"});
    if(path==="/api"||path.startsWith("/api/"))return secure(new Response("Not found",{status:404}));
    return secure(await env.ASSETS.fetch(request));
  }
};
