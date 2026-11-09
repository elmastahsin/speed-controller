# Chrome Web Store yayını

Brave'in ayrı bir extension mağazası yok; Brave kullanıcıları Chrome Web Store'dan kurar.
Bu klasördeki metinler Developer Dashboard'daki alanlara kopyalanmak için.

## Adımlar

1. **Developer hesabı:** Chrome Web Store Developer Dashboard'da kayıt ol (tek seferlik kayıt ücreti var).
   Google hesabında 2 adımlı doğrulama açık olmalı.
2. **Zip:** `scripts/package.sh` → `dist/speed-controller-<version>.zip`.
3. **Yükle:** Dashboard → New item → zip'i yükle.
4. **Store listing** sekmesi: aşağıdaki açıklama, kategori, dil (Türkçe), görseller.
5. **Privacy** sekmesi: aşağıdaki single purpose, izin gerekçeleri ve veri kullanımı cevapları.
   Privacy policy URL'i için `privacy-policy.md`'yi herkese açık bir yerde yayınla (GitHub Pages, gist vb.).
6. **Submit for review.** İnceleme süresi değişken; geniş host izni olmadığı için genelde daha kısa sürer.

Yeni sürüm: `manifest.json` içindeki `version`'ı artır → `scripts/package.sh` → Dashboard'da yeni paketi yükle.

## Görseller

| Görsel | Boyut | Durum |
| --- | --- | --- |
| Store icon | 128×128 | `icons/icon128.png` |
| Screenshot (en az 1) | 1280×800 veya 640×400 | Elle alınacak: YouTube'da overlay + açık popup |
| Small promo tile | 440×280 | Dashboard isterse hazırlanacak |

## Listing metinleri

**Ad:** Speed Controller (manifest'ten gelir)

**Özet:** manifest `description` alanından gelir (en fazla 132 karakter).

**Kategori önerisi:** Tools / Araçlar

**Açıklama:**

```
Speed Controller, web sayfalarındaki video ve audio oynatma hızını klavyeden ve tek tıkla kontrol etmenizi sağlar.

Yalnızca sizin açtığınız sekmede çalışır: toolbar'daki ikona tıklayıp "Bu sekmede aç" demediğiniz sürece hiçbir sayfaya dokunmaz, diğer sekmeler etkilenmez.

Özellikler
• S / D: hızı azalt / artır
• R: 1.00x'e sıfırla
• G: 1.00x ile tercih ettiğiniz hız arasında geçiş
• Z / X: 10 saniye geri / ileri
• V: video üstündeki hız göstergesini aç/kapat
• Popup'ta hazır hızlar (0.5x – 3x) ve ayarlar
• 0.1x – 16x aralığı, ayarlanabilir adım

Gizlilik
Hiçbir veri toplanmaz veya gönderilmez. Ayarlar yalnızca tarayıcınızda saklanır. Tüm sitelere erişim izni istenmez.
```

## Privacy sekmesi cevapları

**Single purpose:**

```
Web sayfalarındaki video ve audio öğelerinin oynatma hızını kontrol etmek.
```

**İzin gerekçeleri:**

| İzin | Gerekçe |
| --- | --- |
| `activeTab` | Kullanıcı popup'ta "Bu sekmede aç" dediğinde yalnızca o sekmeye erişmek için. Başka sekmelere ve sitelere erişilmez. |
| `scripting` | Hız kontrol script'ini kullanıcının açtığı sekmeye `chrome.scripting.executeScript` ile yüklemek için. |
| `storage` | Kullanıcı ayarlarını (hız adımı, tercih edilen hız, gösterge tercihi) tarayıcının yerel deposunda saklamak için. |

**Remote code:** Hayır. Tüm JavaScript paketin içinde, uzaktan kod yüklenmiyor.

**Data usage:** Hiçbir veri kategorisi işaretlenmez (veri toplanmıyor). Üç beyan kutusu işaretlenir
(veri satılmıyor, ana amaç dışında kullanılmıyor, kredi değerlendirmesi için kullanılmıyor).
