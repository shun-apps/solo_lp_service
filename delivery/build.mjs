import {readFile,copyFile,writeFile,mkdir,rm} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=join(root,"dist-delivery");
let html=await readFile(join(root,"index.html"),"utf8");
const script='<script type="module" src="./src/app.mjs"></script>';
if(!html.includes(script))throw Error("Admin template script changed");
html=html.replace(script,'<script type="module" src="/delivery/admin-app.mjs"></script>');
for(const file of ["styles.css","theme-handmade.css","demo-journey.css"]){
 html=html.replace('href="./'+file+'"','href="/'+file+'"');
}
html=html.replace('</head>','<link rel="stylesheet" href="/delivery/admin.css"></head>');
html=html.replace(/<dialog id="experience-dialog"'[\s\S]*?<\/dialog>\s*/,"");
html=html.replace(/<button[^>]+id="reset"[^>]*>[\s\S]*?<\/button>/,"");
html=html.replace("ハンドメイド作家のアトリエ管理｜瞬apps（デモ）","ハンドメイド作家のアトリエ管理｜納品版");
html=html.replace("ハンドメイド作家のショップ（デモ）","ハンドメイド作家のショップ");
html=html.replace("糸と花のアトリエ（架空）","ショップ名未設定");
html=html.replace('value="糸と花のアトリエ（架空）"','value=""');
html=html.replace("架空データで体験中","管理画面");
html=html.replace("納品した訴求違い3本のLPが表示されます。","納品済みのLPを確認・登録できます。");
html=html.replace("サンクスメール、リマインドメールが設定できます。","自動メール送信は準備中です。");
html=html.replace("ショップ名とアイコンを登録して左上に表示できます。","ショップ名を変更して左上に表示できます。");
html=html.replace("アトリエ・ショップ名（デモ用）","アトリエ・ショップ名");
html=html.replace("ワークショップの追加・変更","ワークショップの追加・変更");
html=html.replace("管理画面でワークショップを設定","ワークショップを設定");
html=html.replace("内容を保存する（デモ）","内容を保存する");
html=html.replace("ワークショップ申込（デモ）","ワークショップ申込");
html=html.replace('> 自動返信メール</button>','> メール通知（準備中）</button>');
html=html.replace('<h1 id="title-mail">自動返信メール</h1>','<h1 id="title-mail">メール通知</h1>');
html=html.replace('class="business-avatar" aria-hidden="true">糸<','class="business-avatar" aria-hidden="true">店<');
const settingsStart=html.indexOf('      <section class="page" id="page-settings"');
const settingsEnd=html.indexOf('      <section class="page" id="page-mail"',settingsStart);
if(settingsStart<0||settingsEnd<0)throw Error("Settings screen boundaries changed");
html=html.slice(0,settingsStart)+
  '      <section class="page" id="page-settings" data-page="settings" hidden aria-labelledby="title-settings">\n'+
  '        <div class="page-head"><div><span class="eyebrow">FORM SETTINGS</span><h1 id="title-settings">フォームの設定</h1></div></div>\n'+
  '        <div class="guide-band guide-band--settings" role="note">LPに設定する受付フォームのURLを確認できます。</div>\n'+
  '      </section>\n'+html.slice(settingsEnd);
const mailStart=html.indexOf('      <section class="page" id="page-mail"');
const mailEnd=html.indexOf('      <section class="page" id="page-profile"',mailStart);
if(mailStart<0||mailEnd<0)throw Error("Mail screen boundaries changed");
html=html.slice(0,mailStart)+
  '      <section class="page" id="page-mail" data-page="mail" hidden aria-labelledby="title-mail">\n'+
  '        <div class="page-head"><div><span class="eyebrow">EMAIL</span><h1 id="title-mail">メール通知</h1></div></div>\n'+
  '        <div class="guide-band guide-band--mail" role="note">自動メール送信は準備中です。現在は利用できません。</div>\n'+
  '      </section>\n'+html.slice(mailEnd);

if(html.includes('id="experience-dialog"')||html.includes('id="reset"'))throw Error("Simulator UI leaked into customer delivery");
await rm(dist,{recursive:true,force:true});
const staticFiles=[
 "styles.css","theme-handmade.css","demo-journey.css",
 "delivery/admin-app.mjs","delivery/admin.css","delivery/public-form.html",
 "delivery/public-form.mjs","delivery/public-form.css"
];
for(const file of staticFiles){
 const target=join(dist,file);
 await mkdir(dirname(target),{recursive:true});
 await copyFile(join(root,file),target);
}
await writeFile(join(dist,"admin.html"),html);
await writeFile(join(dist,"public-form.html"),await readFile(join(root,"delivery/public-form.html"),"utf8"));
await writeFile(join(dist,"robots.txt"),"User-agent: *\nDisallow: /\n");
console.log("Customer delivery static assets built at dist-delivery/");
