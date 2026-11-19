var LOG = new File("C:/inza-ae/log/ayar_test.txt"); LOG.encoding="UTF-8"; LOG.open("w");
function L(s){ LOG.writeln(s); }
try {
app.newProject();
var proj = app.project, M="C:/inza-ae/medya/";
var A = proj.importFile(new ImportOptions(new File(M+"salon.mp4")));
var B = proj.importFile(new ImportOptions(new File(M+"balkon2.mp4")));
function koy(c, it){ var l=c.layers.add(it); l.property("Scale").setValue([50,50]); return l; }
function P(e,ad){ for (var i=1;i<=e.numProperties;i++){ var p=e.property(i); if (p.name.replace(/^\s+/,"")==ad) return p; } return null; }
// k: deger ya da function(eski)
function ayarla(e, ad, k, log){ var p=P(e,ad); if(!p){ log.push(ad+"=YOK"); return; }
  try { var v=p.value; var y=(typeof k=="function")?k(v):k; p.setValue(y); log.push(ad+":"+v+"->"+y); } catch(z){ log.push(ad+" HATA "+String(z.message)); } }
function gecis(ad, efekt, ayarlar){
  var c=proj.items.addComp(ad,540,960,1,3,30); var b=koy(c,B); var a=koy(c,A);
  var e=a.property("Effects").addProperty(efekt); var log=[];
  for (var i=1;i<=e.numProperties;i++){ var p=e.property(i);
    if (p.propertyValueType==PropertyValueType.LAYER_INDEX){ try{p.setValue(b.index);}catch(z){} } }
  ayarla(e,"Auto Trans",1,log);
  var yp=P(e,"Wipe Percent")||P(e,"Dissolve Percent"); yp.setValueAtTime(0.9,0); yp.setValueAtTime(2.1,100);
  for (var k in ayarlar) ayarla(e,k,ayarlar[k],log);
  L(ad+" :: "+log.join(" | "));
}
function efekt(ad, efekt, klip, ayarlar){
  var c=proj.items.addComp(ad,540,960,1,3,30); var l=koy(c,klip);
  var e=l.property("Effects").addProperty(efekt); var log=[];
  for (var k in ayarlar) ayarla(e,k,ayarlar[k],log);
  L(ad+" :: "+log.join(" | "));
}
var yari=function(v){return v*0.5;}, ceyrek=function(v){return v*0.25;};
gecis("T_SwishPan_a","S_SwishPan",{"Swish Auto Trans":1,"Blur Amount":yari});
gecis("T_SwishPan_b","S_SwishPan",{"Swish Auto Trans":2,"Blur Amount":yari});
gecis("T_WhipLash_a","S_WhipLash",{"Swish Auto Trans":1,"Edge Mode":1});
gecis("T_WhipLash_b","S_WhipLash",{"Swish Auto Trans":1,"Edge Mode":2});
gecis("T_WhipLash_c","S_WhipLash",{"Swish Auto Trans":1,"Edge Mode":3});
gecis("T_DissolveLightLeak","S_DissolveLightLeak",{"Transition Brightness":ceyrek,"Saturation":yari,"Glow Brightness":ceyrek});
gecis("T_HyperPush","S_HyperPush",{});
efekt("E_Glint","S_Glint",A,{"Size":ceyrek,"Brightness":yari,"Threshold":function(v){return Math.min(v*1.5+0.1,1);}});
efekt("E_Vignette","S_Vignette",A,{"Radius":function(v){return v*1.6;},"Edge Softness":function(v){return v*2;},"Opacity":0.6});
efekt("E_DuoTone","S_DuoTone",A,{"Color0":[0.086,0.13,0.243],"Color1":[0.95,0.71,0.15],"Mix With Source":0.55});
efekt("E_UltraGlow","S_UltraGlow",B,{"Threshold":0.92,"Brightness":ceyrek});
for (var q=1;q<=proj.numItems;q++){ var it=proj.item(q); if (it instanceof CompItem){ var rq=proj.renderQueue.items.add(it); var om=rq.outputModule(1); try{ om.applyTemplate("Lossless"); }catch(z){} om.file=new File("C:/inza-ae/test/ayar/"+it.name+".avi"); } }
try{ proj.gpuAccelType = GpuAccelType.SOFTWARE; }catch(z){}
proj.save(new File("C:/inza-ae/test/ayar_test.aep"));
L("kuruldu");
} catch(err){ L("HATA "+String(err.message)+" satir "+String(err.line)); }
LOG.close();
