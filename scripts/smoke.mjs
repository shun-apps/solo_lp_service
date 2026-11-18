/**
 * 自動ブラウザテスト：GitHub CIから node solo_creator/scripts/smoke.mjs で実行。
 * 本番APIは使わず、distをローカルHTTP配信する。
 */
import assert from "node:assert/strict";
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "node:http";
import {chromium} from "playwright";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const allowed=new Set(["/","/index.html","/styles.css","/theme-handmade.css","/src/app.mjs","/src/state.mjs","/robots.txt"]);
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,"http://127.0.0.1");const path=u.pathname==="/"?"/index.html":u.pathname;
  if(!allowed.has(u.pathname)){res.writeHead(404);res.end();return;}
  try{
    const b=await readFile(join(root,"dist",path.slice(1)));
    const types={".html":"text/html",".css":"text/css",".mjs":"text/javascript",".txt":"text/plain"};
    res.writeHead(200,{"Content-Type":(types[extname(path)]||"application/octet-stream")+"; charset=utf-8"});res.end(b);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolveReady=>server.listen(4185,"127.0.0.1",resolveReady));
const browser=await chromium.launch();
const screenshots=resolve(root,"artifacts");
await mkdir(screenshots,{recursive:true});
try{
 const errors=[];
 const page=await browser.newPage({viewport:{width:1360,height:900},reducedMotion:"reduce"});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:4185/");
 await page.waitForFunction(()=>document.querySelector("#stat-register")?.textContent==="3件");
 assert.equal(await page.locator("#title-dashboard").isVisible(),true);
 assert.equal(await page.locator(".nav").count(),7);
 assert.equal(await page.locator("#stat-inquiry").textContent(),"1件");
 assert.equal(await page.locator("#sidebar-name").textContent(),"糸と花のアトリエ（架空）");
 // 実際の表示フォントサイズを確認（単なるCSS文字列ではなくcomputed style）
 const px=async (p,selector)=>Number.parseFloat(await p.locator(selector).first().evaluate(el=>getComputedStyle(el).fontSize));
 assert.equal(await px(page,"#sidebar-name"),16);
 assert.equal(await px(page,".nav"),15);
 assert.equal(await px(page,"#title-dashboard"),26);
 assert.equal(await px(page,".panel-head h2"),18);
 assert.equal(await px(page,".page-head p"),14);
 assert.equal(await px(page,".metric>p"),13);
 assert.equal(await px(page,".notice"),14);
 assert.equal(await px(page,".page-ctas .btn"),14);
 assert.equal(await px(page,".field"),14);
 assert.equal(await px(page,".records td"),14);
 assert.equal(await page.locator("#page-dashboard").getByRole("button",{name:"ワークショップ申込を試す"}).count(),1);
 assert.equal(await page.locator('#page-dashboard [data-try="event"]').first().evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(150, 74, 100)");
 assert.equal(await page.locator(".sidebar").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(248, 247, 246)");
 assert.equal(await page.locator(".brand").count(),0,"上部の旧ブランドヘッダーは表示しない");
 assert.equal(await page.locator(".sidebar > .business-id").count(),1);
 assert.equal(await page.locator(".sidebar > :first-child").getAttribute("class"),"business-id shop-header");
 assert.equal(await page.locator(".shop-header .business-avatar").isVisible(),true);
 assert.equal(await page.locator(".shop-header").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(248, 247, 246)");
 assert.equal(await page.locator(".lp-event").first().evaluate(el=>getComputedStyle(el).backgroundImage.includes("117, 166, 167")),true,"3番目のLPはブルーグリーン");
 assert.equal(await page.locator(".lp-content").first().evaluate(el=>getComputedStyle(el).backgroundImage.includes("188, 142, 162")),true,"1番目のLPはくすみローズ");
 await page.screenshot({path:join(screenshots,"solo-dashboard-desktop.png"),animations:"disabled"});

 // 申込モード選択 → 内容確認 → 同意 → 確定 → 管理画面に追加
 await page.locator('#page-dashboard [data-try="event"]').first().click();
 assert.equal(await page.locator("#experience-dialog").isVisible(),true);
 assert.match(await page.locator("#experience-title").innerText(),/ワークショップ/);
 assert.equal(await page.locator("#event-choices .event-choice:not(:disabled)").count(),3);
 await page.locator("#step-next").click();
 assert.equal(await page.locator("#experience-step-1").isVisible(),true);
 assert.equal(await page.locator("#step-send").isDisabled(),true);
 assert.match(await page.locator("#review-content").innerText(),/demo@example.invalid/);
 await page.locator("#confirm-checkbox").check();
 await page.locator("#step-send").click();
 assert.equal(await page.locator("#experience-step-2").isVisible(),true);
 assert.equal(await page.locator("#stat-register").textContent(),"4件");
 assert.match(await page.locator("#success-mail").innerText(),/メール送信なし/);
 await page.screenshot({path:join(screenshots,"solo-event-confirmed.png"),animations:"disabled"});
 await page.locator("#view-result").click();
 assert.equal(await page.locator("#page-leads").isVisible(),true);
 assert.match(await page.locator("#title-leads").innerText(),/オーダー相談/);
 assert.equal(await page.locator("#lead-rows tr").count(),4);
 assert.equal(await page.locator("#lead-rows tr.highlight").count(),1);

 // 問い合わせ受付 → 管理受信箱に反映
 await page.locator('[data-page-go="dashboard"]').first().click();
 await page.locator('#page-dashboard [data-try="contact"]').first().click();
 assert.equal(await page.locator("#contact-selection").isVisible(),true);
 assert.match(await page.locator(".flow-mode.active").innerText(),/オーダー相談/);
 await page.locator("#modal-topic").selectOption({label:"作品のオーダー制作について相談したい"});
 await page.locator("#step-next").click();
 await page.locator("#confirm-checkbox").check();
 await page.locator("#step-send").click();
 assert.equal(await page.locator("#stat-inquiry").textContent(),"2件");
 await page.locator("#view-result").click();
 assert.equal(await page.locator("#lead-rows tr").count(),3);
 const newInquiry=page.locator("#lead-rows tr.highlight");
 assert.match(await newInquiry.innerText(),/作品のオーダー制作/);
 await newInquiry.getByRole("button",{name:"対応済みにする"}).click();
 assert.equal(await page.locator("#stat-inquiry").textContent(),"1件");

 // 日程作成、受付ON/OFFで申込可能数も変化
 await page.locator('[data-page-go="events"]').first().click();
 await page.locator("#new-event").click();
 await page.locator("#edit-name").fill("テストオンラインセミナー");
 await page.locator("#edit-date").fill("2027-03-13");
 await page.locator("#edit-time").fill("15:30");
 await page.locator("#edit-capacity").fill("20");
 await page.locator('#event-form button[type="submit"]').click();
 assert.equal(await page.locator("#events-list .event-row").count(),4);
 assert.equal(await page.locator("#stat-events").textContent(),"4件");

 // LP見本は虚偽の実URLにリンクしない
 await page.locator('[data-page-go="lp"]').first().click();
 assert.equal(await page.locator("#lp-cards .lp-card").count(),3);
 assert.match(await page.locator("#lp-cards").innerText(),/作品販売LP/);
 assert.match(await page.locator("#lp-cards").innerText(),/オーダー受付LP/);
 assert.match(await page.locator("#lp-cards").innerText(),/ワークショップ募集LP/);
 assert.equal(await page.locator("#lp-cards a").count(),0);

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,reducedMotion:"reduce"});
 mobile.on("pageerror",e=>errors.push(e.message));
 await mobile.goto("http://127.0.0.1:4185/");
 await mobile.waitForFunction(()=>document.querySelector("#stat-register")?.textContent==="3件");
 assert.equal(await px(mobile,"#sidebar-name"),16);
 assert.equal(await px(mobile,".nav"),14);
 assert.equal(await px(mobile,".notice"),13);
 assert.equal(await px(mobile,"#title-dashboard"),25);
 assert.equal(await px(mobile,".page-ctas .btn"),14);
 assert.equal(await px(mobile,".metric>p"),13);
 assert.equal(await px(mobile,".choice-card small"),13);
 assert.equal(await mobile.locator(".topbar .demo-tag").isVisible(),false);
 assert.equal(await mobile.locator(".brand").count(),0);
 assert.equal(await mobile.locator(".sidebar > :first-child").getAttribute("class"),"business-id shop-header");
 const mobileShop=await mobile.locator(".shop-header").boundingBox();
 assert.ok(mobileShop && mobileShop.y===0 && mobileShop.height>=58 && mobileShop.height<=75,"mobileショップ名は最上段");
 assert.equal(await mobile.locator(".shop-header").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(248, 247, 246)");
 await mobile.screenshot({path:join(screenshots,"solo-dashboard-mobile.png"),animations:"disabled"});
 await mobile.locator('#page-dashboard [data-try="contact"]').first().click();
 assert.equal(await mobile.locator("#experience-dialog").isVisible(),true);
 assert.equal(await mobile.locator('#page-dashboard [data-try="event"]').first().evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(150, 74, 100)");
 await mobile.screenshot({path:join(screenshots,"solo-contact-mobile.png"),animations:"disabled"});
 await mobile.locator("#step-next").click();
 await mobile.locator("#confirm-checkbox").check();
 await mobile.locator("#step-send").click();
 assert.equal(await mobile.locator("#stat-inquiry").textContent(),"2件");
 await mobile.reload();
 await mobile.waitForFunction(()=>document.querySelector("#stat-inquiry")?.textContent==="1件");
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 assert.ok(overflow<4,"mobile overflow "+overflow);
 assert.deepEqual(errors,[],"No browser runtime errors");
 console.log("Solo creator event/inquiry admin browser smoke passed on desktop and mobile.");
}finally{
 await browser.close();await new Promise(done=>server.close(done));
}
