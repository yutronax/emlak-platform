var LOG = new File("C:/inza-ae/log/menu_test.txt"); LOG.encoding="UTF-8"; LOG.open("w");
function L(s){ LOG.writeln(s); }
try {
app.newProject();
var proj = app.project, M="C:/inza-ae/medya/";
var A = proj.importFile(new ImportOptions(new File(M+"salon.mp4")));
var B = proj.importFile(new ImportOptions(new File(M+"balkon2.mp4")));
var D = proj.importFile(new ImportOptions(new File(M+"dron.mp4")));
function koy(c, it, t0){ var l=c.layers.add(it); l.startTime=t0; l.property("Scale").setValue([50,50]); return l; }
function ekle(l, ad){ try { var e=l.property("Effects").addProperty(ad); return e; } catch(x){ return null; } }
function adlar(e){ var s=[]; for (var i=1;i<=e.numProperties;i++){ var p=e.property(i); s.push(i+":"+p.name+(p.propertyValueType==PropertyValueType.LAYER_INDEX?"[L]":"")); } return s.join(" | "); }
var GEC = ["S_SwishPan","S_WhipLash","S_HyperPush","S_HyperPull","S_Swish3D","S_DissolveLightLeak","S_DissolveDefocus","S_DissolveFilm","S_FilmBurnTransition","S_StripSlideTransition"];
for (var g=0; g<GEC.length; g++){
  var c = proj.items.addComp("T_"+GEC[g], 540, 960, 1, 3, 30);
  var b = koy(c, B, 0); var a = koy(c, A, 0);
  var e = ekle(a, GEC[g]);
  if (!e){ L("YOK "+GEC[g]); c.remove(); continue; }
  var not="";
  var p6=null;
  for (var i=1;i<=e.numProperties;i++){ var p=e.property(i), n=p.name;
    if (p.propertyValueType==PropertyValueType.LAYER_INDEX){ try { p.setValue(b.index); } catch(z){ not+=" bgHATA"; } }
    else if (n=="Auto Trans"){ try { p.setValue(1); } catch(z){ not+=" autoHATA"; } }
    else if (!p6 && (/Percent$/.test(n) || n=="Amount")) p6=p;
  }
  var ust = 100;
  try { if (p6.hasMax) ust = p6.maxValue; } catch(z){}
  if (ust > 100) ust = 100;
  try { p6.setValueAtTime(0.9,0); p6.setValueAtTime(2.1,ust); } catch(z){ not+=" yuzdeHATA "+String(z.message); }
  L("GECIS "+GEC[g]+" "+p6.name+" 0->"+ust+not);
}
var TEK = [["S_LightLeak",A],["S_Rays",B],["S_LensFlareAutoTrack",D],["S_Glint",A],["S_BokehLights",A],["S_UltraGlow",B],["S_Halation",B],["S_FilmEffect",A],["S_UltraGrain",A],["S_Vignette",A],["S_BleachBypass",A],["S_DuoTone",A],["S_Tint",A],["S_SoftFocus",A],["S_Shake",A]];
for (var k=0;k<TEK.length;k++){
  var c = proj.items.addComp("E_"+TEK[k][0], 540, 960, 1, 3, 30);
  var l = koy(c, TEK[k][1], 0);
  var e = ekle(l, TEK[k][0]);
  if (!e){ L("YOK "+TEK[k][0]); c.remove(); continue; }
  L("EFEKT "+TEK[k][0]+" :: "+adlar(e));
}
var r = proj.items.addComp("E_Referans", 540, 960, 1, 3, 30); koy(r, A, 0);
for (var q=1;q<=proj.numItems;q++){ var it=proj.item(q); if (it instanceof CompItem){ var rq=proj.renderQueue.items.add(it); var om=rq.outputModule(1); try{ om.applyTemplate("Lossless"); }catch(z){} om.file=new File("C:/inza-ae/test/"+it.name+".avi"); } }
try{ proj.gpuAccelType = GpuAccelType.SOFTWARE; L("gpu yazilim"); }catch(z){ L("gpu ayar yok "+String(z.message)); }
proj.save(new File("C:/inza-ae/test/menu_test.aep"));
L("kuruldu");
} catch(err){ L("HATA "+String(err.message)+" satir "+String(err.line)); }
LOG.close();
