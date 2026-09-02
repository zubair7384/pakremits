/**
 * English message catalogue — the source of truth for every translated string.
 *
 * Message files are TypeScript rather than JSON so that translation notes can
 * live next to the strings they describe. next-intl accepts a plain object.
 */
export const en = {
  nav: {
    compare: 'Compare',
    alerts: 'Rate alerts',
    corridors: 'Corridors',
    howWeRank: 'How we rank',
    faq: 'FAQ',
    setAlert: 'Set a rate alert',
    language: 'Language',
    main: 'Main',
  },

  home: {
    heroTitle: 'Send more rupees home. Same money.',
    heroLede:
      'Compare every major service sending to Pakistan, ranked by the exact amount that lands ' +
      'in the account. Not by rate, not by fee, not by who pays us.',
    heroTagline: 'Check the rate before you send money',
    liveChecked: 'Live · {count} providers checked {minutes} minutes ago',
    liveJustNow: 'Live · {count} providers checked just now',
    liveFallback: 'Live rates',
    statSaving: 'typical saving on {amount} vs a bank',
    statRefreshValue: '15 min',
    statRefresh: 'rate refresh',
    statCountries: 'sending countries',
    tickerLabel: 'Live mid-market rates to Pakistani rupee',
    tickerFootnote: 'Mid-market reference, 7-day trend',
    flatThisWeek: 'Flat this week',
    changeThisWeek: '{direction} {percent}% this week',
    corridorsTitle: 'Where are you sending from?',
    corridorsLede:
      'Every corridor has its own page with live rates, delivery times, and limits.',
    bestToday: 'Best today',
    whyTitle: 'Why our ranking looks different from other comparison sites',
    faqTitle: 'Common questions',

    statLostTitle: '{amount} a year',
    statLostBody:
      'What a family sending {monthly} a month through a high-street bank loses compared with ' +
      'the best-rate service.',
    statComparedBody:
      'Services compared on this corridor. We add providers only where we can get a live quote ' +
      'without working around their site.',
    statSponsoredBody:
      'Sponsored positions. Providers pay us the same whether they rank first or last, and we ' +
      'say so on every page.',

    cardRankedTitle: 'Ranked by rupees received',
    cardRankedBody:
      'We compute the exact amount landing in the account after fees and the real exchange ' +
      'rate, then sort by that. Nothing else moves a provider up.',
    cardPakistanTitle: 'Built for Pakistan only',
    cardPakistanBody:
      'JazzCash, Easypaisa, Sadapay, Nayapay, Roshan Digital Accounts and cash pickup are all ' +
      'covered. Global comparison sites skip most of them.',
    cardBonusTitle: 'Bonuses and incentives shown',
    cardBonusBody:
      'We flag first-transfer promos and the State Bank’s remittance incentive where they ' +
      'apply, so the number you see is the number that arrives.',

    faq1Q: 'Is the rate shown the rate I will actually get?',
    faq1A:
      'It is the provider’s live quote at the time shown on the page, refreshed every 15 ' +
      'minutes. The provider confirms the final rate on their site before you pay, and it can ' +
      'move slightly in between. That is why we show a timestamp on every quote.',
    faq2Q: 'How does Bhejo make money?',
    faq2A:
      'Some providers pay us a fixed commission when a new customer signs up through our link. ' +
      'It does not change your rate and it never changes the order of results, which is always ' +
      'by amount received.',
    faq3Q: 'Can I send directly to JazzCash or Easypaisa?',
    faq3A:
      'Yes. Choose “JazzCash or Easypaisa” under “Recipient gets it in” and we only show ' +
      'services that pay out to mobile wallets, with the wallet-specific rate and delivery time.',
    faq4Q: 'What is the State Bank remittance incentive?',
    faq4A:
      'Pakistan’s central bank subsidises transfers through approved channels, which is why ' +
      'licensed services often show zero fees and slightly better rates than the mid-market. We ' +
      'mark providers where the scheme applies.',

    alertsTitle: 'Tell me when the pound hits <rate>{rateValue}</rate>',
    alertsBody:
      'Pick a target rate. We watch the market every 15 minutes and message you the moment it ' +
      'crosses, with the best provider at that moment.',
    alertsComingSoon:
      'Rate alerts open shortly. They will send one message per alert, at most once every 12 ' +
      'hours, with one-tap unsubscribe.',
    alertsCta: 'Compare rates now',
  },

  alerts: {
    pair: 'Currency pair',
    direction: 'Tell me when it',
    above: 'rises above',
    below: 'falls below',
    targetRate: 'Target rate',
    sendBy: 'Send it by',
    whatsapp: 'WhatsApp',
    email: 'Email',
    whatsappNumber: 'WhatsApp number',
    emailAddress: 'Email address',
    digestOptIn: 'Also send me a weekly summary of this rate',
    createAlert: 'Create free alert',
    creating: 'Setting it up…',
    fineprint: 'One message per alert, max once every 12 hours. Unsubscribe with one tap.',
    genericError: 'Something went wrong. Try again in a moment.',
    checkInbox: 'Check your inbox',
    checkInboxBody:
      'We have sent you a link to confirm the alert. Nothing arrives until you click it, and ' +
      'if you never do, we delete the address within 48 hours.',
    alertSet: 'Alert set',
    alertSetBody:
      'We will message you the moment the rate crosses your target, with the best provider at ' +
      'that moment. At most once every 12 hours.',
  },

  panel: {
    heading: 'Compare money transfer services',
    sendingFrom: 'Sending from',
    recipientGets: 'Recipient gets it in',
    youSend: 'You send',
    compareButton: 'Compare rates',
    capturedAt: 'Quotes captured {time} PKT',
    noQuotesYet: 'No quotes yet',
    stale: 'stale',
    deliversThisWay: '{count} providers deliver this way',
    sortBy: 'Sort by',
    sortReceived: 'Most rupees',
    sortFastest: 'Fastest',
    sortLowestFee: 'Lowest fee',
    columnProvider: 'Provider',
    columnRate: 'Rate',
    columnFee: 'Fee',
    columnReceives: 'Recipient gets',
    bestDeal: 'Best deal',
    sponsored: 'Sponsored',
    bankDeposit: 'Bank deposit',
    swiftTransfer: 'SWIFT transfer',
    perUnit: 'per {symbol}',
    moreThanBank: '{amount} more than your bank',
    lessThanBest: '{amount} less than best',
    bestAvailable: 'Best available',
    sendWith: 'Send with {provider}',
    whySoLow: 'Why so low?',
    emptyState: 'No provider we track delivers to Pakistan this way from {currency} yet.',
    // Shown when we cannot reach our own database. Never conflated with the
    // empty state, which would claim something false about the market.
    unavailable:
      'We cannot load rates right now — this is a problem on our side, not a ' +
      'statement about the market. Please try again in a few minutes.',
    refreshError: 'Could not refresh quotes. Showing the last figures we had.',
    disclaimerQuotes:
      'Quotes are indicative. The provider confirms the final rate before you pay.',
    disclaimerCaptured: 'Rates captured at {amount}.',
    disclaimerCommission:
      'Some links pay us a commission. Ranking is by amount received only.',

    // Delivery-speed buckets, derived from deliverySpeedMinutes. English uses
    // the provider's own published wording where we have it; other locales use
    // these, because an untranslated Latin phrase inside right-to-left text
    // gets reordered by the bidi algorithm into nonsense ("3–5 days" rendered
    // as "days 5–3").
    speedMinutes: 'Minutes',
    speedHours: 'In hours',
    speedSameDay: 'Same day',
    speedFewDays: 'A few days',
    speedVaries: 'Varies',

    promoNewCustomer: 'New-customer rate',
  },

  methods: {
    bank: 'Bank account',
    wallet: 'JazzCash or Easypaisa',
    neobank: 'Sadapay or Nayapay',
    cash: 'Cash pickup',
    rda: 'Roshan Digital Account',
  },

  footer: {
    disclosure:
      'Bhejo is an independent comparison service. We earn a commission from some providers ' +
      'when you sign up through our links. This never affects the ranking, which is by amount ' +
      'received. We are not a money transfer service and never hold your funds.',
    compare: 'Compare',
    rates: 'Rates',
    bhejo: 'Bhejo',
    copyright: '© {year} Bhejo. Rates are indicative and provided for comparison only.',
  },

  common: {
    breadcrumb: 'Breadcrumb',
    otherCorridors: 'Other corridors',
    lastReviewed: 'Guidance on this page was last reviewed on {date}.',
    ratesLiveGuidanceNot:
      'Rates above are live; the written guidance is not, and rules change. Nothing here is ' +
      'financial advice.',
    translationPending:
      'This guidance has not been translated into Urdu yet, so it is shown in English. The ' +
      'rates and the comparison table above are fully translated.',
  },
}

/**
 * The shape every catalogue must satisfy.
 *
 * Note the absence of `as const` above: with it, each value would be a string
 * *literal* type, and Urdu translations would fail to typecheck against the
 * English text. Widening to `string` is what makes `ur.ts` a compile-time check
 * that no key is missing rather than just a hopeful parallel file.
 */
export type Messages = typeof en
