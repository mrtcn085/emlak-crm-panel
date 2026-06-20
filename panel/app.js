const cfg = window.EMLAK_CRM_CONFIG || {};
const badConfig = !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('BURAYA_') || !cfg.SUPABASE_KEY || cfg.SUPABASE_KEY.includes('BURAYA_');
if (badConfig) document.addEventListener('DOMContentLoaded',()=>document.getElementById('configWarn').style.display='block');
const sb = badConfig ? null : supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

let session = null;
let currentUser = null;
let cache = { kisiler: [], portfoyler: [], ilanlar: [], gorevler: [], notlar: [] };
const sections = ['dashboard','kisiler','portfoyler','ilanlar','eslesme','gorevler','ayarlar'];
const navNames = {dashboard:'📊 Dashboard',kisiler:'👥 Kişiler',portfoyler:'🏘️ Portföyler',ilanlar:'🗂️ İlan Arşivi',eslesme:'🎯 Eşleştirme',gorevler:'✅ Görevler',ayarlar:'⚙️ Ayarlar'};

const $ = (id)=>document.getElementById(id);
const esc = (s)=>String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const num = (v)=>{ if(v===null||v===undefined||v==='') return null; const n=Number(String(v).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',', '.')); return Number.isFinite(n)?n:null; };
const money = (v)=> v==null || v==='' ? '-' : Number(v).toLocaleString('tr-TR')+' TL';
const cleanPhone = (p)=>String(p||'').replace(/[^0-9+]/g,'');
function waLink(phone){ let p=cleanPhone(phone); if(!p) return ''; if(p.startsWith('+')) p=p.slice(1); if(p.startsWith('00')) p=p.slice(2); if(p.startsWith('0')) p='90'+p.slice(1); if(!p.startsWith('90') && p.length===10) p='90'+p; return `https://wa.me/${p}`; }
function waHtml(phone){ const u=waLink(phone); return u ? `<a class="wa" target="_blank" href="${u}">💬 WhatsApp Aç</a>` : '-'; }
function norm(s){ return String(s||'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').trim(); }
function typeGroup(t){ const x=norm(t); if(/konut|daire|ev|villa|apart/.test(x)) return 'konut'; if(/arsa|tarla|arazi/.test(x)) return 'arsa'; if(/is|iş|dukkan|dükkan|ofis|magaza|mağaza/.test(x)) return 'is_yeri'; return x || ''; }
function transType(t){ const x=norm(t); if(/kira/.test(x)) return 'kiralik'; if(/sat/.test(x)) return 'satilik'; return x || ''; }
function colorByDiff(diff){ if(diff==null) return 'blue'; if(diff <= -7) return 'green'; if(diff <= 5) return 'blue'; if(diff <= 12) return 'yellow'; return 'red'; }
function statusByDiff(diff){ if(diff==null) return 'emsal yok'; if(diff <= -7) return 'alınabilir / emsal altı'; if(diff <= 5) return 'emsale yakın'; if(diff <= 12) return 'pazarlık gerekir'; return 'pahalı görünüyor'; }
function parseFirstPhoto(v){ try{ const arr=Array.isArray(v)?v:JSON.parse(v||'[]'); return arr[0]||''; }catch{return ''} }
function estatePrice(o){ return num(o.fiyat ?? o.fiyat_text); }
function commission(o){ const fiyat=estatePrice(o); if(!fiyat) return {amount:null,text:'-'}; const islem=transType(o.islem_tipi || o.baslik || ''); if(islem==='kiralik') return {amount:fiyat,text:`Komisyon: ${money(fiyat)} (1 kira bedeli)`}; const base=fiyat*0.02; const kdv=base*0.20; return {amount:base+kdv,text:`Komisyon: ${money(base+kdv)} (%2 + %20 KDV)`}; }
function comparableFor(target){
  const all=[...cache.portfoyler.map(x=>({...x,_src:'portföy'})), ...cache.ilanlar.map(x=>({...x,_src:'ilan'}))];
  const tPrice=estatePrice(target); const tg=typeGroup(target.tur || target.kategori || target.baslik); const islem=transType(target.islem_tipi || target.baslik);
  const sehir=norm(target.sehir); const ilce=norm(target.ilce); const mahalle=norm(target.mahalle); const oda=norm(target.oda); const m2=num(target.brut_m2 || target.net_m2);
  let comps=all.filter(x=>String(x.id)!==String(target.id || '') && estatePrice(x) && typeGroup(x.tur||x.kategori||x.baslik)===tg);
  if(islem) comps=comps.filter(x=>!transType(x.islem_tipi||x.baslik) || transType(x.islem_tipi||x.baslik)===islem);
  if(sehir) comps=comps.filter(x=>norm(x.sehir)===sehir || !x.sehir);
  if(ilce) comps=comps.filter(x=>norm(x.ilce)===ilce || !x.ilce);
  let strong=comps;
  if(mahalle) strong=strong.filter(x=>norm(x.mahalle)===mahalle || !x.mahalle);
  if(oda) strong=strong.filter(x=>!x.oda || norm(x.oda)===oda);
  if(m2) strong=strong.filter(x=>{ const xm=num(x.brut_m2||x.net_m2); return !xm || Math.abs(xm-m2)/m2 <= .30; });
  if(strong.length<2) strong=comps;
  const prices=strong.map(estatePrice).filter(Boolean).sort((a,b)=>a-b);
  if(!prices.length || !tPrice) return {avg:null,diff:null,count:prices.length,cls:'blue',text:'Emsal yok'};
  const avg=prices.reduce((a,b)=>a+b,0)/prices.length; const diff=((tPrice-avg)/avg)*100;
  return {avg,diff,count:prices.length,cls:colorByDiff(diff),text:`Emsal: ${money(avg)} | ${diff>0?'+':''}${diff.toFixed(1)}% | ${statusByDiff(diff)} | ${prices.length} kayıt`};
}
function compHtml(o){ const c=comparableFor(o); return `<span class="pill ${c.cls}">${esc(c.text)}</span>`; }
function scoreMatch(kisi, asset){
  let score=0, reasons=[];
  const budget=num(kisi.butce_max), price=estatePrice(asset);
  if(typeGroup(kisi.aranan_tur) && typeGroup(asset.tur||asset.kategori||asset.baslik) && typeGroup(kisi.aranan_tur)===typeGroup(asset.tur||asset.kategori||asset.baslik)){score+=25;reasons.push('tür uyuyor')}
  if(transType(kisi.islem_tipi) && transType(asset.islem_tipi||asset.baslik) && transType(kisi.islem_tipi)===transType(asset.islem_tipi||asset.baslik)){score+=15;reasons.push('işlem tipi uyuyor')}
  if(norm(kisi.ilce) && norm(asset.ilce) && norm(kisi.ilce)===norm(asset.ilce)){score+=20;reasons.push('ilçe uyuyor')} else if(norm(kisi.sehir) && norm(asset.sehir) && norm(kisi.sehir)===norm(asset.sehir)){score+=10;reasons.push('şehir uyuyor')}
  if(norm(kisi.mahalle) && norm(asset.mahalle) && norm(kisi.mahalle)===norm(asset.mahalle)){score+=10;reasons.push('mahalle uyuyor')}
  if(budget && price && price<=budget){score+=20;reasons.push('bütçeye uygun')} else if(budget && price && price<=budget*1.10){score+=10;reasons.push('bütçeye yakın')}
  if(norm(kisi.oda) && norm(asset.oda) && norm(kisi.oda)===norm(asset.oda)){score+=10;reasons.push('oda uyuyor')}
  const minm=num(kisi.min_m2), maxm=num(kisi.max_m2), m2=num(asset.brut_m2||asset.net_m2); if(m2 && ((!minm||m2>=minm)&&(!maxm||m2<=maxm))){score+=10;reasons.push('m² uyuyor')}
  return {score:Math.min(score,100), reasons};
}

