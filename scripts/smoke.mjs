/** End-to-end trial: intro is explanatory; afterwards only the V2-style form and admin operations. */
import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "node:http";
import {chromium} from "playwright";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const allowed=new Set(["/","/index.html","/styles.css","/theme-handmade.css","/experience.css","/src/app.mjs","/src/state.mjs","/robots.txt","/media/demo-overview.mp4"]);
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,"http://127.0.0.1").pathname;
 const file=path==="/"?"/index.html":path;
 if(!allowed.has(path)){res.writeHead(404);res.end();return}
 try{
  const bytes=await readFile(join(root,"dist",file.slice(1)));
  const mime={".html":"text/html",".css":"text/css",".mjs":"text/javascript",".txt":"text/plain",".mp4":"video/mp4"};
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});res.end(bytes);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(4185,"127.0.0.1",ok));
const browser=await chromium.launch();
const out=join(root,"artifacts");await mkdir(out,{recursive:true});
const errors=[];
const wait=async(p,selector)=>p.locator(selector).waitFor({state:"visible"});
try{
 const page=await browser.newPage({viewport:{width:1360,height:900},reducedMotion:"reduce"});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:4185/");
 await wait(page,"#demo-intro");
 assert.equal(await page.locator("#demo-shell").isVisible(),false);
 assert.equal(await page.locator("#intro-title").isVisible(),true);
 await page.screenshot({path:join(out,"intro-desktop.png"),animations:"disabled"});
 await page.locator("#start-experience").click();
 await wait(page,"#demo-shell");
 assert.equal(await page.locator("#demo-intro").isVisible(),false);
 assert.equal(await page.locator("#stat-register").textContent(),"3件");
 assert.equal(await page.locator("#stat-inquiry").textContent(),"1件");
 assert.equal(await page.locator(".nav").count(),7);
 assert.equal(await page.locator(".page-head p").first().isVisible(),false,"後半に説明段落を残さない");
 await page.screenshot({path:join(out,"solo-dashboard-desktop.png"),animations:"disabled"});

 // 1問ずつ→イベント選択→人数→確認（修正できる）→擬似送信→管理反映
 await page.locator('#page-dashboard [data-try="event"]').first().click();
 await wait(page,"#experience-step-0");
 assert.equal(await page.locator("#demo-name").inputValue(),"デモのお客様");
 assert.equal(await page.locator("#demo-name").getAttribute("readonly"),"");
 assert.equal(await page.locator("#progress-label").innerText(),"質問 1/3");
 await page.locator("#step-next").click();
 await wait(page,"#experience-step-1");
 assert.equal(await page.locator("#demo-email").inputValue(),"demo@example.invalid");
 assert.equal(await page.locator("#progress-label").innerText(),"質問 2/3");
 await page.locator("#step-next").click();
 await wait(page,"#experience-step-2");
 assert.equal(await page.locator("#event-choices .event-choice:not(:disabled)").count(),3);
 assert.equal(await page.locator("#step-next").isDisabled(),true);
 await page.locator("#event-choices .event-choice:not(:disabled)").first().click();
 await page.locator("#demo-attendees").fill("2");
 await page.locator("#step-next").click();
 await wait(page,"#experience-step-3");
 assert.match(await page.locator("#review-content").innerText(),/2名/);
 assert.equal(await page.locator("#review-content .review-edit").count(),5);
 await page.locator("#review-content .review-edit").last().click();
 await wait(page,"#experience-step-2");
 await page.locator("#demo-attendees").fill("1");
 await page.locator("#step-next").click();
 await wait(page,"#experience-step-3");
 assert.match(await page.locator("#review-content").innerText(),/1名/);
 assert.equal(await page.locator("#step-send").isDisabled(),true);
 await page.locator("#confirm-checkbox").check();
 await page.locator("#step-send").click();
 await wait(page,"#experience-step-4");
 assert.equal(await page.locator("#stat-register").textContent(),"4件");
 await page.screenshot({path:join(out,"solo-event-confirmed.png"),animations:"disabled"});
 await page.locator("#view-result").click();
 await wait(page,"#page-leads");
 assert.equal(await page.locator("#lead-rows tr").count(),4);

 // オーダー相談も同じV2形式
 await page.locator('[data-page-go="dashboard"]').first().click();
 await page.locator('#page-dashboard [data-try="contact"]').first().click();
 await page.locator("#step-next").click();
 await page.locator("#step-next").click();
 await wait(page,"#experience-step-2");
 assert.equal(await page.locator("#contact-selection").isVisible(),true);
 await page.locator("#modal-topic").selectOption({label:"作品のオーダー制作について相談したい"});
 await page.locator("#step-next").click();
 await page.locator("#confirm-checkbox").check();
 await page.locator("#step-send").click();
 await wait(page,"#experience-step-4");
 assert.equal(await page.locator("#stat-inquiry").textContent(),"2件");
 await page.locator("#view-result").click();
 await wait(page,"#page-leads");
 const newest=page.locator("#lead-rows tr.highlight");
 assert.match(await newest.innerText(),/オーダー制作/);
 await newest.getByRole("button",{name:"対応済みにする"}).click();
 assert.equal(await page.locator("#stat-inquiry").textContent(),"1件");

 // 管理画面は維持
 await page.locator('[data-page-go="events"]').first().click();
 await page.locator("#new-event").click();
 await page.locator("#edit-name").fill("刺繍のワークショップ（テスト）");
 await page.locator("#edit-date").fill("2027-03-13");
 await page.locator("#edit-time").fill("15:30");
 await page.locator("#edit-capacity").fill("20");
 await page.locator('#event-form button[type="submit"]').click();
 assert.equal(await page.locator("#events-list .event-row").count(),4);
 await page.locator('[data-page-go="lp"]').first().click();
 assert.equal(await page.locator("#lp-cards .lp-card").count(),3);
 assert.equal(await page.locator("#lp-cards a").count(),0);

 // モバイルのフロー・横はみ出し
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,reducedMotion:"reduce"});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:4185/");
 await wait(mobile,"#demo-intro");
 await mobile.screenshot({path:join(out,"intro-mobile.png"),animations:"disabled"});
 await mobile.locator("#start-experience").click();
 await wait(mobile,"#demo-shell");
 await mobile.screenshot({path:join(out,"solo-dashboard-mobile.png"),animations:"disabled"});
 await mobile.locator('#page-dashboard [data-try="contact"]').first().click();
 await wait(mobile,"#experience-step-0");
 await mobile.locator("#step-next").click();
 await mobile.locator("#step-next").click();
 await wait(mobile,"#experience-step-2");
 await mobile.screenshot({path:join(out,"solo-contact-mobile.png"),animations:"disabled"});
 await mobile.locator("#step-next").click();
 await mobile.locator("#confirm-checkbox").check();
 await mobile.locator("#step-send").click();
 assert.equal(await mobile.locator("#stat-inquiry").textContent(),"2件");
 await mobile.reload();
 await mobile.locator("#start-experience").click();
 await wait(mobile,"#demo-shell");
 await mobile.waitForFunction(()=>document.querySelector("#stat-inquiry")?.textContent==="1件");
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<4,"mobile document overflow "+overflow);
 assert.deepEqual(errors,[],"No runtime errors");
 console.log("V2-like form, video intro, admin dashboard and mobile safe demo PASS");
} finally {await browser.close();await new Promise(ok=>server.close(ok))}
