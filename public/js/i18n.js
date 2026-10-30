// Languages a menu can be shown in, with the fixed words of the guest page in each.
export const LANGS = {
  en: { name: 'English', native: 'English' },
  si: { name: 'Sinhala', native: 'සිංහල' },
  ta: { name: 'Tamil', native: 'தமிழ்' },
  hi: { name: 'Hindi', native: 'हिन्दी' },
  zh: { name: 'Chinese', native: '中文' },
  ja: { name: 'Japanese', native: '日本語' },
  ko: { name: 'Korean', native: '한국어' },
  ru: { name: 'Russian', native: 'Русский' },
  de: { name: 'German', native: 'Deutsch' },
  fr: { name: 'French', native: 'Français' },
  es: { name: 'Spanish', native: 'Español' },
  it: { name: 'Italian', native: 'Italiano' },
  nl: { name: 'Dutch', native: 'Nederlands' },
  ar: { name: 'Arabic', native: 'العربية', rtl: true },
};

const T = {
  search: { en: 'Search the menu…', si: 'මෙනුවේ සොයන්න…', ta: 'மெனுவில் தேடுங்கள்…', hi: 'मेनू में खोजें…', zh: '搜索菜单…', ja: 'メニューを検索…', ko: '메뉴 검색…', ru: 'Поиск по меню…', de: 'Speisekarte durchsuchen…', fr: 'Rechercher dans le menu…', es: 'Buscar en el menú…', it: 'Cerca nel menù…', nl: 'Zoek in het menu…', ar: 'ابحث في القائمة…' },
  chefPicks: { en: "Chef's picks", si: 'සූපවේදියාගේ තේරීම්', ta: 'சமையல்காரரின் தேர்வுகள்', hi: 'शेफ़ की पसंद', zh: '主厨推荐', ja: 'シェフのおすすめ', ko: '셰프 추천', ru: 'Выбор шефа', de: 'Empfehlungen des Küchenchefs', fr: 'Suggestions du chef', es: 'Recomendaciones del chef', it: 'Scelti dallo chef', nl: 'Aanraders van de chef', ar: 'اختيارات الشيف' },
  mustTry: { en: 'Must try', si: 'අනිවාර්යයෙන් රස බලන්න', ta: 'கட்டாயம் சுவையுங்கள்', hi: 'ज़रूर चखें', zh: '必尝', ja: 'ぜひ', ko: '꼭 드셔보세요', ru: 'Обязательно', de: 'Unbedingt probieren', fr: 'À goûter', es: 'Imprescindible', it: 'Da provare', nl: 'Moet je proeven', ar: 'جرّبه' },
  soldOut: { en: 'Sold out', si: 'අවසන්', ta: 'தீர்ந்துவிட்டது', hi: 'ख़त्म', zh: '售罄', ja: '売り切れ', ko: '품절', ru: 'Нет в наличии', de: 'Ausverkauft', fr: 'Épuisé', es: 'Agotado', it: 'Esaurito', nl: 'Uitverkocht', ar: 'نفد' },
  soldOutToday: { en: 'Sorry — this dish is sold out today.', si: 'කණගාටුයි — මෙම ආහාරය අද අවසන්.', ta: 'மன்னிக்கவும் — இந்த உணவு இன்று தீர்ந்துவிட்டது.', hi: 'क्षमा करें — यह व्यंजन आज ख़त्म हो गया है।', zh: '抱歉，此菜今日已售罄。', ja: '申し訳ありません。本日は売り切れです。', ko: '죄송합니다. 오늘은 품절입니다.', ru: 'Извините, сегодня это блюдо закончилось.', de: 'Leider heute ausverkauft.', fr: 'Désolé, ce plat est épuisé aujourd’hui.', es: 'Lo sentimos, hoy está agotado.', it: 'Spiacenti, oggi è esaurito.', nl: 'Sorry, vandaag uitverkocht.', ar: 'عذرًا، هذا الطبق نفد اليوم.' },
  call: { en: 'Call', si: 'අමතන්න', ta: 'அழைக்க', hi: 'कॉल करें', zh: '致电', ja: '電話', ko: '전화', ru: 'Позвонить', de: 'Anrufen', fr: 'Appeler', es: 'Llamar', it: 'Chiama', nl: 'Bellen', ar: 'اتصل' },
  directions: { en: 'Directions', si: 'මාර්ගය', ta: 'வழி', hi: 'दिशा-निर्देश', zh: '路线', ja: '道順', ko: '길찾기', ru: 'Маршрут', de: 'Route', fr: 'Itinéraire', es: 'Cómo llegar', it: 'Indicazioni', nl: 'Route', ar: 'الاتجاهات' },
  wifiCopied: { en: 'Wi-Fi password copied', si: 'Wi-Fi මුරපදය පිටපත් කළා', ta: 'Wi-Fi கடவுச்சொல் நகலெடுக்கப்பட்டது', hi: 'Wi-Fi पासवर्ड कॉपी हो गया', zh: '已复制 Wi-Fi 密码', ja: 'Wi-Fi パスワードをコピーしました', ko: 'Wi-Fi 비밀번호 복사됨', ru: 'Пароль Wi-Fi скопирован', de: 'WLAN-Passwort kopiert', fr: 'Mot de passe Wi-Fi copié', es: 'Contraseña Wi-Fi copiada', it: 'Password Wi-Fi copiata', nl: 'Wifi-wachtwoord gekopieerd', ar: 'تم نسخ كلمة مرور Wi-Fi' },
  openPdf: { en: 'Open {x} as PDF', si: '{x} PDF ලෙස විවෘත කරන්න', ta: '{x} PDF ஆக திறக்க', hi: '{x} PDF के रूप में खोलें', zh: '以 PDF 打开{x}', ja: '{x}をPDFで開く', ko: '{x} PDF로 열기', ru: 'Открыть «{x}» в PDF', de: '{x} als PDF öffnen', fr: 'Ouvrir {x} en PDF', es: 'Abrir {x} en PDF', it: 'Apri {x} in PDF', nl: '{x} als pdf openen', ar: 'افتح {x} بصيغة PDF' },
  noResults: { en: 'No dishes match “{x}”.', si: '“{x}” ට ගැළපෙන ආහාර නැත.', ta: '“{x}” உடன் பொருந்தும் உணவுகள் இல்லை.', hi: '“{x}” से कोई व्यंजन मेल नहीं खाता।', zh: '没有与“{x}”匹配的菜品。', ja: '「{x}」に一致する料理はありません。', ko: '“{x}”와 일치하는 메뉴가 없습니다.', ru: 'Ничего не найдено по запросу «{x}».', de: 'Keine Gerichte für „{x}“.', fr: 'Aucun plat ne correspond à « {x} ».', es: 'Ningún plato coincide con «{x}».', it: 'Nessun piatto corrisponde a «{x}».', nl: 'Geen gerechten voor “{x}”.', ar: 'لا توجد أطباق تطابق “{x}”.' },
  approx: { en: 'Prices are charged in {x}. Converted prices are approximate.', si: 'මිල ගණන් {x} වලින් අය කෙරේ. පරිවර්තිත මිල ආසන්න වේ.', ta: 'விலைகள் {x} இல் வசூலிக்கப்படும். மாற்றப்பட்ட விலைகள் தோராயமானவை.', hi: 'भुगतान {x} में होगा। बदले गए दाम अनुमानित हैं।', zh: '以 {x} 结算，换算价格仅供参考。', ja: 'お支払いは{x}です。換算価格は目安です。', ko: '결제는 {x}로 진행됩니다. 환산 가격은 대략적인 금액입니다.', ru: 'Оплата в {x}. Пересчитанные цены приблизительны.', de: 'Bezahlt wird in {x}. Umgerechnete Preise sind ungefähr.', fr: 'Paiement en {x}. Les prix convertis sont approximatifs.', es: 'Se cobra en {x}. Los precios convertidos son aproximados.', it: 'Si paga in {x}. I prezzi convertiti sono indicativi.', nl: 'Er wordt afgerekend in {x}. Omgerekende prijzen zijn bij benadering.', ar: 'يتم الدفع بـ {x}. الأسعار المحوّلة تقريبية.' },
  language: { en: 'Language', si: 'භාෂාව', ta: 'மொழி', hi: 'भाषा', zh: '语言', ja: '言語', ko: '언어', ru: 'Язык', de: 'Sprache', fr: 'Langue', es: 'Idioma', it: 'Lingua', nl: 'Taal', ar: 'اللغة' },
  currency: { en: 'Currency', si: 'මුදල් ඒකකය', ta: 'நாணயம்', hi: 'मुद्रा', zh: '货币', ja: '通貨', ko: '통화', ru: 'Валюта', de: 'Währung', fr: 'Devise', es: 'Moneda', it: 'Valuta', nl: 'Valuta', ar: 'العملة' },
  machine: { en: 'Translated automatically', si: 'ස්වයංක්‍රීයව පරිවර්තනය කළා', ta: 'தானாக மொழிபெயர்க்கப்பட்டது', hi: 'स्वचालित अनुवाद', zh: '自动翻译', ja: '自動翻訳', ko: '자동 번역', ru: 'Автоматический перевод', de: 'Automatisch übersetzt', fr: 'Traduction automatique', es: 'Traducción automática', it: 'Traduzione automatica', nl: 'Automatisch vertaald', ar: 'ترجمة تلقائية' },
  menuSoon: { en: 'Menu coming soon', si: 'මෙනුව ළඟදීම', ta: 'மெனு விரைவில்', hi: 'मेनू जल्द आ रहा है', zh: '菜单即将推出', ja: 'メニューは準備中です', ko: '메뉴 준비 중', ru: 'Меню скоро появится', de: 'Speisekarte folgt', fr: 'Menu bientôt disponible', es: 'Menú próximamente', it: 'Menù in arrivo', nl: 'Menu volgt binnenkort', ar: 'القائمة قريبًا' },
  'tag.chef': { en: "Chef's special", si: 'විශේෂ ආහාරය', ta: 'சமையல்காரர் சிறப்பு', hi: 'शेफ़ स्पेशल', zh: '主厨特色', ja: 'シェフの特製', ko: '셰프 스페셜', ru: 'Фирменное', de: 'Spezialität', fr: 'Spécialité du chef', es: 'Especial del chef', it: 'Specialità dello chef', nl: 'Specialiteit', ar: 'طبق الشيف' },
  'tag.popular': { en: 'Popular', si: 'ජනප්‍රිය', ta: 'பிரபலம்', hi: 'लोकप्रिय', zh: '人气', ja: '人気', ko: '인기', ru: 'Популярное', de: 'Beliebt', fr: 'Populaire', es: 'Popular', it: 'Popolare', nl: 'Populair', ar: 'شائع' },
  'tag.new': { en: 'New', si: 'නව', ta: 'புதியது', hi: 'नया', zh: '新品', ja: '新メニュー', ko: '신메뉴', ru: 'Новинка', de: 'Neu', fr: 'Nouveau', es: 'Nuevo', it: 'Novità', nl: 'Nieuw', ar: 'جديد' },
  'tag.veg': { en: 'Vegetarian', si: 'නිර්මාංශ', ta: 'சைவம்', hi: 'शाकाहारी', zh: '素食', ja: 'ベジタリアン', ko: '채식', ru: 'Вегетарианское', de: 'Vegetarisch', fr: 'Végétarien', es: 'Vegetariano', it: 'Vegetariano', nl: 'Vegetarisch', ar: 'نباتي' },
  'tag.vegan': { en: 'Vegan', si: 'වීගන්', ta: 'வீகன்', hi: 'वीगन', zh: '纯素', ja: 'ヴィーガン', ko: '비건', ru: 'Веганское', de: 'Vegan', fr: 'Végan', es: 'Vegano', it: 'Vegano', nl: 'Veganistisch', ar: 'نباتي صرف' },
  'tag.spicy': { en: 'Spicy', si: 'සැර', ta: 'காரமான', hi: 'तीखा', zh: '辣', ja: '辛口', ko: '매운맛', ru: 'Острое', de: 'Scharf', fr: 'Épicé', es: 'Picante', it: 'Piccante', nl: 'Pittig', ar: 'حار' },
  'tag.gf': { en: 'Gluten-free', si: 'ග්ලූටන් රහිත', ta: 'பசையம் இல்லாதது', hi: 'ग्लूटेन-मुक्त', zh: '无麸质', ja: 'グルテンフリー', ko: '글루텐 프리', ru: 'Без глютена', de: 'Glutenfrei', fr: 'Sans gluten', es: 'Sin gluten', it: 'Senza glutine', nl: 'Glutenvrij', ar: 'خالٍ من الغلوتين' },
  'tag.seafood': { en: 'Seafood', si: 'මුහුදු ආහාර', ta: 'கடல் உணவு', hi: 'सी-फ़ूड', zh: '海鲜', ja: 'シーフード', ko: '해산물', ru: 'Морепродукты', de: 'Meeresfrüchte', fr: 'Fruits de mer', es: 'Marisco', it: 'Frutti di mare', nl: 'Zeevruchten', ar: 'مأكولات بحرية' },
};
export const TAG_ICONS = { chef: '👨‍🍳', popular: '🔥', new: '✨', veg: '🌱', vegan: '🥬', spicy: '🌶️', gf: '🌾', seafood: '🦐' };
export function t(key, lang, x) {
  const s = (T[key] && (T[key][lang] || T[key].en)) || key;
  return x === undefined ? s : s.replace('{x}', x);
}

