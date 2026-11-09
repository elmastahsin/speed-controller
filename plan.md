# Brave Speed Controller Extension — Plan

## Context
`/Users/tahsin/repo/speed-controller` boş. Brave (Chromium) için Video Speed Controller benzeri bir extension yazılacak: video/audio hızını klavyeyle değiştirme, video üstünde küçük hız overlay'i, toolbar popup'ında preset'ler ve ayarlar.
Kararlar (kullanıcı onaylı): **Klavye + overlay + popup**, **Manifest V3 + vanilla JS, build/dependency yok**. Brave'de "Load unpacked" ile yüklenecek.

## Dosya yapısı (flat, 6 dosya)
```
manifest.json
settings.js     # DEFAULTS + loadSettings(); content script ve popup ortak kullanır
content.js      # media takibi, hız uygulama, klavye, overlay, mesaj handler
popup.html
popup.css
popup.js
```
Icon yok (Brave harf ikonu gösterir) — sonraki adım olarak bırakılıyor.

## Adımlar

### 1. `manifest.json`
- `manifest_version: 3`, `permissions: ["storage"]`, `action.default_popup: popup.html`
- `content_scripts`: `matches: ["<all_urls>"]`, `js: ["settings.js", "content.js"]`, `all_frames: true`, `match_about_blank: true`, `run_at: "document_idle"`

### 2. `settings.js`
- `DEFAULTS = { step: 0.1, preferredSpeed: 1.8, rememberSpeed: true, showOverlay: true, lastSpeed: 1.0 }`
- `MIN_SPEED = 0.1`, `MAX_SPEED = 16`, `clampSpeed(s)` (2 ondalığa yuvarla)
- Tümü `chrome.storage.local`'da (lastSpeed sık yazıldığı için sync quota'sına girmesin diye local).

### 3. `content.js`
- **Media takibi**: `querySelectorAll('video, audio')` + `MutationObserver` (eklenen node'lar ve alt ağaçları). Takip edilenler `Set`'te; DOM'dan çıkanlar observer'da temizlenir.
- **Hız state'i**: frame başına `currentSpeed`; başlangıçta `rememberSpeed ? lastSpeed : 1`. `setSpeed(s)` → clamp → tüm media'ya `playbackRate` → overlay'leri güncelle → `rememberSpeed` açıksa `lastSpeed` yaz.
- **Site reset'lerine karşı**: `loadedmetadata`, `play` event'lerinde hızı yeniden uygula; `ratechange`'te değer `currentSpeed`'den farklıysa geri yaz. Loop guard: 1 sn içinde >5 düzeltme olursa site'nin değerini kabul et ve `currentSpeed`'i ona eşitle (sonsuz ping-pong olmasın).
- **Klavye** (`window` keydown, capture phase):
  - Ctrl/Meta/Alt basılıysa veya hedef `input/textarea/select/contenteditable` ise yok say.
  - Frame'de media yoksa hiçbir şey yapma (tuşu yutma).
  - `S` −step, `D` +step, `R` 1.0x, `G` 1.0 ↔ preferredSpeed, `Z` −10 sn, `X` +10 sn, `V` overlay göster/gizle.
  - İşlenen tuşta `preventDefault` + `stopPropagation`.
  - Seek hedefi: oynayan media, yoksa en büyük görünür video.
- **Overlay** (sadece `video`): video'nun parent'ına `insertBefore` ile wrapper div, `attachShadow({mode: 'closed'})` ile stil izolasyonu, `position:absolute; top/left; z-index` max. İçerik: `1.50x` etiketi; hover'da `−` / `+` butonları. Boşta düşük opacity, hız değişince ~1.5 sn tam görünür. `showOverlay` / `V` ile gizlenir. Player container fullscreen olduğunda overlay içinde kaldığı için görünür.
- **Mesajlar** (`chrome.runtime.onMessage`):
  - `{type: 'get'}` → media varsa `{speed, mediaCount}` döner; yoksa cevap vermez (diğer frame cevaplasın).
  - `{type: 'set', speed}` / `{type: 'adjust', delta}` → uygula, yeni hızı döner.
- `chrome.storage.onChanged` ile `step`, `showOverlay`, `preferredSpeed` canlı güncellenir.

### 4. Popup (`popup.html/.css/.js`)
- Üstte büyük hız göstergesi, `−` / `+` / reset butonları.
- Preset butonları: 0.5, 1, 1.25, 1.5, 1.75, 2, 2.5, 3.
- Ayarlar: step (number), preferred speed (number), remember speed (checkbox), show overlay (checkbox) → değişince `chrome.storage.local.set`.
- Kısayol listesi (statik).
- Açılışta `chrome.tabs.query({active, currentWindow})` → `tabs.sendMessage({type:'get'})`. Hata/cevapsızsa: "Bu sayfada video/audio yok veya sayfa yenilenmeli" mesajı, hız kontrolleri disabled (ayarlar yine düzenlenebilir).
- Light/dark: `prefers-color-scheme` ile.

## Bilinen kısıtlar (v1'de çözülmeyecek, listeleniyor)
- Shadow DOM içindeki video'lar (bazı custom player'lar) yakalanmaz.
- Video iframe içindeyken focus top frame'deyse kısayollar çalışmaz (önce video'ya tıklamak gerekir).
- Kısayol tuşları sabit; özelleştirme yok.
- Site'nin kendi hız menüsü extension hızı tarafından ezilir (loop guard tetiklenmedikçe).
- `brave://` sayfaları ve Web Store'da content script çalışmaz.

## Doğrulama
1. Statik: `python3 -m json.tool manifest.json`, `node --check content.js popup.js settings.js`.
2. Brave: `brave://extensions` → Developer mode → Load unpacked → proje klasörü. Hata konsolu temiz olmalı.
3. Manuel test (YouTube + düz HTML5 `<video>`/`<audio>` içeren scratchpad test sayfası):
   - S/D/R/G/Z/X/V çalışıyor, overlay hızı gösteriyor, fullscreen'de görünüyor.
   - YouTube arama kutusuna yazarken kısayol tetiklenmiyor.
   - YouTube'da sonraki video'ya geçince hız korunuyor.
   - Popup preset'leri ve −/+ aktif tab'a uygulanıyor; media olmayan sayfada uyarı çıkıyor.
   - Ayar değişiklikleri açık tab'a canlı yansıyor; sayfa yenilenince `rememberSpeed` çalışıyor.
