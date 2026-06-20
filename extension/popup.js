const $=id=>document.getElementById(id);
const clean=s=>(s||'').replace(/\s+/g,' ').trim();
const status=(id,msg,cls='muted')=>{const el=$(id);el.className=cls;el.textContent=msg};
async function getSettings(){return await chrome.storage.local.get(['url','key','email','pass','access_token','user_id']);}
async function setSettings(o){return await chrome.storage.local.set(o);}
window.addEventListener('DOMContentLoaded',async()=>{const s=await getSettings(); ['url','key','email','pass'].forEach(k=>{if(s[k]) $(k).value=s[k]}); if(s.access_token) status('loginStatus','Giriş token mevcut.','ok');});
$('saveSettings').onclick=async()=>{await setSettings({url:$('url').value.trim(),key:$('key').value.trim(),email:$('email').value.trim(),pass:$('pass').value}); status('loginStatus','Ayarlar kaydedildi.','ok')};
$('login').onclick=async()=>{try{const url=$('url').value.trim(), key=$('key').value.trim(); const res=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value.trim(),password:$('pass').value})}); const j=await res.json(); if(!res.ok) throw new Error(j.error_description||j.msg||j.error||'Giriş başarısız'); await setSettings({url,key,email:$('email').value.trim(),pass:$('pass').value,access_token:j.access_token,user_id:j.user?.id}); status('loginStatus','Giriş başarılı.','ok')}catch(e){status('loginStatus','Hata: '+e.message,'err')}};
$('saveListing').onclick=async()=>{try{const s=await getSettings(); if(!s.url||!s.key||!s.access_token||!s.user_id) throw new Error('Önce eklenti ayarlarından giriş yap.'); const [tab]=await chrome.tabs.query({active:true,currentWindow:true}); if(!tab?.id || !tab.url.includes('sahibinden.com')) throw new Error('Sahibinden ilan sayfasında olmalısın.'); const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id}, func:extractListing}); const payload={...result,user_id:s.user_id}; const res=await fetch(`${s.url}/rest/v1/ilan_arsivi?on_conflict=user_id,ilan_no`,{method:'POST',headers:{apikey:s.key,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)}); const j=await res.text(); if(!res.ok) throw new Error('Supabase kayıt hatası: '+j); status('status',`Kaydedildi: ${payload.ilan_no||payload.baslik||'ilan'} | Tel: ${payload.telefon||'yok'}`,'ok')}catch(e){status('status','Hata: '+e.message,'err')}};
function extractListing(){
 const clean=s=>(s||'').replace(/\s+/g,' ').trim(); const text=document.body.innerText||''; const lines=text.split(/\n|\r/).map(clean).filter(Boolean);
 const first=selectors=>{for(const sel of selectors){const el=document.querySelector(sel); if(el&&clean(el.innerText||el.textContent))return clean(el.innerText||el.textContent); if(el&&el.getAttribute&&clean(el.getAttribute('content')))return clean(el.getAttribute('content'));}return ''};
 const findAfter=label=>{const i=lines.findIndex(x=>x.toLocaleLowerCase('tr-TR')===label.toLocaleLowerCase('tr-TR')); if(i>=0&&lines[i+1])return lines[i+1]; return ''};
 const priceText=first(['.classifiedInfo h3','.classifiedPrice','[class*=price]'])||(text.match(/[0-9\.\,\s]{4,}\s*TL/i)?.[0]||'');
 const toNum=s=>{const n=Number(String(s||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.')); return Number.isFinite(n)?n:null};
 const baslik=first(['h1','meta[property="og:title"]'])||document.title;
 const ilan_no=findAfter('İlan No') || (location.href.match(/-(\d{7,})\/?$/)?.[1]||'');
 const tur=findAfter('Emlak Tipi')||findAfter('Konut Tipi')||findAfter('İşyeri Tipi')||(baslik.match(/arsa|tarla/i)?'arsa':baslik.match(/dükkan|dukkan|iş yeri|isyeri|ofis/i)?'is_yeri':'konut');
 const islem=baslik.match(/kiralık|kiralik/i)?'kiralik':'satilik';
 const konum=first(['.classifiedLocation','[class*=classifiedLocation]']) || '';
 let sehir=findAfter('İl'), ilce=findAfter('İlçe'), mahalle=findAfter('Mahalle');
 if(!sehir){const crumbs=[...document.querySelectorAll('a, span')].map(x=>clean(x.innerText)).filter(Boolean); const art=crumbs.findIndex(x=>x==='Artvin'); if(art>=0){sehir=crumbs[art]; ilce=crumbs[art+1]||''; mahalle=crumbs[art+2]||''}}
 const phoneRegex=/(?:\+90|0090|0)?\s*\(?\s*(?:5\d{2}|[2-4]\d{2})\s*\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/g;
 const tel=(text.match(phoneRegex)||[]).slice(0,2).join(', ');
 let ad='';
 // Sağ panelde genelde isim, "Hesap açma tarihi" satırının üstünde durur.
 for(let i=0;i<lines.length;i++){ if(/hesap açma tarihi|hesap acma tarihi/i.test(lines[i])){ for(let j=i-1;j>=Math.max(0,i-5);j--){const cand=lines[j].replace(phoneRegex,'').trim(); if(/^[A-ZÇĞİÖŞÜa-zçğıöşü .'-]{2,60}$/.test(cand)&&!/cep|telefon|ilan|satılık|kiralık|tl|emlak/i.test(cand)){ad=cand;break}} if(ad)break; } }
 const raw=[]; document.querySelectorAll('img').forEach(img=>[img.currentSrc,img.src,img.getAttribute('data-src'),img.getAttribute('data-original')].forEach(u=>{if(u)raw.push(u)}));
 const foto_urls=[...new Set(raw.map(u=>{try{return new URL(u,location.href).href}catch{return''}}).filter(u=>/^https?:/.test(u)&&!/logo|sprite|icon|avatar|map|blank|loading/i.test(u)&&/(sahibinden|shbdn|jpg|jpeg|png|webp|image|photo)/i.test(u)))].slice(0,30);
 return {ilan_no,url:location.href,baslik,tur,islem_tipi:islem,fiyat:toNum(priceText),fiyat_text:priceText,sehir,ilce,mahalle,konum,oda:findAfter('Oda Sayısı'),brut_m2:toNum(findAfter('m² (Brüt)')||findAfter('m²')),net_m2:toNum(findAfter('m² (Net)')),kimden:findAfter('Kimden'),ad_soyad:ad,telefon:tel,aciklama:first(['#classifiedDescription','.classifiedDescription']),detaylar:{},foto_urls};
}
