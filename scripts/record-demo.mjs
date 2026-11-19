/**
 * Real silent UI walkthrough, recorded with Playwright to WebM then converted to MP4.
 * Only fake customer records are exercised; no network APIs and no personal data.
 * Run after npm run build + npm install playwright + npx playwright install chromium.
 */
import {readFile,mkdir} from "node:fs/promises";
import {resolve,dirname,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "node:http";
import {chromium} from "playwright";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const allowed=new Set(["/","/index.html","/styles.css","/theme-handmade.css","/demo-journey.css","/src/app.mjs","/src/state.mjs"]);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 const path=url.pathname==="/"?"/index.html":url.pathname;
 if(!allowed.has(path)){res.writeHead(404);res.end();return}
 try{
  const data=await readFile(join(root,"dist",path.slice(1)));
  const types={".html":"text/html",".css":"text/css",".mjs":"text/javascript"};
  res.writeHead(200,{"Content-Type":(types[extname(path)]||"application/octet-stream")+"; charset=utf-8"});res.end(data);
 }catch{res.writeHead(404);res.end()}
});
await new Promise(ok=>server.listen(4188,"127.0.0.1",ok));
const browser=await chromium.launch();
const captureDir=join(root,"artifacts","video");
await mkdir(captureDir,{recursive:true});
let rawVideo;
try{
 const context=await browser.newContext({
  viewport:{width:1280,height:720},
  recordVideo:{dir:captureDir,size:{width:1280,height:720}},
  reducedMotion:"reduce",deviceScaleFactor:1
 });
 const page=await context.newPage();
 const hold=async(ms=850)=>page.waitForTimeout(ms);
 await page.goto("http://127.0.0.1:4188/?demo=1");
 await page.waitForFunction(()=>document.querySelector("#stat-register")?.textContent==="3件");
 await hold(1400);
 await page.locator('#page-dashboard [data-try="event"]').first().click();
 await hold(950);
 await page.locator("#event-choices .event-choice:not(:disabled)").nth(1).click();
 await hold(650);
 await page.locator("#step-next").click();await hold(700);
 await page.locator("#step-next").click();await hold(700);
 await page.locator("#step-next").click();await hold(1200);
 await page.locator("#step-send").click();await hold(1250);
 await page.locator("#view-result").click();await hold(1550);
 await page.locator('[data-page-go="dashboard"]').first().click();
 await hold(600);
 await page.locator('#page-dashboard [data-try="contact"]').first().click();await hold(700);
 await page.locator("#modal-topic").selectOption({label:"作品のオーダー制作について相談したい"});
 await hold(650);
 await page.locator("#step-next").click();await hold(450);
 await page.locator("#step-next").click();await hold(450);
 await page.locator("#step-next").click();await hold(700);
 await page.locator("#step-send").click();await hold(750);
 await page.locator("#view-result").click();await hold(1800);
 rawVideo=await page.video().path();
 await context.close();
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
console.log("RECORDING="+rawVideo);