// Currencies guests can switch to (ISO code -> symbol); amounts are converted with the restaurant's rates
export const CURRENCIES = {
  LKR: 'Rs', USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$', CNY: '¥', JPY: '¥', RUB: '₽', AED: 'AED', SGD: 'S$',
  MYR: 'RM', THB: '฿', CHF: 'CHF', KRW: '₩', MVR: 'Rf', SAR: 'SAR', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr', HKD: 'HK$',
};

// Machine translation without an API key: the browser's on-device translator (Chrome), else the free MyMemory service
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
export async function machineTranslate(texts, from, to) {
  const list = texts.map(s => s || '');
  try {
    if ('Translator' in self && (await withTimeout(Translator.availability({ sourceLanguage: from, targetLanguage: to }), 5000)) !== 'unavailable') {
      // The first use may download a language model, so allow time for that
      const tr = await withTimeout(Translator.create({ sourceLanguage: from, targetLanguage: to }), 60000);
      const out = [];
      for (const s of list) out.push(s ? await withTimeout(tr.translate(s), 15000) : '');
      return { texts: out, via: 'browser' };
    }
  } catch { /* fall through */ }
  const out = [];
  for (const s of list) {
    if (!s) { out.push(''); continue; }
    let r;
    try { r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${from}|${to}`, { signal: AbortSignal.timeout(10000) }); }
    catch { throw new Error('Automatic translation isn’t reachable right now — you can type the translations instead.'); }
    if (!r.ok) throw new Error('Automatic translation isn’t reachable right now — you can type the translations instead.');
    const j = await r.json();
    if (j.responseStatus !== 200 && j.responseStatus !== '200') throw new Error(j.responseDetails || 'Translation limit reached for today.');
    out.push(j.responseData.translatedText);
  }
  return { texts: out, via: 'mymemory' };
}
