export const supportedLanguages = ["en", "ha", "ig", "yo"] as const;
export type Language = (typeof supportedLanguages)[number];
export const languageNames: Record<Language, string> = {
  en: "English",
  ha: "Hausa",
  ig: "Igbo",
  yo: "Yorùbá",
};
export const translations: Record<
  Exclude<Language, "en">,
  Record<string, string>
> = {
  ha: {
    "Start for free": "Fara kyauta",
    "Log in": "Shiga",
    "Sign in": "Shiga",
    "Sign up": "Yi rajista",
    "Log out": "Fita",
    Product: "Samfura",
    Solutions: "Mafita",
    Resources: "Abubuwan taimako",
    Domains: "Sunayen yanar gizo",
    Pricing: "Farashi",
    Creation: "Ƙirƙira",
    Business: "Kasuwanci",
    Essentials: "Muhimman abubuwa",
    Management: "Gudanarwa",
    Growth: "Ci gaba",
    "By industry": "Ta fannin sana’a",
    Explore: "Bincika",
    Support: "Taimako",
    "Start here": "Fara nan",
    "Website builder": "Mai ƙirƙirar shafin yanar gizo",
    "Website templates": "Samfuran shafin yanar gizo",
    "Free website address": "Adireshin yanar gizo na kyauta",
    "Landing page builder": "Mai ƙirƙirar shafin talla",
    "Customer management": "Gudanar da abokan ciniki",
    "Bookings & sales": "Ajiyar lokaci da tallace-tallace",
    "Invoicing & payments": "Takardun kuɗi da biyan kuɗi",
    "Inventory & expenses": "Kaya da kashe kuɗi",
    "Reports & analytics": "Rahotanni da nazari",
    "AI receptionist": "Mai karɓar kira na AI",
    "Custom domains": "Sunan yanar gizo naka",
    "Hosting & HTTPS": "Masaukin yanar gizo da HTTPS",
    "Business email": "Imel na kasuwanci",
    "Business tools": "Kayan aikin kasuwanci",
    "Manage your customers": "Gudanar da abokan cinikinka",
    "Schedule appointments": "Tsara alƙawura",
    "Get paid": "Karɓi kuɗi",
    "Track stock & expenses": "Bibiyar kaya da kashe kuɗi",
    "Work with your team": "Yi aiki tare da ƙungiyarka",
    "Run your business on mobile": "Gudanar da kasuwanci a waya",
    "Get your business online": "Sanya kasuwancinka a yanar gizo",
    "Recover missed enquiries": "Dawo da tambayoyin da aka rasa",
    "Know your numbers": "San alkalumanka",
    "Salons & beauty": "Salon da ƙawata jiki",
    "Retail & trade": "Sayarwa da ciniki",
    "Food & hospitality": "Abinci da karɓar baƙi",
    "Explore all industries": "Duba dukkan sana’o’i",
    "Business management tools": "Kayan gudanar da kasuwanci",
    "How JKTL works": "Yadda JKTL ke aiki",
    "About JKTL": "Game da JKTL",
    "Partner programme": "Shirin abokan hulɗa",
    "Help & guides": "Taimako da jagorori",
    "Contact the team": "Tuntuɓi ƙungiyar",
    "Plans & pricing": "Tsare-tsare da farashi",
    "Your first steps with JKTL": "Matakan farko da JKTL",
    "Need a hand?": "Kana buƙatar taimako?",
    "Websites • Domains • Hosting • Business Email":
      "Shafukan yanar gizo • Sunayen yanar gizo • Masauki • Imel na kasuwanci",
    "Build your business online.": "Gina kasuwancinka a yanar gizo.",
    "Grow beyond limits.": "Bunku fiye da iyaka.",
    "Create a professional website, get your own domain and business email, and access powerful tools to manage your business — all in one place.":
      "Ƙirƙiri shafin yanar gizo na ƙwararru, sami sunan yanar gizo da imel na kasuwanci, tare da kayan gudanar da kasuwanci — duk a wuri ɗaya.",
    "No credit card required. Choose a plan when you’re ready.":
      "Ba a buƙatar katin kuɗi. Zaɓi tsari idan ka shirya.",
    "Your business. Online.": "Kasuwancinka. A yanar gizo.",
    "Your website, in four easy steps.": "Shafinka, a matakai huɗu masu sauƙi.",
    "Find your design": "Nemo samfurinka",
    "Make it yours": "Mayar da shi naka",
    "Publish your website": "Wallafa shafinka",
    "Grow when you’re ready": "Bunku idan ka shirya",
    "Explore templates": "Bincika samfura",
    "Compare plans": "Kwatanta tsare-tsare",
    "How publishing works": "Yadda wallafawa ke aiki",
    "See what’s possible.": "Ga abin da zai yiwu.",
    Pause: "Dakatar",
    Play: "Ci gaba",
    "Find the right plan": "Nemo tsarin da ya dace",
    "for your next chapter.": "don matakinka na gaba.",
    Yearly: "Shekara-shekara",
    Monthly: "Wata-wata",
    "Best value": "Mafi amfani",
    "Save with yearly billing. All prices in NGN.":
      "Rage kuɗi da biyan shekara. Duk farashi a NGN yake.",
    "A strong foundation": "Tushe mai ƙarfi",
    "for your business online.": "don kasuwancinka a yanar gizo.",
    "Before you choose": "Kafin ka zaɓa",
    "Before you begin": "Kafin ka fara",
    "How it works": "Yadda yake aiki",
    "What you can do": "Abin da za ka iya yi",
    "Continue editing your website": "Ci gaba da gyara shafinka",
    "Back to your website": "Koma shafinka",
    Dashboard: "Allon gudanarwa",
    Home: "Gida",
    Customers: "Abokan ciniki",
    Bookings: "Ajiyar lokaci",
    Sales: "Tallace-tallace",
    More: "Ƙari",
    Settings: "Saituna",
    Help: "Taimako",
    Reports: "Rahotanni",
    Inventory: "Kaya",
    Expenses: "Kashe kuɗi",
    Invoices: "Takardun kuɗi",
    Services: "Ayyuka",
    Products: "Kayayyaki",
    Website: "Shafin yanar gizo",
    "Website plans": "Tsare-tsaren yanar gizo",
    Billing: "Biyan kuɗi",
    Team: "Ƙungiya",
    Account: "Asusu",
    Payments: "Biyan kuɗi",
    Save: "Ajiye",
    Cancel: "Soke",
    Delete: "Goge",
    Edit: "Gyara",
    View: "Duba",
    Search: "Nema",
    "See all": "Duba duka",
    "Good morning": "Barka da safe",
    "Good afternoon": "Barka da rana",
    "Good evening": "Barka da yamma",
    "Today's sales": "Tallace-tallacen yau",
    "Bookings today": "Ajiyar lokacin yau",
    "Customers today": "Abokan cinikin yau",
    Outstanding: "Kuɗin da ya rage",
    "Today's bookings": "Ajiyar lokacin yau",
    "Upcoming bookings": "Ajiyar lokaci mai zuwa",
    "No bookings today yet.": "Babu ajiyar lokaci yau tukuna.",
    "Create your free account": "Ƙirƙiri asusun kyautarka",
    "Full name": "Cikakken suna",
    "Business name": "Sunan kasuwanci",
    "Email address": "Adireshin imel",
    Password: "Kalmar sirri",
    "Show password": "Nuna kalmar sirri",
    "Hide password": "Ɓoye kalmar sirri",
    "Create account": "Ƙirƙiri asusu",
    "Forgot password?": "Ka manta kalmar sirri?",
    "Welcome back": "Barka da dawowa",
    "Sign in to your account": "Shiga asusunka",
    "Start for free. No credit card required.":
      "Fara kyauta. Ba a buƙatar katin kuɗi.",
    "Terms of Use": "Sharuɗɗan amfani",
    "Privacy Policy": "Manufar sirri",
    "All templates": "Dukkan samfura",
    Websites: "Shafukan yanar gizo",
    "Landing pages": "Shafukan talla",
    "Blank templates": "Samfura marasa komai",
    "All industries": "Dukkan sana’o’i",
    Type: "Nau’i",
    Industry: "Sana’a",
    "Search templates…": "Nemo samfura…",
    "View template": "Duba samfurin",
    "Edit template": "Gyara samfurin",
    "Show more templates": "Nuna ƙarin samfura",
    "Your website subscription": "Tsarin biyan shafinka",
    "Website payment history": "Tarihin biyan shafin yanar gizo",
    "Cancel renewal": "Dakatar da sabuntawa",
    "Manage payment method": "Gudanar da hanyar biyan kuɗi",
    "Schedule plan change": "Tsara sauyin tsari",
    "Request guarantee refund": "Nemi mayar da kuɗin garanti",
    "Your name. Your business.": "Sunanka. Kasuwancinka.",
    "Your own domain.": "Sunan yanar gizo naka.",
    "Build a Nigerian identity with .ng, .com.ng or .name.ng — or explore a global or country-code domain for your next chapter.":
      "Gina asalin Najeriya da .ng, .com.ng ko .name.ng — ko bincika sunan yanar gizo na duniya ko na wata ƙasa.",
    "Your preferred name": "Sunan da kake so",
    Extension: "Ƙarin sunan yanar gizo",
    "Explore domains": "Bincika sunayen yanar gizo",
    "JKTL handles registration requests through Go54. Availability, eligibility and the full price are confirmed before you pay. Searching here does not reserve a domain.":
      "JKTL yana sarrafa buƙatun rajista ta Go54. Za a tabbatar da samuwa, cancanta da cikakken farashi kafin ka biya. Wannan binciken ba ya ajiye suna.",
    "START WITH YOUR IDENTITY": "FARA DA ASALINKA",
    "Made for a Nigerian name.": "An yi don sunan Najeriya.",
    "Your website, email address and brand can share one memorable name.":
      "Shafinka, imel da alamarka za su iya amfani da suna ɗaya mai sauƙin tunawa.",
    "For Nigerian businesses and organisations":
      "Don kasuwanci da ƙungiyoyin Najeriya",
    "A short Nigerian country-code identity": "Gajeren suna na ƙasar Najeriya",
    "For a personal name or professional identity":
      "Don suna ko asalin ƙwararre",
    "For organisations and communities": "Don ƙungiyoyi da al’umma",
    "For networks and technology businesses":
      "Don sadarwa da kasuwancin fasaha",
    "For eligible educational institutions; documentation may be required":
      "Don cibiyoyin ilimi da suka cancanta; ana iya buƙatar takardu",
    "For eligible schools; documentation may be required":
      "Don makarantun da suka cancanta; ana iya buƙatar takardu",
    "A familiar global business address":
      "Sanannen adireshin kasuwanci na duniya",
    "A continental identity for an African brand":
      "Asalin nahiyar Afirka don alamarka",
    "A flexible online identity": "Sunan yanar gizo mai sassauci",
    "For a retail brand or online store":
      "Don alamar kaya ko shagon yanar gizo",
    "Explore a country-specific address": "Bincika adireshin wata ƙasa",
    "Request a quote": "Nemi farashi",
    "Registration and annual renewal quoted separately.":
      "Ana bayar da farashin rajista da sabuntawar shekara dabam.",
    "Renewal per year": "Sabuntawar kowace shekara",
    "Explore this extension": "Bincika wannan ƙarin suna",
    "Choose the right extension.": "Zaɓi ƙarin sunan da ya dace.",
    "Explore names for your business.": "Bincika sunaye don kasuwancinka.",
    "All extensions": "Dukkan ƙarin sunaye",
    "Nigerian domains": "Sunayen Najeriya",
    "Generic TLDs": "Sunayen TLD na gama gari",
    "Country-code domains": "Sunayen yanar gizo na ƙasashe",
    "Availability requires confirmation": "Ana buƙatar tabbatar da samuwa",
    "first year": "shekarar farko",
    "Price on request": "Farashi bisa buƙata",
    "Renewal price confirmed in your quote":
      "Za a tabbatar da farashin sabuntawa cikin tayin farashi",
    "Request availability & quote": "Nemi binciken samuwa da farashi",
    "Your domain request is saved.": "An ajiye buƙatar sunanka.",
    "Tell us where to send your availability check and quote.":
      "Faɗa mana inda za mu aika binciken samuwa da farashi.",
    "Domain service": "Aikin sunan yanar gizo",
    "Phone number": "Lambar waya",
    "New registration": "Sabuwar rajista",
    "Transfer an existing domain": "Canja sunan da yake akwai",
    "Renewal enquiry": "Tambayar sabuntawa",
    "Send domain request": "Aika buƙatar suna",
    "Sending…": "Ana aikawa…",
    "Your domain, step by step.": "Sunan yanar gizonkinka, mataki-mataki.",
    "Choose your name": "Zaɓi sunanka",
    "Confirm the quote": "Tabbatar da farashi",
    "Register and connect": "Yi rajista ka haɗa",
    "Keep it yours": "Riƙe shi naka",
    "Explore Nigerian, global and country-code extensions.":
      "Bincika ƙarin sunaye na Najeriya, duniya da ƙasashe.",
    "Keep your contact details current and renew before your confirmed expiry date.":
      "Sabunta bayanan tuntuɓarka ka sabunta suna kafin ranar ƙarewa.",
    "A domain is one part of your online home.":
      "Sunan yanar gizo wani sashe ne na gidanka a intanet.",
    "Connect a domain you own": "Haɗa sunan yanar gizonkinka",
    "Good to know before you register.": "Abin sani kafin rajista.",
    "Is the domain available when it appears here?":
      "Shin suna yana samuwa idan ya bayyana nan?",
    "Who handles my registration?": "Wa ke sarrafa rajistata?",
    "Is my domain included in the website plan?":
      "Shin sunana yana cikin tsarin shafin yanar gizo?",
    "Can I transfer a domain?": "Zan iya canja sunan yanar gizo?",
    "Enter your preferred name above first.":
      "Da farko shigar da sunan da kake so a sama.",
    "Choose a supported extension.": "Zaɓi ƙarin sunan da ake tallafawa.",
    "Use letters, numbers and hyphens, without spaces or a website address.":
      "Yi amfani da haruffa, lambobi da layukan haɗi, ba tare da sarari ko cikakken adireshin yanar gizo ba.",
    Nigeria: "Najeriya",
    Global: "Duniya",
    Africa: "Afirka",
    "United Kingdom": "Birtaniya",
    "South Africa": "Afirka ta Kudu",
    Ghana: "Gana",
    Kenya: "Kenya",
    "Choose a design.": "Zaɓi samfurin.",
    "Create your account and edit your content.":
      "Ƙirƙiri asusunka ka gyara bayananka.",
    "Save your website and turn on publishing.":
      "Ajiye shafinka ka kunna wallafawa.",
    "Keep customer records in one workspace.":
      "Riƙe bayanan abokan ciniki a wuri ɗaya.",
    "Find contact details when you need them.":
      "Nemo bayanan tuntuɓa lokacin da kake buƙata.",
    "Use actual business history to follow up.":
      "Yi amfani da ainihin tarihin kasuwanci don bibiyar aiki.",
    "Organise services and appointment times.":
      "Tsara ayyuka da lokutan alƙawari.",
    "Record sales and see daily totals.":
      "Rubuta tallace-tallace ka ga jimillar yau.",
    "Keep customer details beside your activity.":
      "Riƙe bayanan abokan ciniki kusa da aikinka.",
    "Keep invoices linked to customer records.":
      "Haɗa takardun kuɗi da bayanan abokan ciniki.",
    "See outstanding balances in your dashboard.":
      "Ga kuɗin da ya rage a allon gudanarwarka.",
    "Configure Paystack settlement before accepting online payments.":
      "Saita karɓar kuɗin Paystack kafin biyan yanar gizo.",
    "Maintain your product catalogue.": "Kula da kundin kayayyaki.",
    "Track stock changes and low inventory.":
      "Bi sauye-sauyen kaya da ƙarancin su.",
    "Record expenses for a clearer operating picture.":
      "Rubuta kashe kuɗi don fahimtar aikinka.",
    "Review business performance from recorded activity.":
      "Duba yadda kasuwanci ke tafiya daga bayanan da aka rubuta.",
    "Measure published website and landing-page interactions.":
      "Auna hulɗar shafukan yanar gizo da aka wallafa.",
    "Keep preview activity separate from live metrics.":
      "Ware dubawar samfurin daga alkaluman ainihin shafi.",
    "Create a customer record.": "Ƙirƙiri bayanan abokin ciniki.",
    "Add their contact details and relevant notes.":
      "Ƙara bayanan tuntuɓarsu da bayanin da ya dace.",
    "Connect their bookings, sales and invoices.":
      "Haɗa ajiyar lokacinsu, tallace-tallace da takardun kuɗi.",
    "Add your services and team.": "Ƙara ayyukanka da ƙungiyarka.",
    "Create an appointment or record a sale.":
      "Tsara alƙawari ko rubuta tallace-tallace.",
    "Review the day in your dashboard.":
      "Duba ayyukan yau a allon gudanarwarka.",
    "Create an invoice for a customer.":
      "Ƙirƙiri takardar kuɗi don abokin ciniki.",
    "Review the details and share the invoice.":
      "Duba bayanan ka tura takardar kuɗi.",
    "Track the payment and outstanding balance.":
      "Bi biyan kuɗi da ragowar kuɗi.",
    "Add your products and stock quantities.": "Ƙara kayayyaki da adadinsu.",
    "Record sales and stock changes.":
      "Rubuta tallace-tallace da sauye-sauyen kaya.",
    "Add expenses and review reports.": "Ƙara kashe kuɗi ka duba rahotanni.",
    "Keep your business records up to date.":
      "Riƙa sabunta bayanan kasuwancinka.",
    "Publish your selected design.": "Wallafa samfurin da ka zaɓa.",
    "Review your reports and website metrics.":
      "Duba rahotanni da alkaluman shafinka.",
    "Request a consultation.": "Nemi tattaunawa.",
    "Confirm your scope and usage allowances.":
      "Tabbatar da iyakar aiki da yawan amfani.",
    "Complete setup and test your business line.":
      "Kammala saiti ka gwada layin kasuwanci.",
    "Choose from 200 website and landing-page designs.":
      "Zaɓi daga samfuran yanar gizo da talla 200.",
    "Add your logo, photos, services and genuine reviews.":
      "Ƙara tambari, hotuna, ayyuka da sharhi na gaske.",
    "Preview your design on desktop and mobile before publishing.":
      "Duba samfurinka a kwamfuta da waya kafin wallafawa.",
    "Keep your design when you upgrade your plan.":
      "Riƙe samfurinka idan ka haɓaka tsari.",
    "A free JKTL subdomain for one published website.":
      "Adireshin JKTL na kyauta don shafi ɗaya da aka wallafa.",
    "Managed hosting and SSL for supported published sites.":
      "Masauki da SSL don shafukan da aka wallafa masu tallafi.",
    "Publish on your free JKTL address.": "Wallafa a adireshin JKTL na kyauta.",
    "Keep hosting included when you upgrade.":
      "Masauki yana nan cikin tsari idan ka haɓaka.",
    "Request a separate quote only for standalone hosting needs.":
      "Nemi farashi dabam don masaukin da ya keɓanta.",
    "Create your website.": "Ƙirƙiri shafinka.",
    "Share your site without buying hosting twice.":
      "Raba shafinka ba tare da biyan masauki sau biyu ba.",
    "Browse templates without creating an account.":
      "Duba samfura ba tare da ƙirƙirar asusu ba.",
    "Keep your selected design through sign-in.":
      "Riƙe zaɓin samfurinka har bayan shiga.",
    "Review paid capabilities and totals before checkout.":
      "Duba ayyukan biyan kuɗi da jimilla kafin biya.",
    "Open Help in your Business dashboard for account-specific guides.":
      "Buɗe Taimako a allon kasuwanci don jagorar asusunka.",
    "Create a website that works for your business.":
      "Mai ƙirƙirar shafin yanar gizo",
    "Build your website from a JKTL design or a blank canvas, then publish it on your own free JKTL address.":
      "Mai ƙirƙirar shafin yanar gizo. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A place online with your name on it.": "Adireshin yanar gizo na kyauta",
    "Start with a free businessname.jktl.com.ng address. You can connect a domain you own when you choose an eligible paid plan.":
      "Adireshin yanar gizo na kyauta. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Keep your customer relationships together.": "Gudanar da abokan ciniki",
    "Organise customer details and history alongside the bookings, sales and invoices that matter to your business.":
      "Gudanar da abokan ciniki. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A clearer view of the day ahead.": "Ajiyar lokaci da tallace-tallace",
    "Manage appointments and record everyday sales without losing track of the customer behind each transaction.":
      "Ajiyar lokaci da tallace-tallace. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Send an invoice. Keep track of payment.": "Takardun kuɗi da biyan kuɗi",
    "Create invoices, record their status and connect supported Paystack payments through your business payment settings.":
      "Takardun kuɗi da biyan kuɗi. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Know what is in stock and what you spend.": "Kaya da kashe kuɗi",
    "Keep product quantities and operating expenses alongside your everyday business activity.":
      "Kaya da kashe kuɗi. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Understand the numbers behind your business.": "Rahotanni da nazari",
    "Use your actual records to review sales, customers and website interactions. Published template sites can report views, contact clicks and booking conversions.":
      "Rahotanni da nazari. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Give missed enquiries a way forward.": "Mai karɓar kira na AI",
    "Explore separately activated call handling and missed-call recovery. Setup, subscription and communication usage are scoped independently from website plans.":
      "Mai karɓar kira na AI. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A reliable home for your JKTL website.": "Masaukin yanar gizo da HTTPS",
    "Managed website hosting is already included with a JKTL website subscription, including the Free plan. Supported hosted sites use SSL.":
      "Masaukin yanar gizo da HTTPS. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Make every customer easier to remember.": "Gudanar da abokan cinikinka",
    "Bring contact details and business history together so your team can pick up where the last conversation ended.":
      "Gudanar da abokan cinikinka. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Keep appointments moving smoothly.": "Tsara alƙawura",
    "Organise services, team availability and customer bookings in one workspace.":
      "Tsara alƙawura. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Make payment part of a clearer workflow.": "Karɓi kuɗi",
    "Connect invoices and supported online payments to the customer records you already use.":
      "Karɓi kuɗi. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Keep your stock and spending in view.": "Bibiyar kaya da kashe kuɗi",
    "Record what comes in, what goes out and the expenses that keep your business running.":
      "Bibiyar kaya da kashe kuɗi. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A workspace your team can share.": "Yi aiki tare da ƙungiyarka",
    "Use owner, manager and staff roles. New website plans support finite collaborator allowances while existing contractual access remains unchanged.":
      "Yi aiki tare da ƙungiyarka. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Your business, wherever the day takes you.": "Gudanar da kasuwanci a waya",
    "Use JKTL Business on your phone and install it from a supported browser for easier access.":
      "Gudanar da kasuwanci a waya. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Turn your next idea into an online presence.":
      "Sanya kasuwancinka a yanar gizo",
    "Choose a design, create your account and publish your business website. Add a domain and email when you are ready.":
      "Sanya kasuwancinka a yanar gizo. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Give the next enquiry a clear next step.":
      "Dawo da tambayoyin da aka rasa",
    "Explore the optional AI receptionist and missed-call workflow, with an agreed scope and explicit communication usage limits.":
      "Dawo da tambayoyin da aka rasa. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Make the next decision with better information.": "San alkalumanka",
    "Review recorded sales, customer activity and published website interactions without invented visitor or revenue figures.":
      "San alkalumanka. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A smoother day for your salon or beauty business.": "Salon da ƙawata jiki",
    "Use customer records, service catalogues, bookings and a website design suited to salons, wellness studios and med spas.":
      "Salon da ƙawata jiki. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Give your products a clearer place online.": "Sayarwa da ciniki",
    "Keep products, stock, sales and invoices together, with a website that introduces your business to new customers.":
      "Sayarwa da ciniki. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "Make it easier to discover your business.": "Abinci da karɓar baƙi",
    "Build an online home for a restaurant, hotel or hospitality business while keeping everyday sales, stock and enquiries in view.":
      "Abinci da karɓar baƙi. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "A little guidance for your next step.": "Taimako da jagorori",
    "Find a practical starting point for your website, account, business tools and billing.":
      "Taimako da jagorori. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    "From your first design to your first published page.":
      "Matakan farko da JKTL",
    "Start with a template or blank canvas, add your business details and publish on a free JKTL address.":
      "Matakan farko da JKTL. Duba yadda kayan aikin JKTL za su taimaka wa kasuwancinka, ka fara kyauta sannan ka zaɓi ayyukan da kake buƙata.",
    Email: "Imel",
    "Sign out": "Fita",
    "Already have an account?": "Kana da asusu?",
    "Sign in to run your business today.":
      "Shiga don gudanar da kasuwancinka yau.",
    "Your selected template is ready. Sign in to open it in the website editor.":
      "Samfurin da ka zaɓa yana shirye. Shiga don buɗe shi a editan yanar gizo.",
    "Your selected template is ready. It will open after account setup.":
      "Samfurinka yana shirye. Zai buɗe bayan saita asusu.",
    "A place for your next big idea": "Wuri don babban ra’ayinka na gaba",
    "Your business.": "Kasuwancinka.",
    "Your vision.": "Burinka.",
    "Your next chapter.": "Matakinka na gaba.",
    "Your next chapter starts here.": "Matakinka na gaba yana farawa nan.",
    "Let’s get you started": "Mu fara tare",
    "No credit card required": "Ba a buƙatar katin kuɗi",
    "Selected template:": "Samfurin da aka zaɓa:",
    "Catalogue & stock": "Kundin kaya da adadi",
    Money: "Kuɗi",
    "Grow your business": "Bunku kasuwancinka",
    Analytics: "Nazari",
    "Import data": "Shigo da bayanai",
    Pending: "Ana jira",
    Confirmed: "An tabbatar",
    Completed: "An kammala",
    Cancelled: "An soke",
    Paid: "An biya",
    Draft: "Daftari",
    Overdue: "Ya wuce lokaci",
    Low: "Ƙaranci",
    "Low stock": "Kaya sun yi ƙasa",
    Adjust: "Daidaita",
    "in stock": "a cikin kaya",
    "Nothing booked beyond today yet.": "Babu ajiyar lokaci bayan yau tukuna.",
    "Recent activity": "Ayyukan baya-bayan nan",
    "Popular services": "Ayyukan da aka fi nema",
    "Website metrics": "Alkaluman yanar gizo",
    "Websites & landing pages": "Shafukan yanar gizo da talla",
    "View website metrics": "Duba alkaluman shafi",
    "Edit selected template": "Gyara samfurin da aka zaɓa",
    "Website address, business logo & custom domain":
      "Adireshin shafi, tambarin kasuwanci da sunan yanar gizo",
    "Your selected design stays with you:":
      "Samfurin da ka zaɓa yana nan tare da kai:",
    "Upgrading changes your plan, not your website.":
      "Haɓakawa tana canza tsarinka, ba shafinka ba.",
    Free: "Kyauta",
    RECOMMENDED: "AN BA DA SHAWARA",
    "NO CREDIT CARD REQUIRED": "BA A BUƘATAR KATIN KUƊI",
    Select: "Zaɓi",
    "billed yearly": "ana biya duk shekara",
    "billed monthly": "ana biya duk wata",
    "Monthly billing available": "Akwai biyan duk wata",
    "Free to start — no subscription charge": "Fara kyauta — babu kuɗin tsari",
    "Start with your free website": "Fara da shafinka na kyauta",
    "Free JKTL subdomain": "Adireshin JKTL na kyauta",
    "Managed hosting & SSL": "Masauki da SSL",
    "200 designs + blank canvases": "Samfura 200 da shafukan farawa",
    "A website that feels like you": "Shafin da ya yi daidai da kai",
    "Your digital essentials": "Muhimman kayan aikinka na dijital",
    "Tools for the everyday": "Kayan aikin yau da kullum",
    "Everything in Free": "Duk abin da ke cikin Kyauta",
    "Everything in Starter": "Duk abin da ke cikin Starter",
    "Everything in Growth": "Duk abin da ke cikin Growth",
    "Everything in Business": "Duk abin da ke cikin Business",
    "Custom domain connection": "Haɗa sunan yanar gizo naka",
    "Remove JKTL branding": "Cire alamar JKTL",
    "Basic SEO settings": "Saitunan SEO na asali",
    "Two collaborators": "Mutane biyu masu haɗin aiki",
    "Five collaborators": "Mutane biyar masu haɗin aiki",
    "Ten collaborators": "Mutane goma masu haɗin aiki",
    "25 collaborators": "Mutane 25 masu haɗin aiki",
    "Standard support": "Taimako na yau da kullum",
    "1 GB image storage": "Ma’ajin hotuna na 1 GB",
    "5 GB image storage": "Ma’ajin hotuna na 5 GB",
    "15 GB image storage": "Ma’ajin hotuna na 15 GB",
    "30 GB image storage": "Ma’ajin hotuna na 30 GB",
    "Basic website analytics": "Nazarin shafin yanar gizo na asali",
    "Inventory and expense tracking": "Bibiyar kaya da kashe kuɗi",
    "Appointment scheduling": "Tsara alƙawura",
    "Products and services catalogue": "Kundin kayayyaki da ayyuka",
    "Paystack payment integration": "Haɗin biyan kuɗi ta Paystack",
    "Basic website editor": "Editan shafin yanar gizo na asali",
    "JKTL branding": "Alamar JKTL",
    "Responsive website editor": "Editan shafi mai daidaita girman allo",
    "Customer records and invoicing": "Bayanan abokan ciniki da takardun kuɗi",
    "One published website or landing page":
      "Shafin yanar gizo ko talla ɗaya da aka wallafa",
    "Choose an available JKTL address in Website settings.":
      "Zaɓi adireshin JKTL da yake samuwa a saitunan shafi.",
    "Save your design and business details.":
      "Ajiye samfurinka da bayanan kasuwanci.",
    "Publish your site and share your address.":
      "Wallafa shafinka ka raba adireshinka.",
    "Discuss your services, opening hours and call requirements.":
      "Tattauna ayyuka, lokutan buɗewa da bukatun kira.",
    "Agree setup, recurring costs and usage limits before activation.":
      "Amince da saiti, kuɗin lokaci-lokaci da iyakar amfani kafin kunnawa.",
    "Use the existing receptionist console to manage an active contract.":
      "Yi amfani da allon mai karɓar kira don gudanar da kwangila mai aiki.",
    "Manage team access from your owner account.":
      "Gudanar da damar ƙungiya daga asusun mai kasuwanci.",
    "Choose a plan with the collaborator allowance you need.":
      "Zaɓi tsarin da yake da adadin masu aiki da kake buƙata.",
    "Keep your website design when your team grows.":
      "Riƙe samfurin shafinka idan ƙungiyarka ta bunƙasa.",
    "Open team settings as the owner.":
      "Buɗe saitunan ƙungiya a matsayin mai kasuwanci.",
    "Review your current collaborator allowance.":
      "Duba adadin masu aiki da tsarinka ya yarda.",
    "Add the team members you need.": "Ƙara mutanen ƙungiyar da kake buƙata.",
    "Use a responsive business dashboard.":
      "Yi amfani da allon kasuwanci mai daidaita allo.",
    "Access your records on supported mobile browsers.":
      "Duba bayananka a burauzar waya masu tallafi.",
    "Check sync status when your connection returns.":
      "Duba matsayin daidaitawa idan haɗin ya dawo.",
    "Open JKTL Business in your mobile browser.":
      "Buɗe JKTL Business a burauzar wayarka.",
    "Sign in to your business account.": "Shiga asusun kasuwancinka.",
    "Use your browser installation option where supported.":
      "Yi amfani da zaɓin girkawa na burauza idan yana aiki.",
    "Publish a business website with your services, photos and contact details.":
      "Mai ƙirƙirar shafin yanar gizo. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Make it yours with brand colours and curated font pairings.":
      "Samfuran shafin yanar gizo. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Get online with your own JKTL subdomain.":
      "Adireshin yanar gizo na kyauta. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Create a focused campaign page and measure published results.":
      "Mai ƙirƙirar shafin talla. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Keep customer records, history and preferences together.":
      "Gudanar da abokan ciniki. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Manage appointments and record everyday sales.":
      "Ajiyar lokaci da tallace-tallace. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Send invoices and collect payments through Paystack.":
      "Takardun kuɗi da biyan kuɗi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Track your stock and the money your business spends.":
      "Kaya da kashe kuɗi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Understand revenue, customer trends and performance.":
      "Rahotanni da nazari. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Explore call handling and missed-call recovery for your business.":
      "Mai karɓar kira na AI. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Connect a domain you own, or ask us about manual registration.":
      "Sunan yanar gizo naka. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Managed hosting for your published JKTL business website.":
      "Masaukin yanar gizo da HTTPS. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Ask the team about manual Zoho Mail setup for your domain.":
      "Imel na kasuwanci. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Start with the business tools. AI and optional services are priced separately.":
      "Fara kyauta. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Give every customer a more personal experience.":
      "Gudanar da abokan cinikinka. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Organise bookings, services and customer visits.":
      "Tsara alƙawura. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Invoice customers and track their payments.":
      "Karɓi kuɗi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Keep an eye on your products and operating costs.":
      "Bibiyar kaya da kashe kuɗi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Manage access with owner, manager and staff roles.":
      "Yi aiki tare da ƙungiyarka. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Install JKTL from your browser and work on the go.":
      "Gudanar da kasuwanci a waya. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Help customers discover your services and reach you.":
      "Sanya kasuwancinka a yanar gizo. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Explore the paid AI receptionist and follow-up workflow.":
      "Dawo da tambayoyin da aka rasa. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Use reports to understand how your business is doing.":
      "San alkalumanka. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Customer records and bookings for personal care businesses.":
      "Salon da ƙawata jiki. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Stock, sales and invoices for product businesses.":
      "Sayarwa da ciniki. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Keep track of sales, stock and customer enquiries.":
      "Abinci da karɓar baƙi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Find the tools that fit your type of business.":
      "Duba dukkan sana’o’i. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "See how the existing JKTL tools work together.":
      "Kayan gudanar da kasuwanci. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "A practical introduction to your business tools.":
      "Yadda JKTL ke aiki. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Meet the company behind your business platform.":
      "Game da JKTL. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Learn about referring businesses to JKTL.":
      "Shirin abokan hulɗa. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Find product guides in your JKTL account.":
      "Taimako da jagorori. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Ask a question or discuss setup and custom work.":
      "Tuntuɓi ƙungiyar. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Compare free and paid website plans with monthly or yearly billing.":
      "Tsare-tsare da farashi. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Create an account, add your business and get familiar with the tools.":
      "Matakan farko da JKTL. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Talk to the JKTL team about the right next step.":
      "Kana buƙatar taimako?. Gano abubuwan da JKTL ke ba kasuwancinka.",
    "Core business tools and all website designs remain available. Domains, business email, AI products and custom services are scoped separately. Review current capabilities and the full payable total before any paid checkout.":
      "Kayan kasuwanci na asali da duk samfura suna nan. Sunayen yanar gizo, imel, AI da ayyuka na musamman suna da farashi dabam. Duba abubuwan da ake samu da cikakken kuɗi kafin biya.",
    "No. These are name suggestions and extension choices. The JKTL team confirms live registrar availability before quoting or taking payment.":
      "A’a. Waɗannan shawarwarin suna ne da zaɓin ƙarin suna. Ƙungiyar JKTL tana tabbatar da ainihin samuwa kafin farashi ko karɓar kuɗi.",
    "JKTL manages your request and fulfils domain registration through Go54 after confirming the quote, payment and any registry requirements.":
      "JKTL yana sarrafa buƙatarka yana yin rajista ta Go54 bayan tabbatar da farashi, biyan kuɗi da bukatun rajista.",
    "A free JKTL subdomain is included. Registration of a separate domain and its annual renewal are quoted independently.":
      "Adireshin JKTL na kyauta yana ciki. Ana bayar da farashin rajistar suna dabam da sabuntawar shekara dabam.",
    "The JKTL team will confirm registrar availability, eligibility, registration price and renewal price before requesting payment. Your domain has not yet been registered or reserved.":
      "Ƙungiyar JKTL za ta tabbatar da samuwa, cancanta, farashin rajista da sabuntawa kafin neman biya. Ba a yi rajista ko ajiyar sunanka ba tukuna.",
    "Hosting is already included with your JKTL website. Domain registration and professional email are separate services — you do not need to buy website hosting twice.":
      "Masauki yana cikin shafin JKTL. Rajistar sunan yanar gizo da imel na kasuwanci ayyuka ne dabam — ba sai ka biya masauki sau biyu ba.",
    "Country-code and restricted domains may need local presence or supporting documents. Registry support, premium names, transfer eligibility and final registration terms are confirmed by the team.":
      "Sunayen ƙasa ko masu sharadi na iya buƙatar zama a ƙasar ko takardun shaida. Ƙungiyar za ta tabbatar da tallafin rajista, sunaye na musamman, cancantar canja wuri da sharuɗɗan ƙarshe.",
    "One-year request. The quote confirms the permitted term, any transfer requirements, taxes and renewal dates. No payment or automatic registration starts from this form.":
      "Buƙatar shekara ɗaya. Tayin farashi zai tabbatar da wa’adin da aka yarda, bukatun canja wuri, haraji da ranakun sabuntawa. Wannan fom ba ya fara biyan kuɗi ko rajista ta atomatik.",
    "JKTL checks availability and confirms registration and renewal totals through Go54.":
      "JKTL yana duba samuwa yana tabbatar da jimillar rajista da sabuntawa ta Go54.",
    "After payment and any required checks, the team completes registration and helps you connect your website.":
      "Bayan biya da binciken da ake buƙata, ƙungiyar tana kammala rajista tana taimaka maka haɗa shafinka.",
    "You can request a transfer assessment. The team confirms registry rules, transfer eligibility, authorisation requirements and any applicable cost.":
      "Za ka iya neman tantance canja wuri. Ƙungiyar tana tabbatar da dokokin rajista, cancanta, izini da farashin da ya dace.",
    "Explore the templates without signing up. Try desktop and mobile preview, or choose a blank canvas.":
      "Duba samfura ba tare da rajista ba. Gwada dubawa a kwamfuta da waya, ko zaɓi shafin farawa.",
    "Create your free account. Your selected template follows you — add your logo, photos, services and contact details.":
      "Ƙirƙiri asusun kyauta. Samfurin da ka zaɓa yana tare da kai — ƙara tambari, hotuna, ayyuka da bayanan tuntuɓa.",
    "Save your design and turn on publishing. Your website is available on your free JKTL address, with hosting and SSL included.":
      "Ajiye samfurinka ka kunna wallafawa. Shafinka zai kasance a adireshin JKTL na kyauta, tare da masauki da SSL.",
    "Choose a paid plan for your team, connect a domain you own, and request business email separately.":
      "Zaɓi tsarin biyan kuɗi don ƙungiya, haɗa sunan yanar gizo naka, ka nemi imel na kasuwanci dabam.",
    "Pick a 2026 website or landing-page template":
      "Zaɓi samfurin shafin yanar gizo ko talla na 2026",
    "that feels like your business.": "wanda ya dace da kasuwancinka.",
    "200 industry designs, plus blank starting points. Preview a design, then make it yours in JKTL Business.":
      "Samfuran sana’o’i 200 tare da shafukan farawa. Duba samfurin sannan ka mayar da shi naka a JKTL Business.",
    "Website plans — keep this design →":
      "Tsare-tsaren shafi — riƙe wannan samfurin →",
    "← Website settings": "← Saitunan shafi",
    "Choose another template": "Zaɓi wani samfurin",
    "Identity & hero": "Asali da gabatarwa",
    "Website name": "Sunan shafi",
    "Introductory line": "Jumlar gabatarwa",
    "Main headline": "Babban take",
    Introduction: "Gabatarwa",
    "Main button label": "Rubutun babban maɓalli",
    "Hero image HTTPS URL": "Adireshin HTTPS na hoton farko",
    "Use bundled template artwork": "Yi amfani da hoton da ke cikin samfurin",
    "Live preview": "Dubawa kai tsaye",
    About: "Game da mu",
    Gallery: "Hotuna",
    "Service areas": "Wuraren ayyuka",
    "Social icons": "Alamomin sada zumunta",
    Reviews: "Ra’ayoyi",
    "Logo, service areas & SEO": "Tambari, wuraren aiki da SEO",
    "Publish website": "Wallafa shafi",
    "Save demo website": "Ajiye shafin gwaji",
    "Save website": "Ajiye shafi",
    "· Website editor": "· Editan shafi",
  },
  ig: {
    "Start for free": "Bido n’efu",
    "Log in": "Banye",
    "Sign in": "Banye",
    "Sign up": "Debanye aha",
    "Log out": "Pụọ",
    Product: "Ngwaahịa",
    Solutions: "Ngwọta",
    Resources: "Akụrụngwa",
    Domains: "Aha ngalaba",
    Pricing: "Ọnụahịa",
    Creation: "Mepụta",
    Business: "Azụmahịa",
    Essentials: "Ihe ndị dị mkpa",
    Management: "Nlekọta",
    Growth: "Uto",
    "By industry": "Dị ka ụdị azụmahịa",
    Explore: "Chọgharịa",
    Support: "Nkwado",
    "Start here": "Bido ebe a",
    "Website builder": "Ngwa ime weebụsaịtị",
    "Website templates": "Ụdị weebụsaịtị",
    "Free website address": "Adreesị weebụsaịtị n’efu",
    "Landing page builder": "Ngwa ime ibe mgbasa ozi",
    "Customer management": "Nlekọta ndị ahịa",
    "Bookings & sales": "Ntụnye oge na ahịa",
    "Invoicing & payments": "Akwụkwọ ụgwọ na ịkwụ ụgwọ",
    "Inventory & expenses": "Ngwaahịa na mmefu",
    "Reports & analytics": "Akụkọ na nyocha",
    "AI receptionist": "Onye nnabata oku AI",
    "Custom domains": "Aha ngalaba nke gị",
    "Hosting & HTTPS": "Nkwado weebụsaịtị na HTTPS",
    "Business email": "Email azụmahịa",
    "Business tools": "Ngwa azụmahịa",
    "Manage your customers": "Lekọta ndị ahịa gị",
    "Schedule appointments": "Hazie oge nzukọ",
    "Get paid": "Nata ụgwọ",
    "Track stock & expenses": "Sochie ngwaahịa na mmefu",
    "Work with your team": "Soro ndị otu gị rụọ ọrụ",
    "Run your business on mobile": "Jiri ekwentị lekọta azụmahịa gị",
    "Get your business online": "Tinye azụmahịa gị n’ịntanetị",
    "Recover missed enquiries": "Zaghachi ajụjụ ndị furu efu",
    "Know your numbers": "Mara ọnụọgụ azụmahịa gị",
    "Salons & beauty": "Ụlọ mma na ịma mma",
    "Retail & trade": "Ahịa na azụmahịa",
    "Food & hospitality": "Nri na ile ọbịa",
    "Explore all industries": "Chọgharịa ụdị azụmahịa niile",
    "Business management tools": "Ngwa nlekọta azụmahịa",
    "How JKTL works": "Otu JKTL si arụ ọrụ",
    "About JKTL": "Gbasara JKTL",
    "Partner programme": "Mmemme ndị mmekọ",
    "Help & guides": "Enyemaka na ntuziaka",
    "Contact the team": "Kpọtụrụ ndị otu",
    "Plans & pricing": "Atụmatụ na ọnụahịa",
    "Your first steps with JKTL": "Nzọụkwụ mbụ gị na JKTL",
    "Need a hand?": "Ị chọrọ enyemaka?",
    "Websites • Domains • Hosting • Business Email":
      "Weebụsaịtị • Aha ngalaba • Nkwado weebụsaịtị • Email azụmahịa",
    "Build your business online.": "Wulite azụmahịa gị n’ịntanetị.",
    "Grow beyond limits.": "Too n’enweghị oke.",
    "Create a professional website, get your own domain and business email, and access powerful tools to manage your business — all in one place.":
      "Mepụta weebụsaịtị ọkachamara, nweta aha ngalaba na email azụmahịa nke gị, ma jiri ngwa dị ike lekọta azụmahịa gị — niile n’otu ebe.",
    "No credit card required. Choose a plan when you’re ready.":
      "A chọghị kaadị akwụmụgwọ. Họrọ atụmatụ mgbe ị dị njikere.",
    "Your business. Online.": "Azụmahịa gị. N’ịntanetị.",
    "Your website, in four easy steps.":
      "Weebụsaịtị gị, n’ime nzọụkwụ anọ dị mfe.",
    "Find your design": "Chọta ụdị gị",
    "Make it yours": "Mee ya nke gị",
    "Publish your website": "Bipụta weebụsaịtị gị",
    "Grow when you’re ready": "Too mgbe ị dị njikere",
    "Explore templates": "Chọgharịa ụdị",
    "Compare plans": "Tụnyere atụmatụ",
    "How publishing works": "Otu mbipụta si arụ ọrụ",
    "See what’s possible.": "Lee ihe ga-ekwe omume.",
    Pause: "Kwụsịtụ",
    Play: "Gaa n’ihu",
    "Find the right plan": "Chọta atụmatụ dabara adaba",
    "for your next chapter.": "maka nzọụkwụ gị ọzọ.",
    Yearly: "Kwa afọ",
    Monthly: "Kwa ọnwa",
    "Best value": "Uru kachasị mma",
    "Save with yearly billing. All prices in NGN.":
      "Chekwaa ego site n’ịkwụ ụgwọ kwa afọ. Ọnụahịa niile dị na NGN.",
    "A strong foundation": "Ntọala siri ike",
    "for your business online.": "maka azụmahịa gị n’ịntanetị.",
    "Before you choose": "Tupu ị họrọ",
    "Before you begin": "Tupu ị bido",
    "How it works": "Otu o si arụ ọrụ",
    "What you can do": "Ihe ị nwere ike ime",
    "Continue editing your website": "Gaa n’ihu na idezi weebụsaịtị gị",
    "Back to your website": "Laghachi na weebụsaịtị gị",
    Dashboard: "Dashboard",
    Home: "Ụlọ",
    Customers: "Ndị ahịa",
    Bookings: "Ntụnye oge",
    Sales: "Ahịa",
    More: "Ọzọ",
    Settings: "Ntọala",
    Help: "Enyemaka",
    Reports: "Akụkọ",
    Inventory: "Ngwaahịa",
    Expenses: "Mmefu",
    Invoices: "Akwụkwọ ụgwọ",
    Services: "Ọrụ",
    Products: "Ngwaahịa",
    Website: "Weebụsaịtị",
    "Website plans": "Atụmatụ weebụsaịtị",
    Billing: "Ịkwụ ụgwọ",
    Team: "Ndị otu",
    Account: "Akaụntụ",
    Payments: "Ịkwụ ụgwọ",
    Save: "Chekwaa",
    Cancel: "Kagbuo",
    Delete: "Hichapụ",
    Edit: "Dezie",
    View: "Lee",
    Search: "Chọọ",
    "See all": "Lee ha niile",
    "Good morning": "Ụtụtụ ọma",
    "Good afternoon": "Ehihie ọma",
    "Good evening": "Mgbede ọma",
    "Today's sales": "Ahịa taa",
    "Bookings today": "Ntụnye oge taa",
    "Customers today": "Ndị ahịa taa",
    Outstanding: "Ụgwọ fọdụrụ",
    "Today's bookings": "Ntụnye oge taa",
    "Upcoming bookings": "Ntụnye oge na-abịa",
    "No bookings today yet.": "Enweghị ntụnye oge taa.",
    "Create your free account": "Mepụta akaụntụ efu gị",
    "Full name": "Aha zuru ezu",
    "Business name": "Aha azụmahịa",
    "Email address": "Adreesị email",
    Password: "Okwuntughe",
    "Show password": "Gosi okwuntughe",
    "Hide password": "Zoo okwuntughe",
    "Create account": "Mepụta akaụntụ",
    "Forgot password?": "Ị chefuru okwuntughe?",
    "Welcome back": "Nnọọ ọzọ",
    "Sign in to your account": "Banye n’akaụntụ gị",
    "Start for free. No credit card required.":
      "Bido n’efu. A chọghị kaadị akwụmụgwọ.",
    "Terms of Use": "Usoro ojiji",
    "Privacy Policy": "Iwu nzuzo",
    "All templates": "Ụdị niile",
    Websites: "Weebụsaịtị",
    "Landing pages": "Ibe mgbasa ozi",
    "Blank templates": "Ụdị efu",
    "All industries": "Ụdị azụmahịa niile",
    Type: "Ụdị",
    Industry: "Ụdị azụmahịa",
    "Search templates…": "Chọọ ụdị…",
    "View template": "Lee ụdị",
    "Edit template": "Dezie ụdị",
    "Show more templates": "Gosi ụdị ndị ọzọ",
    "Your website subscription": "Atụmatụ weebụsaịtị gị",
    "Website payment history": "Akụkọ ịkwụ ụgwọ weebụsaịtị",
    "Cancel renewal": "Kagbuo mmegharị",
    "Manage payment method": "Lekọta ụzọ ịkwụ ụgwọ",
    "Schedule plan change": "Hazie mgbanwe atụmatụ",
    "Request guarantee refund": "Rịọ nkwụghachi ego nkwa",
    "Your name. Your business.": "Aha gị. Azụmahịa gị.",
    "Your own domain.": "Aha ngalaba nke gị.",
    "Build a Nigerian identity with .ng, .com.ng or .name.ng — or explore a global or country-code domain for your next chapter.":
      "Wulite njirimara Naịjirịa na .ng, .com.ng ma ọ bụ .name.ng — ma ọ bụ chọgharịa aha ngalaba ụwa ma ọ bụ nke obodo ọzọ.",
    "Your preferred name": "Aha ị chọrọ",
    Extension: "Mgbakwunye aha",
    "Explore domains": "Chọgharịa aha ngalaba",
    "JKTL handles registration requests through Go54. Availability, eligibility and the full price are confirmed before you pay. Searching here does not reserve a domain.":
      "JKTL na-elekọta arịrịọ ndebanye aha site na Go54. A ga-ekwenye nnweta, ntozu na ọnụahịa zuru ezu tupu ị kwụọ ụgwọ. Nchọgharị a anaghị edobe aha ngalaba.",
    "START WITH YOUR IDENTITY": "BIDO NA NJIRIMARA GỊ",
    "Made for a Nigerian name.": "E mere maka aha Naịjirịa.",
    "Your website, email address and brand can share one memorable name.":
      "Weebụsaịtị, email na akara azụmahịa gị nwere ike ịkekọrịta otu aha dị mfe icheta.",
    "For Nigerian businesses and organisations":
      "Maka azụmahịa na òtù Naịjirịa",
    "A short Nigerian country-code identity":
      "Njirimara koodu obodo Naịjirịa dị mkpụmkpụ",
    "For a personal name or professional identity":
      "Maka aha mmadụ ma ọ bụ njirimara ọkachamara",
    "For organisations and communities": "Maka òtù na obodo",
    "For networks and technology businesses": "Maka netwọk na azụmahịa teknụzụ",
    "For eligible educational institutions; documentation may be required":
      "Maka ụlọ akwụkwọ tozuru etozu; enwere ike ịchọ akwụkwọ nkwado",
    "For eligible schools; documentation may be required":
      "Maka ụlọ akwụkwọ tozuru etozu; enwere ike ịchọ akwụkwọ nkwado",
    "A familiar global business address":
      "Adreesị azụmahịa ụwa a maara nke ọma",
    "A continental identity for an African brand":
      "Njirimara kọntinent maka akara Africa",
    "A flexible online identity": "Njirimara ịntanetị na-agbanwe agbanwe",
    "For a retail brand or online store":
      "Maka akara ahịa ma ọ bụ ụlọ ahịa ịntanetị",
    "Explore a country-specific address": "Chọgharịa adreesị obodo pụrụ iche",
    "Request a quote": "Rịọ ọnụahịa",
    "Registration and annual renewal quoted separately.":
      "A na-enye ọnụahịa ndebanye aha na mmegharị kwa afọ iche.",
    "Renewal per year": "Mmegharị kwa afọ",
    "Explore this extension": "Chọgharịa mgbakwunye a",
    "Choose the right extension.": "Họrọ mgbakwunye aha dabara adaba.",
    "Explore names for your business.": "Chọgharịa aha maka azụmahịa gị.",
    "All extensions": "Mgbakwunye aha niile",
    "Nigerian domains": "Aha ngalaba Naịjirịa",
    "Generic TLDs": "TLD zuru ụwa ọnụ",
    "Country-code domains": "Aha ngalaba koodu obodo",
    "Availability requires confirmation": "A ghaghị ikwenye nnweta",
    "first year": "afọ mbụ",
    "Price on request": "Rịọ maka ọnụahịa",
    "Renewal price confirmed in your quote":
      "A ga-ekwenye ọnụahịa mmegharị na ọnụahịa gị",
    "Request availability & quote": "Rịọ nyocha nnweta na ọnụahịa",
    "Your domain request is saved.": "Echekwara arịrịọ aha ngalaba gị.",
    "Tell us where to send your availability check and quote.":
      "Gwa anyị ebe anyị ga-eziga nyocha nnweta na ọnụahịa gị.",
    "Domain service": "Ọrụ aha ngalaba",
    "Phone number": "Nọmba ekwentị",
    "New registration": "Ndebanye aha ọhụrụ",
    "Transfer an existing domain": "Nyefee aha ngalaba dị adị",
    "Renewal enquiry": "Ajụjụ mmegharị",
    "Send domain request": "Ziga arịrịọ aha ngalaba",
    "Sending…": "Na-eziga…",
    "Your domain, step by step.": "Aha ngalaba gị, nzọụkwụ n’otu n’otu.",
    "Choose your name": "Họrọ aha gị",
    "Confirm the quote": "Kwenye ọnụahịa",
    "Register and connect": "Debanye aha ma jikọọ",
    "Keep it yours": "Debe ya nke gị",
    "Explore Nigerian, global and country-code extensions.":
      "Chọgharịa mgbakwunye Naịjirịa, ụwa na koodu obodo.",
    "Keep your contact details current and renew before your confirmed expiry date.":
      "Debe nkọwa kọntaktị gị ka ọ dị ọhụrụ ma megharịa tupu ụbọchị ngwụcha ekwenyere.",
    "A domain is one part of your online home.":
      "Aha ngalaba bụ otu akụkụ nke ebe ị nọ n’ịntanetị.",
    "Connect a domain you own": "Jikọọ aha ngalaba nke gị",
    "Good to know before you register.": "Ihe ị ga-ama tupu ndebanye aha.",
    "Is the domain available when it appears here?":
      "Aha ngalaba ahụ ọ dị mgbe ọ pụtara ebe a?",
    "Who handles my registration?": "Ònye na-elekọta ndebanye aha m?",
    "Is my domain included in the website plan?":
      "Aha ngalaba m ò so n’atụmatụ weebụsaịtị?",
    "Can I transfer a domain?": "Enwere m ike inyefe aha ngalaba?",
    "Enter your preferred name above first.": "Tinye aha ị chọrọ n’elu mbụ.",
    "Choose a supported extension.": "Họrọ mgbakwunye aha akwadoro.",
    "Use letters, numbers and hyphens, without spaces or a website address.":
      "Jiri mkpụrụedemede, ọnụọgụ na ahịrị njikọ, na-enweghị oghere ma ọ bụ adreesị weebụsaịtị.",
    Nigeria: "Naịjirịa",
    Global: "Ụwa",
    Africa: "Afrịka",
    "United Kingdom": "United Kingdom",
    "South Africa": "South Africa",
    Ghana: "Ghana",
    Kenya: "Kenya",
    "Choose a design.": "Họrọ ụdị.",
    "Create your account and edit your content.":
      "Mepụta akaụntụ gị ma dezie ọdịnaya gị.",
    "Save your website and turn on publishing.":
      "Chekwaa weebụsaịtị gị ma gbanye mbipụta.",
    "Keep customer records in one workspace.":
      "Debe ndekọ ndị ahịa n’otu ebe ọrụ.",
    "Find contact details when you need them.":
      "Chọta nkọwa kọntaktị mgbe ịchọrọ ha.",
    "Use actual business history to follow up.":
      "Jiri akụkọ azụmahịa n’ezie mee nsochi.",
    "Organise services and appointment times.": "Hazie ọrụ na oge nzukọ.",
    "Record sales and see daily totals.":
      "Dekọọ ahịa ma hụ ngụkọta kwa ụbọchị.",
    "Keep customer details beside your activity.":
      "Debe nkọwa ndị ahịa n’akụkụ ọrụ gị.",
    "Keep invoices linked to customer records.":
      "Jikọọ akwụkwọ ụgwọ na ndekọ ndị ahịa.",
    "See outstanding balances in your dashboard.":
      "Hụ ụgwọ fọdụrụ na dashboard gị.",
    "Configure Paystack settlement before accepting online payments.":
      "Hazie nnyefe ego Paystack tupu ị nabata ịkwụ ụgwọ ịntanetị.",
    "Maintain your product catalogue.": "Lekọta katalọgụ ngwaahịa gị.",
    "Track stock changes and low inventory.":
      "Sochie mgbanwe ngwaahịa na ụkọ ngwaahịa.",
    "Record expenses for a clearer operating picture.":
      "Dekọọ mmefu ka ị ghọta ọrụ gị nke ọma.",
    "Review business performance from recorded activity.":
      "Nyochaa arụmọrụ azụmahịa site na ndekọ ọrụ.",
    "Measure published website and landing-page interactions.":
      "Tụọ mmekọrịta weebụsaịtị na ibe e bipụtara.",
    "Keep preview activity separate from live metrics.":
      "Debe nlele tupu mbipụta iche na ọnụọgụ weebụsaịtị dị ndụ.",
    "Create a customer record.": "Mepụta ndekọ onye ahịa.",
    "Add their contact details and relevant notes.":
      "Tinye nkọwa kọntaktị ha na ndetu dị mkpa.",
    "Connect their bookings, sales and invoices.":
      "Jikọọ ntụnye oge, ahịa na akwụkwọ ụgwọ ha.",
    "Add your services and team.": "Tinye ọrụ na ndị otu gị.",
    "Create an appointment or record a sale.":
      "Mepụta oge nzukọ ma ọ bụ dekọọ ahịa.",
    "Review the day in your dashboard.": "Nyochaa ụbọchị na dashboard gị.",
    "Create an invoice for a customer.": "Mepụta akwụkwọ ụgwọ maka onye ahịa.",
    "Review the details and share the invoice.":
      "Nyochaa nkọwa ma kesaa akwụkwọ ụgwọ ahụ.",
    "Track the payment and outstanding balance.":
      "Sochie ịkwụ ụgwọ na ụgwọ fọdụrụ.",
    "Add your products and stock quantities.": "Tinye ngwaahịa na ọnụọgụ ha.",
    "Record sales and stock changes.": "Dekọọ ahịa na mgbanwe ngwaahịa.",
    "Add expenses and review reports.": "Tinye mmefu ma nyochaa akụkọ.",
    "Keep your business records up to date.":
      "Debe ndekọ azụmahịa gị ka ọ dị ọhụrụ.",
    "Publish your selected design.": "Bipụta ụdị ị họọrọ.",
    "Review your reports and website metrics.":
      "Nyochaa akụkọ na ọnụọgụ weebụsaịtị gị.",
    "Request a consultation.": "Rịọ mkparịta ụka.",
    "Confirm your scope and usage allowances.":
      "Kwenye oke ọrụ na ikike ojiji.",
    "Complete setup and test your business line.":
      "Mechaa nhazi ma nwalee akara ekwentị azụmahịa gị.",
    "Choose from 200 website and landing-page designs.":
      "Họrọ n’etiti ụdị weebụsaịtị na ibe mgbasa ozi 200.",
    "Add your logo, photos, services and genuine reviews.":
      "Tinye akara, foto, ọrụ na nyocha n’ezie.",
    "Preview your design on desktop and mobile before publishing.":
      "Lelee ụdị gị na kọmputa na ekwentị tupu mbipụta.",
    "Keep your design when you upgrade your plan.":
      "Debe ụdị gị mgbe ị kwalitere atụmatụ gị.",
    "A free JKTL subdomain for one published website.":
      "Aha ngalaba JKTL n’efu maka otu weebụsaịtị e bipụtara.",
    "Managed hosting and SSL for supported published sites.":
      "Nkwado weebụsaịtị na SSL maka ibe e bipụtara akwadoro.",
    "Publish on your free JKTL address.": "Bipụta na adreesị JKTL efu gị.",
    "Keep hosting included when you upgrade.":
      "Nkwado weebụsaịtị ka so mgbe ị kwalitere.",
    "Request a separate quote only for standalone hosting needs.":
      "Rịọ ọnụahịa iche maka nkwado weebụsaịtị kwụụrụ onwe ya.",
    "Create your website.": "Mepụta weebụsaịtị gị.",
    "Share your site without buying hosting twice.":
      "Kesaa weebụsaịtị gị na-enweghị ịzụta nkwado ugboro abụọ.",
    "Browse templates without creating an account.":
      "Chọgharịa ụdị na-enweghị imepụta akaụntụ.",
    "Keep your selected design through sign-in.":
      "Debe ụdị ị họọrọ mgbe ị na-abanye.",
    "Review paid capabilities and totals before checkout.":
      "Nyochaa ikike akwụ ụgwọ na ngụkọta tupu ịkwụ ụgwọ.",
    "Open Help in your Business dashboard for account-specific guides.":
      "Mepee Enyemaka na dashboard azụmahịa gị maka ntuziaka akaụntụ.",
    "Create a website that works for your business.": "Ngwa ime weebụsaịtị",
    "Build your website from a JKTL design or a blank canvas, then publish it on your own free JKTL address.":
      "Ngwa ime weebụsaịtị. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A place online with your name on it.": "Adreesị weebụsaịtị n’efu",
    "Start with a free businessname.jktl.com.ng address. You can connect a domain you own when you choose an eligible paid plan.":
      "Adreesị weebụsaịtị n’efu. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Keep your customer relationships together.": "Nlekọta ndị ahịa",
    "Organise customer details and history alongside the bookings, sales and invoices that matter to your business.":
      "Nlekọta ndị ahịa. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A clearer view of the day ahead.": "Ntụnye oge na ahịa",
    "Manage appointments and record everyday sales without losing track of the customer behind each transaction.":
      "Ntụnye oge na ahịa. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Send an invoice. Keep track of payment.": "Akwụkwọ ụgwọ na ịkwụ ụgwọ",
    "Create invoices, record their status and connect supported Paystack payments through your business payment settings.":
      "Akwụkwọ ụgwọ na ịkwụ ụgwọ. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Know what is in stock and what you spend.": "Ngwaahịa na mmefu",
    "Keep product quantities and operating expenses alongside your everyday business activity.":
      "Ngwaahịa na mmefu. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Understand the numbers behind your business.": "Akụkọ na nyocha",
    "Use your actual records to review sales, customers and website interactions. Published template sites can report views, contact clicks and booking conversions.":
      "Akụkọ na nyocha. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Give missed enquiries a way forward.": "Onye nnabata oku AI",
    "Explore separately activated call handling and missed-call recovery. Setup, subscription and communication usage are scoped independently from website plans.":
      "Onye nnabata oku AI. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A reliable home for your JKTL website.": "Nkwado weebụsaịtị na HTTPS",
    "Managed website hosting is already included with a JKTL website subscription, including the Free plan. Supported hosted sites use SSL.":
      "Nkwado weebụsaịtị na HTTPS. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Make every customer easier to remember.": "Lekọta ndị ahịa gị",
    "Bring contact details and business history together so your team can pick up where the last conversation ended.":
      "Lekọta ndị ahịa gị. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Keep appointments moving smoothly.": "Hazie oge nzukọ",
    "Organise services, team availability and customer bookings in one workspace.":
      "Hazie oge nzukọ. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Make payment part of a clearer workflow.": "Nata ụgwọ",
    "Connect invoices and supported online payments to the customer records you already use.":
      "Nata ụgwọ. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Keep your stock and spending in view.": "Sochie ngwaahịa na mmefu",
    "Record what comes in, what goes out and the expenses that keep your business running.":
      "Sochie ngwaahịa na mmefu. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A workspace your team can share.": "Soro ndị otu gị rụọ ọrụ",
    "Use owner, manager and staff roles. New website plans support finite collaborator allowances while existing contractual access remains unchanged.":
      "Soro ndị otu gị rụọ ọrụ. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Your business, wherever the day takes you.":
      "Jiri ekwentị lekọta azụmahịa gị",
    "Use JKTL Business on your phone and install it from a supported browser for easier access.":
      "Jiri ekwentị lekọta azụmahịa gị. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Turn your next idea into an online presence.":
      "Tinye azụmahịa gị n’ịntanetị",
    "Choose a design, create your account and publish your business website. Add a domain and email when you are ready.":
      "Tinye azụmahịa gị n’ịntanetị. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Give the next enquiry a clear next step.": "Zaghachi ajụjụ ndị furu efu",
    "Explore the optional AI receptionist and missed-call workflow, with an agreed scope and explicit communication usage limits.":
      "Zaghachi ajụjụ ndị furu efu. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Make the next decision with better information.":
      "Mara ọnụọgụ azụmahịa gị",
    "Review recorded sales, customer activity and published website interactions without invented visitor or revenue figures.":
      "Mara ọnụọgụ azụmahịa gị. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A smoother day for your salon or beauty business.": "Ụlọ mma na ịma mma",
    "Use customer records, service catalogues, bookings and a website design suited to salons, wellness studios and med spas.":
      "Ụlọ mma na ịma mma. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Give your products a clearer place online.": "Ahịa na azụmahịa",
    "Keep products, stock, sales and invoices together, with a website that introduces your business to new customers.":
      "Ahịa na azụmahịa. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "Make it easier to discover your business.": "Nri na ile ọbịa",
    "Build an online home for a restaurant, hotel or hospitality business while keeping everyday sales, stock and enquiries in view.":
      "Nri na ile ọbịa. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "A little guidance for your next step.": "Enyemaka na ntuziaka",
    "Find a practical starting point for your website, account, business tools and billing.":
      "Enyemaka na ntuziaka. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    "From your first design to your first published page.":
      "Nzọụkwụ mbụ gị na JKTL",
    "Start with a template or blank canvas, add your business details and publish on a free JKTL address.":
      "Nzọụkwụ mbụ gị na JKTL. Chọpụta otu ngwa JKTL nwere ike isi nyere azụmahịa gị aka; bido n’efu ma họrọ ọrụ ị chọrọ.",
    Email: "Email",
    "Sign out": "Pụọ",
    "Already have an account?": "Ị nwere akaụntụ?",
    "Sign in to run your business today.": "Banye ka ị lekọta azụmahịa gị taa.",
    "Your selected template is ready. Sign in to open it in the website editor.":
      "Ụdị ị họọrọ dị njikere. Banye ka ị mepee ya na ndezi weebụsaịtị.",
    "Your selected template is ready. It will open after account setup.":
      "Ụdị gị dị njikere. Ọ ga-emeghe mgbe emechara nhazi akaụntụ.",
    "A place for your next big idea": "Ebe maka nnukwu echiche gị ọzọ",
    "Your business.": "Azụmahịa gị.",
    "Your vision.": "Ọhụụ gị.",
    "Your next chapter.": "Nzọụkwụ gị ọzọ.",
    "Your next chapter starts here.": "Nzọụkwụ gị ọzọ na-amalite ebe a.",
    "Let’s get you started": "Ka anyị bido",
    "No credit card required": "A chọghị kaadị akwụmụgwọ",
    "Selected template:": "Ụdị ahọpụtara:",
    "Catalogue & stock": "Katalọgụ na ngwaahịa",
    Money: "Ego",
    "Grow your business": "Too azụmahịa gị",
    Analytics: "Nyocha",
    "Import data": "Bubata data",
    Pending: "Na-echere",
    Confirmed: "Ekwenyere",
    Completed: "Emechara",
    Cancelled: "Akagbuola",
    Paid: "Akwụgoro",
    Draft: "Ndetu mbido",
    Overdue: "Oge agafeela",
    Low: "Dị ala",
    "Low stock": "Ngwaahịa dị ala",
    Adjust: "Gbanwee",
    "in stock": "n’ụlọ ahịa",
    "Nothing booked beyond today yet.": "Enweghị ntụnye oge gafere taa.",
    "Recent activity": "Ọrụ na-adịbeghị anya",
    "Popular services": "Ọrụ ndị a na-achọkarị",
    "Website metrics": "Ọnụọgụ weebụsaịtị",
    "Websites & landing pages": "Weebụsaịtị na ibe mgbasa ozi",
    "View website metrics": "Lee ọnụọgụ weebụsaịtị",
    "Edit selected template": "Dezie ụdị ahọpụtara",
    "Website address, business logo & custom domain":
      "Adreesị weebụsaịtị, akara azụmahịa na aha ngalaba",
    "Your selected design stays with you:": "Ụdị ị họọrọ ga-anọnyere gị:",
    "Upgrading changes your plan, not your website.":
      "Ịkwalite na-agbanwe atụmatụ gị, ọ bụghị weebụsaịtị gị.",
    Free: "N’efu",
    RECOMMENDED: "AKWADORO",
    "NO CREDIT CARD REQUIRED": "A CHỌGHỊ KAADỊ AKWỤMỤGWỌ",
    Select: "Họrọ",
    "billed yearly": "a na-akwụ kwa afọ",
    "billed monthly": "a na-akwụ kwa ọnwa",
    "Monthly billing available": "Ịkwụ ụgwọ kwa ọnwa dị",
    "Free to start — no subscription charge":
      "Bido n’efu — enweghị ụgwọ atụmatụ",
    "Start with your free website": "Bido na weebụsaịtị efu gị",
    "Free JKTL subdomain": "Aha ngalaba JKTL n’efu",
    "Managed hosting & SSL": "Nkwado weebụsaịtị na SSL",
    "200 designs + blank canvases": "Ụdị 200 na ibe efu",
    "A website that feels like you": "Weebụsaịtị na-egosipụta gị",
    "Your digital essentials": "Ihe dijitalụ ndị dị mkpa",
    "Tools for the everyday": "Ngwa maka kwa ụbọchị",
    "Everything in Free": "Ihe niile dị na N’efu",
    "Everything in Starter": "Ihe niile dị na Starter",
    "Everything in Growth": "Ihe niile dị na Growth",
    "Everything in Business": "Ihe niile dị na Business",
    "Custom domain connection": "Njikọ aha ngalaba nke gị",
    "Remove JKTL branding": "Wepụ akara JKTL",
    "Basic SEO settings": "Ntọala SEO mbụ",
    "Two collaborators": "Ndị ọrụ abụọ",
    "Five collaborators": "Ndị ọrụ ise",
    "Ten collaborators": "Ndị ọrụ iri",
    "25 collaborators": "Ndị ọrụ 25",
    "Standard support": "Nkwado ọkọlọtọ",
    "1 GB image storage": "Nchekwa foto 1 GB",
    "5 GB image storage": "Nchekwa foto 5 GB",
    "15 GB image storage": "Nchekwa foto 15 GB",
    "30 GB image storage": "Nchekwa foto 30 GB",
    "Basic website analytics": "Nyocha weebụsaịtị mbụ",
    "Inventory and expense tracking": "Nsochi ngwaahịa na mmefu",
    "Appointment scheduling": "Nhazi oge nzukọ",
    "Products and services catalogue": "Katalọgụ ngwaahịa na ọrụ",
    "Paystack payment integration": "Njikọ ịkwụ ụgwọ Paystack",
    "Basic website editor": "Ndezi weebụsaịtị mbụ",
    "JKTL branding": "Akara JKTL",
    "Responsive website editor": "Ndezi weebụsaịtị na-adaba na ihuenyo",
    "Customer records and invoicing": "Ndekọ ndị ahịa na akwụkwọ ụgwọ",
    "One published website or landing page":
      "Otu weebụsaịtị ma ọ bụ ibe e bipụtara",
    "Choose an available JKTL address in Website settings.":
      "Họrọ adreesị JKTL dị na ntọala weebụsaịtị.",
    "Save your design and business details.":
      "Chekwaa ụdị gị na nkọwa azụmahịa.",
    "Publish your site and share your address.":
      "Bipụta weebụsaịtị gị ma kesaa adreesị gị.",
    "Discuss your services, opening hours and call requirements.":
      "Kọwaa ọrụ, oge mmeghe na mkpa oku gị.",
    "Agree setup, recurring costs and usage limits before activation.":
      "Kwenye nhazi, ụgwọ na-emegharị na oke ojiji tupu ịmalite.",
    "Use the existing receptionist console to manage an active contract.":
      "Jiri njikwa onye nnabata oku lekọta nkwekọrịta dị ndụ.",
    "Manage team access from your owner account.":
      "Lekọta ohere ndị otu site n’akaụntụ onye nwe ya.",
    "Choose a plan with the collaborator allowance you need.":
      "Họrọ atụmatụ nwere ọnụọgụ ndị ọrụ ị chọrọ.",
    "Keep your website design when your team grows.":
      "Debe ụdị weebụsaịtị gị mgbe ndị otu gị toro.",
    "Open team settings as the owner.":
      "Mepee ntọala ndị otu dịka onye nwe ya.",
    "Review your current collaborator allowance.":
      "Nyochaa ọnụọgụ ndị ọrụ atụmatụ gị kwadoro.",
    "Add the team members you need.": "Tinye ndị otu ị chọrọ.",
    "Use a responsive business dashboard.":
      "Jiri dashboard azụmahịa na-adaba na ihuenyo.",
    "Access your records on supported mobile browsers.":
      "Nweta ndekọ gị na ihe nchọgharị ekwentị akwadoro.",
    "Check sync status when your connection returns.":
      "Lelee ọnọdụ mmekọrịta mgbe njikọ gị laghachiri.",
    "Open JKTL Business in your mobile browser.":
      "Mepee JKTL Business na ihe nchọgharị ekwentị gị.",
    "Sign in to your business account.": "Banye n’akaụntụ azụmahịa gị.",
    "Use your browser installation option where supported.":
      "Jiri nhọrọ nrụnye ihe nchọgharị ebe akwadoro.",
    "Publish a business website with your services, photos and contact details.":
      "Ngwa ime weebụsaịtị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Make it yours with brand colours and curated font pairings.":
      "Ụdị weebụsaịtị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Get online with your own JKTL subdomain.":
      "Adreesị weebụsaịtị n’efu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Create a focused campaign page and measure published results.":
      "Ngwa ime ibe mgbasa ozi. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Keep customer records, history and preferences together.":
      "Nlekọta ndị ahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Manage appointments and record everyday sales.":
      "Ntụnye oge na ahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Send invoices and collect payments through Paystack.":
      "Akwụkwọ ụgwọ na ịkwụ ụgwọ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Track your stock and the money your business spends.":
      "Ngwaahịa na mmefu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Understand revenue, customer trends and performance.":
      "Akụkọ na nyocha. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Explore call handling and missed-call recovery for your business.":
      "Onye nnabata oku AI. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Connect a domain you own, or ask us about manual registration.":
      "Aha ngalaba nke gị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Managed hosting for your published JKTL business website.":
      "Nkwado weebụsaịtị na HTTPS. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Ask the team about manual Zoho Mail setup for your domain.":
      "Email azụmahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Start with the business tools. AI and optional services are priced separately.":
      "Bido n’efu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Give every customer a more personal experience.":
      "Lekọta ndị ahịa gị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Organise bookings, services and customer visits.":
      "Hazie oge nzukọ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Invoice customers and track their payments.":
      "Nata ụgwọ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Keep an eye on your products and operating costs.":
      "Sochie ngwaahịa na mmefu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Manage access with owner, manager and staff roles.":
      "Soro ndị otu gị rụọ ọrụ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Install JKTL from your browser and work on the go.":
      "Jiri ekwentị lekọta azụmahịa gị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Help customers discover your services and reach you.":
      "Tinye azụmahịa gị n’ịntanetị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Explore the paid AI receptionist and follow-up workflow.":
      "Zaghachi ajụjụ ndị furu efu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Use reports to understand how your business is doing.":
      "Mara ọnụọgụ azụmahịa gị. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Customer records and bookings for personal care businesses.":
      "Ụlọ mma na ịma mma. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Stock, sales and invoices for product businesses.":
      "Ahịa na azụmahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Keep track of sales, stock and customer enquiries.":
      "Nri na ile ọbịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Find the tools that fit your type of business.":
      "Chọgharịa ụdị azụmahịa niile. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "See how the existing JKTL tools work together.":
      "Ngwa nlekọta azụmahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "A practical introduction to your business tools.":
      "Otu JKTL si arụ ọrụ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Meet the company behind your business platform.":
      "Gbasara JKTL. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Learn about referring businesses to JKTL.":
      "Mmemme ndị mmekọ. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Find product guides in your JKTL account.":
      "Enyemaka na ntuziaka. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Ask a question or discuss setup and custom work.":
      "Kpọtụrụ ndị otu. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Compare free and paid website plans with monthly or yearly billing.":
      "Atụmatụ na ọnụahịa. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Create an account, add your business and get familiar with the tools.":
      "Nzọụkwụ mbụ gị na JKTL. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Talk to the JKTL team about the right next step.":
      "Ị chọrọ enyemaka?. Chọpụta ihe JKTL na-enye azụmahịa gị.",
    "Core business tools and all website designs remain available. Domains, business email, AI products and custom services are scoped separately. Review current capabilities and the full payable total before any paid checkout.":
      "Ngwa azụmahịa mbụ na ụdị weebụsaịtị niile ka dị. Aha ngalaba, email, AI na ọrụ pụrụ iche nwere nkọwa na ọnụahịa iche. Nyochaa ikike dị ugbu a na ngụkọta tupu ịkwụ ụgwọ.",
    "No. These are name suggestions and extension choices. The JKTL team confirms live registrar availability before quoting or taking payment.":
      "Mba. Ndị a bụ aro aha na nhọrọ mgbakwunye. Ndị otu JKTL na-ekwenye nnweta n’ezie tupu inye ọnụahịa ma ọ bụ ịnata ụgwọ.",
    "JKTL manages your request and fulfils domain registration through Go54 after confirming the quote, payment and any registry requirements.":
      "JKTL na-elekọta arịrịọ gị ma debanye aha site na Go54 mgbe ekwenyere ọnụahịa, ịkwụ ụgwọ na ihe ndị ndebanye chọrọ.",
    "A free JKTL subdomain is included. Registration of a separate domain and its annual renewal are quoted independently.":
      "Aha ngalaba JKTL n’efu so. Ndebanye aha nke ọzọ na mmegharị kwa afọ nwere ọnụahịa iche.",
    "The JKTL team will confirm registrar availability, eligibility, registration price and renewal price before requesting payment. Your domain has not yet been registered or reserved.":
      "Ndị otu JKTL ga-ekwenye nnweta, ntozu, ọnụahịa ndebanye aha na mmegharị tupu ịrịọ ụgwọ. Edebanyebeghị ma ọ bụ edobebeghị aha ngalaba gị.",
    "Hosting is already included with your JKTL website. Domain registration and professional email are separate services — you do not need to buy website hosting twice.":
      "Nkwado weebụsaịtị so na weebụsaịtị JKTL gị. Ndebanye aha ngalaba na email ọkachamara bụ ọrụ iche — ị gaghị azụta nkwado ugboro abụọ.",
    "Country-code and restricted domains may need local presence or supporting documents. Registry support, premium names, transfer eligibility and final registration terms are confirmed by the team.":
      "Aha ngalaba obodo na ndị nwere mgbochi nwere ike ịchọ ọnụnọ obodo ma ọ bụ akwụkwọ nkwado. Ndị otu ga-ekwenye nkwado ndebanye, aha pụrụ iche, ntozu nnyefe na usoro ikpeazụ.",
    "One-year request. The quote confirms the permitted term, any transfer requirements, taxes and renewal dates. No payment or automatic registration starts from this form.":
      "Arịrịọ otu afọ. Ọnụahịa ga-egosi oge akwadoro, ihe nnyefe chọrọ, ụtụ na ụbọchị mmegharị. Fọm a anaghị amalite ịkwụ ụgwọ ma ọ bụ ndebanye akpaaka.",
    "JKTL checks availability and confirms registration and renewal totals through Go54.":
      "JKTL na-enyocha nnweta ma kwado ngụkọta ndebanye aha na mmegharị site na Go54.",
    "After payment and any required checks, the team completes registration and helps you connect your website.":
      "Mgbe ịkwụ ụgwọ na nyocha achọrọ gasịrị, ndị otu na-emecha ndebanye aha ma nyere gị aka ijikọ weebụsaịtị gị.",
    "You can request a transfer assessment. The team confirms registry rules, transfer eligibility, authorisation requirements and any applicable cost.":
      "Ị nwere ike ịrịọ nyocha nnyefe. Ndị otu na-ekwenye iwu ndebanye, ntozu nnyefe, ikike achọrọ na ụgwọ ọ bụla.",
    "Explore the templates without signing up. Try desktop and mobile preview, or choose a blank canvas.":
      "Chọgharịa ụdị na-enweghị ndebanye aha. Lelee na kọmputa na ekwentị, ma ọ bụ họrọ ibe efu.",
    "Create your free account. Your selected template follows you — add your logo, photos, services and contact details.":
      "Mepụta akaụntụ efu gị. Ụdị ị họọrọ na-eso gị — tinye akara, foto, ọrụ na nkọwa kọntaktị.",
    "Save your design and turn on publishing. Your website is available on your free JKTL address, with hosting and SSL included.":
      "Chekwaa ụdị gị ma gbanye mbipụta. Weebụsaịtị gị ga-adị na adreesị JKTL efu, yana nkwado weebụsaịtị na SSL.",
    "Choose a paid plan for your team, connect a domain you own, and request business email separately.":
      "Họrọ atụmatụ akwụ ụgwọ maka ndị otu gị, jikọọ aha ngalaba nke gị, ma rịọ email azụmahịa iche.",
    "Pick a 2026 website or landing-page template":
      "Họrọ ụdị weebụsaịtị ma ọ bụ ibe mgbasa ozi 2026",
    "that feels like your business.": "nke na-egosipụta azụmahịa gị.",
    "200 industry designs, plus blank starting points. Preview a design, then make it yours in JKTL Business.":
      "Ụdị azụmahịa 200 na ibe efu. Lelee ụdị, wee mee ya nke gị na JKTL Business.",
    "Website plans — keep this design →": "Atụmatụ weebụsaịtị — debe ụdị a →",
    "← Website settings": "← Ntọala weebụsaịtị",
    "Choose another template": "Họrọ ụdị ọzọ",
    "Identity & hero": "Njirimara na mbido",
    "Website name": "Aha weebụsaịtị",
    "Introductory line": "Ahịrị mmeghe",
    "Main headline": "Isi okwu",
    Introduction: "Okwu mmeghe",
    "Main button label": "Aha bọtịnụ isi",
    "Hero image HTTPS URL": "Adreesị HTTPS foto mbido",
    "Use bundled template artwork": "Jiri ihe osise so n’ụdị",
    "Live preview": "Nlele ozugbo",
    About: "Gbasara anyị",
    Gallery: "Foto",
    "Service areas": "Ebe ọrụ",
    "Social icons": "Akara mgbasa ozi",
    Reviews: "Nyocha",
    "Logo, service areas & SEO": "Akara, ebe ọrụ na SEO",
    "Publish website": "Bipụta weebụsaịtị",
    "Save demo website": "Chekwaa weebụsaịtị nnwale",
    "Save website": "Chekwaa weebụsaịtị",
    "· Website editor": "· Ndezi weebụsaịtị",
  },
  yo: {
    "Start for free": "Bẹrẹ lọ́fẹ̀ẹ́",
    "Log in": "Wọlé",
    "Sign in": "Wọlé",
    "Sign up": "Forúkọsílẹ̀",
    "Log out": "Jáde",
    Product: "Àwọn ọjà",
    Solutions: "Àwọn ojútùú",
    Resources: "Àwọn orísun ìrànlọ́wọ́",
    Domains: "Àwọn orúkọ ẹ̀ka",
    Pricing: "Ìdíyelé",
    Creation: "Ìṣẹ̀dá",
    Business: "Iṣòwò",
    Essentials: "Àwọn ohun pàtàkì",
    Management: "Ìṣàkóso",
    Growth: "Ìdàgbàsókè",
    "By industry": "Gẹ́gẹ́ bí ẹ̀ka iṣẹ́",
    Explore: "Ṣàwárí",
    Support: "Ìrànlọ́wọ́",
    "Start here": "Bẹrẹ níbí",
    "Website builder": "Ohun èlò ṣíṣe ojúlé",
    "Website templates": "Àwọn àpẹẹrẹ ojúlé",
    "Free website address": "Àdírẹ́sì ojúlé ọ̀fẹ́",
    "Landing page builder": "Ohun èlò ṣíṣe ojúewé ìpolówó",
    "Customer management": "Ìṣàkóso oníbàárà",
    "Bookings & sales": "Ìforúkọsílẹ̀ àsìkò àti títà",
    "Invoicing & payments": "Ìwé ìdíyelé àti ìsanwó",
    "Inventory & expenses": "Ọjà inú ilé àti ìnáwó",
    "Reports & analytics": "Ìròyìn àti ìtúpalẹ̀",
    "AI receptionist": "Olùgbà ìpè AI",
    "Custom domains": "Orúkọ ẹ̀ka tirẹ",
    "Hosting & HTTPS": "Gbígba ojúlé àti HTTPS",
    "Business email": "Ímeèlì iṣẹ́",
    "Business tools": "Àwọn ohun èlò iṣẹ́",
    "Manage your customers": "Ṣàkóso àwọn oníbàárà rẹ",
    "Schedule appointments": "Ṣètò àsìkò ìpàdé",
    "Get paid": "Gba owó",
    "Track stock & expenses": "Tọpinpin ọjà àti ìnáwó",
    "Work with your team": "Bá ẹgbẹ́ rẹ ṣiṣẹ́",
    "Run your business on mobile": "Ṣàkóso iṣẹ́ rẹ lórí fóònù",
    "Get your business online": "Mú iṣẹ́ rẹ wá sí ayélujára",
    "Recover missed enquiries": "Dáhùn àwọn ìbéèrè tí ó ti kọjá",
    "Know your numbers": "Mọ iye owó iṣẹ́ rẹ",
    "Salons & beauty": "Ilé ẹwà àti iṣẹ́ ẹwà",
    "Retail & trade": "Títà àti òwò",
    "Food & hospitality": "Oúnjẹ àti ìtẹ́wọ́gbà",
    "Explore all industries": "Ṣàwárí gbogbo ẹ̀ka iṣẹ́",
    "Business management tools": "Àwọn ohun èlò ìṣàkóso iṣẹ́",
    "How JKTL works": "Bí JKTL ṣe ń ṣiṣẹ́",
    "About JKTL": "Nípa JKTL",
    "Partner programme": "Ètò alábàáṣiṣẹ́",
    "Help & guides": "Ìrànlọ́wọ́ àti ìtọ́sọ́nà",
    "Contact the team": "Kàn sí ẹgbẹ́ wa",
    "Plans & pricing": "Àwọn ètò àti ìdíyelé",
    "Your first steps with JKTL": "Àwọn ìgbésẹ̀ àkọ́kọ́ rẹ pẹ̀lú JKTL",
    "Need a hand?": "Ṣé o nílò ìrànlọ́wọ́?",
    "Websites • Domains • Hosting • Business Email":
      "Àwọn ojúlé • Orúkọ ẹ̀ka • Gbígba ojúlé • Ímeèlì iṣẹ́",
    "Build your business online.": "Kọ iṣẹ́ rẹ lórí ayélujára.",
    "Grow beyond limits.": "Dàgbà ju ààlà lọ.",
    "Create a professional website, get your own domain and business email, and access powerful tools to manage your business — all in one place.":
      "Ṣẹ̀dá ojúlé amọ̀ṣẹ́dunjú, gba orúkọ ẹ̀ka àti ímeèlì iṣẹ́ tirẹ, kí o sì lo àwọn ohun èlò tó lágbára láti ṣàkóso iṣẹ́ rẹ — ní ibi kan.",
    "No credit card required. Choose a plan when you’re ready.":
      "A kò nílò káàdì ìsanwó. Yan ètò nígbà tí o bá ṣetán.",
    "Your business. Online.": "Iṣẹ́ rẹ. Lórí ayélujára.",
    "Your website, in four easy steps.": "Ojúlé rẹ, ní ìgbésẹ̀ mẹ́rin tó rọrùn.",
    "Find your design": "Wa àpẹẹrẹ rẹ",
    "Make it yours": "Ṣe é ní tìrẹ",
    "Publish your website": "Ṣe àtẹ̀jáde ojúlé rẹ",
    "Grow when you’re ready": "Dàgbà nígbà tí o bá ṣetán",
    "Explore templates": "Ṣàwárí àwọn àpẹẹrẹ",
    "Compare plans": "Ṣe àfiwé àwọn ètò",
    "How publishing works": "Bí àtẹ̀jáde ṣe ń ṣiṣẹ́",
    "See what’s possible.": "Wo ohun tí ó ṣeé ṣe.",
    Pause: "Dá dúró",
    Play: "Tẹ̀síwájú",
    "Find the right plan": "Wa ètò tó tọ́",
    "for your next chapter.": "fún ìpele rẹ tí ó kàn.",
    Yearly: "Lọ́dọọdún",
    Monthly: "Lóṣooṣù",
    "Best value": "Èrè tó dára jù",
    "Save with yearly billing. All prices in NGN.":
      "Fi owó pamọ́ pẹ̀lú ìsanwó ọdún. Gbogbo ìdíyelé wà ní NGN.",
    "A strong foundation": "Ìpìlẹ̀ tó lágbára",
    "for your business online.": "fún iṣẹ́ rẹ lórí ayélujára.",
    "Before you choose": "Kí o tó yàn",
    "Before you begin": "Kí o tó bẹ̀rẹ̀",
    "How it works": "Bí ó ṣe ń ṣiṣẹ́",
    "What you can do": "Ohun tí o lè ṣe",
    "Continue editing your website": "Tẹ̀síwájú ṣíṣàtúnṣe ojúlé rẹ",
    "Back to your website": "Padà sí ojúlé rẹ",
    Dashboard: "Pátákó ìṣàkóso",
    Home: "Ilé",
    Customers: "Àwọn oníbàárà",
    Bookings: "Àwọn ìforúkọsílẹ̀ àsìkò",
    Sales: "Títà",
    More: "Síwájú sí i",
    Settings: "Ètò",
    Help: "Ìrànlọ́wọ́",
    Reports: "Àwọn ìròyìn",
    Inventory: "Ọjà inú ilé",
    Expenses: "Ìnáwó",
    Invoices: "Àwọn ìwé ìdíyelé",
    Services: "Àwọn iṣẹ́",
    Products: "Àwọn ọjà",
    Website: "Ojúlé",
    "Website plans": "Àwọn ètò ojúlé",
    Billing: "Ìsanwó",
    Team: "Ẹgbẹ́",
    Account: "Àkọọ́lẹ̀",
    Payments: "Àwọn ìsanwó",
    Save: "Fipamọ́",
    Cancel: "Fagilé",
    Delete: "Pa rẹ́",
    Edit: "Ṣàtúnṣe",
    View: "Wò",
    Search: "Wá",
    "See all": "Wo gbogbo rẹ̀",
    "Good morning": "Ẹ káàárọ̀",
    "Good afternoon": "Ẹ káàsán",
    "Good evening": "Ẹ káalẹ́",
    "Today's sales": "Títà òní",
    "Bookings today": "Àwọn ìforúkọsílẹ̀ òní",
    "Customers today": "Àwọn oníbàárà òní",
    Outstanding: "Owó tó ṣẹ́ kù",
    "Today's bookings": "Àwọn ìforúkọsílẹ̀ òní",
    "Upcoming bookings": "Àwọn ìforúkọsílẹ̀ tó ń bọ̀",
    "No bookings today yet.": "Kò sí ìforúkọsílẹ̀ fún òní síbẹ̀.",
    "Create your free account": "Ṣẹ̀dá àkọọ́lẹ̀ ọ̀fẹ́ rẹ",
    "Full name": "Orúkọ kíkún",
    "Business name": "Orúkọ iṣẹ́",
    "Email address": "Àdírẹ́sì ímeèlì",
    Password: "Ọ̀rọ̀ aṣínà",
    "Show password": "Fi ọ̀rọ̀ aṣínà hàn",
    "Hide password": "Fi ọ̀rọ̀ aṣínà pamọ́",
    "Create account": "Ṣẹ̀dá àkọọ́lẹ̀",
    "Forgot password?": "Ṣé o gbàgbé ọ̀rọ̀ aṣínà?",
    "Welcome back": "Káàbọ̀ padà",
    "Sign in to your account": "Wọlé sínú àkọọ́lẹ̀ rẹ",
    "Start for free. No credit card required.":
      "Bẹrẹ lọ́fẹ̀ẹ́. A kò nílò káàdì ìsanwó.",
    "Terms of Use": "Àwọn òfin lílo",
    "Privacy Policy": "Ìlànà àṣírí",
    "All templates": "Gbogbo àpẹẹrẹ",
    Websites: "Àwọn ojúlé",
    "Landing pages": "Àwọn ojúewé ìpolówó",
    "Blank templates": "Àwọn àpẹẹrẹ òfo",
    "All industries": "Gbogbo ẹ̀ka iṣẹ́",
    Type: "Irú",
    Industry: "Ẹ̀ka iṣẹ́",
    "Search templates…": "Wá àpẹẹrẹ…",
    "View template": "Wo àpẹẹrẹ",
    "Edit template": "Ṣàtúnṣe àpẹẹrẹ",
    "Show more templates": "Fi àpẹẹrẹ púpọ̀ sí i hàn",
    "Your website subscription": "Ètò ìsanwó ojúlé rẹ",
    "Website payment history": "Ìtàn ìsanwó ojúlé",
    "Cancel renewal": "Fagilé ìtunṣe",
    "Manage payment method": "Ṣàkóso ọ̀nà ìsanwó",
    "Schedule plan change": "Ṣètò àyípadà ètò",
    "Request guarantee refund": "Béèrè ìdápadà owó ẹ̀rí",
    "Your name. Your business.": "Orúkọ rẹ. Iṣẹ́ rẹ.",
    "Your own domain.": "Orúkọ ẹ̀ka tirẹ.",
    "Build a Nigerian identity with .ng, .com.ng or .name.ng — or explore a global or country-code domain for your next chapter.":
      "Kọ ìdánimọ̀ Nàìjíríà pẹ̀lú .ng, .com.ng tàbí .name.ng — tàbí ṣàwárí orúkọ ẹ̀ka àgbáyé tàbí ti orílẹ̀-èdè mìíràn.",
    "Your preferred name": "Orúkọ tí o fẹ́",
    Extension: "Àfikún orúkọ ẹ̀ka",
    "Explore domains": "Ṣàwárí orúkọ ẹ̀ka",
    "JKTL handles registration requests through Go54. Availability, eligibility and the full price are confirmed before you pay. Searching here does not reserve a domain.":
      "JKTL ń bójú tó ìbéèrè ìforúkọsílẹ̀ nípasẹ̀ Go54. A ó fìdí wíwà, yíyẹ àti iye owó kíkún múlẹ̀ kí o tó sanwó. Ìwádìí yìí kò fi orúkọ ẹ̀ka pamọ́.",
    "START WITH YOUR IDENTITY": "BẸRẸ PẸ̀LÚ ÌDÁNIMỌ̀ RẸ",
    "Made for a Nigerian name.": "Fún orúkọ Nàìjíríà.",
    "Your website, email address and brand can share one memorable name.":
      "Ojúlé, àdírẹ́sì ímeèlì àti àmì iṣẹ́ rẹ lè lo orúkọ kan tó rọrùn láti rántí.",
    "For Nigerian businesses and organisations": "Fún iṣẹ́ àti ẹgbẹ́ Nàìjíríà",
    "A short Nigerian country-code identity": "Ìdánimọ̀ kúkúrú fún Nàìjíríà",
    "For a personal name or professional identity":
      "Fún orúkọ ẹni tàbí ìdánimọ̀ amọ̀ṣẹ́dunjú",
    "For organisations and communities": "Fún ẹgbẹ́ àti àwùjọ",
    "For networks and technology businesses": "Fún nẹ́tíwọ́ọ̀kì àti iṣẹ́ ìmọ̀ ẹ̀rọ",
    "For eligible educational institutions; documentation may be required":
      "Fún ilé ẹ̀kọ́ tó yẹ; a lè nílò àwọn ìwé ẹ̀rí",
    "For eligible schools; documentation may be required":
      "Fún àwọn ilé ẹ̀kọ́ tó yẹ; a lè nílò ìwé ẹ̀rí",
    "A familiar global business address":
      "Àdírẹ́sì iṣẹ́ àgbáyé tí gbogbo ènìyàn mọ̀",
    "A continental identity for an African brand":
      "Ìdánimọ̀ ilẹ̀ Áfíríkà fún àmì rẹ",
    "A flexible online identity": "Ìdánimọ̀ tó rọrùn lórí ayélujára",
    "For a retail brand or online store":
      "Fún àmì ọjà tàbí ilé ìtajà ayélujára",
    "Explore a country-specific address": "Ṣàwárí àdírẹ́sì orílẹ̀-èdè kan",
    "Request a quote": "Béèrè ìdíyelé",
    "Registration and annual renewal quoted separately.":
      "Ìforúkọsílẹ̀ àti ìtunṣe ọdún ní ìdíyelé ọ̀tọ̀ọ̀tọ̀.",
    "Renewal per year": "Ìtunṣe lọ́dọọdún",
    "Explore this extension": "Ṣàwárí àfikún yìí",
    "Choose the right extension.": "Yan àfikún tó tọ́.",
    "Explore names for your business.": "Ṣàwárí orúkọ fún iṣẹ́ rẹ.",
    "All extensions": "Gbogbo àfikún",
    "Nigerian domains": "Orúkọ ẹ̀ka Nàìjíríà",
    "Generic TLDs": "Àwọn TLD àgbáyé",
    "Country-code domains": "Orúkọ ẹ̀ka orílẹ̀-èdè",
    "Availability requires confirmation": "A nílò láti fìdí wíwà rẹ̀ múlẹ̀",
    "first year": "ọdún àkọ́kọ́",
    "Price on request": "Béèrè fún ìdíyelé",
    "Renewal price confirmed in your quote":
      "Ìdíyelé ìtunṣe wà nínú ìwé ìdíyelé rẹ",
    "Request availability & quote": "Béèrè àyẹ̀wò wíwà àti ìdíyelé",
    "Your domain request is saved.": "A ti fi ìbéèrè orúkọ ẹ̀ka rẹ pamọ́.",
    "Tell us where to send your availability check and quote.":
      "Sọ ibi tí a ó fi àyẹ̀wò wíwà àti ìdíyelé rẹ ránṣẹ́ sí.",
    "Domain service": "Iṣẹ́ orúkọ ẹ̀ka",
    "Phone number": "Nọ́mbà fóònù",
    "New registration": "Ìforúkọsílẹ̀ tuntun",
    "Transfer an existing domain": "Gbé orúkọ ẹ̀ka tó wà tẹ́lẹ̀ wá",
    "Renewal enquiry": "Ìbéèrè ìtunṣe",
    "Send domain request": "Fi ìbéèrè orúkọ ẹ̀ka ránṣẹ́",
    "Sending…": "Ń fi ránṣẹ́…",
    "Your domain, step by step.": "Orúkọ ẹ̀ka rẹ, ní ìgbésẹ̀ kọ̀ọ̀kan.",
    "Choose your name": "Yan orúkọ rẹ",
    "Confirm the quote": "Fìdí ìdíyelé múlẹ̀",
    "Register and connect": "Forúkọsílẹ̀ kí o sì so pọ̀",
    "Keep it yours": "Jẹ́ kí ó jẹ́ tìrẹ",
    "Explore Nigerian, global and country-code extensions.":
      "Ṣàwárí àfikún Nàìjíríà, àgbáyé àti ti orílẹ̀-èdè.",
    "Keep your contact details current and renew before your confirmed expiry date.":
      "Mú àlàyé ìbánisọ̀rọ̀ rẹ dojútì, kí o sì tún un ṣe kí ọjọ́ ìparí tó dé.",
    "A domain is one part of your online home.":
      "Orúkọ ẹ̀ka jẹ́ apá kan ilé rẹ lórí ayélujára.",
    "Connect a domain you own": "So orúkọ ẹ̀ka tirẹ pọ̀",
    "Good to know before you register.":
      "Ohun tí ó yẹ kí o mọ̀ kí o tó forúkọsílẹ̀.",
    "Is the domain available when it appears here?":
      "Ṣé orúkọ ẹ̀ka wà bí ó bá farahàn níbí?",
    "Who handles my registration?": "Ta ni yóò bójú tó ìforúkọsílẹ̀ mi?",
    "Is my domain included in the website plan?":
      "Ṣé orúkọ ẹ̀ka mi wà nínú ètò ojúlé?",
    "Can I transfer a domain?": "Ṣé mo lè gbé orúkọ ẹ̀ka wá?",
    "Enter your preferred name above first.": "Tẹ orúkọ tí o fẹ́ sí òkè kọ́kọ́.",
    "Choose a supported extension.": "Yan àfikún tí a ń ṣe àtìlẹ́yìn fún.",
    "Use letters, numbers and hyphens, without spaces or a website address.":
      "Lo lẹ́tà, nọ́mbà àti àmì àsopọ̀, láìsí àyè tàbí àdírẹ́sì ojúlé kíkún.",
    Nigeria: "Nàìjíríà",
    Global: "Àgbáyé",
    Africa: "Áfíríkà",
    "United Kingdom": "Ilẹ̀ Gẹ̀ẹ́sì",
    "South Africa": "Gúúsù Áfíríkà",
    Ghana: "Gánà",
    Kenya: "Kẹ́ńyà",
    "Choose a design.": "Yan àpẹẹrẹ kan.",
    "Create your account and edit your content.":
      "Ṣẹ̀dá àkọọ́lẹ̀ rẹ kí o sì ṣàtúnṣe àkóónú rẹ.",
    "Save your website and turn on publishing.":
      "Fi ojúlé rẹ pamọ́ kí o sì tan àtẹ̀jáde sí i.",
    "Keep customer records in one workspace.":
      "Pa àkọsílẹ̀ oníbàárà mọ́ ní ibi iṣẹ́ kan.",
    "Find contact details when you need them.":
      "Wa àlàyé ìbánisọ̀rọ̀ nígbà tí o bá nílò rẹ̀.",
    "Use actual business history to follow up.":
      "Lo ìtàn iṣẹ́ gidi láti ṣe ìtẹ̀lé.",
    "Organise services and appointment times.": "Ṣètò iṣẹ́ àti àsìkò ìpàdé.",
    "Record sales and see daily totals.":
      "Ṣàkọsílẹ̀ títà kí o sì wo àpapọ̀ ojoojúmọ́.",
    "Keep customer details beside your activity.":
      "Pa àlàyé oníbàárà mọ́ pẹ̀lú ìṣe rẹ.",
    "Keep invoices linked to customer records.":
      "So ìwé ìdíyelé pọ̀ mọ́ àkọsílẹ̀ oníbàárà.",
    "See outstanding balances in your dashboard.":
      "Wo owó tó ṣẹ́ kù lórí pátákó ìṣàkóso rẹ.",
    "Configure Paystack settlement before accepting online payments.":
      "Ṣètò gbígba owó Paystack kí o tó gba ìsanwó ayélujára.",
    "Maintain your product catalogue.": "Ṣètọju àtòjọ ọjà rẹ.",
    "Track stock changes and low inventory.":
      "Tọpinpin àyípadà ọjà àti ọjà tó ń tán.",
    "Record expenses for a clearer operating picture.":
      "Ṣàkọsílẹ̀ ìnáwó fún ìmọ̀ iṣẹ́ tó ṣe kedere.",
    "Review business performance from recorded activity.":
      "Ṣàyẹ̀wò ìlọsíwájú iṣẹ́ láti inú àkọsílẹ̀ ìṣe.",
    "Measure published website and landing-page interactions.":
      "Wọn ìbáṣepọ̀ lórí ojúlé àti ojúewé tí a tẹ̀ jáde.",
    "Keep preview activity separate from live metrics.":
      "Ya àwòkọ́ṣe sọ́tọ̀ kúrò nínú ìwọ̀n ojúlé gidi.",
    "Create a customer record.": "Ṣẹ̀dá àkọsílẹ̀ oníbàárà.",
    "Add their contact details and relevant notes.":
      "Fi àlàyé ìbánisọ̀rọ̀ àti àkọsílẹ̀ tó yẹ kún un.",
    "Connect their bookings, sales and invoices.":
      "So ìforúkọsílẹ̀ àsìkò, títà àti ìwé ìdíyelé wọn pọ̀.",
    "Add your services and team.": "Fi iṣẹ́ àti ẹgbẹ́ rẹ kún un.",
    "Create an appointment or record a sale.": "Ṣẹ̀dá ìpàdé tàbí ṣàkọsílẹ̀ títà.",
    "Review the day in your dashboard.": "Ṣàyẹ̀wò ọjọ́ rẹ lórí pátákó ìṣàkóso.",
    "Create an invoice for a customer.": "Ṣẹ̀dá ìwé ìdíyelé fún oníbàárà.",
    "Review the details and share the invoice.":
      "Ṣàyẹ̀wò àlàyé kí o sì pín ìwé ìdíyelé náà.",
    "Track the payment and outstanding balance.":
      "Tọpinpin ìsanwó àti owó tó ṣẹ́ kù.",
    "Add your products and stock quantities.": "Fi ọjà àti iye wọn kún un.",
    "Record sales and stock changes.": "Ṣàkọsílẹ̀ títà àti àyípadà ọjà.",
    "Add expenses and review reports.":
      "Fi ìnáwó kún un kí o sì ṣàyẹ̀wò ìròyìn.",
    "Keep your business records up to date.": "Mú àkọsílẹ̀ iṣẹ́ rẹ dojútì.",
    "Publish your selected design.": "Ṣe àtẹ̀jáde àpẹẹrẹ tí o yàn.",
    "Review your reports and website metrics.":
      "Ṣàyẹ̀wò ìròyìn àti ìwọ̀n ojúlé rẹ.",
    "Request a consultation.": "Béèrè ìjíròrò.",
    "Confirm your scope and usage allowances.":
      "Fìdí iye iṣẹ́ àti ààyè lílo múlẹ̀.",
    "Complete setup and test your business line.":
      "Parí ètò kí o sì dán laini iṣẹ́ rẹ wò.",
    "Choose from 200 website and landing-page designs.":
      "Yan lára àpẹẹrẹ ojúlé àti ojúewé ìpolówó 200.",
    "Add your logo, photos, services and genuine reviews.":
      "Fi àmì, fọ́tò, iṣẹ́ àti àyẹ̀wò gidi kún un.",
    "Preview your design on desktop and mobile before publishing.":
      "Ṣàwò àpẹẹrẹ rẹ lórí kọ̀ǹpútà àti fóònù kí o tó tẹ̀ jáde.",
    "Keep your design when you upgrade your plan.":
      "Pa àpẹẹrẹ rẹ mọ́ nígbà tí o bá gbé ètò rẹ ga.",
    "A free JKTL subdomain for one published website.":
      "Orúkọ abẹ́-ẹ̀ka JKTL ọ̀fẹ́ fún ojúlé kan tí a tẹ̀ jáde.",
    "Managed hosting and SSL for supported published sites.":
      "Gbígba ojúlé àti SSL fún àwọn ojúlé tí a ń ṣe àtìlẹ́yìn fún.",
    "Publish on your free JKTL address.": "Tẹ̀ jáde lórí àdírẹ́sì JKTL ọ̀fẹ́ rẹ.",
    "Keep hosting included when you upgrade.":
      "Gbígba ojúlé ṣì wà nínú ètò rẹ bí o bá gbé e ga.",
    "Request a separate quote only for standalone hosting needs.":
      "Béèrè ìdíyelé ọ̀tọ̀ fún gbígba ojúlé àdáṣe.",
    "Create your website.": "Ṣẹ̀dá ojúlé rẹ.",
    "Share your site without buying hosting twice.":
      "Pín ojúlé rẹ láì sanwó gbígba ojúlé lẹ́ẹ̀mejì.",
    "Browse templates without creating an account.":
      "Ṣàwárí àwọn àpẹẹrẹ láì ṣẹ̀dá àkọọ́lẹ̀.",
    "Keep your selected design through sign-in.":
      "Pa àpẹẹrẹ tí o yàn mọ́ nígbà wíwọlé.",
    "Review paid capabilities and totals before checkout.":
      "Ṣàyẹ̀wò ohun tí ètò ìsanwó ní àti àpapọ̀ owó kí o tó sanwó.",
    "Open Help in your Business dashboard for account-specific guides.":
      "Ṣí Ìrànlọ́wọ́ lórí pátákó ìṣàkóso fún ìtọ́sọ́nà àkọọ́lẹ̀ rẹ.",
    "Create a website that works for your business.": "Ohun èlò ṣíṣe ojúlé",
    "Build your website from a JKTL design or a blank canvas, then publish it on your own free JKTL address.":
      "Ohun èlò ṣíṣe ojúlé. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A place online with your name on it.": "Àdírẹ́sì ojúlé ọ̀fẹ́",
    "Start with a free businessname.jktl.com.ng address. You can connect a domain you own when you choose an eligible paid plan.":
      "Àdírẹ́sì ojúlé ọ̀fẹ́. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Keep your customer relationships together.": "Ìṣàkóso oníbàárà",
    "Organise customer details and history alongside the bookings, sales and invoices that matter to your business.":
      "Ìṣàkóso oníbàárà. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A clearer view of the day ahead.": "Ìforúkọsílẹ̀ àsìkò àti títà",
    "Manage appointments and record everyday sales without losing track of the customer behind each transaction.":
      "Ìforúkọsílẹ̀ àsìkò àti títà. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Send an invoice. Keep track of payment.": "Ìwé ìdíyelé àti ìsanwó",
    "Create invoices, record their status and connect supported Paystack payments through your business payment settings.":
      "Ìwé ìdíyelé àti ìsanwó. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Know what is in stock and what you spend.": "Ọjà inú ilé àti ìnáwó",
    "Keep product quantities and operating expenses alongside your everyday business activity.":
      "Ọjà inú ilé àti ìnáwó. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Understand the numbers behind your business.": "Ìròyìn àti ìtúpalẹ̀",
    "Use your actual records to review sales, customers and website interactions. Published template sites can report views, contact clicks and booking conversions.":
      "Ìròyìn àti ìtúpalẹ̀. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Give missed enquiries a way forward.": "Olùgbà ìpè AI",
    "Explore separately activated call handling and missed-call recovery. Setup, subscription and communication usage are scoped independently from website plans.":
      "Olùgbà ìpè AI. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A reliable home for your JKTL website.": "Gbígba ojúlé àti HTTPS",
    "Managed website hosting is already included with a JKTL website subscription, including the Free plan. Supported hosted sites use SSL.":
      "Gbígba ojúlé àti HTTPS. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Make every customer easier to remember.": "Ṣàkóso àwọn oníbàárà rẹ",
    "Bring contact details and business history together so your team can pick up where the last conversation ended.":
      "Ṣàkóso àwọn oníbàárà rẹ. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Keep appointments moving smoothly.": "Ṣètò àsìkò ìpàdé",
    "Organise services, team availability and customer bookings in one workspace.":
      "Ṣètò àsìkò ìpàdé. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Make payment part of a clearer workflow.": "Gba owó",
    "Connect invoices and supported online payments to the customer records you already use.":
      "Gba owó. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Keep your stock and spending in view.": "Tọpinpin ọjà àti ìnáwó",
    "Record what comes in, what goes out and the expenses that keep your business running.":
      "Tọpinpin ọjà àti ìnáwó. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A workspace your team can share.": "Bá ẹgbẹ́ rẹ ṣiṣẹ́",
    "Use owner, manager and staff roles. New website plans support finite collaborator allowances while existing contractual access remains unchanged.":
      "Bá ẹgbẹ́ rẹ ṣiṣẹ́. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Your business, wherever the day takes you.": "Ṣàkóso iṣẹ́ rẹ lórí fóònù",
    "Use JKTL Business on your phone and install it from a supported browser for easier access.":
      "Ṣàkóso iṣẹ́ rẹ lórí fóònù. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Turn your next idea into an online presence.": "Mú iṣẹ́ rẹ wá sí ayélujára",
    "Choose a design, create your account and publish your business website. Add a domain and email when you are ready.":
      "Mú iṣẹ́ rẹ wá sí ayélujára. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Give the next enquiry a clear next step.":
      "Dáhùn àwọn ìbéèrè tí ó ti kọjá",
    "Explore the optional AI receptionist and missed-call workflow, with an agreed scope and explicit communication usage limits.":
      "Dáhùn àwọn ìbéèrè tí ó ti kọjá. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Make the next decision with better information.": "Mọ iye owó iṣẹ́ rẹ",
    "Review recorded sales, customer activity and published website interactions without invented visitor or revenue figures.":
      "Mọ iye owó iṣẹ́ rẹ. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A smoother day for your salon or beauty business.": "Ilé ẹwà àti iṣẹ́ ẹwà",
    "Use customer records, service catalogues, bookings and a website design suited to salons, wellness studios and med spas.":
      "Ilé ẹwà àti iṣẹ́ ẹwà. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Give your products a clearer place online.": "Títà àti òwò",
    "Keep products, stock, sales and invoices together, with a website that introduces your business to new customers.":
      "Títà àti òwò. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "Make it easier to discover your business.": "Oúnjẹ àti ìtẹ́wọ́gbà",
    "Build an online home for a restaurant, hotel or hospitality business while keeping everyday sales, stock and enquiries in view.":
      "Oúnjẹ àti ìtẹ́wọ́gbà. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "A little guidance for your next step.": "Ìrànlọ́wọ́ àti ìtọ́sọ́nà",
    "Find a practical starting point for your website, account, business tools and billing.":
      "Ìrànlọ́wọ́ àti ìtọ́sọ́nà. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    "From your first design to your first published page.":
      "Àwọn ìgbésẹ̀ àkọ́kọ́ rẹ pẹ̀lú JKTL",
    "Start with a template or blank canvas, add your business details and publish on a free JKTL address.":
      "Àwọn ìgbésẹ̀ àkọ́kọ́ rẹ pẹ̀lú JKTL. Ṣàwárí bí àwọn ohun èlò JKTL ṣe lè ran iṣẹ́ rẹ lọ́wọ́; bẹ̀rẹ̀ lọ́fẹ̀ẹ́ kí o sì yan iṣẹ́ tí o nílò.",
    Email: "Ímeèlì",
    "Sign out": "Jáde",
    "Already have an account?": "Ṣé o ní àkọọ́lẹ̀ tẹ́lẹ̀?",
    "Sign in to run your business today.": "Wọlé láti ṣàkóso iṣẹ́ rẹ lónìí.",
    "Your selected template is ready. Sign in to open it in the website editor.":
      "Àpẹẹrẹ tí o yàn ti ṣetán. Wọlé láti ṣí i nínú olùṣàtúnṣe ojúlé.",
    "Your selected template is ready. It will open after account setup.":
      "Àpẹẹrẹ rẹ ti ṣetán. Yóò ṣí lẹ́yìn ètò àkọọ́lẹ̀.",
    "A place for your next big idea": "Ibi fún èrò ńlá rẹ tí ó kàn",
    "Your business.": "Iṣẹ́ rẹ.",
    "Your vision.": "Ìran rẹ.",
    "Your next chapter.": "Ìpele rẹ tí ó kàn.",
    "Your next chapter starts here.": "Ìpele rẹ tí ó kàn bẹ̀rẹ̀ níbí.",
    "Let’s get you started": "Ẹ jẹ́ ká bẹ̀rẹ̀",
    "No credit card required": "A kò nílò káàdì ìsanwó",
    "Selected template:": "Àpẹẹrẹ tí a yàn:",
    "Catalogue & stock": "Àtòjọ ọjà àti iye ọjà",
    Money: "Owó",
    "Grow your business": "Mú iṣẹ́ rẹ dàgbà",
    Analytics: "Ìtúpalẹ̀",
    "Import data": "Gbé àlàyé wọlé",
    Pending: "Ń dúró",
    Confirmed: "A ti fìdí rẹ̀ múlẹ̀",
    Completed: "A ti parí",
    Cancelled: "A ti fagilé",
    Paid: "A ti sanwó",
    Draft: "Àkọ́kọ́ ìwé",
    Overdue: "Ó ti kọjá àkókò",
    Low: "Kéré",
    "Low stock": "Ọjà ń tán",
    Adjust: "Ṣe àtúnṣe",
    "in stock": "wà nínú ọjà",
    "Nothing booked beyond today yet.": "Kò sí ìforúkọsílẹ̀ lẹ́yìn òní síbẹ̀.",
    "Recent activity": "Ìṣe tuntun",
    "Popular services": "Àwọn iṣẹ́ tí a fẹ́ràn",
    "Website metrics": "Ìwọ̀n ojúlé",
    "Websites & landing pages": "Àwọn ojúlé àti ojúewé ìpolówó",
    "View website metrics": "Wo ìwọ̀n ojúlé",
    "Edit selected template": "Ṣàtúnṣe àpẹẹrẹ tí o yàn",
    "Website address, business logo & custom domain":
      "Àdírẹ́sì ojúlé, àmì iṣẹ́ àti orúkọ ẹ̀ka tirẹ",
    "Your selected design stays with you:": "Àpẹẹrẹ tí o yàn ṣì wà pẹ̀lú rẹ:",
    "Upgrading changes your plan, not your website.":
      "Gbígbé ètò ga yí ètò rẹ padà, kì í yí ojúlé rẹ padà.",
    Free: "Ọ̀fẹ́",
    RECOMMENDED: "A DÁBÀÁ RẸ̀",
    "NO CREDIT CARD REQUIRED": "A KÒ NÍLÒ KÁÀDÌ ÌSANWÓ",
    Select: "Yàn",
    "billed yearly": "a ń san lọ́dọọdún",
    "billed monthly": "a ń san lóṣooṣù",
    "Monthly billing available": "Ìsanwó oṣooṣù wà",
    "Free to start — no subscription charge": "Bẹrẹ lọ́fẹ̀ẹ́ — kò sí owó ètò",
    "Start with your free website": "Bẹrẹ pẹ̀lú ojúlé ọ̀fẹ́ rẹ",
    "Free JKTL subdomain": "Orúkọ abẹ́-ẹ̀ka JKTL ọ̀fẹ́",
    "Managed hosting & SSL": "Gbígba ojúlé àti SSL",
    "200 designs + blank canvases": "Àpẹẹrẹ 200 àti ojúewé òfo",
    "A website that feels like you": "Ojúlé tó dà bí tìrẹ",
    "Your digital essentials": "Àwọn ohun pàtàkì rẹ lórí ayélujára",
    "Tools for the everyday": "Àwọn ohun èlò ojoojúmọ́",
    "Everything in Free": "Gbogbo ohun inú Ọ̀fẹ́",
    "Everything in Starter": "Gbogbo ohun inú Starter",
    "Everything in Growth": "Gbogbo ohun inú Growth",
    "Everything in Business": "Gbogbo ohun inú Business",
    "Custom domain connection": "Sísopọ̀ orúkọ ẹ̀ka tirẹ",
    "Remove JKTL branding": "Yọ àmì JKTL kúrò",
    "Basic SEO settings": "Ètò SEO ìpìlẹ̀",
    "Two collaborators": "Olùbáṣiṣẹ́ méjì",
    "Five collaborators": "Olùbáṣiṣẹ́ márùn-ún",
    "Ten collaborators": "Olùbáṣiṣẹ́ mẹ́wàá",
    "25 collaborators": "Olùbáṣiṣẹ́ 25",
    "Standard support": "Ìrànlọ́wọ́ déédéé",
    "1 GB image storage": "Ibi ìpamọ́ fọ́tò 1 GB",
    "5 GB image storage": "Ibi ìpamọ́ fọ́tò 5 GB",
    "15 GB image storage": "Ibi ìpamọ́ fọ́tò 15 GB",
    "30 GB image storage": "Ibi ìpamọ́ fọ́tò 30 GB",
    "Basic website analytics": "Ìtúpalẹ̀ ojúlé ìpìlẹ̀",
    "Inventory and expense tracking": "Títọpinpin ọjà àti ìnáwó",
    "Appointment scheduling": "Ṣíṣètò àsìkò ìpàdé",
    "Products and services catalogue": "Àtòjọ ọjà àti iṣẹ́",
    "Paystack payment integration": "Sísopọ̀ ìsanwó Paystack",
    "Basic website editor": "Olùṣàtúnṣe ojúlé ìpìlẹ̀",
    "JKTL branding": "Àmì JKTL",
    "Responsive website editor": "Olùṣàtúnṣe ojúlé tó bá ìwọ̀n ojú-ìwò mu",
    "Customer records and invoicing": "Àkọsílẹ̀ oníbàárà àti ìwé ìdíyelé",
    "One published website or landing page":
      "Ojúlé tàbí ojúewé ìpolówó kan tí a tẹ̀ jáde",
    "Choose an available JKTL address in Website settings.":
      "Yan àdírẹ́sì JKTL tó wà nínú ètò ojúlé.",
    "Save your design and business details.":
      "Fi àpẹẹrẹ àti àlàyé iṣẹ́ rẹ pamọ́.",
    "Publish your site and share your address.":
      "Ṣe àtẹ̀jáde ojúlé rẹ kí o sì pín àdírẹ́sì rẹ.",
    "Discuss your services, opening hours and call requirements.":
      "Jíròrò iṣẹ́, àsìkò ṣíṣí àti ohun tí ìpè rẹ nílò.",
    "Agree setup, recurring costs and usage limits before activation.":
      "Fọwọ́ sí ètò, ìsanwó déédéé àti ààlà lílo kí a tó tan iṣẹ́ sí i.",
    "Use the existing receptionist console to manage an active contract.":
      "Lo pátákó olùgbà ìpè láti ṣàkóso àdéhùn tí ó ń ṣiṣẹ́.",
    "Manage team access from your owner account.":
      "Ṣàkóso àṣẹ ẹgbẹ́ láti inú àkọọ́lẹ̀ olówó iṣẹ́.",
    "Choose a plan with the collaborator allowance you need.":
      "Yan ètò pẹ̀lú iye olùbáṣiṣẹ́ tí o nílò.",
    "Keep your website design when your team grows.":
      "Pa àpẹẹrẹ ojúlé rẹ mọ́ bí ẹgbẹ́ rẹ ṣe ń dàgbà.",
    "Open team settings as the owner.": "Ṣí ètò ẹgbẹ́ gẹ́gẹ́ bí olówó iṣẹ́.",
    "Review your current collaborator allowance.":
      "Ṣàyẹ̀wò iye olùbáṣiṣẹ́ tí ètò rẹ gbà.",
    "Add the team members you need.": "Fi àwọn ọmọ ẹgbẹ́ tí o nílò kún un.",
    "Use a responsive business dashboard.":
      "Lo pátákó ìṣàkóso tó bá ìwọ̀n ojú-ìwò mu.",
    "Access your records on supported mobile browsers.":
      "Wo àkọsílẹ̀ rẹ lórí àwọn aṣàwákiri fóònù tí a ń ṣe àtìlẹ́yìn fún.",
    "Check sync status when your connection returns.":
      "Ṣàyẹ̀wò ìṣọ̀kan àlàyé nígbà tí ìsopọ̀ rẹ bá padà.",
    "Open JKTL Business in your mobile browser.":
      "Ṣí JKTL Business nínú aṣàwákiri fóònù rẹ.",
    "Sign in to your business account.": "Wọlé sínú àkọọ́lẹ̀ iṣẹ́ rẹ.",
    "Use your browser installation option where supported.":
      "Lo àṣàyàn fífi sí ẹrọ nínú aṣàwákiri tí ó bá wà.",
    "Publish a business website with your services, photos and contact details.":
      "Ohun èlò ṣíṣe ojúlé. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Make it yours with brand colours and curated font pairings.":
      "Àwọn àpẹẹrẹ ojúlé. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Get online with your own JKTL subdomain.":
      "Àdírẹ́sì ojúlé ọ̀fẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Create a focused campaign page and measure published results.":
      "Ohun èlò ṣíṣe ojúewé ìpolówó. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Keep customer records, history and preferences together.":
      "Ìṣàkóso oníbàárà. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Manage appointments and record everyday sales.":
      "Ìforúkọsílẹ̀ àsìkò àti títà. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Send invoices and collect payments through Paystack.":
      "Ìwé ìdíyelé àti ìsanwó. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Track your stock and the money your business spends.":
      "Ọjà inú ilé àti ìnáwó. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Understand revenue, customer trends and performance.":
      "Ìròyìn àti ìtúpalẹ̀. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Explore call handling and missed-call recovery for your business.":
      "Olùgbà ìpè AI. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Connect a domain you own, or ask us about manual registration.":
      "Orúkọ ẹ̀ka tirẹ. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Managed hosting for your published JKTL business website.":
      "Gbígba ojúlé àti HTTPS. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Ask the team about manual Zoho Mail setup for your domain.":
      "Ímeèlì iṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Start with the business tools. AI and optional services are priced separately.":
      "Bẹrẹ lọ́fẹ̀ẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Give every customer a more personal experience.":
      "Ṣàkóso àwọn oníbàárà rẹ. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Organise bookings, services and customer visits.":
      "Ṣètò àsìkò ìpàdé. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Invoice customers and track their payments.":
      "Gba owó. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Keep an eye on your products and operating costs.":
      "Tọpinpin ọjà àti ìnáwó. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Manage access with owner, manager and staff roles.":
      "Bá ẹgbẹ́ rẹ ṣiṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Install JKTL from your browser and work on the go.":
      "Ṣàkóso iṣẹ́ rẹ lórí fóònù. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Help customers discover your services and reach you.":
      "Mú iṣẹ́ rẹ wá sí ayélujára. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Explore the paid AI receptionist and follow-up workflow.":
      "Dáhùn àwọn ìbéèrè tí ó ti kọjá. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Use reports to understand how your business is doing.":
      "Mọ iye owó iṣẹ́ rẹ. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Customer records and bookings for personal care businesses.":
      "Ilé ẹwà àti iṣẹ́ ẹwà. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Stock, sales and invoices for product businesses.":
      "Títà àti òwò. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Keep track of sales, stock and customer enquiries.":
      "Oúnjẹ àti ìtẹ́wọ́gbà. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Find the tools that fit your type of business.":
      "Ṣàwárí gbogbo ẹ̀ka iṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "See how the existing JKTL tools work together.":
      "Àwọn ohun èlò ìṣàkóso iṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "A practical introduction to your business tools.":
      "Bí JKTL ṣe ń ṣiṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Meet the company behind your business platform.":
      "Nípa JKTL. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Learn about referring businesses to JKTL.":
      "Ètò alábàáṣiṣẹ́. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Find product guides in your JKTL account.":
      "Ìrànlọ́wọ́ àti ìtọ́sọ́nà. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Ask a question or discuss setup and custom work.":
      "Kàn sí ẹgbẹ́ wa. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Compare free and paid website plans with monthly or yearly billing.":
      "Àwọn ètò àti ìdíyelé. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Create an account, add your business and get familiar with the tools.":
      "Àwọn ìgbésẹ̀ àkọ́kọ́ rẹ pẹ̀lú JKTL. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Talk to the JKTL team about the right next step.":
      "Ṣé o nílò ìrànlọ́wọ́?. Ṣàwárí ohun tí JKTL ń pèsè fún iṣẹ́ rẹ.",
    "Core business tools and all website designs remain available. Domains, business email, AI products and custom services are scoped separately. Review current capabilities and the full payable total before any paid checkout.":
      "Àwọn ohun èlò iṣẹ́ ìpìlẹ̀ àti gbogbo àpẹẹrẹ ojúlé ṣì wà. Orúkọ ẹ̀ka, ímeèlì, AI àti iṣẹ́ àkànṣe ní ètò ọ̀tọ̀. Ṣàyẹ̀wò ohun tí ó wà àti iye owó kíkún kí o tó sanwó.",
    "No. These are name suggestions and extension choices. The JKTL team confirms live registrar availability before quoting or taking payment.":
      "Rárá. Àwọn wọ̀nyí jẹ́ ìmọ̀ràn orúkọ àti àṣàyàn àfikún. Ẹgbẹ́ JKTL ń fìdí wíwà rẹ̀ múlẹ̀ kí a tó fún ọ ní ìdíyelé tàbí gba owó.",
    "JKTL manages your request and fulfils domain registration through Go54 after confirming the quote, payment and any registry requirements.":
      "JKTL ń bójú tó ìbéèrè rẹ, ó sì ń forúkọsílẹ̀ nípasẹ̀ Go54 lẹ́yìn ìfọwọ́sí ìdíyelé, ìsanwó àti àwọn ohun tí a nílò.",
    "A free JKTL subdomain is included. Registration of a separate domain and its annual renewal are quoted independently.":
      "Orúkọ abẹ́-ẹ̀ka JKTL ọ̀fẹ́ wà nínú ètò. Ìforúkọsílẹ̀ orúkọ ẹ̀ka ọ̀tọ̀ àti ìtunṣe ọdún ní ìdíyelé ọ̀tọ̀.",
    "The JKTL team will confirm registrar availability, eligibility, registration price and renewal price before requesting payment. Your domain has not yet been registered or reserved.":
      "Ẹgbẹ́ JKTL yóò fìdí wíwà, yíyẹ, ìdíyelé ìforúkọsílẹ̀ àti ìtunṣe múlẹ̀ kí a tó béèrè owó. A kò tíì forúkọsílẹ̀ tàbí fi orúkọ ẹ̀ka rẹ pamọ́.",
    "Hosting is already included with your JKTL website. Domain registration and professional email are separate services — you do not need to buy website hosting twice.":
      "Gbígba ojúlé ti wà nínú ojúlé JKTL rẹ. Ìforúkọsílẹ̀ orúkọ ẹ̀ka àti ímeèlì iṣẹ́ jẹ́ iṣẹ́ ọ̀tọ̀ — o kò nílò láti sanwó gbígba ojúlé lẹ́ẹ̀mejì.",
    "Country-code and restricted domains may need local presence or supporting documents. Registry support, premium names, transfer eligibility and final registration terms are confirmed by the team.":
      "Orúkọ ẹ̀ka orílẹ̀-èdè àti àwọn tó ní òfin pàtàkì lè nílò ìbùgbé níbẹ̀ tàbí ìwé ẹ̀rí. Ẹgbẹ́ wa yóò fìdí àtìlẹ́yìn, orúkọ pàtàkì, yíyẹ fún gbígbé àti òfin ìforúkọsílẹ̀ múlẹ̀.",
    "One-year request. The quote confirms the permitted term, any transfer requirements, taxes and renewal dates. No payment or automatic registration starts from this form.":
      "Ìbéèrè ọdún kan. Ìwé ìdíyelé yóò sọ àkókò tó yẹ, ohun tí gbígbé nílò, owó orí àti ọjọ́ ìtunṣe. Fọ́ọ̀mù yìí kì í bẹ̀rẹ̀ ìsanwó tàbí ìforúkọsílẹ̀ aládàáṣiṣẹ́.",
    "JKTL checks availability and confirms registration and renewal totals through Go54.":
      "JKTL ń ṣàyẹ̀wò wíwà, ó sì ń fìdí àpapọ̀ owó ìforúkọsílẹ̀ àti ìtunṣe múlẹ̀ nípasẹ̀ Go54.",
    "After payment and any required checks, the team completes registration and helps you connect your website.":
      "Lẹ́yìn ìsanwó àti àyẹ̀wò tó yẹ, ẹgbẹ́ wa yóò parí ìforúkọsílẹ̀ kí ó sì ràn ọ́ lọ́wọ́ láti so ojúlé rẹ pọ̀.",
    "You can request a transfer assessment. The team confirms registry rules, transfer eligibility, authorisation requirements and any applicable cost.":
      "O lè béèrè àyẹ̀wò gbígbé. Ẹgbẹ́ wa yóò fìdí òfin, yíyẹ, àṣẹ tí a nílò àti iye owó tó yẹ múlẹ̀.",
    "Explore the templates without signing up. Try desktop and mobile preview, or choose a blank canvas.":
      "Ṣàwárí àwọn àpẹẹrẹ láì forúkọsílẹ̀. Dán àwòkọ́ṣe kọ̀ǹpútà àti fóònù wò, tàbí yan ojúewé òfo.",
    "Create your free account. Your selected template follows you — add your logo, photos, services and contact details.":
      "Ṣẹ̀dá àkọọ́lẹ̀ ọ̀fẹ́ rẹ. Àpẹẹrẹ tí o yàn yóò tẹ̀lé ọ — fi àmì, fọ́tò, iṣẹ́ àti àlàyé ìbánisọ̀rọ̀ kún un.",
    "Save your design and turn on publishing. Your website is available on your free JKTL address, with hosting and SSL included.":
      "Fi àpẹẹrẹ rẹ pamọ́ kí o sì tan àtẹ̀jáde sí i. Ojúlé rẹ yóò wà lórí àdírẹ́sì JKTL ọ̀fẹ́, pẹ̀lú gbígba ojúlé àti SSL.",
    "Choose a paid plan for your team, connect a domain you own, and request business email separately.":
      "Yan ètò ìsanwó fún ẹgbẹ́ rẹ, so orúkọ ẹ̀ka tirẹ pọ̀, kí o sì béèrè ímeèlì iṣẹ́ lọ́tọ̀.",
    "Pick a 2026 website or landing-page template":
      "Yan àpẹẹrẹ ojúlé tàbí ojúewé ìpolówó 2026",
    "that feels like your business.": "tó bá iṣẹ́ rẹ mu.",
    "200 industry designs, plus blank starting points. Preview a design, then make it yours in JKTL Business.":
      "Àpẹẹrẹ ẹ̀ka iṣẹ́ 200 àti ojúewé òfo. Wo àpẹẹrẹ, kí o sì ṣe é ní tìrẹ nínú JKTL Business.",
    "Website plans — keep this design →": "Àwọn ètò ojúlé — pa àpẹẹrẹ yìí mọ́ →",
    "← Website settings": "← Ètò ojúlé",
    "Choose another template": "Yan àpẹẹrẹ mìíràn",
    "Identity & hero": "Ìdánimọ̀ àti àkọ́kọ́ ojúlé",
    "Website name": "Orúkọ ojúlé",
    "Introductory line": "Gbólóhùn ìṣáájú",
    "Main headline": "Àkọlé pàtàkì",
    Introduction: "Ìfihàn",
    "Main button label": "Ọ̀rọ̀ bọ́tìnì pàtàkì",
    "Hero image HTTPS URL": "Àdírẹ́sì HTTPS fọ́tò àkọ́kọ́",
    "Use bundled template artwork": "Lo àwòrán tó wà pẹ̀lú àpẹẹrẹ",
    "Live preview": "Àwòkọ́ṣe lẹ́sẹ̀kẹsẹ̀",
    About: "Nípa wa",
    Gallery: "Àwọn fọ́tò",
    "Service areas": "Agbègbè iṣẹ́",
    "Social icons": "Àwọn àmì ìbánisọ̀rọ̀",
    Reviews: "Àwọn àyẹ̀wò",
    "Logo, service areas & SEO": "Àmì, agbègbè iṣẹ́ àti SEO",
    "Publish website": "Ṣe àtẹ̀jáde ojúlé",
    "Save demo website": "Fi ojúlé àdánwò pamọ́",
    "Save website": "Fi ojúlé pamọ́",
    "· Website editor": "· Olùṣàtúnṣe ojúlé",
  },
};
export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    (supportedLanguages as readonly string[]).includes(value)
  );
}
export function translate(language: Language, message: string): string {
  if (language === "en") return message;
  const key = message.replace(/\s+/g, " ").trim();
  const dictionary = translations[language];
  const match =
    dictionary[key] ||
    Object.entries(dictionary).find(
      ([source]) => source.toLowerCase() === key.toLowerCase(),
    )?.[1];
  if (match) return match;
  const suffix = key.match(/^(.*?)([ ]*[→↗↓])$/);
  if (suffix) {
    const translated = translate(language, suffix[1]);
    if (translated !== suffix[1]) return translated + suffix[2];
  }
  return message;
}
