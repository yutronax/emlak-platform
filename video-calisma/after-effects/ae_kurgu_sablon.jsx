// ae_kurgu.py başına "var V = {...};" ekleyerek çalıştırır. Kurallar: SKILL.md "After Effects yolu".
var LOG = new File("C:/inza-ae/log/kurgu_" + V.ad + ".txt"); LOG.encoding = "UTF-8"; LOG.open("w");
function L(s) { LOG.writeln(s); }
function al(yol) { return app.project.importFile(new ImportOptions(new File(yol))); }
function P(e, ad) { for (var i = 1; i <= e.numProperties; i++) { var p = e.property(i); if (p.name.replace(/^\s+/, "") == ad) return p; } return null; }
function ayarla(e, ad, k) { var p = P(e, ad); if (!p) return; try { p.setValue(typeof k == "function" ? k(p.value) : k); } catch (z) { L("ayar yok " + ad); } }
function efekt(ly, ad) { try { return ly.property("Effects").addProperty("S_" + ad); } catch (z) { L("efekt yok " + ad); return null; } }
// test edilmiş ayarlar (AFTER-EFFECTS-KISA-MENU.md)
var AYAR = {
  DissolveLightLeak: { "Transition Brightness": 0.375, "Saturation": 0.5, "Glow Brightness": 0.125 },
  Vignette: { "Radius": function (v) { return v * 1.6; }, "Edge Softness": 2, "Opacity": 0.6 },
  UltraGlow: { "Threshold": 0.92, "Brightness": function (v) { return v * 0.25; } },
  LightLeak: { "Opacity": 0.4 }
};
function uygula(e, ad) { var a = AYAR[ad]; if (e && a) for (var k in a) ayarla(e, k, a[k]); }
function yazi(comp, metin, alt, t0, t1, y) {
  var tl = comp.layers.addText(metin); var td = tl.property("Source Text").value;
  td.fontSize = metin.length > 14 ? 84 : 130; td.fillColor = [1, 1, 1]; td.applyStroke = false;
  td.justification = ParagraphJustification.CENTER_JUSTIFY; td.font = "Impact";
  tl.property("Source Text").setValue(td);
  tl.property("Position").setValue([540, y]); tl.inPoint = t0; tl.outPoint = t1;
  var sh = tl.property("Effects").addProperty("ADBE Drop Shadow"); sh.property(4).setValue(12); sh.property(5).setValue(25);
  var an = tl.property("Text").property("Animators").addProperty("ADBE Text Animator");
  an.property("Properties").addProperty("ADBE Text Opacity").setValue(0);
  an.property("Properties").addProperty("ADBE Text Position 3D").setValue([0, 80, 0]);
  var st = an.property("Selectors").addProperty("ADBE Text Selector").property("Start");
  st.setValueAtTime(t0, 0); st.setValueAtTime(t0 + 0.8, 100);
  var o = tl.property("Opacity"); o.setValueAtTime(t1 - 0.3, 100); o.setValueAtTime(t1, 0);
  if (alt) {
    var a = comp.layers.addText(alt); var ad = a.property("Source Text").value;
    ad.fontSize = 46; ad.fillColor = [0.95, 0.71, 0.15]; ad.justification = ParagraphJustification.CENTER_JUSTIFY; ad.font = "Arial-BoldMT";
    a.property("Source Text").setValue(ad); a.property("Position").setValue([540, y + 85]);
    a.inPoint = t0 + 0.5; a.outPoint = t1; a.property("Effects").addProperty("ADBE Drop Shadow");
  }
  return tl;
}
var KONUM = { ust: 1380, orta: 1380, alt: 1500 };                  // Gemini eleştirisi: yazılar alt üçte birde, mekânın ortası açık
try {
  app.newProject();
  var proj = app.project;
  try { proj.gpuAccelType = GpuAccelType.SOFTWARE; } catch (z) { }
  var comp = proj.items.addComp(V.ad, 1080, 1920, 1, V.sure, 30);
  var lys = [];
  for (var i = 0; i < V.planlar.length; i++) {
    var p = V.planlar[i];
    var ly = comp.layers.add(al(p.v)); ly.moveToEnd();               // önceki plan üstte kalır (geçiş efekti onun üstünde)
    if (p.hiz != 1) ly.stretch = 100 / p.hiz;
    ly.startTime = p.t - p.bas / p.hiz; ly.inPoint = p.t; ly.outPoint = p.t + p.sure;
    var w = ly.source.width, h = ly.source.height; var s = Math.max(1080 / w, 1920 / h) * 100;
    var sc = ly.property("Scale");
    if (i == 0) {                                                     // kanca: ilk 1 sn hızlı yaklaşma, sonra yavaş süzülme
      sc.setValueAtTime(0, [s, s]); sc.setValueAtTime(1.0, [s * 1.18, s * 1.18]); sc.setValueAtTime(p.t + p.sure, [s * 1.24, s * 1.24]);
      var ke = new KeyframeEase(0, 85); sc.setTemporalEaseAtKey(2, [ke, ke, ke], [ke, ke, ke]);
    } else if (V.yenilik) {                                           // 3D süzülme: katman 3D, hafif Y dönüşü + yaklaşma (perspektif derinliği)
      ly.threeDLayer = true; var yon = (i % 2) ? 1 : -1;
      sc.setValue([s * 1.12, s * 1.12, 100]);
      var ry = ly.property("Y Rotation"); ry.setValueAtTime(p.t, -4 * yon); ry.setValueAtTime(p.t + p.sure, 4 * yon);
      var ps = ly.property("Position"); ps.setValueAtTime(p.t, [540, 960, 0]); ps.setValueAtTime(p.t + p.sure, [540, 960, -120]);
    } else { sc.setValueAtTime(p.t, [s, s]); sc.setValueAtTime(p.t + p.sure, [s * 1.05, s * 1.05]); }
    if (p.efekt) uygula(efekt(ly, p.efekt), p.efekt);
    lys.push(ly);
    if (p.ortam) { var o = comp.layers.add(al(p.ortam)); o.startTime = p.t; o.outPoint = Math.min(p.t + p.sure, V.sure); o.property("Audio").property("Audio Levels").setValue([-14, -14]); }
  }
  for (var i = 0; i < V.planlar.length - 1; i++) {
    var p = V.planlar[i]; if (p.gecis == "yok") continue;
    var e = efekt(lys[i], p.gecis); if (!e) continue;
    for (var j = 1; j <= e.numProperties; j++) { var q = e.property(j); if (q.propertyValueType == PropertyValueType.LAYER_INDEX) { try { q.setValue(lys[i + 1].index); } catch (z) { } } }
    ayarla(e, "Auto Trans", 1); uygula(e, p.gecis);
    var yp = P(e, "Wipe Percent") || P(e, "Dissolve Percent") || P(e, "Amount");
    var b = p.t + p.sure - p.ov; yp.setValueAtTime(b, 0); yp.setValueAtTime(p.t + p.sure, 100);
    L("gecis " + (i + 1) + " " + p.gecis + " " + b.toFixed(2));
  }
  // görünüm: tek ayar katmanı
  var adj = comp.layers.addSolid([1, 1, 1], "gorunum", 1080, 1920, 1, V.kapanis_t); adj.adjustmentLayer = true; adj.moveToBeginning();
  for (var g = 0; g < V.gorunum.length; g++) uygula(efekt(adj, V.gorunum[g]), V.gorunum[g]);
  try {                                                               // iç mekân sarı tonunu nötrle (Lumetri sıcaklık)
    var lu = adj.property("Effects").addProperty("ADBE Lumetri");
    var tp = P(lu, "Temperature"); if (tp) { tp.setValue(-12); L("lumetri sicaklik -12"); } else L("lumetri sicaklik parametresi yok");
  } catch (z) { L("lumetri yok " + String(z.message)); }
  // yazılar
  if (V.acilis) { var m = V.acilis.split("|"); yazi(comp, m[0], m[1] || null, 0.1, Math.min(2.4, V.planlar[0].sure), 520); }
  for (var i = 0; i < V.planlar.length; i++) {
    var p = V.planlar[i], y = p.yazi; if (!y) continue;
    var t0 = p.t + (y.giris_sn || 0.4); yazi(comp, y.metin, y.alt || null, t0, p.t + p.sure - 0.1, KONUM[y.konum] || 960);
  }
  // kapanış kartı
  var kt = V.kapanis_t;
  var bg = comp.layers.addSolid([0.086, 0.13, 0.243], "kapanis", 1080, 1920, 1, V.sure - kt); bg.startTime = kt; bg.moveToBeginning();
  var bo = bg.property("Opacity"); bo.setValueAtTime(kt, 0); bo.setValueAtTime(kt + 0.4, 100);
  var lg = comp.layers.add(al(V.logo)); lg.startTime = kt; lg.inPoint = kt; lg.moveToBeginning(); lg.property("Position").setValue([540, 760]);
  var lgs = lg.property("Scale"), lw = 700 / lg.source.width * 100; lgs.setValueAtTime(kt + 0.3, [lw * 0.8, lw * 0.8]); lgs.setValueAtTime(kt + 0.9, [lw, lw]);
  var lo = lg.property("Opacity"); lo.setValueAtTime(kt + 0.3, 0); lo.setValueAtTime(kt + 0.8, 100);
  var ct = yazi(comp, V.cagri, V.telefon, kt + 0.8, V.sure, 1180);
  if (V.neon) try {                                                   // neon kapanış (DENEYSEL: kayık mavi hayalet yazı bırakıyor): Saber çekirdeği = çağrı yazısı (Core Type 3), altın ışıma
    var sb = comp.layers.addSolid([0, 0, 0], "neon", 1080, 1920, 1, V.sure - kt); sb.startTime = kt; sb.moveToBeginning(); sb.blendingMode = BlendingMode.ADD;
    var se = sb.property("Effects").addProperty("VIDEOCOPILOT LightSaber");
    ayarla(se, "Core Type", 3); P(se, "Text Layer").setValue(ct.index); ayarla(se, "Glow Intensity", 6); ayarla(se, "Core Size", 1);
    var so = sb.property("Opacity"); so.setValueAtTime(kt + 0.8, 0); so.setValueAtTime(kt + 1.6, 100); so.setValueAtTime(kt + 2.6, 55);
    L("neon kapanis");
  } catch (z) { L("saber yok " + String(z.message)); }
  if (V.notlar) { var nt = comp.layers.addText(V.notlar); var nd = nt.property("Source Text").value; nd.fontSize = 26; nd.fillColor = [0.8, 0.8, 0.8]; nd.font = "ArialMT"; nd.justification = ParagraphJustification.CENTER_JUSTIFY; nt.property("Source Text").setValue(nd); nt.property("Position").setValue([540, 1800]); nt.inPoint = kt + 1; }
  // müzik
  var mz = comp.layers.add(al(V.muzik)); mz.startTime = -V.muzik_bas; mz.inPoint = 0; mz.outPoint = V.sure;
  var ml = mz.property("Audio").property("Audio Levels"); ml.setValueAtTime(V.sure - 1.5, [0, 0]); ml.setValueAtTime(V.sure, [-40, -40]);
  comp.motionBlur = true;
  var rq = proj.renderQueue.items.add(comp); var om = rq.outputModule(1);
  if (V.onizleme) { try { rq.setSetting("Resolution", "Half"); L("onizleme: yarim cozunurluk"); } catch (z) { L("onizleme ayari olmadi " + String(z.message)); } }
  try { om.applyTemplate("Lossless"); } catch (z) { }
  om.file = new File("C:/inza-ae/cikti/" + V.ad + ".avi");
  proj.save(new File("C:/inza-ae/" + V.ad + ".aep"));
  L("kuruldu " + V.sure);
} catch (err) { L("HATA " + String(err.message) + " satir " + String(err.line)); }
LOG.close();
