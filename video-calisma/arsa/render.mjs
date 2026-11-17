// Parsel JSON -> kare dizisi (Google 3D Tiles + CesiumJS, headless Chrome).
// Kullanım: node render.mjs <parsel.json> <kare_klasoru> [genislik] [yukseklik] [sure_sn] [fps]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const [parselYol, cikti, W = "1080", H = "1920", SURE = "12", FPS = "30"] = process.argv.slice(2);
const kok = path.dirname(fileURLToPath(import.meta.url));
const anahtar = fs.readFileSync(path.join(os.homedir(), ".google-maps-anahtar"), "utf8").trim();
const parsel = JSON.parse(fs.readFileSync(parselYol, "utf8"));
fs.mkdirSync(cikti, { recursive: true });

const chrome = path.join(kok, "..", "remotion", "node_modules", ".remotion", "chrome-headless-shell",
  "win64", "chrome-headless-shell-win64", "chrome-headless-shell.exe");

// file:// yerine yerel sunucu (Cesium worker'ları için)
const sunucu = http.createServer((q, r) => {
  r.setHeader("Content-Type", "text/html; charset=utf-8");
  r.end(fs.readFileSync(path.join(kok, "sahne.html")));
}).listen(0, "127.0.0.1");
await new Promise((ok) => sunucu.once("listening", ok));
const url = `http://127.0.0.1:${sunucu.address().port}/`;

const tarayici = await puppeteer.launch({
  executablePath: chrome, headless: true,
  args: process.env.GPU === "0"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl"],
});
const sayfa = await tarayici.newPage();
await sayfa.setViewport({ width: +W, height: +H });
sayfa.on("console", (m) => { if (m.type() === "error") console.error("[sayfa]", m.text()); });
await sayfa.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
await sayfa.evaluate((pl) => { window.PLAN = pl; }, process.env.PLAN || "");
await sayfa.evaluate((a) => kur(a), { anahtar, parsel, sse: process.env.SSE });
await sayfa.waitForFunction("window.hazir === true", { timeout: 120000 });

const toplam = Math.round(+SURE * +FPS);
const zaman = () => Number(process.hrtime.bigint() / 1000000n);
const bas0 = zaman();

// 1) Ön yükleme: rotayı seyrek adımlarla dolaş, döşemeleri önbelleğe al.
const ADIM = Number(process.env.ADIM || 15);
for (let i = 0; i < toplam; i += ADIM) {
  await sayfa.evaluate((t) => window.kare(t), i / (toplam - 1));
  await sayfa.evaluate(() => window.bekle(15000));
}
await sayfa.evaluate((t) => window.kare(t), 1);
await sayfa.evaluate(() => window.bekle(15000));
console.log(`on yukleme: ${((zaman() - bas0) / 1000).toFixed(1)} sn`);

// 2) Çekim: önbellekten hızlı.
const bas1 = zaman();
let bekleme = 0, cekim = 0;
const cdp = await sayfa.createCDPSession();
for (let i = 0; i < toplam; i++) {
  await sayfa.evaluate((t) => window.kare(t), i / (toplam - 1));
  bekleme += await sayfa.evaluate(() => window.bekle(4000));
  const c0 = zaman();
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
  fs.writeFileSync(path.join(cikti, `k${String(i).padStart(4, "0")}.jpg`), Buffer.from(data, "base64"));
  cekim += zaman() - c0;
  if (i % 60 === 0) console.log(`kare ${i}/${toplam}`);
}
const top = (zaman() - bas1) / 1000;
console.log(`cekim: ${top.toFixed(1)} sn, kare basi ${(top / toplam).toFixed(2)} sn ` +
  `(bekleme ${(bekleme / toplam / 1000).toFixed(2)}, ekran ${(cekim / toplam / 1000).toFixed(2)})`);
await tarayici.close();
sunucu.close();
console.log("bitti");
