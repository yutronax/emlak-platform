var LOG = new File("C:/inza-ae/log/ae_sablon.txt"); LOG.encoding="UTF-8"; LOG.open("w");
function L(s){ LOG.writeln(s); }
try {
app.beginUndoGroup("ilan deneme");
var M = "C:/inza-ae/medya/";
var proj = app.project;
var comp = proj.items.addComp("INZA_deneme3", 1080, 1920, 1, 14, 30);
var klipler = [["dron.mp4",0,4.5],["salon.mp4",1,4.5],["balkon2.mp4",0,4.2]];
var t = 0, GEC = 0.6, katlar = [];
for (var i=0;i<klipler.length;i++){
  var it = proj.importFile(new ImportOptions(new File(M+klipler[i][0])));
  var ly = comp.layers.add(it); ly.moveToEnd();
  ly.startTime = t - klipler[i][1]; ly.inPoint = t; ly.outPoint = t + klipler[i][2];
  var sc = ly.property("Scale"); sc.setValueAtTime(t,[100,100]); sc.setValueAtTime(t+klipler[i][2],[106,106]);
  katlar.push(ly); t += klipler[i][2] - GEC;
}
// geçişler: Sapphire Swish Pan (yoksa CC Light Wipe) — gelen klibin başına
function efekt(ly, adlar){ for (var j=0;j<adlar.length;j++){ try { var e = ly.property("Effects").addProperty(adlar[j]); if (e){ L("efekt ok: "+adlar[j]); return e; } } catch(x){ L("yok: "+adlar[j]+" "+x); } } return null; }
for (var i=1;i<katlar.length;i++){
  var ly = katlar[i];
  var e = efekt(ly, ["S_SwishPan","BCC Swish Pan","CC Light Wipe"]);
  var op = ly.property("Opacity"); op.setValueAtTime(ly.inPoint,0); op.setValueAtTime(ly.inPoint+GEC,100);
}
// ışık kaçağı: ayar katmanı
var adj = comp.layers.addSolid([1,1,1],"isik",1080,1920,1,14); adj.adjustmentLayer = true; adj.moveToBeginning();
efekt(adj, ["S_LightLeak","BCC Light Leaks","CC Light Sweep"]);
// yazılar
function yazi(metin, alt, t0, t1, y){
  var tl = comp.layers.addText(metin); var td = tl.property("Source Text").value;
  td.fontSize = (metin.length>14?78:130); td.fillColor=[1,1,1]; td.applyStroke=false; td.justification = ParagraphJustification.CENTER_JUSTIFY;
  td.font = "Impact";
  tl.property("Source Text").setValue(td);
  tl.property("Position").setValue([540,y]); tl.inPoint=t0; tl.outPoint=t1;
  var sh = tl.property("Effects").addProperty("ADBE Drop Shadow"); sh.property(4).setValue(12); sh.property(5).setValue(25);
  var an = tl.property("Text").property("Animators").addProperty("ADBE Text Animator");
  an.property("Properties").addProperty("ADBE Text Opacity").setValue(0);
  an.property("Properties").addProperty("ADBE Text Position 3D").setValue([0,80,0]);
  var sel = an.property("Selectors").addProperty("ADBE Text Selector");
  var st = sel.property("Start"); st.setValueAtTime(t0,0); st.setValueAtTime(t0+0.8,100);
  var o = tl.property("Opacity"); o.setValueAtTime(t1-0.3,100); o.setValueAtTime(t1,0);
  if (alt){ var a = comp.layers.addText(alt); var ad=a.property("Source Text").value; ad.fontSize=48; ad.fillColor=[0.95,0.75,0.3]; ad.justification=ParagraphJustification.CENTER_JUSTIFY; a.property("Source Text").setValue(ad);
    a.property("Position").setValue([540,y+80]); a.inPoint=t0+0.5; a.outPoint=t1; a.property("Effects").addProperty("ADBE Drop Shadow"); }
}
yazi("MALATYA CADDESİ","Ataşehir · Ana cadde üzerinde",0.6,4.0,520);
yazi("GÜN IŞIĞIYLA DOLAN SALON",null,4.5,8.0,1250);
yazi("CAM BALKON","Geniş kullanım alanı · Ana cadde cepheli",8.6,12.2,960);
comp.duration = t + GEC;
comp.motionBlur = true;
var ses = proj.importFile(new ImportOptions(new File("C:/inza-ae/medya/inspired.mp3"))); comp.layers.add(ses).moveToEnd();
proj.save(new File("C:/inza-ae/INZA_deneme3.aep"));
var rq = proj.renderQueue.items.add(comp);
rq.outputModule(1).file = new File("C:/inza-ae/cikti/ae-deneme.mov");
L("kuruldu; süre " + comp.duration);
app.endUndoGroup();
} catch(err){ LOG.writeln("HATA " + String(err.message) + " satir " + String(err.line)); }
LOG.close();