async function authInit(){
  if(!sb) return;
  const {data}=await sb.auth.getSession(); session=data.session; currentUser=session?.user || null; updateAuthView();
  sb.auth.onAuthStateChange((event,s)=>{session=s;currentUser=s?.user||null;updateAuthView();});
}
function updateAuthView(){
  if(currentUser){ $('loginView').style.display='none'; $('appView').style.display='block'; $('userLine').textContent='Giriş yapan: '+currentUser.email; buildNav(); loadAll(); }
  else { $('loginView').style.display='block'; $('appView').style.display='none'; }
}
function buildNav(){ $('nav').innerHTML=sections.map(s=>`<button data-sec="${s}" class="${s==='dashboard'?'active':''}">${navNames[s]}</button>`).join(''); document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>showSec(b.dataset.sec)); }
function showSec(id){ sections.forEach(s=>$(s).classList.toggle('active',s===id)); document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.sec===id)); renderSection(id); }
async function loadAll(){
  await Promise.all([loadTable('kisiler'),loadTable('portfoyler'),loadTable('ilan_arsivi','ilanlar'),loadTable('gorevler')]);
  renderAll();
}
async function loadTable(table,key){ const {data,error}=await sb.from(table).select('*').order('created_at',{ascending:false}); if(error) alert(table+' yüklenemedi: '+error.message); else cache[key||table]=data||[]; }
function renderAll(){ sections.forEach(renderSection); }
function renderSection(id){ if(!currentUser) return; if(id==='dashboard') renderDashboard(); if(id==='kisiler') renderKisiler(); if(id==='portfoyler') renderPortfoyler(); if(id==='ilanlar') renderIlanlar(); if(id==='eslesme') renderEslesme(); if(id==='gorevler') renderGorevler(); if(id==='ayarlar') renderAyarlar(); }

