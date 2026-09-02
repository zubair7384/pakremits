/**
 * Urdu message catalogue.
 *
 * IMPORTANT — every string in this file needs review by a native Urdu speaker
 * before launch. They were written to read naturally rather than as a literal
 * rendering of the English, which is the right goal but also the reason a
 * native check matters: a phrase that is grammatical can still land wrong.
 *
 * Particular things for a reviewer to look at:
 *  - Register. These read as everyday Urdu rather than formal/literary Urdu,
 *    which suits the audience (people sending money to family) but is a choice.
 *  - Loanwords. "ریٹ", "بینک", "ٹرانسفر" are what people actually say, and have
 *    been kept over Persianised alternatives on purpose. Confirm that is right.
 *  - Numerals. We use Western digits throughout because the rate figures come
 *    from Intl formatting and mixing digit systems on one page looks broken.
 *
 * The long-form corridor and rate-page editorial is deliberately NOT here.
 * Machine-translating several thousand words of financial guidance would be
 * worse than showing the English with a note, which is what those pages do.
 */
import type { Messages } from './en'

export const ur: Messages = {
  nav: {
    // TODO: native review
    compare: 'موازنہ',
    // TODO: native review
    alerts: 'ریٹ الرٹ',
    // TODO: native review
    corridors: 'ممالک',
    // TODO: native review — "how we rank" as a section title
    howWeRank: 'درجہ بندی کیسے ہوتی ہے',
    // TODO: native review
    faq: 'عام سوالات',
    // TODO: native review
    setAlert: 'ریٹ الرٹ لگائیں',
    // TODO: native review
    language: 'زبان',
    // TODO: native review — accessibility label for the main nav
    main: 'مرکزی',
  },

  home: {
    // TODO: native review — headline; should feel punchy, not literal
    heroTitle: 'وہی رقم، زیادہ روپے',
    // TODO: native review
    heroLede:
      'پاکستان پیسے بھیجنے والی ہر بڑی سروس کا موازنہ کریں، اس رقم کے حساب سے جو واقعی اکاؤنٹ ' +
      'میں پہنچتی ہے۔ نہ ریٹ کے حساب سے، نہ فیس کے، اور نہ اس بنیاد پر کہ ہمیں کون پیسے دیتا ہے۔',
    // TODO: native review — this line is from the design file
    heroTagline: 'پیسے بھیجنے سے پہلے ریٹ چیک کریں',
    // TODO: native review
    liveChecked: 'لائیو · {count} سروسز {minutes} منٹ پہلے چیک کی گئیں',
    // TODO: native review
    liveJustNow: 'لائیو · {count} سروسز ابھی چیک کی گئیں',
    // TODO: native review
    liveFallback: 'لائیو ریٹ',
    // TODO: native review
    statSaving: '{amount} پر بینک کے مقابلے میں عام بچت',
    // TODO: native review
    statRefreshValue: '15 منٹ',
    // TODO: native review
    statRefresh: 'بعد ریٹ اپ ڈیٹ',
    // TODO: native review
    statCountries: 'ممالک سے',
    // TODO: native review
    tickerLabel: 'پاکستانی روپے کے لائیو مڈ مارکیٹ ریٹ',
    // TODO: native review
    tickerFootnote: 'مڈ مارکیٹ ریٹ، 7 دن کا رجحان',
    // TODO: native review
    flatThisWeek: 'اس ہفتے کوئی تبدیلی نہیں',
    // TODO: native review
    changeThisWeek: '{direction} {percent}% اس ہفتے',
    // TODO: native review
    corridorsTitle: 'آپ کہاں سے بھیج رہے ہیں؟',
    // TODO: native review
    corridorsLede:
      'ہر ملک کا اپنا صفحہ ہے جس میں لائیو ریٹ، رقم پہنچنے کا وقت اور حدود درج ہیں۔',
    // TODO: native review
    bestToday: 'آج کا بہترین',
    // TODO: native review
    whyTitle: 'ہماری درجہ بندی دوسری ویب سائٹس سے مختلف کیوں ہے',
    // TODO: native review
    faqTitle: 'عام سوالات',

    // TODO: native review
    statLostTitle: 'سالانہ {amount}',
    // TODO: native review
    statLostBody:
      'جو خاندان ہر مہینے {monthly} کسی عام بینک کے ذریعے بھیجتا ہے، وہ بہترین ریٹ والی سروس ' +
      'کے مقابلے میں اتنا نقصان اٹھاتا ہے۔',
    // TODO: native review
    statComparedBody:
      'اس ملک کے لیے موازنہ کی گئی سروسز۔ ہم صرف وہی سروسز شامل کرتے ہیں جن کا لائیو ریٹ ہم ' +
      'ان کی ویب سائٹ سے بچ کر نکالے بغیر حاصل کر سکیں۔',
    // TODO: native review
    statSponsoredBody:
      'اشتہاری درجہ بندی۔ سروسز ہمیں یکساں ادائیگی کرتی ہیں چاہے وہ پہلے نمبر پر ہوں یا آخری، ' +
      'اور ہم یہ بات ہر صفحے پر لکھتے ہیں۔',

    // TODO: native review
    cardRankedTitle: 'وصول ہونے والے روپوں کے حساب سے درجہ بندی',
    // TODO: native review
    cardRankedBody:
      'ہم فیس اور اصل ایکسچینج ریٹ کے بعد اکاؤنٹ میں پہنچنے والی اصل رقم نکالتے ہیں اور اسی ' +
      'کے حساب سے ترتیب دیتے ہیں۔ اس کے علاوہ کوئی چیز کسی سروس کو اوپر نہیں لا سکتی۔',
    // TODO: native review
    cardPakistanTitle: 'صرف پاکستان کے لیے',
    // TODO: native review
    cardPakistanBody:
      'JazzCash، Easypaisa، Sadapay، Nayapay، روشن ڈیجیٹل اکاؤنٹ اور نقد وصولی — سب شامل ہیں۔ ' +
      'بین الاقوامی موازنہ ویب سائٹس ان میں سے اکثر کو نظرانداز کر دیتی ہیں۔',
    // TODO: native review
    cardBonusTitle: 'بونس اور مراعات بھی شامل',
    // TODO: native review
    cardBonusBody:
      'ہم پہلی ٹرانسفر کی آفرز اور اسٹیٹ بینک کی ترسیلاتِ زر کی مراعات کو نمایاں کرتے ہیں، ' +
      'تاکہ جو رقم آپ دیکھ رہے ہیں وہی پہنچے۔',

    // TODO: native review
    faq1Q: 'کیا دکھایا گیا ریٹ وہی ہے جو مجھے ملے گا؟',
    // TODO: native review
    faq1A:
      'یہ اس وقت کا لائیو ریٹ ہے جو صفحے پر درج ہے، اور ہر 15 منٹ بعد اپ ڈیٹ ہوتا ہے۔ ' +
      'ادائیگی سے پہلے متعلقہ سروس اپنی ویب سائٹ پر حتمی ریٹ کی تصدیق کرتی ہے، اور اس دوران ' +
      'ریٹ تھوڑا بدل سکتا ہے۔ اسی لیے ہم ہر ریٹ کے ساتھ وقت لکھتے ہیں۔',
    // TODO: native review
    faq2Q: 'PakRemits کیسے کماتا ہے؟',
    // TODO: native review
    faq2A:
      'کچھ سروسز ہمیں مقررہ کمیشن دیتی ہیں جب کوئی نیا صارف ہمارے لنک سے رجسٹر ہوتا ہے۔ اس سے ' +
      'آپ کا ریٹ تبدیل نہیں ہوتا اور نتائج کی ترتیب پر بھی کوئی اثر نہیں پڑتا، جو ہمیشہ ' +
      'وصول ہونے والی رقم پر ہوتی ہے۔',
    // TODO: native review
    faq3Q: 'کیا میں براہِ راست JazzCash یا Easypaisa پر بھیج سکتا ہوں؟',
    // TODO: native review
    faq3A:
      'جی ہاں۔ "وصول کنندہ کو کیسے ملے" میں سے "JazzCash یا Easypaisa" منتخب کریں، پھر ہم صرف ' +
      'وہی سروسز دکھاتے ہیں جو موبائل والٹ میں رقم بھیجتی ہیں، والٹ کے مخصوص ریٹ اور وقت کے ساتھ۔',
    // TODO: native review
    faq4Q: 'اسٹیٹ بینک کی ترسیلاتِ زر مراعات کیا ہیں؟',
    // TODO: native review
    faq4A:
      'پاکستان کا مرکزی بینک منظور شدہ ذرائع سے آنے والی رقوم پر سبسڈی دیتا ہے، اسی لیے ' +
      'لائسنس یافتہ سروسز اکثر صفر فیس اور مڈ مارکیٹ سے کچھ بہتر ریٹ دکھاتی ہیں۔ جہاں یہ ' +
      'اسکیم لاگو ہوتی ہے، ہم اسے نمایاں کرتے ہیں۔',

    // TODO: native review
    alertsTitle: 'جب پاؤنڈ <rate>{rateValue}</rate> پر پہنچے تو مجھے بتائیں',
    // TODO: native review
    alertsBody:
      'اپنا مطلوبہ ریٹ منتخب کریں۔ ہم ہر 15 منٹ بعد مارکیٹ دیکھتے ہیں اور جیسے ہی ریٹ اس حد ' +
      'کو پار کرے، اس وقت کی بہترین سروس کے ساتھ آپ کو پیغام بھیج دیتے ہیں۔',
    // TODO: native review
    alertsComingSoon:
      'ریٹ الرٹ جلد شروع ہو رہے ہیں۔ ہر الرٹ پر ایک پیغام، زیادہ سے زیادہ ہر 12 گھنٹے میں ' +
      'ایک بار، اور ایک ٹیپ سے بند کرنے کی سہولت۔',
    // TODO: native review
    alertsCta: 'ابھی ریٹ کا موازنہ کریں',
  },

  alerts: {
    // TODO: native review
    pair: 'کرنسی جوڑا',
    // TODO: native review
    direction: 'مجھے بتائیں جب یہ',
    // TODO: native review
    above: 'اس سے اوپر جائے',
    // TODO: native review
    below: 'اس سے نیچے آئے',
    // TODO: native review
    targetRate: 'مطلوبہ ریٹ',
    // TODO: native review
    sendBy: 'کس ذریعے بھیجیں',
    // TODO: native review — brand name, kept in Latin script as people write it
    whatsapp: 'WhatsApp',
    // TODO: native review
    email: 'ای میل',
    // TODO: native review
    whatsappNumber: 'WhatsApp نمبر',
    // TODO: native review
    emailAddress: 'ای میل ایڈریس',
    // TODO: native review
    digestOptIn: 'مجھے ہر ہفتے اس ریٹ کا خلاصہ بھی بھیجیں',
    // TODO: native review
    createAlert: 'مفت الرٹ بنائیں',
    // TODO: native review
    creating: 'بنایا جا رہا ہے…',
    // TODO: native review
    fineprint: 'ہر الرٹ پر ایک پیغام، زیادہ سے زیادہ ہر 12 گھنٹے میں ایک بار۔ ایک ٹیپ سے بند کریں۔',
    // TODO: native review
    genericError: 'کچھ غلط ہو گیا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔',
    // TODO: native review
    checkInbox: 'اپنا ان باکس دیکھیں',
    // TODO: native review
    checkInboxBody:
      'ہم نے آپ کو الرٹ کی تصدیق کے لیے ایک لنک بھیجا ہے۔ جب تک آپ اس پر کلک نہیں کرتے، کوئی ' +
      'پیغام نہیں آئے گا، اور اگر آپ کلک نہ کریں تو ہم 48 گھنٹے میں آپ کا ایڈریس حذف کر دیتے ہیں۔',
    // TODO: native review
    alertSet: 'الرٹ لگ گیا',
    // TODO: native review
    alertSetBody:
      'جیسے ہی ریٹ آپ کی مقررہ حد کو پار کرے گا، ہم آپ کو اس وقت کی بہترین سروس کے ساتھ پیغام ' +
      'بھیج دیں گے۔ زیادہ سے زیادہ ہر 12 گھنٹے میں ایک بار۔',
  },

  panel: {
    // TODO: native review
    heading: 'رقم بھیجنے والی سروسز کا موازنہ',
    // TODO: native review
    sendingFrom: 'کہاں سے بھیج رہے ہیں',
    // TODO: native review
    recipientGets: 'وصول کنندہ کو کیسے ملے',
    // TODO: native review
    youSend: 'آپ بھیج رہے ہیں',
    // TODO: native review
    compareButton: 'ریٹ کا موازنہ کریں',
    // TODO: native review — PKT stays in Latin script, it is read that way
    capturedAt: 'ریٹ {time} PKT پر لیے گئے',
    // TODO: native review
    noQuotesYet: 'ابھی کوئی ریٹ دستیاب نہیں',
    // TODO: native review
    stale: 'پرانا',
    // TODO: native review
    deliversThisWay: '{count} سروسز اس طریقے سے بھیجتی ہیں',
    // TODO: native review
    sortBy: 'ترتیب',
    // TODO: native review
    sortReceived: 'سب سے زیادہ روپے',
    // TODO: native review
    sortFastest: 'سب سے تیز',
    // TODO: native review
    sortLowestFee: 'سب سے کم فیس',
    // TODO: native review
    columnProvider: 'سروس',
    // TODO: native review
    columnRate: 'ریٹ',
    // TODO: native review
    columnFee: 'فیس',
    // TODO: native review
    columnReceives: 'وصول کنندہ کو ملیں گے',
    // TODO: native review
    bestDeal: 'بہترین آفر',
    // TODO: native review — must read clearly as a paid placement
    sponsored: 'اشتہار',
    // TODO: native review
    bankDeposit: 'بینک اکاؤنٹ میں',
    // TODO: native review — SWIFT kept in Latin script, it is a proper noun
    swiftTransfer: 'SWIFT ٹرانسفر',
    // TODO: native review
    perUnit: 'فی {symbol}',
    // TODO: native review
    moreThanBank: 'آپ کے بینک سے {amount} زیادہ',
    // TODO: native review
    lessThanBest: 'بہترین سے {amount} کم',
    // TODO: native review
    bestAvailable: 'سب سے بہتر',
    // TODO: native review
    sendWith: '{provider} سے بھیجیں',
    // TODO: native review
    whySoLow: 'اتنا کم کیوں؟',
    // TODO: native review
    emptyState:
      'ہم جن سروسز کو ٹریک کرتے ہیں، ان میں سے کوئی بھی {currency} سے اس طریقے سے پاکستان ' +
      'نہیں بھیجتی۔',
    // TODO: native review
    unavailable:
      'اس وقت ریٹ لوڈ نہیں ہو سکے — یہ ہماری طرف کا مسئلہ ہے، مارکیٹ کے بارے میں کوئی بات ' +
      'نہیں۔ چند منٹ بعد دوبارہ کوشش کریں۔',
    // TODO: native review
    refreshError: 'ریٹ اپ ڈیٹ نہیں ہو سکے۔ پچھلے دستیاب ریٹ دکھائے جا رہے ہیں۔',
    // TODO: native review
    disclaimerQuotes:
      'یہ ریٹ اندازاً ہیں۔ ادائیگی سے پہلے متعلقہ سروس حتمی ریٹ کی تصدیق کرتی ہے۔',
    // TODO: native review
    disclaimerCaptured: 'ریٹ {amount} پر لیے گئے۔',
    // TODO: native review
    disclaimerCommission:
      'کچھ لنکس پر ہمیں کمیشن ملتا ہے۔ درجہ بندی صرف وصول ہونے والی رقم پر ہوتی ہے۔',

    // TODO: native review
    speedMinutes: 'چند منٹ میں',
    // TODO: native review
    speedHours: 'چند گھنٹوں میں',
    // TODO: native review
    speedSameDay: 'اسی دن',
    // TODO: native review
    speedFewDays: 'چند دن میں',
    // TODO: native review
    speedVaries: 'مختلف',

    // TODO: native review
    promoNewCustomer: 'نئے صارف کا ریٹ',
  },

  methods: {
    // TODO: native review
    bank: 'بینک اکاؤنٹ',
    // TODO: native review — brand names stay in Latin script, as people write them
    wallet: 'JazzCash یا Easypaisa',
    // TODO: native review
    neobank: 'Sadapay یا Nayapay',
    // TODO: native review
    cash: 'نقد وصولی',
    // TODO: native review
    rda: 'روشن ڈیجیٹل اکاؤنٹ',
  },

  footer: {
    // TODO: native review — this is a legal-ish disclosure, check it carefully
    disclosure:
      'PakRemits ایک آزاد موازنہ سروس ہے۔ جب آپ ہمارے لنک سے کسی سروس میں رجسٹر ہوتے ہیں تو ہمیں ' +
      'کمیشن ملتا ہے۔ اس سے درجہ بندی پر کوئی اثر نہیں پڑتا، جو صرف وصول ہونے والی رقم پر ' +
      'مبنی ہے۔ ہم رقم بھیجنے والی سروس نہیں ہیں اور آپ کی رقم کبھی اپنے پاس نہیں رکھتے۔',
    // TODO: native review
    compare: 'موازنہ',
    // TODO: native review
    rates: 'ریٹ',
    // Brand name stays in Latin script in Urdu copy — see the rebrand note in the README.
    brand: 'PakRemits',
    // TODO: native review
    copyright: '© {year} PakRemits۔ ریٹ اندازاً ہیں اور صرف موازنے کے لیے دیے گئے ہیں۔',
  },

  common: {
    // TODO: native review
    breadcrumb: 'راستہ',
    // TODO: native review
    otherCorridors: 'دیگر ممالک',
    // TODO: native review
    lastReviewed: 'اس صفحے کی معلومات کا آخری جائزہ {date} کو لیا گیا۔',
    // TODO: native review
    ratesLiveGuidanceNot:
      'اوپر دیے گئے ریٹ لائیو ہیں؛ تحریری معلومات نہیں، اور قواعد تبدیل ہوتے رہتے ہیں۔ یہ ' +
      'مالی مشورہ نہیں ہے۔',
    // TODO: native review — shown where long-form content is not yet translated
    translationPending:
      'یہ تفصیلی معلومات ابھی اردو میں دستیاب نہیں، اس لیے انگریزی میں دکھائی جا رہی ہیں۔ ' +
      'اوپر کے ریٹ اور موازنے کا جدول مکمل طور پر اردو میں ہیں۔',
  },
}
