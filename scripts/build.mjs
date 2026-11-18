import {readFile,copyFile,writeFile,mkdir,rm} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=join(root,"dist");
const files=["index.html","styles.css","src/app.mjs","src/state.mjs"];
const html=await readFile(join(root,"index.html"),"utf8");
if(!["page-dashboard","page-lp","page-events","page-leads","experience-dialog","event-dialog"].every(x=>html.includes(x)))throw Error("Missing demo screens");
await rm(dist,{recursive:true,force:true});
for(const file of files){const path=join(dist,file);await mkdir(dirname(path),{recursive:true});await copyFile(join(root,file),path);}
await writeFile(join(dist,"robots.txt"),"User-agent: *\nDisallow: /\n");
console.log("Isolated Cloudflare Workers demo built into dist/");