function renderDashboard(){
  const buyers=cache.kisiler.filter(k=>/alici|ikisi/.test(norm(k.tip))).length; const assets=[...cache.portfoyler, ...cache.ilanlar];
  const alerts=[]; cache.kisiler.filter(k=>/alici|ikisi/.test(norm(k.tip))).forEach(k=>assets.forEach(a=>{ const m=scoreMatch(k,a); if(m.score>=35) alerts.push({k,a,m}); })); alerts.sort((x,y)=>y.m.score-x.m.score);
  $('dashboard').innerHTML=`<div class="grid"><div class="card"><b>${cache.kisiler.length}</b><br><span class="muted">Kişi</span></div><div class="card"><b>${buyers}</b><br><span class="muted">Alıcı</span></div><div class="card"><b>${cache.portfoyler.length}</b><br><span class="muted">Portföy</span></div><div class="card"><b>${cache.ilanlar.length}</b><br><span class="muted">İlan arşivi</span></div></div>
  <div class="card" style="margin-top:12px"><h3>🔥 Eşleşme Uyarıları - Bu ilanları incele</h3><div class="muted">Eşleştirme verisi: ${buyers} alıcı, ${assets.length} portföy/ilan. Min skor: 35.</div>${alerts.length?matchTable(alerts.slice(0,20)):'<p class="muted">Şu an eşleşme yok. Alıcı bütçe/bölge/tür bilgilerini ve ilan fiyat/konum/tür alanlarını doldur.</p>'}</div>`;
}
function matchTable(rows){ return `<div class="table-wrap"><table class="table"><thead><tr><th>Skor</th><th>Alıcı</th><th>İlan/Portföy</th><th>Fiyat</th><th>Emsal</th><th>Komisyon</th><th>WhatsApp</th></tr></thead><tbody>${rows.map(r=>{const c=commission(r.a); return `<tr><td><b>${r.m.score}</b><br><span class="muted">${esc(r.m.reasons.join(', '))}</span></td><td>${esc(r.k.ad_soyad)}<br>${esc(r.k.telefon||'')}</td><td>${esc(r.a.baslik||r.a.url||'-')}<br><span class="muted">${esc([r.a.sehir,r.a.ilce,r.a.mahalle].filter(Boolean).join(' / '))}</span></td><td>${money(estatePrice(r.a))}</td><td>${compHtml(r.a)}</td><td>${esc(c.text)}</td><td>${waHtml(r.k.telefon)}</td></tr>`}).join('')}</tbody></table></div>` }

