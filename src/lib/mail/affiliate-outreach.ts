/** Programme guidance for enrolled affiliates. No customer records or fixed earning promises. */
export const AFFILIATE_OUTREACH_TEMPLATES = [
  {
    id: "affiliate-welcome",
    title: "New affiliate welcome",
    audience: "NEW_AFFILIATES",
    kind: "operational",
    subject: "Welcome to JKTL Affiliates — get ready for your first referral",
    body: "Hello,\n\nWelcome to JKTL Affiliates. Here’s how to get your account ready and make your first promotion:\n\n1. [Sign in to your affiliate account](https://business.jktl.com.ng/affiliates/login) and copy your personal referral link from the Overview page. Use that link when you share JKTL so eligible referrals can be attributed to you.\n2. Open [Marketing Materials](https://business.jktl.com.ng/affiliates/resources) and choose the current approved content for a product that suits your audience.\n3. Review [Referrals & Earnings](https://business.jktl.com.ng/affiliates/commercial) for your assigned terms, eligible products and commission information.\n4. Check [Settings](https://business.jktl.com.ng/affiliates/settings) and complete any required payout information. Never email bank credentials or verification codes.\n5. Start with one business owner you already know. Explain how the relevant JKTL product could help, share your own referral link and disclose that you may earn a commission.\n\nCommissions and payouts follow your current agreement and its qualifying-payment and verification requirements. A visit or free signup alone is not a promise of payable earnings.\n\nNeed help finding your referral link or preparing a promotion? Reply to this email and tell us where you’re stuck.",
  },
  {
    id: "affiliate-existing",
    title: "Existing affiliate action plan",
    audience: "EXISTING_AFFILIATES",
    kind: "operational",
    subject: "Your JKTL affiliate toolkit: plan your next promotion",
    body: "Hello,\n\nHere’s a practical refresher for using your JKTL affiliate account:\n\n- [Open your affiliate dashboard](https://business.jktl.com.ng/affiliates) and copy your current personal referral link. A general website link does not replace your tracked referral link.\n- Check your assigned terms and eligible products under [Referrals & Earnings](https://business.jktl.com.ng/affiliates/commercial).\n- Refresh the content you use from [Marketing Materials](https://business.jktl.com.ng/affiliates/resources), so you aren’t sharing outdated claims or prices.\n- Choose one suitable business owner or audience, explain a relevant product and share your personal referral link. Make your affiliate relationship clear.\n- Review your referrals and payment status in your dashboard. Earnings become payable only under your agreement’s qualification and verification rules; they are not guaranteed by posting a link.\n\nYour next referral can start with one helpful conversation. If your link, account status or payout setup needs attention, reply to this email or [contact affiliate support](https://business.jktl.com.ng/affiliates/support).",
  },
  {
    id: "affiliate-first-promotion",
    title: "First promotion checklist",
    audience: "ACTIVE_AFFILIATES",
    kind: "operational",
    subject: "Your first JKTL promotion: a simple checklist",
    body: "Hello,\n\nUse this checklist before sharing your next JKTL affiliate promotion:\n\n1. Copy your own referral link from [Overview](https://business.jktl.com.ng/affiliates).\n2. Confirm the product is eligible under your assigned terms in [Referrals & Earnings](https://business.jktl.com.ng/affiliates/commercial).\n3. Choose the latest approved content from [Marketing Materials](https://business.jktl.com.ng/affiliates/resources).\n4. Explain the product accurately, include your referral link and say that you may earn a commission.\n5. Review the resulting referrals and qualifying-payment status in your dashboard.\n\nHere’s a starting message you can adapt for a suitable contact. Replace YOUR_REFERRAL_LINK with the personal link copied from your dashboard:\n\n> Hi! If you’re exploring an online presence for your business, you can take a look at JKTL here: YOUR_REFERRAL_LINK. I’m a JKTL affiliate and may receive a commission if you make a qualifying purchase through my link. Would you like me to point you to information about a product that fits your business?\n\nOnly share claims and offers supported by the current product information and your agreement. Commission eligibility, verification and payout requirements remain those shown in your account.\n\nIf you’d like help adapting your message or finding your link, reply to this email.",
  },
] as const;
