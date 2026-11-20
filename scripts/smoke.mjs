/** Browser smoke test for explanation-first intro and V2-like privacy-safe experience. */
import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "node:http";
import {chromium} from "playwright";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const allowed=new Set(["/","/index.html","/styles.css","/theme-handmade.css","/demo-journey.css","/src/app.mjs","/src/state.mjs","/robots.txt"]);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1"),path=url.pathname==="/"?"/index.html":url.pathname;
 if(!allowed.has(path)){res.writeHead(404);res.end();return}
 try{
  const data=await readFile(join(root,"dist",path.slice(1)));
  const types={".html":"text/html",".css":"text/css",".mjs":"text/javascript",".txt":"text/plain"};
  res.writeHead(200,{"Content-Type":(types[extname(path)]||"application/octet-stream")+"; charset=utf-8"});res.end(data);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(4185,"127.0.0.1",ok));
const browser=await chromium.launch();
const screenshots=join(root,"artifacts");
await mkdir(screenshots,{recursive:true});
try{
 const errors=[];
 const page=await browser.newPage({viewport:{width:1360,height:900},reducedMotion:"reduce"});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:4185/");
 await page.waitForSelector("#stat-register");
 assert.equal(await page.locator("#demo-shell").isVisible(),true,"最初から管理画面を表示");
 assert.equal(await page.locator("#demo-intro").count(),0);
 assert.equal(await page.locator("video").count(),0);
 assert.equal(await page.locator("#back-to-intro").count(),0);
 assert.equal(await page.locator("#stat-register").textContent(),"3件");
 assert.equal(await page.locator(".nav").count(),7);
 assert.equal(await page.locator("#sidebar-name").textContent(),"糸と花のアトリエ（架空）");
 const bands=[
  ["dashboard","LPからどのくらい予約が入ったかが表示されます。","rgb(237, 231, 227)"],
  ["lp","納品した訴求違い3本のLPが表示されます。","rgb(237, 231, 227)"],
  ["events","ワークショップの開催日時と定員を設定できます。","rgb(237, 231, 227)"],
  ["leads","申込やオーダー相談を一覧で確認できます。","rgb(237, 231, 227)"],
  ["settings","お問い合わせフォームとイベントの予約フォームの設定ができます。","rgb(237, 231, 227)"],
  ["mail","サンクスメール、リマインドメールが設定できます。","rgb(237, 231, 227)"],
  ["profile","ショップ名とアイコンを登録して左上に表示できます。","rgb(237, 231, 227)"]
 ];
 for(const [id,description,color] of bands){
  await page.locator('[data-page-go="'+id+'"]').first().click();
  const band=page.locator("#page-"+id+" .guide-band");
  assert.equal(await band.isVisible(),true,id+" guide visible");
  assert.equal(await band.innerText(),description,id+" guide copy");
  assert.equal(await band.evaluate(el=>getComputedStyle(el).backgroundColor),color,id+" guide color");
  const banner=await band.boundingBox(),heading=await page.locator("#title-"+id).boundingBox();
  assert.ok(banner&&heading&&banner.y>heading.y,id+" guide below heading");
 }
 await page.locator('[data-page-go="dashboard"]').first().click();
 await page.screenshot({path:join(screenshots,"02-dashboard-desktop.png")});
 // Workshop path: event and attendee count, name, email, confirm/edit, completion
 await page.locator('#page-dashboard [data-try="event"]').first().click();
 assert.equal(await page.locator("#experience-dialog").isVisible(),true);
 assert.equal(await page.locator("#experience-step-0").isVisible(),true);
 assert.equal(await page.locator("#event-choices .event-choice:not(:disabled)").count(),3);
 assert.equal(await page.locator("#experience-dialog [type=email]").count(),0,"No real email input");
 await page.locator("#event-attendees").fill("2");
 await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-1").isVisible(),true);
 assert.equal(await page.locator(".readonly-sample").first().inputValue(),"デモのお客様");
 await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-2").isVisible(),true);
 assert.equal(await page.locator("#experience-step-2 .readonly-sample").inputValue(),"demo@example.invalid");
 await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-3").isVisible(),true);
 assert.equal(await page.locator(".review-edit").count(),5);
 assert.match(await page.locator("#review-content").innerText(),/2名/);
 await page.locator(".review-edit").last().click();
 assert.equal(await page.locator("#experience-step-0").isVisible(),true);
 await page.locator("#event-attendees").fill("1");
 for(let i=0;i<3;i++)await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-3").isVisible(),true);
 await page.screenshot({path:join(screenshots,"03-v2-confirm.png")});
 await page.locator("#step-send").click();
 assert.equal(await page.locator("#experience-step-4").isVisible(),true);
 assert.equal(await page.locator("#stat-register").textContent(),"4件");
 assert.match(await page.locator("#success-mail").textContent(),/メール送信なし/);
 await page.screenshot({path:join(screenshots,"04-form-complete.png")});
 await page.locator("#view-result").click();
 assert.equal(await page.locator("#page-leads").isVisible(),true);
 assert.equal(await page.locator("#lead-rows tr").count(),4);
 assert.equal(await page.locator("#lead-rows tr.highlight").count(),1);
 // Contact path
 await page.locator('[data-page-go="dashboard"]').first().click();
 await page.locator('#page-dashboard [data-try="contact"]').first().click();
 assert.equal(await page.locator("#contact-selection").isVisible(),true);
 assert.equal(await page.locator("#event-selection").isVisible(),false);
 await page.locator("#modal-topic").selectOption({label:"作品のオーダー制作について相談したい"});
 for(let i=0;i<3;i++)await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-3").isVisible(),true);
 assert.match(await page.locator("#review-content").innerText(),/オーダー制作/);
 await page.locator("#step-send").click();
 assert.equal(await page.locator("#stat-inquiry").textContent(),"2件");
 await page.locator("#view-result").click();
 assert.equal(await page.locator("#lead-rows tr").count(),3);
 await page.locator("#lead-rows tr.highlight").getByRole("button",{name:"対応済みにする"}).click();
 assert.equal(await page.locator("#stat-inquiry").textContent(),"1件");
 // Workshop edit and LP cards remain functional
 await page.locator('[data-page-go="events"]').first().click();
 await page.locator("#new-event").click();
 await page.locator("#edit-name").fill("手刺繍の体験講座");
 await page.locator("#edit-date").fill("2027-03-13");
 await page.locator("#edit-time").fill("15:30");
 await page.locator("#edit-capacity").fill("20");
 await page.locator('#event-form button[type="submit"]').click();
 assert.equal(await page.locator("#events-list .event-row").count(),4);
 await page.locator('[data-page-go="lp"]').first().click();
 assert.equal(await page.locator("#lp-cards .lp-card").count(),3);
 assert.equal(await page.locator("#lp-cards a").count(),0);
 // Mobile layout and independent reset
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,reducedMotion:"reduce"});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:4185/");
 await mobile.waitForFunction(()=>document.querySelector("#stat-register")?.textContent==="3件");
 assert.equal(await mobile.locator("#demo-shell").isVisible(),true);
 assert.equal(await mobile.locator("#demo-intro").count(),0);
 assert.equal(await mobile.locator("#page-dashboard .guide-band").innerText(),"LPからどのくらい予約が入ったかが表示されます。");
 assert.equal(await mobile.locator("#page-dashboard .guide-band").evaluate(el=>getComputedStyle(el).fontSize),"14px");
 await mobile.screenshot({path:join(screenshots,"06-dashboard-mobile.png")});
 await mobile.locator('#page-dashboard [data-try="contact"]').first().click();
 assert.equal(await mobile.locator("#experience-dialog").isVisible(),true);
 await mobile.screenshot({path:join(screenshots,"07-contact-mobile.png")});
 for(let i=0;i<3;i++)await mobile.locator("#step-next").click();
 await mobile.locator("#step-send").click();
 assert.equal(await mobile.locator("#stat-inquiry").textContent(),"2件");
 await mobile.reload();
 await mobile.waitForFunction(()=>document.querySelector("#stat-inquiry")?.textContent==="1件");
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<4,"mobile overflow "+overflow);
 assert.deepEqual(errors,[],"No JS errors");
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
console.log("Direct dashboard + seven guide bands + V2-style demo passed on desktop/mobile.");