function formVal(prefix,names){ const o={}; names.forEach(n=>{ const el=$(`${prefix}_${n}`); if(!el) return; let v=el.value.trim(); if(['fiyat','butce_min','butce_max','min_m2','max_m2','brut_m2','net_m2'].includes(n)) v=num(v); o[n]=v===''?null:v; }); return o; }
async function upsert(table,obj,id){ let q=id?sb.from(table).update(obj).eq('id',id):sb.from(table).insert(obj); const {error}=await q; if(error) alert('Kayıt hatası: '+error.message); else { await loadAll(); } }
async function del(table,id){ if(!confirm('Bu kayıt silinsin mi?')) return; const {error}=await sb.from(table).delete().eq('id',id); if(error) alert('Silme hatası: '+error.message); else await loadAll(); }

function renderKisiler(){
  $('kisiler').innerHTML=`<div class="two"><div class="card"><h3>Kişi Ekle</h3>${fields('kisi',['ad_soyad','telefon','sehir','ilce','mahalle','aranan_tur','islem_tipi','butce_min','butce_max','oda','min_m2','max_m2'],{tip:true,notlar:true})}<button class="btn" onclick="saveKisi()">Kaydet</button></div><div class="card"><h3>Kişiler</h3>${tableKisiler()}</div></div>`;
}
function fields(p,names,opt={}){ let html=''; if(opt.tip) html+=`<div class="field"><label>Tip</label><select id="${p}_tip"><option value="alici">Alıcı</option><option value="satici">Satıcı</option><option value="ikisi">İkisi</option></select></div>`; names.forEach(n=>{ const lab={ad_soyad:'Ad Soyad',telefon:'Telefon',sehir:'Şehir',ilce:'İlçe',mahalle:'Mahalle',aranan_tur:'Tür',islem_tipi:'Satılık/Kiralık',butce_min:'Bütçe Min',butce_max:'Bütçe Max',oda:'Oda',min_m2:'Min m²',max_m2:'Max m²',baslik:'Başlık',tur:'Tür',fiyat:'Fiyat',brut_m2:'Brüt m²',net_m2:'Net m²',satici_ad_soyad:'Satıcı Adı',satici_telefon:'Satıcı Telefon'}[n]||n; html+=`<div class="field"><label>${lab}</label><input id="${p}_${n}"></div>` }); if(opt.notlar) html+=`<div class="field"><label>Notlar</label><textarea id="${p}_notlar"></textarea></div>`; if(opt.aciklama) html+=`<div class="field"><label>Açıklama</label><textarea id="${p}_aciklama"></textarea></div>`; return html; }
window.saveKisi=()=>upsert('kisiler',formVal('kisi',['tip','ad_soyad','telefon','sehir','ilce','mahalle','aranan_tur','islem_tipi','butce_min','butce_max','oda','min_m2','max_m2','notlar']));
function tableKisiler(){ return `<div class="table-wrap"><table class="table"><thead><tr><th>Kişi</th><th>Aradığı</th><th>Bütçe</th><th>WhatsApp</th><th></th></tr></thead><tbody>${cache.kisiler.map(k=>`<tr><td><b>${esc(k.ad_soyad)}</b><br>${esc(k.telefon||'')}<br><span class="muted">${esc([k.sehir,k.ilce,k.mahalle].filter(Boolean).join(' / '))}</span></td><td>${esc(k.tip)}<br>${esc([k.aranan_tur,k.islem_tipi,k.oda].filter(Boolean).join(' / '))}</td><td>${money(k.butce_min)} - ${money(k.butce_max)}</td><td>${waHtml(k.telefon)}</td><td><button class="btn small danger" onclick="del('kisiler','${k.id}')">Sil</button></td></tr>`).join('')}</tbody></table></div>` }

