import {readFile,copyFile,writeFile,mkdir,rm,access} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=join(root,"dist");
const files=["index.html","styles.css","theme-handmade.css","experience.css","src/app.mjs","src/state.mjs"];
const html=await readFile(join(root,"index.html"),"utf8");
if(!["page-dashboard","page-lp","page-events","page-leads","experience-dialog","event-dialog"].every(x=>html.includes(x)))throw Error("Missing demo screens");
await rm(dist,{recursive:true,force:true});
for(const file of files){const path=join(dist,file);await mkdir(dirname(path),{recursive:true});await copyFile(join(root,file),path);}
await writeFile(join(dist,"robots.txt"),"User-agent: *\nDisallow: /\n");
try { await access(join(root,"public/media/demo-overview.mp4"));
  await mkdir(join(dist,"media"),{recursive:true});
  await copyFile(join(root,"public/media/demo-overview.mp4"),join(dist,"media/demo-overview.mp4"));
} catch (error) { if(error?.code!=="ENOENT")throw error; }
console.log("Isolated Cloudflare Workers demo built into dist/");
