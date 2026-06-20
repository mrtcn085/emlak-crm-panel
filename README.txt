EMLAK CRM V12 CLOUD / SUPABASE

Bu paket bilgisayar açık kalmadan kullanılacak bulut CRM panelinin ilk sürümüdür.
Sistem frontend + Supabase şeklinde çalışır. Python gerekmez.

KLASÖRLER
1) panel/
   Buluta yükleyeceğin web panelidir.

2) extension/
   Sahibinden açık ilanını Supabase CRM'e kaydeden Chrome eklentisidir.

ADIM 1 - CONFIG.JS DOLDUR
panel/config.js dosyasını Not Defteri ile aç.
Şunları doldur:

SUPABASE_URL: Supabase Project URL
SUPABASE_KEY: Supabase publishable key veya anon key

KESİNLİKLE service_role key yazma.

ADIM 2 - PANELİ TEST ET
panel/index.html dosyasını çift tıklayıp açabilirsin.
Daha temiz test için panel klasörünü ücretsiz statik site olarak yayınla.

ADIM 3 - SUPABASE AUTH KULLANICI
Supabase > Authentication > Users kısmından kendini ve arkadaşını ekle.
Veya panelde Kayıt Ol butonu ile kayıt oluştur.
Mail onayı açıksa e-postayı onaylamak gerekir.

ADIM 4 - CHROME EKLENTİ
Chrome: chrome://extensions/
Geliştirici modu aç.
Paketlenmemiş öğe yükle > extension klasörünü seç.
Eklenti içinde Supabase URL, key, e-posta, şifre yaz ve Giriş Yap.
Sonra sahibinden ilanında 'Bu ilanı CRM'e kaydet' butonunu kullan.

ÖNEMLİ
- Her kullanıcı kendi kayıtlarını görür.
- Bu sürüm Sahibinden'i otomatik gezmez.
- Eklenti sadece açık ilanın görünen bilgilerini kaydeder.
- WhatsApp butonu otomatik mesaj göndermez; sadece sohbet ekranını açar.
- Emsal fiyat analizi sadece CRM'de kayıtlı portföy/ilan arşivi verilerinden hesaplanır.


V12.1 - V11 GÖRÜNÜM CLOUD
Bu paket V12 Supabase cloud panelinin arayüzünü V11 masaüstü paneline benzetir:
- koyu tema
- sol menü
- kart/tablo düzeni
- V11 benzeri dashboard düzeni
- WhatsApp, eşleştirme, emsal ve komisyon hesapları korunur

Kurulum:
1) panel/config.js içine Supabase Project URL ve publishable/anon key yaz.
2) panel/index.html dosyasını açarak test et.
3) Render/Netlify/Vercel gibi statik siteye panel klasörünü yükleyebilirsin.
4) Chrome eklentisi için extension klasörünü yükle.