function renderPortfoyler(){
  $('portfoyler').innerHTML=`<div class="two"><div class="card"><h3>Portföy Ekle</h3>${fields('portfoy',['baslik','tur','islem_tipi','fiyat','sehir','ilce','mahalle','oda','brut_m2','net_m2','satici_ad_soyad','satici_telefon'],{aciklama:true})}<button class="btn" onclick="savePortfoy()">Kaydet</button></div><div class="card"><h3>Portföyler</h3>${tablePortfoy()}</div></div>`;
}
window.savePortfoy=()=>upsert('portfoyler',formVal('portfoy',['baslik','tur','islem_tipi','fiyat','sehir','ilce','mahalle','oda','brut_m2','net_m2','satici_ad_soyad','satici_telefon','aciklama']));
function tablePortfoy(){ return `<div class="table-wrap"><table class="table"><thead><tr><th>Portföy</th><th>Fiyat</th><th>Satıcı</th><th></th></tr></thead><tbody>${cache.portfoyler.map(p=>{const c=commission(p);return `<tr><td><b>${esc(p.baslik)}</b><br><span class="muted">${esc([p.tur,p.islem_tipi,p.sehir,p.ilce,p.mahalle,p.oda].filter(Boolean).join(' / '))}</span></td><td>${money(p.fiyat)}<br>${compHtml(p)}<br><span class="muted">${esc(c.text)}</span></td><td>${esc(p.satici_ad_soyad||'-')}<br>${esc(p.satici_telefon||'')}<br>${waHtml(p.satici_telefon)}</td><td><button class="btn small" onclick="goMatchAsset('${p.id}','portfoy')">Alıcı bul</button> <button class="btn small danger" onclick="del('portfoyler','${p.id}')">Sil</button></td></tr>`}).join('')}</tbody></table></div>` }

function renderIlanlar(){
  $('ilanlar').innerHTML=`<div class="card"><h3>İlan Arşivi</h3><p class="muted">Sahibinden eklentisi cloud ayarı yapıldıktan sonra buraya otomatik düşer. Şimdilik manuel kayıt da ekleyebilirsin.</p>${manualIlanForm()}${tableIlanlar()}</div>`;
}
function manualIlanForm(){return `<details><summary><b>Manuel İlan Ekle</b></summary><div class="row">${fields('ilan',['ilan_no','url','baslik','tur','islem_tipi','fiyat','sehir','ilce','mahalle','oda','brut_m2','net_m2','ad_soyad','telefon'])}<div class="field"><label>Foto URL, virgülle</label><input id="ilan_foto_urls"></div><button class="btn" onclick="saveIlan()">İlan Kaydet</button></div></details><hr>`}
window.saveIlan=()=>{ const o=formVal('ilan',['ilan_no','url','baslik','tur','islem_tipi','fiyat','sehir','ilce','mahalle','oda','brut_m2','net_m2','ad_soyad','telefon']); const photos=($('ilan_foto_urls').value||'').split(',').map(x=>x.trim()).filter(Boolean); o.foto_urls=photos; upsert('ilan_arsivi',o); };
function tableIlanlar(){ return `<div class="table-wrap"><table class="table"><thead><tr><th>Görsel</th><th>İlan</th><th>Fiyat</th><th>Kişi</th><th></th></tr></thead><tbody>${cache.ilanlar.map(i=>{const photo=parseFirstPhoto(i.foto_urls);const c=commission(i);return `<tr><td>${photo?`<img class="thumb" src="${esc(photo)}">`:'-'}</td><td><b>${esc(i.baslik||i.ilan_no||'-')}</b><br><span class="muted">${esc([i.tur,i.islem_tipi,i.sehir,i.ilce,i.mahalle,i.oda].filter(Boolean).join(' / '))}</span><br>${i.url?`<a target="_blank" class="muted" href="${esc(i.url)}">İlana git</a>`:''}</td><td>${money(estatePrice(i))}<br>${compHtml(i)}<br><span class="muted">${esc(c.text)}</span></td><td>${esc(i.ad_soyad||'-')}<br>${esc(i.telefon||'')}<br>${waHtml(i.telefon)}</td><td><button class="btn small" onclick="goMatchAsset('${i.id}','ilan')">Alıcı bul</button> <button class="btn small danger" onclick="del('ilan_arsivi','${i.id}')">Sil</button></td></tr>`}).join('')}</tbody></table></div>` }

