/** Record real demo screens, using only fictional data, as a silent 16:9 MP4. */
import {readFile,mkdir,rm,readdir} from "node:fs/promises";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import {resolve,dirname,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createServer} from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {chromium} from "playwright";

const run=promisify(execFile);
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const output=join(root,"public/media/demo-overview.mp4");
const capture=join(root,"artifacts/video-tmp");
await rm(capture,{recursive:true,force:true});
await mkdir(capture,{recursive:true});
await mkdir(join(root,"public/media"),{recursive:true});
const fontDir=join(root,"node_modules/@fontsource/noto-sans-jp/files");
const jpFiles=await readdir(fontDir);
const jpFont=jpFiles.find(f=>/japanese-400-normal\.woff2$/.test(f));
if(!jpFont)throw Error("Noto Japanese WOFF2 not found");
const allowed=new Set(["/","/index.html","/styles.css","/theme-handmade.css","/experience.css","/src/app.mjs","/src/state.mjs","/demo-font.woff2"]);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");const p=url.pathname==="/"?"/index.html":url.pathname;
 if(!allowed.has(url.pathname)){res.writeHead(404);res.end();return;}
 try{
  const data=await readFile(p==="/demo-font.woff2"?join(fontDir,jpFont):join(root,"dist",p.slice(1)));
  const types={".html":"text/html",".css":"text/css",".mjs":"text/javascript",".woff2":"font/woff2"};
  res.writeHead(200,{"Content-Type":types[extname(p)]||"application/octet-stream"});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(ok=>server.listen(4187,"127.0.0.1",ok));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({
  viewport:{width:1200,height:675},deviceScaleFactor:1,reducedMotion:"reduce",
  recordVideo:{dir:capture,size:{width:1200,height:675}}
 });
 const page=await context.newPage();
 await page.goto("http://127.0.0.1:4187/?capture=1");
 await page.waitForFunction(()=>document.querySelector("#stat-register")?.textContent==="3件");
 await page.addStyleTag({content:'@font-face{font-family:DemoJP;src:url("/demo-font.woff2") format("woff2");font-style:normal;font-weight:100 900}body,button,input,select{font-family:DemoJP,sans-serif!important}'});
 await page.evaluate(()=>document.fonts.load('16px DemoJP'));
 await page.evaluate(()=>document.fonts.ready);
 await page.addStyleTag({content:'#video-caption{position:fixed;left:270px;bottom:24px;z-index:99999;padding:11px 20px;border-radius:12px;background:rgba(41,83,86,.95);color:white;font:800 20px/1.4 sans-serif;box-shadow:0 8px 28px #0002}'});
 await page.evaluate(()=>{const box=document.createElement("div");box.id="video-caption";document.body.append(box);});
 const caption=async s=>page.locator("#video-caption").evaluate((el,t)=>{el.textContent=t},s);
 const hold=async(ms=950)=>page.waitForTimeout(ms);
 await caption("01 申込フォームを体験");
 await hold(1200);
 await page.locator('#page-dashboard [data-try="event"]').first().click();
 await hold(1100);
 await page.locator("#step-next").click();
 await hold(900);
 await page.locator("#step-next").click();
 await hold(900);
 await page.locator("#event-choices .event-choice:not(:disabled)").first().click();
 await hold(950);
 await page.locator("#step-next").click();
 await hold(1000);
 await caption("02 確認して送信");
 await page.locator("#confirm-checkbox").check();
 await hold(650);
 await page.locator("#step-send").click();
 await hold(1800);
 await page.locator("#view-result").click();
 await caption("03 申込が管理画面に反映");
 await hold(2200);
 await page.locator('[data-page-go="dashboard"]').first().click();
 await hold(950);
 await caption("作品のご相談も、同じ管理画面へ");
 await page.locator('#page-dashboard [data-try="contact"]').first().click();
 await page.locator("#step-next").click();
 await page.locator("#step-next").click();
 await hold(1300);
 await page.locator("#step-next").click();
 await page.locator("#confirm-checkbox").check();
 await hold(900);
 await page.locator("#step-send").click();
 await hold(1200);
 await page.locator("#view-result").click();
 await hold(2100);
 await page.locator('[data-page-go="dashboard"]').first().click();
 await caption("デモで今すぐ操作できます");
 await hold(1500);
 const recorded=await page.video().path();
 await context.close();
 await run(ffmpegInstaller.path,["-hide_banner","-loglevel","error","-y","-i",recorded,
  "-vf","fps=15,scale=960:540","-c:v","libx264","-preset","veryfast",
  "-crf","30","-pix_fmt","yuv420p","-movflags","+faststart","-an",output]);
 const info=await readFile(output);
 if(info.length<15000||info.length>9000000)throw Error("Video artifact unexpected size "+info.length);
 console.log("Recorded real UI walkthrough:",output,info.length,"bytes");
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