window.goMatchAsset=(id,type)=>{ showSec('eslesme'); setTimeout(()=>{ $('matchAsset').value=type+':'+id; runAssetMatch(); },50); };
function renderEslesme(){
  const buyers=cache.kisiler.filter(k=>/alici|ikisi/.test(norm(k.tip))); const assets=[...cache.portfoyler.map(x=>({...x,_type:'portfoy'})),...cache.ilanlar.map(x=>({...x,_type:'ilan'}))];
  $('eslesme').innerHTML=`<div class="card"><h3>Eşleştirme</h3><div class="muted">Veri: ${buyers.length} alıcı, ${assets.length} portföy/ilan.</div><div class="row"><div class="field"><label>Portföy/İlan seç</label><select id="matchAsset"><option value="">Seç</option>${assets.map(a=>`<option value="${a._type}:${a.id}">${esc((a._type==='ilan'?'İlan: ':'Portföy: ')+(a.baslik||a.ilan_no||'-'))}</option>`).join('')}</select></div><div class="field"><label>Min Skor</label><input id="minScore" value="30"></div><button class="btn" onclick="runAssetMatch()">Bu ilana alıcı bul</button></div><div id="matchResults"></div></div>`;
}
window.runAssetMatch=()=>{ const v=$('matchAsset').value; const min=num($('minScore').value)||0; if(!v){$('matchResults').innerHTML='<p class="notice">Önce portföy/ilan seç.</p>';return} const [type,id]=v.split(':'); const asset=(type==='ilan'?cache.ilanlar:cache.portfoyler).find(x=>x.id===id); if(!asset){$('matchResults').innerHTML='<p class="notice">Kayıt bulunamadı.</p>';return} const rows=cache.kisiler.filter(k=>/alici|ikisi/.test(norm(k.tip))).map(k=>({k,a:asset,m:scoreMatch(k,asset)})).filter(x=>x.m.score>=min).sort((a,b)=>b.m.score-a.m.score); $('matchResults').innerHTML=rows.length?matchTable(rows):'<p class="muted">Eşleşme bulunamadı. Min skoru düşür veya kriterleri kontrol et.</p>'; };

function renderGorevler(){
  $('gorevler').innerHTML=`<div class="two"><div class="card"><h3>Görev Ekle</h3><div class="field"><label>Başlık</label><input id="gorev_baslik"></div><div class="field"><label>Tarih</label><input id="gorev_tarih" type="date"></div><div class="field"><label>Açıklama</label><textarea id="gorev_aciklama"></textarea></div><button class="btn" onclick="saveGorev()">Kaydet</button></div><div class="card"><h3>Görevler</h3>${tableGorev()}</div></div>`;
}
window.saveGorev=()=>upsert('gorevler',formVal('gorev',['baslik','tarih','aciklama']));
function tableGorev(){ return `<table class="table"><thead><tr><th>Görev</th><th>Tarih</th><th>Durum</th><th></th></tr></thead><tbody>${cache.gorevler.map(g=>`<tr><td>${esc(g.baslik)}<br><span class="muted">${esc(g.aciklama||'')}</span></td><td>${esc(g.tarih||'-')}</td><td>${esc(g.durum||'')}</td><td><button class="btn small danger" onclick="del('gorevler','${g.id}')">Sil</button></td></tr>`).join('')}</tbody></table>` }
function renderAyarlar(){ $('ayarlar').innerHTML=`<div class="card"><h3>Ayarlar</h3><p><b>Kullanıcı:</b> ${esc(currentUser?.email)}</p><p class="muted">Bu panel Supabase RLS ile çalışır. Kayıtlar user_id üzerinden ayrılır.</p><button class="btn secondary" onclick="loadAll()">Verileri Yenile</button></div>`; }

$('loginBtn').onclick=async()=>{ if(!sb) return alert('config.js eksik.'); const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value,password:$('loginPass').value}); $('loginMsg').textContent=error?error.message:'Giriş yapıldı'; };
$('signupBtn').onclick=async()=>{ if(!sb) return alert('config.js eksik.'); const {error}=await sb.auth.signUp({email:$('loginEmail').value,password:$('loginPass').value}); $('loginMsg').textContent=error?error.message:'Kayıt oluşturuldu. Mail onayı açıksa e-postanı kontrol et.'; };
$('logoutBtn').onclick=async()=>{ await sb.auth.signOut(); };
window.del=del;

authInit();
