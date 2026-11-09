// This catalogue and renderer are mirrored in JKTL Main and JKTL Business.
// All names and content are original demonstration material, not live client sites.
export type TemplateLayout =
  | "editorial"
  | "community"
  | "campus"
  | "stage"
  | "wellness"
  | "portrait"
  | "industrial"
  | "hospitality"
  | "catalogue"
  | "minimal"
  | "studio";
export type BeautyContent = {
  design?: "atelier" | "luxe" | "barber" | "spa" | "bridal" | "nail";
  version: 2;
  demoContent: boolean;
  aboutImage: string;
  philosophy: string[];
  stylists: { name: string; role: string; bio: string; image: string }[];
  hours: { day: string; hours: string }[];
  contact: {
    phone: string;
    email: string;
    address: string;
    whatsapp: string;
    mapUrl: string;
  };
  pages: { path: string; title: string; description: string }[];
};
export type WebsiteOffering = {
  title: string;
  description: string;
  slug?: string;
  category?: string;
  duration?: string;
  price?: string;
  image?: string;
  benefits?: string[];
  preparation?: string;
};
export type WebsiteDocument = {
  design?: "legal" | "dressmaker" | "jewellery";
  legalVariant?: "family";
  aboutImage?: string;
  demoContent?: boolean;
  beauty?: BeautyContent;
  version: 1;
  blank?: boolean;
  logoUrl?: string;
  serviceAreas?: string[];
  socials?: { platform: string; url: string }[];
  reviews?: { name: string; quote: string; rating: number }[];
  seoTitle?: string;
  seoDescription?: string;
  brandName: string;
  eyebrow: string;
  headline: string;
  intro: string;
  ctaLabel: string;
  accent: string;
  paper: string;
  ink: string;
  heroImage: string;
  aboutTitle: string;
  aboutText: string;
  offeringsTitle: string;
  offerings: WebsiteOffering[];
  galleryTitle: string;
  gallery: { src: string; alt: string; category?: string }[];
  featureTitle: string;
  featureText: string;
  featureItems: string[];
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  contactTitle: string;
  contactText: string;
};
export type WebsiteTemplate = {
  kind?: "website" | "landing" | "blank";
  sourceId?: string;
  edition?: string;
  id: string;
  name: string;
  category: string;
  layout: TemplateLayout;
  sectionOrder: string[];
  document: WebsiteDocument;
};
const seeds = [
  {
    id: "law-firm",
    name: "Law Firm",
    category: "Legal & Professional",
    brand: "Aster Legal",
    layout: "editorial",
    accent: "#8d6339",
    paper: "#f5f1e9",
    ink: "#222722",
    photo: 5668473,
    eyebrow: "Counsel with perspective.",
    headline: "Clear thinking for the decisions that matter.",
    intro: "Practical legal support, built around your next chapter.",
    aboutTitle: "A considered approach to legal work.",
    aboutText:
      "We listen carefully, explain your options clearly and help you decide what comes next. Our practice brings a thoughtful, personal approach to business and private matters.",
    offers: [
      {
        title: "Business & commercial",
        description:
          "Contracts and practical guidance for the way your business works.",
      },
      {
        title: "Property matters",
        description: "Support for transactions, leases and property decisions.",
      },
      {
        title: "Private client",
        description:
          "Thoughtful advice for the personal matters that deserve care.",
      },
    ],
    steps: [
      "Understand your priorities",
      "Explore the available options",
      "Agree a clear next step",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "church",
    name: "Church & Ministry",
    category: "Faith & Community",
    brand: "The Gathering",
    layout: "community",
    accent: "#9a653c",
    paper: "#fbf7ef",
    ink: "#28332e",
    photo: 208315,
    eyebrow: "There is a place for you.",
    headline: "Faith. Community. A new beginning.",
    intro: "A welcoming place to worship, grow and share life together.",
    aboutTitle: "A community that walks together.",
    aboutText:
      "Whether you are exploring faith or looking for a church to call home, you are welcome here. Discover the gatherings and community life that bring us together.",
    offers: [
      {
        title: "Worship gatherings",
        description: "A place to pause, reflect and worship together.",
      },
      {
        title: "Community groups",
        description: "Build friendships and explore faith in smaller groups.",
      },
      {
        title: "Serve together",
        description: "Find meaningful ways to support people in our community.",
      },
    ],
    steps: [
      "Plan your first visit",
      "Connect with a group",
      "Find a place to serve",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "school",
    name: "School & Academy",
    category: "Education",
    brand: "Oakfield Academy",
    layout: "campus",
    accent: "#1c5547",
    paper: "#faf8f0",
    ink: "#152d27",
    photo: 207692,
    eyebrow: "Curiosity starts here.",
    headline: "A brighter path to learning.",
    intro:
      "A school community where questions are welcome and every next step matters.",
    aboutTitle: "Learning with purpose.",
    aboutText:
      "We bring thoughtful teaching, creative experiences and a caring community together. Explore our approach to learning and find the information your family needs to get started.",
    offers: [
      {
        title: "Early years",
        description: "A warm introduction to discovery, play and learning.",
      },
      {
        title: "Primary learning",
        description:
          "Build foundations through a balanced, engaging programme.",
      },
      {
        title: "Beyond the classroom",
        description: "Space for interests, creativity and wider experiences.",
      },
    ],
    steps: [
      "Explore our approach",
      "Meet the school community",
      "Ask about admissions",
    ],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "music-label",
    name: "Music Label & Artist",
    category: "Music & Creative",
    brand: "Afterhours Records",
    layout: "stage",
    accent: "#cbff65",
    paper: "#12131a",
    ink: "#faf8f1",
    photo: 164938,
    eyebrow: "Independent sound. Unlimited possibility.",
    headline: "Made to be heard.",
    intro:
      "A home for original voices, new releases and the culture around them.",
    aboutTitle: "Sound with a point of view.",
    aboutText:
      "We work at the intersection of music, identity and creative collaboration. Get to know the projects and people shaping our sound.",
    offers: [
      {
        title: "Artist development",
        description:
          "Shape the sound, story and creative direction of a project.",
      },
      {
        title: "New releases",
        description:
          "Discover current projects and the ideas behind the music.",
      },
      {
        title: "Creative collaborations",
        description: "Connect music with the people and platforms it deserves.",
      },
    ],
    steps: [
      "Discover the sound",
      "Explore the creative work",
      "Start a conversation",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "med-spa",
    name: "Med Spa & Aesthetics",
    category: "Beauty & Wellness",
    brand: "Still Aesthetics",
    layout: "wellness",
    accent: "#80655c",
    paper: "#f5eee9",
    ink: "#39312f",
    photo: 3738349,
    eyebrow: "Carefully considered care.",
    headline: "Feel more like yourself.",
    intro: "A calm space to explore your skincare and aesthetic care options.",
    aboutTitle: "Care begins with a conversation.",
    aboutText:
      "Every person has different priorities. We take time to understand yours, explain the available services and help you make an informed decision.",
    offers: [
      {
        title: "Skin consultations",
        description: "Discuss your skin concerns, goals and available options.",
      },
      {
        title: "Facial treatments",
        description: "Explore care designed around your individual needs.",
      },
      {
        title: "Aftercare guidance",
        description:
          "Understand what comes next and how to care for your skin.",
      },
    ],
    steps: [
      "Share your goals",
      "Discuss suitable options",
      "Make an informed choice",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "hair-salon",
    name: "Hair Salon & Beauty",
    category: "Beauty & Wellness",
    brand: "Atelier Hair",
    layout: "portrait",
    accent: "#8c3e2b",
    paper: "#f8f2e9",
    ink: "#35251f",
    photo: 3993330,
    eyebrow: "Your next good hair day.",
    headline: "Beautiful hair. Your way.",
    intro:
      "Considered cuts, colour and styling, with room to make it personal.",
    aboutTitle: "A little time for you.",
    aboutText:
      "A salon visit should feel like a moment to yourself. Tell us what you have in mind and we will help you find a style that feels like you.",
    offers: [
      {
        title: "Cut & shape",
        description: "A fresh perspective on a cut that works for you.",
      },
      {
        title: "Colour & care",
        description: "Explore colour and a routine that supports your hair.",
      },
      {
        title: "Occasion styling",
        description: "Bring your look together for an important moment.",
      },
    ],
    steps: [
      "Find your inspiration",
      "Talk through your look",
      "Plan your salon visit",
    ],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "construction",
    name: "Construction & Engineering",
    category: "Property & Services",
    brand: "Foundry Build",
    layout: "industrial",
    accent: "#e77c32",
    paper: "#f3f1e9",
    ink: "#242b2d",
    photo: 1216589,
    eyebrow: "Built on clear thinking.",
    headline: "Bring the plan to life.",
    intro:
      "From early conversations to the details on site, keep your project moving.",
    aboutTitle: "A practical approach to building.",
    aboutText:
      "Good projects start with a clear brief. We bring planning, communication and attention to detail together to help clients take the next step.",
    offers: [
      {
        title: "Project planning",
        description:
          "Define the brief, priorities and requirements of your project.",
      },
      {
        title: "Build & renovation",
        description:
          "Coordinate practical work around an agreed project scope.",
      },
      {
        title: "Project support",
        description:
          "Keep track of decisions, progress and the details that matter.",
      },
    ],
    steps: [
      "Discuss your project",
      "Define the scope",
      "Plan the next milestone",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "real-estate",
    name: "Real Estate & Property",
    category: "Property & Services",
    brand: "Westhaven Living",
    layout: "editorial",
    accent: "#456a57",
    paper: "#f5f3eb",
    ink: "#26372c",
    photo: 106399,
    eyebrow: "Find a place that fits.",
    headline: "A new address. A new chapter.",
    intro:
      "Explore spaces, ask the right questions and take your next property step.",
    aboutTitle: "Property, with a personal perspective.",
    aboutText:
      "A place is more than a floor plan. We help you think through location, lifestyle and the details behind your next move.",
    offers: [
      {
        title: "Find a home",
        description:
          "Explore the spaces and locations that suit your priorities.",
      },
      {
        title: "Property viewings",
        description: "Arrange a closer look and discuss the details.",
      },
      {
        title: "Owners & landlords",
        description: "Talk through your property and the support you need.",
      },
    ],
    steps: [
      "Tell us what matters",
      "Explore your options",
      "Arrange a conversation",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "restaurant",
    name: "Restaurant & Café",
    category: "Food & Hospitality",
    brand: "Terra Table",
    layout: "hospitality",
    accent: "#a85032",
    paper: "#fcf5e9",
    ink: "#3a2c23",
    photo: 262978,
    eyebrow: "Good food. Better company.",
    headline: "Make time for the table.",
    intro:
      "A place for easy conversations, generous plates and the moments in between.",
    aboutTitle: "A neighbourhood table.",
    aboutText:
      "Our kitchen brings people together through thoughtful food and a warm welcome. Come for a quiet catch-up, a special occasion or simply something good to eat.",
    offers: [
      {
        title: "The kitchen",
        description: "Explore a menu built around the way we love to eat.",
      },
      {
        title: "Gatherings",
        description: "Make room for a shared meal and a special occasion.",
      },
      {
        title: "Private dining",
        description: "Talk to us about bringing your people together.",
      },
    ],
    steps: ["Explore the menu", "Plan your visit", "Ask about a gathering"],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "hotel",
    name: "Boutique Hotel",
    category: "Food & Hospitality",
    brand: "The Palm House",
    layout: "hospitality",
    accent: "#4e6b61",
    paper: "#f7f4e9",
    ink: "#293c35",
    photo: 258154,
    eyebrow: "Somewhere to slow down.",
    headline: "Stay a little longer.",
    intro: "Thoughtful spaces, an easy welcome and a place to make your own.",
    aboutTitle: "A more personal stay.",
    aboutText:
      "Discover a place to pause, settle in and enjoy the details. Explore our spaces and get in touch to plan the stay that suits you.",
    offers: [
      {
        title: "Rooms & suites",
        description: "Find a space for your kind of stay.",
      },
      {
        title: "Dining & downtime",
        description: "Make time for unhurried meals and relaxed moments.",
      },
      {
        title: "Gatherings & stays",
        description: "Ask about group visits and special occasions.",
      },
    ],
    steps: [
      "Explore our spaces",
      "Share your travel plans",
      "Enquire about your stay",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "fashion",
    name: "Fashion & Clothing",
    category: "Retail & Lifestyle",
    brand: "Forma Studio",
    layout: "catalogue",
    accent: "#3d4135",
    paper: "#f0f0e9",
    ink: "#242921",
    photo: 994517,
    eyebrow: "Considered pieces. Everyday expression.",
    headline: "Wear your own story.",
    intro:
      "Explore a wardrobe with room for personality, texture and a fresh point of view.",
    aboutTitle: "Style in the details.",
    aboutText:
      "From the shape of a piece to the way it fits into your day, we believe personal style is built through thoughtful choices. Explore the collection and ask us about a piece you love.",
    offers: [
      {
        title: "The collection",
        description: "Discover the pieces and ideas in our current edit.",
      },
      {
        title: "Personal styling",
        description: "Find a look that fits your day and your point of view.",
      },
      {
        title: "Custom enquiries",
        description: "Discuss a particular fit, piece or occasion.",
      },
    ],
    steps: ["Explore the edit", "Find your favourites", "Ask about a piece"],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "retail",
    name: "Retail & Online Store",
    category: "Retail & Lifestyle",
    brand: "Everyday Objects",
    layout: "catalogue",
    accent: "#ae5b34",
    paper: "#f9f4ec",
    ink: "#352d26",
    photo: 264636,
    eyebrow: "Objects for a life well lived.",
    headline: "The everyday, reimagined.",
    intro:
      "Discover useful, thoughtful things for the spaces and routines you love.",
    aboutTitle: "Good things, thoughtfully chosen.",
    aboutText:
      "We bring together pieces with a purpose and a point of view. Browse the edit, find something that feels right and get in touch for more information.",
    offers: [
      {
        title: "For the home",
        description: "Considered pieces for the spaces you spend time in.",
      },
      {
        title: "Everyday essentials",
        description: "Useful favourites that fit naturally into your day.",
      },
      {
        title: "Gifting & enquiries",
        description:
          "Find something thoughtful or ask about a particular item.",
      },
    ],
    steps: [
      "Browse the collection",
      "Choose something useful",
      "Ask us for details",
    ],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "auto-service",
    name: "Auto Repairs & Service",
    category: "Property & Services",
    brand: "Motorworks",
    layout: "industrial",
    accent: "#d84e2d",
    paper: "#f0f1ed",
    ink: "#252c30",
    photo: 3807277,
    eyebrow: "Keep moving with confidence.",
    headline: "Care for the road ahead.",
    intro:
      "Straightforward conversations about your vehicle and the work it needs.",
    aboutTitle: "A practical workshop partner.",
    aboutText:
      "Tell us what you have noticed and what you need from your vehicle. We will discuss the next steps and the work involved before you decide how to proceed.",
    offers: [
      {
        title: "Service enquiries",
        description: "Talk through routine care and your vehicle concerns.",
      },
      {
        title: "Inspection & diagnostics",
        description: "Arrange an assessment and understand the findings.",
      },
      {
        title: "Repair planning",
        description: "Discuss the proposed work and agree the next step.",
      },
    ],
    steps: ["Describe the concern", "Arrange an assessment", "Agree the work"],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "clinic",
    name: "Medical & Dental Clinic",
    category: "Health & Care",
    brand: "Cedar Health",
    layout: "minimal",
    accent: "#286c76",
    paper: "#f4f8f6",
    ink: "#193d43",
    photo: 4386466,
    eyebrow: "A more personal conversation about care.",
    headline: "Start with being heard.",
    intro:
      "A welcoming space to discuss your health questions and arrange a visit.",
    aboutTitle: "Care built around a conversation.",
    aboutText:
      "Clear information and a thoughtful approach can make a difference. Get to know our practice, explore the services and ask us about an appointment.",
    offers: [
      {
        title: "Consultations",
        description: "Arrange time to discuss your concerns with the practice.",
      },
      {
        title: "Practice services",
        description: "Learn about available services and suitability.",
      },
      {
        title: "Visit information",
        description: "Find the details you need before coming in.",
      },
    ],
    steps: [
      "Read the practice information",
      "Ask about a consultation",
      "Prepare for your visit",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "fitness",
    name: "Fitness & Wellness Studio",
    category: "Beauty & Wellness",
    brand: "Movement Club",
    layout: "portrait",
    accent: "#475d32",
    paper: "#f6f3e9",
    ink: "#263024",
    photo: 1954524,
    eyebrow: "Find your way to move.",
    headline: "A little stronger. A little more you.",
    intro: "Discover movement, a routine and a community that fit your life.",
    aboutTitle: "Progress at your own pace.",
    aboutText:
      "There is no single way to get started. Explore our approach, talk about what you enjoy and find a session that works for you.",
    offers: [
      {
        title: "Studio sessions",
        description: "Make time for guided movement and a regular routine.",
      },
      {
        title: "Personal sessions",
        description: "Discuss a more individual approach to your goals.",
      },
      {
        title: "Community & events",
        description: "Connect with people through shared movement.",
      },
    ],
    steps: [
      "Explore the studio",
      "Find a starting point",
      "Plan your first session",
    ],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "photography",
    name: "Photography & Film",
    category: "Music & Creative",
    brand: "Studio Frame",
    layout: "studio",
    accent: "#a56547",
    paper: "#f7f3ed",
    ink: "#322a25",
    photo: 3379934,
    eyebrow: "Stories worth keeping.",
    headline: "See it differently.",
    intro:
      "Photography and film for the people, places and ideas that deserve a closer look.",
    aboutTitle: "An eye for the in-between.",
    aboutText:
      "Every project begins with a story. We take time to understand what you want to capture and shape a thoughtful visual response.",
    offers: [
      {
        title: "Portraits & people",
        description: "A considered approach to capturing personality.",
      },
      {
        title: "Brand stories",
        description: "Create visual work around the ideas behind a brand.",
      },
      {
        title: "Film & projects",
        description:
          "Explore a story through movement and a wider perspective.",
      },
    ],
    steps: [
      "Explore the portfolio",
      "Share your project",
      "Plan the creative approach",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "events",
    name: "Events & Weddings",
    category: "Food & Hospitality",
    brand: "Gather & Grace",
    layout: "wellness",
    accent: "#a16566",
    paper: "#fbf1ec",
    ink: "#493236",
    photo: 169190,
    eyebrow: "Bring your people together.",
    headline: "A day to remember.",
    intro:
      "Thoughtful planning and creative details for the moments you want to share.",
    aboutTitle: "Considered from the first idea.",
    aboutText:
      "Every gathering has its own character. Tell us about yours and we will help you think through the shape, atmosphere and details of the occasion.",
    offers: [
      {
        title: "Weddings",
        description: "Shape a celebration that feels personal to you.",
      },
      {
        title: "Private events",
        description: "Bring people together around an important moment.",
      },
      {
        title: "Creative planning",
        description: "Explore the setting, details and flow of your event.",
      },
    ],
    steps: [
      "Share your ideas",
      "Explore the possibilities",
      "Start the planning conversation",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
  {
    id: "travel",
    name: "Travel & Tours",
    category: "Food & Hospitality",
    brand: "Elsewhere Travel",
    layout: "studio",
    accent: "#237e80",
    paper: "#f2f7f0",
    ink: "#204547",
    photo: 346885,
    eyebrow: "There is more to discover.",
    headline: "Go somewhere that stays with you.",
    intro:
      "Explore new places, consider your options and start planning your next journey.",
    aboutTitle: "A different point of view.",
    aboutText:
      "Travel begins with curiosity. We help you think through the places, pace and experiences that could make your next trip feel like yours.",
    offers: [
      {
        title: "Destinations",
        description: "Find inspiration for the places you want to explore.",
      },
      {
        title: "Travel planning",
        description: "Discuss the shape and practical details of your trip.",
      },
      {
        title: "Group journeys",
        description:
          "Ask about bringing people together for a shared experience.",
      },
    ],
    steps: [
      "Find your inspiration",
      "Share your travel plans",
      "Explore the next step",
    ],
    order: ["gallery", "about", "offerings", "feature", "faq"],
  },
  {
    id: "consultancy",
    name: "Consultancy & Business",
    category: "Legal & Professional",
    brand: "Northline Advisory",
    layout: "minimal",
    accent: "#31566d",
    paper: "#f3f6f6",
    ink: "#213947",
    photo: 3184465,
    eyebrow: "Perspective for what comes next.",
    headline: "Move forward with clarity.",
    intro:
      "Thoughtful conversations and practical direction for your next business decision.",
    aboutTitle: "An outside perspective. A practical approach.",
    aboutText:
      "We help teams step back, understand the challenge and decide where to focus. Tell us what is changing and what you want to work towards.",
    offers: [
      {
        title: "Business strategy",
        description: "Clarify priorities and explore possible directions.",
      },
      {
        title: "Team & operations",
        description: "Understand the way work happens and where to improve it.",
      },
      {
        title: "Project advisory",
        description: "Bring a focused perspective to a particular challenge.",
      },
    ],
    steps: [
      "Understand the challenge",
      "Explore the possibilities",
      "Agree a practical next step",
    ],
    order: ["offerings", "about", "gallery", "feature", "faq"],
  },
  {
    id: "nonprofit",
    name: "Nonprofit & Foundation",
    category: "Faith & Community",
    brand: "Common Ground",
    layout: "community",
    accent: "#c17432",
    paper: "#fbf5e9",
    ink: "#3b392b",
    photo: 6646918,
    eyebrow: "Good begins with people.",
    headline: "Together, there is possibility.",
    intro:
      "A community-led space for ideas, action and a shared sense of purpose.",
    aboutTitle: "People at the heart of the work.",
    aboutText:
      "We believe meaningful change starts with listening and working together. Learn about our focus, explore the work and find a way to get involved.",
    offers: [
      {
        title: "Our focus",
        description: "Discover the causes and conversations behind our work.",
      },
      {
        title: "Community projects",
        description: "Explore the activities that bring people together.",
      },
      {
        title: "Get involved",
        description:
          "Ask about volunteering, partnerships and ways to contribute.",
      },
    ],
    steps: [
      "Learn about the focus",
      "Explore the work",
      "Start a conversation",
    ],
    order: ["about", "offerings", "feature", "gallery", "faq"],
  },
];
const baseWebsiteTemplates: WebsiteTemplate[] = seeds.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  layout: s.layout as TemplateLayout,
  sectionOrder: s.order,
  document: {
    version: 1,
    brandName: s.brand,
    eyebrow: s.eyebrow,
    headline: s.headline,
    intro: s.intro,
    ctaLabel:
      s.id === "church"
        ? "Plan your visit"
        : s.id === "school"
          ? "Explore the academy"
          : s.id === "music-label"
            ? "Explore the sound"
            : "Explore what we do",
    accent: s.accent,
    paper: s.paper,
    ink: s.ink,
    heroImage: `/template-art/${s.id}.svg`,
    aboutTitle: s.aboutTitle,
    aboutText: s.aboutText,
    offeringsTitle:
      s.id === "school"
        ? "Room to learn and grow"
        : s.id === "music-label"
          ? "The work behind the sound"
          : "Explore what we do",
    offerings: s.offers,
    galleryTitle:
      s.id === "photography" ? "A closer look" : "A little inspiration",
    gallery: [0, 1, 2].map((_, i) => ({
      src: `/template-art/${s.id}.svg`,
      alt: `${s.name} — original sample artwork ${i + 1}`,
    })),
    featureTitle:
      s.id === "church"
        ? "Your first visit starts here."
        : s.id === "school"
          ? "Your next chapter starts here."
          : "A thoughtful next step.",
    featureText:
      "Good things begin with a conversation. Get to know our approach and find the next step that feels right for you.",
    featureItems: s.steps,
    faqTitle: "A few things to know",
    faqs: [
      {
        question:
          s.id === "school"
            ? "How can we find out about admissions?"
            : s.id === "church"
              ? "Can I visit for the first time?"
              : "How do I get started?",
        answer:
          "Use the contact details below to tell us what you have in mind. We will discuss the information you need and the available next steps.",
      },
      {
        question: "Can I ask a question before deciding?",
        answer:
          "Of course. Get in touch with your questions and let us know the best way to reach you.",
      },
    ],
    contactTitle:
      s.id === "music-label"
        ? "Let’s make something worth hearing."
        : s.id === "church"
          ? "Come as you are."
          : "Let’s talk about what comes next.",
    contactText:
      "Tell us a little about what you have in mind. We would love to hear from you.",
  },
}));
const editions: {
  id: string;
  name: string;
  layout?: TemplateLayout;
  kind: "website" | "landing";
  accent?: string;
  paper?: string;
  ink?: string;
}[] = [
  { id: "signature", name: "Signature", kind: "website" },
  {
    id: "editorial",
    name: "Editorial",
    layout: "editorial",
    kind: "website",
    accent: "#8a613d",
    paper: "#f9f3e8",
    ink: "#29291f",
  },
  {
    id: "afterdark",
    name: "After Dark",
    layout: "stage",
    kind: "website",
    accent: "#d9ff76",
    paper: "#12191c",
    ink: "#f7f3e9",
  },
  {
    id: "minimal",
    name: "Minimal",
    layout: "minimal",
    kind: "website",
    accent: "#256963",
    paper: "#f2f8f6",
    ink: "#173c36",
  },
  {
    id: "portfolio",
    name: "Portfolio",
    layout: "studio",
    kind: "website",
    accent: "#ae5738",
    paper: "#fbf3ec",
    ink: "#402b23",
  },
  {
    id: "community",
    name: "Community",
    layout: "community",
    kind: "website",
    accent: "#675388",
    paper: "#f8f3fc",
    ink: "#342443",
  },
  {
    id: "showcase",
    name: "Showcase",
    layout: "catalogue",
    kind: "website",
    accent: "#38618c",
    paper: "#f1f5fa",
    ink: "#1c3047",
  },
  {
    id: "campaign",
    name: "Campaign",
    layout: "portrait",
    kind: "landing",
    accent: "#a64731",
    paper: "#fff4e8",
    ink: "#40291e",
  },
  {
    id: "launch",
    name: "Launch",
    layout: "minimal",
    kind: "landing",
    accent: "#225b99",
    paper: "#f3f7ff",
    ink: "#182e4d",
  },
  {
    id: "bold",
    name: "Bold",
    layout: "stage",
    kind: "landing",
    accent: "#f2b85d",
    paper: "#191719",
    ink: "#fbf4e9",
  },
];
export const websiteTemplates: WebsiteTemplate[] = baseWebsiteTemplates.flatMap(
  (base) =>
    editions.map((edition, i) => {
      const doc = JSON.parse(JSON.stringify(base.document)) as WebsiteDocument;
      doc.logoUrl = "";
      doc.serviceAreas = [];
      doc.socials = [];
      doc.reviews = [];
      doc.seoTitle = `${doc.brandName} | ${base.name}`;
      doc.seoDescription = doc.intro;
      if (edition.accent) {
        doc.accent = edition.accent;
        doc.paper = edition.paper!;
        doc.ink = edition.ink!;
      }
      if (edition.kind === "landing") {
        doc.eyebrow = `${base.name} · Let’s get started`;
        doc.ctaLabel = "Get in touch";
        doc.intro = `${base.document.intro} Tell us what you need and take the next step.`;
      }
      return {
        ...base,
        id: i === 0 ? base.id : `${base.id}-${edition.id}`,
        name: i === 0 ? base.name : `${base.name} — ${edition.name}`,
        sourceId: base.id,
        edition: edition.name,
        kind: edition.kind,
        layout: edition.layout || base.layout,
        sectionOrder:
          edition.kind === "landing"
            ? ["offerings", "about", "feature", "reviews", "areas", "faq"]
            : [
                ...base.sectionOrder.slice(0, 3),
                "areas",
                "reviews",
                ...base.sectionOrder.slice(3),
              ],
        document: doc,
      };
    }),
);
// Versioned defaults only affect new drafts. Saved v1 salon documents retain
// their original renderer until an owner explicitly chooses the new design.
const salon = websiteTemplates.find((t) => t.id === "hair-salon")!;
Object.assign(salon.document, {
  eyebrow: "THE ART OF FEELING YOURSELF",
  headline: "Good hair.\nA little more you.",
  intro:
    "Considered cuts, expressive colour and care for every texture. A slower, more personal kind of salon experience.",
  ctaLabel: "Request an appointment",
  accent: "#875844",
  paper: "#f7f3ec",
  ink: "#302521",
  seoTitle: "Hair, with a personal touch | Atelier Hair",
  seoDescription:
    "Considered cuts, expressive colour and care for every texture. Discover the studio, explore our services and request your next salon visit.",
  heroImage: "/template-photos/beauty/hero.jpg",
  aboutTitle: "A space to feel\nlike yourself.",
  aboutText:
    "Hair is personal. So is our approach. We begin with a conversation about your routine, your texture and the way you want to feel. Then we take the time to create something that belongs to you.\n\nFrom an everyday shape to a once-in-a-lifetime look, our studio brings thoughtful craft and a warm welcome to every chair.",
  offeringsTitle: "Your hair, thoughtfully considered.",
  offerings: [
    {
      slug: "cut-and-finish",
      category: "Cut & style",
      title: "Signature cut & finish",
      description:
        "A personal consultation, a precision shape and a finish that feels effortless. Designed around your texture, your proportions and your everyday routine.",
      duration: "60–90 minutes",
      price: "From ₦25,000",
      image: "/template-photos/beauty/styling.jpg",
      benefits: [
        "A shape designed for your texture",
        "Styling guidance for your routine",
        "A finish you can make your own",
      ],
      preparation:
        "Bring a few reference photos and tell us about your current hair routine.",
    },
    {
      slug: "colour-and-gloss",
      category: "Colour",
      title: "Colour & gloss",
      description:
        "Soft dimension, a fresh tone or a more expressive change. We talk through the possibilities and choose an approach with the condition of your hair in mind.",
      duration: "2–3 hours",
      price: "From ₦45,000",
      image: "/template-photos/beauty/colour.jpg",
      benefits: [
        "A considered colour consultation",
        "A personalised tone and finish",
        "Advice for maintaining your colour",
      ],
      preparation:
        "A consultation and sensitivity test may be required before colour appointments.",
    },
    {
      slug: "texture-and-care",
      category: "Care",
      title: "Texture & restorative care",
      description:
        "A dedicated moment for your hair and scalp. A consultation-led treatment with gentle styling and practical guidance for looking after your natural texture.",
      duration: "60 minutes",
      price: "From ₦20,000",
      image: "/template-photos/beauty/hero.jpg",
      benefits: [
        "Time to understand your hair",
        "A care-led treatment approach",
        "A simple home-care conversation",
      ],
      preparation:
        "Let us know about sensitivities, recent treatments or concerns when requesting your visit.",
    },
    {
      slug: "occasion-styling",
      category: "Occasion",
      title: "Occasion & bridal styling",
      description:
        "A thoughtful finishing touch for your celebration. From softly sculpted looks to a more polished statement, we design a style to complement you and the occasion.",
      duration: "90–120 minutes",
      price: "By consultation",
      image: "/template-photos/beauty/styling.jpg",
      benefits: [
        "A look planned around your occasion",
        "Space for inspiration and consultation",
        "A considered finishing detail",
      ],
      preparation:
        "Share your event date and inspiration. Bridal trials are arranged separately.",
    },
  ],
  galleryTitle: "A few moments from the chair.",
  gallery: [
    {
      src: "/template-photos/beauty/hero.jpg",
      alt: "Editorial portrait showing natural hair texture",
      category: "Texture",
    },
    {
      src: "/template-photos/beauty/styling.jpg",
      alt: "A stylist carefully finishing a salon client's hair",
      category: "Styling",
    },
    {
      src: "/template-photos/beauty/interior.jpg",
      alt: "Light-filled salon with thoughtfully arranged styling stations",
      category: "Studio",
    },
    {
      src: "/template-photos/beauty/colour.jpg",
      alt: "A salon colour and styling detail",
      category: "Colour",
    },
  ],
  featureTitle: "Thoughtful hands.\nA warm welcome.",
  featureText:
    "A team who listens first, works with intention and makes room for your individuality.",
  contactTitle: "Your next good hair day starts here.",
  contactText:
    "Tell us what you have in mind. We will help you choose the right service and arrange a time to visit.",
  reviews: [
    {
      name: "Demo client",
      quote: "Time to talk, thoughtful advice and a style that feels like me.",
      rating: 5,
    },
  ],
  beauty: {
    version: 2,
    demoContent: true,
    aboutImage: "/template-photos/beauty/interior.jpg",
    philosophy: [
      "Listen before we begin.",
      "Work with your natural texture.",
      "Make everyday care feel achievable.",
    ],
    stylists: [
      {
        name: "Ada",
        role: "Creative stylist",
        bio: "A thoughtful eye for shape, texture and the small details that make a look your own.",
        image: "/template-photos/beauty/stylist.jpg",
      },
      {
        name: "Maya",
        role: "Colour specialist",
        bio: "An intuitive approach to tone, dimension and a colour story that feels personal.",
        image: "/template-photos/beauty/colour.jpg",
      },
    ],
    hours: [
      { day: "Tuesday–Friday", hours: "9:00 AM–6:00 PM" },
      { day: "Saturday", hours: "9:00 AM–5:00 PM" },
      { day: "Sunday–Monday", hours: "By appointment" },
    ],
    contact: { phone: "", email: "", address: "", whatsapp: "", mapUrl: "" },
    pages: [
      {
        path: "",
        title: "Hair, with a personal touch",
        description:
          "Considered cuts, expressive colour and care for every texture. Discover the studio, explore our services and request your next salon visit.",
      },
      {
        path: "about",
        title: "Our story & stylists",
        description:
          "Get to know our salon philosophy, our creative stylists and the thoughtful details that make every visit a little more personal.",
      },
      {
        path: "services",
        title: "Services & treatments",
        description:
          "Explore precision cuts, colour and gloss, restorative hair care and occasion styling. Find the right service and request your appointment.",
      },
      {
        path: "gallery",
        title: "The salon gallery",
        description:
          "Discover our approach to texture, colour and styling through editorial imagery and a closer look at the salon experience.",
      },
      {
        path: "book",
        title: "Request an appointment",
        description:
          "Tell us about your hair and your preferred visit. Send an appointment request and our salon team will get in touch to confirm availability.",
      },
      {
        path: "contact",
        title: "Contact & opening hours",
        description:
          "Find our salon contact details, opening hours and location. Ask a question, explore our social channels or arrange your next visit.",
      },
    ],
  },
});

for (const [id, name, layout] of [
  ["blank-website", "Blank Website", "minimal"],
  ["blank-landing", "Blank Landing Page", "portrait"],
] as const) {
  const doc = JSON.parse(
    JSON.stringify(baseWebsiteTemplates[0].document),
  ) as WebsiteDocument;
  Object.assign(doc, {
    blank: true,
    brandName: "Your business",
    eyebrow: "",
    headline: "",
    intro: "",
    ctaLabel: "Get in touch",
    aboutTitle: "About",
    aboutText: "",
    offeringsTitle: "Services",
    offerings: [],
    galleryTitle: "Gallery",
    gallery: [],
    featureTitle: "Our approach",
    featureText: "",
    featureItems: [],
    faqTitle: "Questions",
    faqs: [],
    contactTitle: "Get in touch",
    contactText: "",
    heroImage: `/template-art/${id}.svg`,
    accent: "#245e50",
    paper: "#ffffff",
    ink: "#142c25",
    logoUrl: "",
    serviceAreas: [],
    socials: [],
    reviews: [],
    seoTitle: "",
    seoDescription: "",
  });
  websiteTemplates.push({
    id,
    name,
    category: "Blank starting points",
    layout,
    kind: "blank",
    sourceId: id,
    edition: "Blank",
    sectionOrder: [
      "about",
      "offerings",
      "gallery",
      "areas",
      "reviews",
      "feature",
      "faq",
    ],
    document: doc,
  });
}
// An additional original beauty-studio design. Existing IDs and saved drafts stay intact.
const skinDocument = JSON.parse(
  JSON.stringify(salon.document),
) as WebsiteDocument;
Object.assign(skinDocument, {
  brandName: "Rouge Bloom Studio",
  eyebrow: "BEAUTY, ON YOUR OWN TERMS",
  headline: "Where your\nindividuality blooms.",
  intro:
    "Personal skin rituals, expressive beauty and a little time just for you. Discover a studio that celebrates the way you are.",
  ctaLabel: "Book your session",
  accent: "#b52d28",
  paper: "#fffefa",
  ink: "#a92b26",
  heroImage: "/template-photos/beauty/skin-hero.jpg",
  seoTitle: "Personal beauty rituals | Rouge Bloom Studio",
  seoDescription:
    "Explore personal skin rituals, expressive beauty and considered nail care at Rouge Bloom Studio. Meet the artists and request your next appointment.",
  aboutTitle: "Your beauty. Your expression.",
  aboutText:
    "We believe beauty begins with listening. Your preferences, your routine and the way you want to feel guide every visit.\n\nOur independent studio brings a gentle approach and a creative eye to skin, makeup and nail care. We explain each step and make space for your questions.",
  offeringsTitle: "Our signature edit",
  offerings: [
    {
      slug: "skin-ritual",
      title: "The skin ritual",
      category: "Skin care",
      description:
        "A gentle cleanse, thoughtful hydration and time to reset. A personal ritual shaped around your skin and comfort.",
      duration: "60 minutes",
      price: "From ₦30,000",
      image: "/template-photos/beauty/skin-care.jpg",
      benefits: [
        "A personal consultation",
        "A gentle, considered routine",
        "Simple aftercare guidance",
      ],
      preparation:
        "Tell us about sensitivities and products you currently use. Suitability is discussed before treatment.",
    },
    {
      slug: "makeup-artistry",
      title: "Makeup, your way",
      category: "Makeup",
      description:
        "Soft definition or a bold point of view. An expressive look designed with you, for your moment.",
      duration: "75 minutes",
      price: "From ₦40,000",
      image: "/template-photos/beauty/skin-hero.jpg",
      benefits: [
        "A shared creative direction",
        "A personalised finish",
        "Time for the details",
      ],
      preparation: "Bring inspiration and let us know about any sensitivities.",
    },
    {
      slug: "nail-design",
      title: "The nail atelier",
      category: "Nail care",
      description:
        "Considered shaping, careful finishing and colour that feels like you. Small details, beautifully done.",
      duration: "60 minutes",
      price: "From ₦20,000",
      image: "/template-photos/beauty/colour.jpg",
      benefits: [
        "A shape you love",
        "Personal colour selection",
        "Care advice for home",
      ],
      preparation:
        "Tell us about existing products or extensions when requesting your visit.",
    },
  ],
  galleryTitle: "A closer look at our world",
  gallery: [
    {
      src: "/template-photos/beauty/skin-hero.jpg",
      alt: "A beauty portrait with thoughtful skin care",
      category: "Beauty",
    },
    {
      src: "/template-photos/beauty/skin-care.jpg",
      alt: "A relaxing studio skin care ritual",
      category: "Studio",
    },
    {
      src: "/template-photos/beauty/interior.jpg",
      alt: "An inviting beauty studio interior",
      category: "Studio",
    },
  ],
  featureTitle: "The artists behind the details",
  featureText:
    "A shared creative spirit. A thoughtful eye. A personal approach that makes every appointment feel like your own.",
  featureItems: ["Listen first", "Create together", "Care in every detail"],
  contactTitle: "Make a little space for yourself.",
  contactText:
    "Ask us about a service or request a studio visit. We will get in touch to discuss your preferences and confirm availability.",
  reviews: [
    {
      name: "Sample guest",
      quote:
        "A warm welcome, thoughtful details and a little time to feel like myself again.",
      rating: 5,
    },
  ],
});
skinDocument.beauty = {
  ...skinDocument.beauty!,
  design: "atelier",
  demoContent: true,
  aboutImage: "/template-photos/beauty/skin-care.jpg",
  philosophy: [
    "Listen with care",
    "Celebrate individuality",
    "Explain every step",
  ],
  stylists: [
    {
      name: "Ada Okoro",
      role: "Skin care artist",
      bio: "A calm, thoughtful approach to personal skin rituals.",
      image: "/template-photos/beauty/stylist.jpg",
    },
    {
      name: "Lola Bello",
      role: "Makeup artist",
      bio: "Colour, detail and a creative eye for individual expression.",
      image: "/template-photos/beauty/hero.jpg",
    },
    {
      name: "Zara Obi",
      role: "Nail artist",
      bio: "Careful finishing and a love of the smallest details.",
      image: "/template-photos/beauty/skin-artist.jpg",
    },
  ],
  pages: [
    {
      path: "",
      title: skinDocument.seoTitle!,
      description: skinDocument.seoDescription!,
    },
    {
      path: "about",
      title: "Our story | Rouge Bloom Studio",
      description: skinDocument.aboutText.split("\n\n")[0],
    },
    {
      path: "services",
      title: "Our services | Rouge Bloom Studio",
      description: skinDocument.intro,
    },
    ...skinDocument.offerings.map((service) => ({
      path: `services/${service.slug}`,
      title: `${service.title} | Rouge Bloom Studio`,
      description: service.description,
    })),
    {
      path: "gallery",
      title: "Studio gallery | Rouge Bloom Studio",
      description: skinDocument.intro,
    },
    {
      path: "book",
      title: "Request a visit | Rouge Bloom Studio",
      description: skinDocument.contactText,
    },
    {
      path: "contact",
      title: "Contact | Rouge Bloom Studio",
      description: skinDocument.contactText,
    },
  ],
};
websiteTemplates.push({
  id: "beauty-atelier",
  name: "Beauty Studio — Rouge Bloom",
  category: "Beauty & Wellness",
  layout: "portrait",
  kind: "website",
  sourceId: "beauty-atelier",
  edition: "Atelier",
  sectionOrder: [
    "offerings",
    "reviews",
    "about",
    "gallery",
    "feature",
    "areas",
    "faq",
  ],
  document: skinDocument,
});

// Another independent starter: warm cream, burgundy and a full-bleed salon portrait.
const luxeDocument = JSON.parse(
  JSON.stringify(salon.document),
) as WebsiteDocument;
Object.assign(luxeDocument, {
  brandName: "Velour Hair Studio",
  eyebrow: "A PERSONAL EXPRESSION OF STYLE",
  headline: "The art of\nbeautifully you.",
  intro:
    "Thoughtful cuts, luminous colour and care that celebrates your texture. Discover a more personal kind of salon experience.",
  ctaLabel: "Request your session",
  accent: "#50271f",
  paper: "#faf2eb",
  ink: "#30251f",
  heroImage: "/template-photos/beauty/luxe-hero.jpg",
  seoTitle: "Thoughtful cuts & luminous colour | Velour Hair Studio",
  seoDescription:
    "Explore thoughtful cuts, luminous colour and personal hair care at Velour Hair Studio. Meet the artists, discover our services and request your next visit.",
  aboutTitle: "An eye for detail. A feeling of belonging.",
  aboutText:
    "We see a salon visit as a conversation. About your routine, your hair and the way you want to show up in the world. Every appointment begins with listening.\n\nOur independent studio combines thoughtful technique with an easy welcome. From a small refresh to a new direction, we take time to find the look that feels like you.",
  offeringsTitle: "Our signature services",
  offerings: [
    {
      ...salon.document.offerings[0],
      slug: "signature-cut",
      title: "Signature cut & style",
    },
    {
      ...salon.document.offerings[1],
      slug: "colour-and-light",
      title: "Colour & light",
    },
    {
      ...salon.document.offerings[2],
      slug: "texture-ritual",
      title: "The texture ritual",
    },
    {
      ...salon.document.offerings[3],
      slug: "occasion-styling",
      title: "Occasion styling",
    },
  ],
  galleryTitle: "The studio edit",
  featureTitle: "Meet our artists",
  featureText:
    "A shared love of craft. An eye for the details that make a look your own.",
  contactTitle: "Ready for your next chapter?",
  contactText:
    "Your next look starts with a conversation. Tell us what you have in mind and we will be in touch to confirm availability and the right service for you.",
  reviews: [
    {
      name: "Sample guest · Ada",
      quote:
        "They took the time to listen. I left with a shape that feels completely like me.",
      rating: 5,
    },
    {
      name: "Sample guest · Tolu",
      quote:
        "A warm welcome and thoughtful care, from the first conversation to the finishing touches.",
      rating: 5,
    },
  ],
});
luxeDocument.beauty = {
  ...luxeDocument.beauty!,
  design: "luxe",
  demoContent: true,
  stylists: [
    {
      name: "Amara Eze",
      role: "Cut & styling artist",
      bio: "Personal shapes and considered finishes for everyday confidence.",
      image: "/template-photos/beauty/stylist.jpg",
    },
    {
      name: "Tomi James",
      role: "Colour artist",
      bio: "Soft dimension, thoughtful colour and a creative eye for the individual.",
      image: "/template-photos/beauty/skin-artist.jpg",
    },
    {
      name: "Zuri Cole",
      role: "Texture specialist",
      bio: "A gentle approach to texture, care and expressive styling.",
      image: "/template-photos/beauty/luxe-hero.jpg",
    },
  ],
  pages: [
    {
      path: "",
      title: luxeDocument.seoTitle!,
      description: luxeDocument.seoDescription!,
    },
    {
      path: "about",
      title: "Our story | Velour Hair Studio",
      description: luxeDocument.aboutText.split("\n\n")[0],
    },
    {
      path: "services",
      title: "Our services | Velour Hair Studio",
      description: luxeDocument.intro,
    },
    ...luxeDocument.offerings.map((service) => ({
      path: `services/${service.slug}`,
      title: `${service.title} | Velour Hair Studio`,
      description: service.description,
    })),
    {
      path: "gallery",
      title: "Studio gallery | Velour Hair Studio",
      description: luxeDocument.intro,
    },
    {
      path: "book",
      title: "Request your session | Velour Hair Studio",
      description: luxeDocument.contactText,
    },
    {
      path: "contact",
      title: "Contact | Velour Hair Studio",
      description: luxeDocument.contactText,
    },
  ],
};
websiteTemplates.push({
  id: "salon-luxe",
  name: "Hair Salon — Velour",
  category: "Beauty & Wellness",
  layout: "portrait",
  kind: "website",
  sourceId: "salon-luxe",
  edition: "Luxe",
  sectionOrder: [
    "offerings",
    "about",
    "reviews",
    "gallery",
    "areas",
    "feature",
    "faq",
  ],
  document: luxeDocument,
});

// Crown & Blade is a separate monochrome barbershop starter, not a replacement.
const barberDocument = JSON.parse(
  JSON.stringify(salon.document),
) as WebsiteDocument;
Object.assign(barberDocument, {
  brandName: "Crown & Blade",
  eyebrow: "SHARP CRAFT. INDIVIDUAL STYLE.",
  headline: "Your cut.\nYour character.",
  intro:
    "Precision cuts, considered beard care and a chair where you can be yourself. A modern barbershop built around good craft and an easy welcome.",
  ctaLabel: "Request your appointment",
  accent: "#f7f7f2",
  paper: "#111111",
  ink: "#f7f7f2",
  heroImage: "/template-photos/beauty/barber-studio.jpg",
  seoTitle: "Precision cuts & beard care | Crown & Blade",
  seoDescription:
    "Discover precision cuts, traditional shaves and considered beard care at Crown & Blade. Explore our work, meet the barbers and request your next appointment.",
  aboutTitle: "Respect the craft. Make it your own.",
  aboutText:
    "A good cut starts with a conversation. We listen to your routine, your texture and the way you want to wear your hair, then bring a careful eye to every line and finish.\n\nOur independent barbershop blends time-honoured care with a modern point of view. An easy welcome, an honest conversation and a look that feels like you.",
  offeringsTitle: "Our signature services",
  offerings: [
    {
      slug: "signature-cut",
      title: "Signature haircut",
      category: "Cuts",
      description:
        "A personal consultation, a considered shape and a careful finish. Designed around your texture and everyday routine.",
      duration: "45–60 minutes",
      price: "From ₦15,000",
      image: "/template-photos/beauty/barber-studio.jpg",
      benefits: [
        "A personal consultation",
        "A shape that suits your routine",
        "Simple styling advice",
      ],
      preparation:
        "Bring a reference or tell us what you would like to change.",
    },
    {
      slug: "traditional-shave",
      title: "Traditional shave",
      category: "Shaves",
      description:
        "A slower grooming ritual with warm towels and careful finishing. We discuss your skin and preferences before we begin.",
      duration: "40 minutes",
      price: "From ₦10,000",
      image: "/template-photos/beauty/barber-craft.jpg",
      benefits: [
        "A considered consultation",
        "Warm-towel preparation",
        "A comfortable finish",
      ],
      preparation:
        "Tell your barber about sensitivities, irritation or recent skin treatments.",
    },
    {
      slug: "beard-sculpt",
      title: "Beard sculpting",
      category: "Beard care",
      description:
        "Balance, shape and definition. A tidy-up or a new direction, finished with guidance for care at home.",
      duration: "30 minutes",
      price: "From ₦8,000",
      image: "/template-photos/beauty/barber-cut.jpg",
      benefits: [
        "Personal shape and definition",
        "A careful finish",
        "Home-care advice",
      ],
      preparation:
        "Come with your beard as you normally wear it and share the look you have in mind.",
    },
  ],
  galleryTitle: "The art of the craft",
  gallery: [
    {
      src: "/template-photos/beauty/barber-studio.jpg",
      alt: "A barber carefully shaping a client's haircut",
      category: "Cuts",
    },
    {
      src: "/template-photos/beauty/barber-craft.jpg",
      alt: "A traditional barbering ritual in progress",
      category: "Care",
    },
    {
      src: "/template-photos/beauty/barber-cut.jpg",
      alt: "Tools of the barbering craft",
      category: "Studio",
    },
  ],
  featureTitle: "Meet the barbers",
  featureText: "Different perspectives. A shared respect for the details.",
  featureItems: [
    "Precision cuts",
    "Thoughtful beard care",
    "Every texture welcome",
  ],
  contactTitle: "Your next look starts here.",
  contactText:
    "Tell us what you have in mind and when you would like to visit. We will be in touch to confirm your service, timing and final price.",
  reviews: [
    {
      name: "Sample guest · Chidi",
      quote: "Good conversation, careful work and a cut that feels like me.",
      rating: 5,
    },
    {
      name: "Sample guest · Wale",
      quote: "They listened to what I wanted and took care of the details.",
      rating: 5,
    },
    {
      name: "Sample guest · Emeka",
      quote:
        "An easy welcome and a thoughtful finish. A little time well spent.",
      rating: 5,
    },
  ],
});
barberDocument.beauty = {
  ...barberDocument.beauty!,
  design: "barber",
  demoContent: true,
  aboutImage: "/template-photos/beauty/barber-craft.jpg",
  philosophy: [
    "Listen before the first cut",
    "Respect every texture",
    "Take care of the details",
  ],
  stylists: [
    {
      name: "Tunde Cole",
      role: "Cut & shave specialist",
      bio: "Considered shapes, careful lines and an easy conversation.",
      image: "/template-photos/beauty/barber-artist-one.jpg",
    },
    {
      name: "Dayo Obi",
      role: "Texture & styling artist",
      bio: "A personal approach to texture, shape and everyday style.",
      image: "/template-photos/beauty/barber-artist-two.jpg",
    },
    {
      name: "Kene James",
      role: "Beard care specialist",
      bio: "Thoughtful grooming and a sharp eye for balance and definition.",
      image: "/template-photos/beauty/barber-artist-three.jpg",
    },
  ],
  pages: [
    {
      path: "",
      title: barberDocument.seoTitle!,
      description: barberDocument.seoDescription!,
    },
    {
      path: "about",
      title: "Our story | Crown & Blade",
      description: barberDocument.aboutText.split("\n\n")[0],
    },
    {
      path: "services",
      title: "Our services | Crown & Blade",
      description: barberDocument.intro,
    },
    ...barberDocument.offerings.map((service) => ({
      path: `services/${service.slug}`,
      title: `${service.title} | Crown & Blade`,
      description: service.description,
    })),
    {
      path: "gallery",
      title: "Our work | Crown & Blade",
      description: barberDocument.intro,
    },
    {
      path: "book",
      title: "Request a visit | Crown & Blade",
      description: barberDocument.contactText,
    },
    {
      path: "contact",
      title: "Contact | Crown & Blade",
      description: barberDocument.contactText,
    },
  ],
};
websiteTemplates.push({
  id: "barber-monochrome",
  name: "Barbershop — Crown & Blade",
  category: "Beauty & Wellness",
  layout: "portrait",
  kind: "website",
  sourceId: "barber-monochrome",
  edition: "Monochrome",
  sectionOrder: [
    "offerings",
    "gallery",
    "about",
    "reviews",
    "areas",
    "feature",
    "faq",
  ],
  document: barberDocument,
});

// Solace is an independent spa starter; prices, people and reviews are editable examples.
const spaDocument = JSON.parse(
  JSON.stringify(salon.document),
) as WebsiteDocument;
Object.assign(spaDocument, {
  brandName: "Solace Beauty & Spa",
  eyebrow: "A LITTLE TIME, JUST FOR YOU",
  headline: "Beauty, care\nand a softer pace.",
  intro:
    "Personal beauty rituals, gentle care and room to pause. Discover a welcoming studio that helps you feel a little more like yourself.",
  ctaLabel: "Request an appointment",
  accent: "#c9593e",
  paper: "#fffaf6",
  ink: "#342d29",
  heroImage: "/template-photos/beauty/spa-hero.jpg",
  seoTitle: "Beauty, care & a softer pace | Solace Beauty & Spa",
  seoDescription:
    "Discover personal beauty rituals, relaxing spa visits and thoughtful packages at Solace Beauty & Spa. Meet the team and request your next appointment.",
  aboutTitle: "A calm space. A personal approach.",
  aboutText:
    "We make room for a slower kind of appointment. One that begins with a conversation about your preferences, your routine and what would help you feel comfortable.\n\nFrom a simple refresh to time set aside for yourself, our independent studio brings a thoughtful touch to every visit. We explain what to expect and make space for your questions.",
  offeringsTitle: "Our beauty & spa services",
  offerings: [
    ...[
      [
        "relaxation-massage",
        "Relaxation massage",
        "A gentle, unhurried session shaped around your comfort and preferences.",
        "60 minutes",
        "From ₦25,000",
        "skin-care.jpg",
      ],
      [
        "facial-ritual",
        "Facial ritual",
        "A considered cleanse, hydration and simple care guidance for your routine.",
        "60 minutes",
        "From ₦30,000",
        "skin-hero.jpg",
      ],
      [
        "skin-care",
        "Skin care consultation",
        "A conversation about your routine and the care that feels right for you.",
        "30 minutes",
        "From ₦15,000",
        "spa-hero.jpg",
      ],
      [
        "nail-care",
        "Nail care",
        "Thoughtful shaping, careful finishing and colour that feels like you.",
        "45 minutes",
        "From ₦15,000",
        "colour.jpg",
      ],
      [
        "makeup",
        "Makeup artistry",
        "Soft definition or a creative statement, designed together for your moment.",
        "75 minutes",
        "From ₦35,000",
        "luxe-hero.jpg",
      ],
      [
        "quiet-time",
        "Quiet-time ritual",
        "A slower studio visit with a warm welcome and a personal care conversation.",
        "45 minutes",
        "From ₦20,000",
        "spa-interior.jpg",
      ],
      [
        "hand-foot-care",
        "Hand & foot care",
        "A careful refresh with gentle shaping, finishing and practical aftercare advice.",
        "60 minutes",
        "From ₦22,000",
        "skin-care.jpg",
      ],
      [
        "occasion-beauty",
        "Occasion beauty",
        "A personal consultation and a considered beauty look for your special occasion.",
        "90 minutes",
        "By consultation",
        "stylist.jpg",
      ],
    ].map(([slug, title, description, duration, price, image]) => ({
      slug,
      title,
      description,
      duration,
      price,
      image: `/template-photos/beauty/${image}`,
      category: "Treatment",
      benefits: [
        "A personal consultation",
        "Care shaped around your preferences",
        "Simple aftercare guidance",
      ],
      preparation:
        "Tell us about allergies, sensitivities, recent treatments and any concerns before your visit. Your team will discuss suitability, timing and final pricing with you.",
    })),
    ...[
      [
        "restore-package",
        "Restore",
        "From ₦40,000",
        ["Personal consultation", "Facial ritual", "Aftercare conversation"],
      ],
      [
        "renew-package",
        "Renew",
        "From ₦60,000",
        ["Personal consultation", "Relaxation massage", "Hand & foot care"],
      ],
      [
        "celebrate-package",
        "Celebrate",
        "From ₦75,000",
        ["Personal consultation", "Makeup artistry", "Nail care"],
      ],
    ].map(([slug, title, price, benefits]) => ({
      slug: slug as string,
      title: title as string,
      price: price as string,
      benefits: benefits as string[],
      category: "Package",
      description:
        "A considered combination of studio services, with timing and suitability discussed before your appointment.",
      duration: "By consultation",
      image: "/template-photos/beauty/spa-interior.jpg",
      preparation:
        "Your studio confirms availability, package inclusions and final pricing before the visit. This request does not take payment.",
    })),
  ],
  galleryTitle: "A little look inside",
  gallery: [
    {
      src: "/template-photos/beauty/skin-care.jpg",
      alt: "A gentle facial care ritual",
      category: "Care",
    },
    {
      src: "/template-photos/beauty/spa-interior.jpg",
      alt: "A calm and welcoming spa space",
      category: "Studio",
    },
    {
      src: "/template-photos/beauty/skin-hero.jpg",
      alt: "A personal facial treatment in progress",
      category: "Care",
    },
    {
      src: "/template-photos/beauty/spa-hero.jpg",
      alt: "A beauty portrait with a natural finish",
      category: "Beauty",
    },
  ],
  featureTitle: "Thoughtful people. A gentle touch.",
  featureText:
    "Different skills, a shared commitment to making you feel welcome.",
  featureItems: [
    "Personal consultation",
    "Comfort comes first",
    "Transparent conversations",
    "Care for your routine",
  ],
  faqTitle: "Notes on beauty & care",
  faqs: [
    {
      question: "Preparing for your first spa visit",
      answer:
        "Start with a conversation. Tell the studio what you would like from the visit, how much time you have and whether there is anything that would make you more comfortable. You can ask about the treatment, the products used and the final price before deciding.\n\nShare any allergies, sensitivities, recent procedures or health concerns before the appointment. A treatment may need to be adapted or postponed. If you are unsure about suitability, speak to a qualified health professional.\n\nArrive with time to settle in, wear something comfortable and bring your questions. Your visit should feel considered and personal, with no pressure to choose a service you do not want.",
    },
    {
      question: "A simpler everyday skin routine",
      answer:
        "A good routine can be simple. Introduce changes gradually and pay attention to how your skin feels. Gentle cleansing, suitable hydration and appropriate sun protection are useful topics to discuss with your skin-care professional.\n\nMore products do not automatically mean better care. Ask about ingredients, sensitivities and how a product fits with what you already use. Follow product instructions and stop using anything that causes irritation.\n\nThis is general information, not a diagnosis or personal treatment plan. Persistent irritation, new symptoms or concerns about a skin condition deserve advice from a qualified clinician.",
    },
    {
      question: "Making time for a slower appointment",
      answer:
        "Setting aside time for yourself does not need to be complicated. Choose a visit that fits your day and talk with the team about your preferences before it begins. Quiet time, a little conversation or extra explanation can all be part of a personal experience.\n\nYou can ask the practitioner to adjust pressure, pause a service or explain a step. Feeling comfortable includes knowing that you can change your mind.\n\nAfter your appointment, give yourself room to ease back into the day. Ask for any relevant aftercare guidance and choose a pace that feels right for you.",
    },
    {
      question: "Choosing a beauty package",
      answer:
        "A package can be a useful way to plan a few services together. Begin with what you actually want from the visit rather than the number of treatments listed. Ask which services are included, how long they take and how the final price is confirmed.\n\nTell the studio about sensitivities, preferences and any timing constraints. Some combinations may not suit every guest, and your team should discuss alternatives before you decide.\n\nA request is not a confirmed reservation or a payment. Ask about the studio's booking, cancellation and aftercare arrangements so you know what to expect.",
    },
  ],
  contactTitle: "Make a little space for yourself.",
  contactText:
    "Tell us what you have in mind. We will get in touch to discuss suitability, availability and the right service for you.",
  reviews: [
    {
      name: "Sample guest · Ada",
      quote:
        "A warm welcome and time to slow down. Every detail felt considered.",
      rating: 5,
    },
    {
      name: "Sample guest · Kemi",
      quote: "They listened to my preferences and explained each step clearly.",
      rating: 5,
    },
    {
      name: "Sample guest · Zainab",
      quote:
        "A calm space, thoughtful care and a lovely little pause in my week.",
      rating: 5,
    },
  ],
});
spaDocument.beauty = {
  ...spaDocument.beauty!,
  design: "spa",
  demoContent: true,
  aboutImage: "/template-photos/beauty/spa-interior.jpg",
  philosophy: [
    "Listen first",
    "Respect your comfort",
    "Explain each step",
    "Keep care personal",
  ],
  stylists: [
    {
      name: "Ada Eze",
      role: "Skin care artist",
      bio: "A gentle approach and time for your questions.",
      image: "/template-photos/beauty/spa-hero.jpg",
    },
    {
      name: "Lola James",
      role: "Makeup artist",
      bio: "Personal expression, colour and a considered finish.",
      image: "/template-photos/beauty/luxe-hero.jpg",
    },
    {
      name: "Zara Cole",
      role: "Beauty specialist",
      bio: "An eye for detail and a warm studio welcome.",
      image: "/template-photos/beauty/stylist.jpg",
    },
    {
      name: "Amara Obi",
      role: "Nail care artist",
      bio: "Careful finishing and simple care guidance.",
      image: "/template-photos/beauty/skin-artist.jpg",
    },
  ],
  pages: [
    {
      path: "",
      title: spaDocument.seoTitle!,
      description: spaDocument.seoDescription!,
    },
    ...[
      ["about", "Our story"],
      ["services", "Our services"],
      ["gallery", "Studio gallery"],
      ["book", "Request a visit"],
      ["contact", "Contact"],
    ].map(([path, title]) => ({
      path,
      title: `${title} | Solace Beauty & Spa`,
      description: spaDocument.intro,
    })),
    ...spaDocument.offerings.map((o) => ({
      path: `services/${o.slug}`,
      title: `${o.title} | Solace Beauty & Spa`,
      description: o.description,
    })),
  ],
};
websiteTemplates.push({
  id: "spa-solace",
  name: "Spa & Wellness — Solace",
  category: "Beauty & Wellness",
  layout: "portrait",
  kind: "website",
  sourceId: "spa-solace",
  edition: "Spa",
  sectionOrder: [
    "about",
    "offerings",
    "feature",
    "gallery",
    "reviews",
    "faq",
    "areas",
  ],
  document: spaDocument,
});

// Original editorial law-firm design, independent from the existing law-firm editions.
const legalDocument = JSON.parse(
  JSON.stringify(baseWebsiteTemplates[0].document),
) as WebsiteDocument;
Object.assign(legalDocument, {
  design: "legal",
  demoContent: true,
  aboutImage: "/template-photos/legal/team.jpg",
  brandName: "Alden & Rowe",
  eyebrow: "CONSIDERED COUNSEL. CLEARER DECISIONS.",
  headline: "ALDEN\n& ROWE",
  intro:
    "Practical legal guidance for the decisions that matter to you and your business.",
  ctaLabel: "Request a consultation",
  accent: "#cf6b45",
  paper: "#f8f7f0",
  ink: "#30332a",
  heroImage: "/template-photos/legal/office.jpg",
  logoUrl: "",
  seoTitle: "Considered counsel, clearer decisions | Alden & Rowe",
  seoDescription:
    "Explore Alden & Rowe's approach to business, employment, property and dispute matters. Meet the team and make a general consultation enquiry.",
  aboutTitle: "A considered approach to your next step.",
  aboutText:
    "Legal matters are personal, even when they concern a business. We begin by listening to your priorities, understanding the context and explaining what a useful next step could look like.\n\nOur approach combines clear communication with practical thinking. We discuss scope, timing and fees before agreeing an engagement, and keep you informed as the work develops.",
  offeringsTitle: "Practice areas",
  offerings: [
    {
      slug: "business-law",
      title: "Business law",
      description:
        "Support for commercial arrangements, contracts and the decisions that shape your business.",
      benefits: [
        "Understanding the commercial context",
        "Reviewing the available options",
        "Agreeing a practical scope of work",
      ],
      preparation:
        "Bring a brief outline of the matter. The firm will tell you which documents to share through an appropriate channel.",
    },
    {
      slug: "employment-workplace",
      title: "Employment & workplace",
      description:
        "A clear, considered approach to workplace arrangements, policies and employment matters.",
      benefits: [
        "Understanding the working relationship",
        "Explaining possible next steps",
        "A conversation about scope and timing",
      ],
      preparation:
        "Prepare a short summary of your concerns and any relevant dates. Avoid sending sensitive documents through the initial enquiry form.",
    },
    {
      slug: "property-real-estate",
      title: "Property & real estate",
      description:
        "Guidance for property decisions, agreements and transactions, shaped around your priorities.",
      benefits: [
        "Considering your priorities",
        "Identifying information needed for review",
        "Planning a clear next step",
      ],
      preparation:
        "The firm will discuss the information it needs and the appropriate way to provide it.",
    },
    {
      slug: "dispute-resolution",
      title: "Dispute resolution",
      description:
        "Practical thinking when a disagreement needs a structured conversation and a clear way forward.",
      benefits: [
        "Listening to the background",
        "Explaining available approaches",
        "Discussing timing and next steps",
      ],
      preparation:
        "Note key dates and the people involved. Time-sensitive matters should be raised directly with a qualified lawyer.",
    },
  ],
  galleryTitle: "Meet our attorneys",
  gallery: [
    {
      src: "/template-photos/legal/attorney-one.jpg",
      alt: "Ada Rowe",
      category: "Sample profile · Employment & workplace",
    },
    {
      src: "/template-photos/legal/attorney-two.jpg",
      alt: "Tunde Alden",
      category: "Sample profile · Business & property",
    },
    {
      src: "/template-photos/legal/attorney-three.jpg",
      alt: "Kene James",
      category: "Sample profile · Dispute resolution",
    },
  ],
  featureTitle: "Clear communication. Thoughtful work.",
  featureText:
    "Good counsel begins with listening, makes room for questions and helps you understand the decisions ahead.",
  featureItems: [
    "Listen carefully",
    "Explain the options",
    "Agree a clear next step",
  ],
  faqTitle: "News & perspectives",
  faqs: [
    {
      question: "Preparing for a first legal consultation",
      answer:
        "Begin with a short summary of what you would like help with and any dates that may matter. A first conversation is an opportunity to explain your priorities and ask how the firm approaches this type of work.\n\nAsk about scope, timing, fees and the steps needed before an engagement can begin. The firm may need to check for conflicts and gather more information before it can advise you.\n\nDo not send confidential documents through a general website form. Ask the firm which information it needs and the appropriate channel for sharing it. This article provides general information, not legal advice for a particular situation.",
    },
    {
      question: "Keeping business records organised",
      answer:
        "An organised record of agreements, decisions and key correspondence can make a professional consultation more focused. Keep documents in a consistent location, record relevant dates and separate signed versions from working drafts.\n\nAccess and retention arrangements should fit your business and any applicable requirements. Ask an appropriate professional about records you are required to keep, how long to keep them and who should have access.\n\nThis is general organisational guidance. It does not establish a legal retention policy or replace advice on your circumstances.",
    },
    {
      question: "Understanding the scope of an engagement",
      answer:
        "Before professional work begins, ask what is included, what information is needed and how the firm will communicate with you. Clear expectations help both sides understand the purpose of the engagement.\n\nDiscuss fees, timing, points of contact and how a change in scope would be handled. If something is unclear, ask for an explanation before you agree.\n\nThe terms of any engagement are determined by the agreement with your lawyer. Reading this article or sending a general enquiry does not create a lawyer-client relationship.",
    },
  ],
  contactTitle: "Let’s discuss your next step.",
  contactText:
    "Send a brief general enquiry. The firm will contact you to discuss suitability, scope, availability and fees before agreeing an engagement.",
  serviceAreas: [],
  socials: [],
  reviews: [],
});
websiteTemplates.push({
  id: "law-firm-counsel",
  name: "Law Firm — Alden & Rowe",
  category: "Legal & Professional",
  layout: "editorial",
  kind: "website",
  sourceId: "law-firm-counsel",
  edition: "Counsel",
  sectionOrder: [
    "about",
    "offerings",
    "gallery",
    "feature",
    "faq",
    "areas",
    "reviews",
  ],
  document: legalDocument,
});

// Family-law edition: original content inspired by the supplied layout reference.
const familyDocument = JSON.parse(
  JSON.stringify(legalDocument),
) as WebsiteDocument;
Object.assign(familyDocument, {
  legalVariant: "family",
  heroImage: "/template-photos/legal/family-hero.jpg",
  brandName: "Hartwell & Vale",
  eyebrow: "FAMILY LAW. A THOUGHTFUL WAY FORWARD.",
  headline: "Guidance for life's next chapter.",
  intro:
    "Compassionate counsel for your family, with clear advice at every step.",
  ctaLabel: "Request a consultation",
  accent: "#d4e9f3",
  paper: "#fbfced",
  ink: "#102140",
  seoTitle: "Family law, with care | Hartwell & Vale",
  seoDescription:
    "Discover a thoughtful approach to separation, parenting arrangements, family agreements and estate planning. Meet our sample team and explore a first consultation.",
  aboutTitle: "Compassion in counsel. Clarity in every decision.",
  aboutText:
    "Every family has its own story. We start by listening to yours, understanding your priorities and explaining the options in language that makes sense.\n\nFrom changing relationships to plans for the future, our approach gives you space to ask questions and consider your next step. Scope, availability and fees are agreed before any engagement begins.",
  offeringsTitle: "Support for what matters most",
  offerings: [
    {
      slug: "separation-divorce",
      title: "Separation & divorce",
      image: "/template-photos/legal/office.jpg",
      description:
        "Navigate a changing relationship with a clearer understanding of the process and your options.",
      benefits: [
        "Discuss your priorities",
        "Understand the process",
        "Plan practical next steps",
      ],
      preparation:
        "Prepare a brief outline of your situation and important dates. Ask the firm how to share documents securely.",
    },
    {
      slug: "parenting-arrangements",
      title: "Children & parenting",
      image: "/template-photos/legal/team.jpg",
      description:
        "Thoughtful guidance on parenting arrangements, with attention to your family's circumstances.",
      benefits: [
        "Understand the family's needs",
        "Explore available arrangements",
        "Discuss appropriate professional support",
      ],
      preparation:
        "Bring a short summary of your concerns. Avoid including sensitive information about children in the initial form.",
    },
    {
      slug: "family-agreements",
      title: "Family agreements",
      image: "/template-photos/legal/office.jpg",
      description:
        "Discuss agreements and financial arrangements with clear expectations about scope and advice.",
      benefits: [
        "Review your priorities",
        "Discuss information needed",
        "Understand the next step",
      ],
      preparation:
        "Ask which documents are relevant before sending financial or personal information.",
    },
    {
      slug: "wills-estate-planning",
      title: "Wills & future planning",
      image: "/template-photos/legal/team.jpg",
      description:
        "Consider the future with guidance on wills, responsibilities and your family's wishes.",
      benefits: [
        "Outline your wishes",
        "Identify questions for advice",
        "Discuss suitable planning",
      ],
      preparation:
        "Prepare your questions and a general outline of your goals. Specific advice depends on your circumstances and applicable law.",
    },
  ],
  galleryTitle: "People who listen. Counsel you can understand.",
  gallery: [
    {
      src: "/template-photos/legal/attorney-one.jpg",
      alt: "Amara Vale",
      category: "Sample profile · Family law",
    },
    {
      src: "/template-photos/legal/attorney-two.jpg",
      alt: "Daniel Hartwell",
      category: "Sample profile · Family agreements",
    },
    {
      src: "/template-photos/legal/attorney-three.jpg",
      alt: "Nneka Cole",
      category: "Sample profile · Future planning",
    },
  ],
  featureTitle: "A more considered conversation",
  featureText:
    "You deserve time to be heard, room to ask questions and clarity about what comes next.",
  featureItems: ["Listen with care", "Explain clearly", "Plan together"],
  faqTitle: "Before we begin",
  faqs: [
    {
      question: "What should I bring to a first conversation?",
      answer:
        "Start with a short outline of your concerns, your questions and any important dates. The firm will explain which documents are needed and how to share them securely.\n\nA first enquiry does not create a lawyer-client relationship. Scope, fees and suitability must be agreed separately.",
    },
    {
      question: "Can I send private family information through the form?",
      answer:
        "Please keep your initial enquiry general. Do not send sensitive case details, children's information or confidential documents through a public website form.\n\nAsk the firm about an appropriate channel before sharing private information.",
    },
    {
      question: "How are fees and next steps agreed?",
      answer:
        "Ask what work is included, how fees are calculated and who will keep you informed. The firm should discuss scope and availability before you decide to proceed.\n\nUrgent matters should be raised directly with a qualified lawyer. This website provides general information only.",
    },
  ],
  contactTitle: "Begin the conversation.",
  contactText:
    "Tell us how we can help, in general terms. We will discuss the appropriate next step before any engagement is agreed.",
});
websiteTemplates.push({
  id: "family-law",
  name: "Family Law — Hartwell & Vale",
  category: "Legal & Professional",
  layout: "editorial",
  kind: "website",
  sourceId: "family-law",
  edition: "Family",
  sectionOrder: [
    "about",
    "offerings",
    "gallery",
    "feature",
    "faq",
    "areas",
    "reviews",
  ],
  document: familyDocument,
});

// Catalogue demonstration photography only. Existing saved customer documents are
// never rewritten by this policy. Add future default photos to the reviewed source manifest.
const reviewedTemplatePhotos = {
  "business-woman": {
    src: "/template-photos/african/business-woman.jpg",
    alt: "African American woman walking down stairs holding smartphone and bag.",
  },
  "business-professional": {
    src: "/template-photos/african/business-professional.jpg",
    alt: "Professional African American woman in business attire standing confidently in an office environment.",
  },
  "business-elegance": {
    src: "/template-photos/african/business-elegance.jpg",
    alt: "Elegant woman in a red dress using a tablet indoors, exuding confidence.",
  },
  lawyer: {
    src: "/template-photos/african/lawyer.jpg",
    alt: "Elegant portrait of a female barrister in Abuja, showcasing professional legal attire.",
  },
  "lawyer-smile": {
    src: "/template-photos/african/lawyer-smile.jpg",
    alt: "Smiling female lawyer in traditional legal attire posing confidently indoors.",
  },
  "portrait-braids": {
    src: "/template-photos/african/portrait-braids.jpg",
    alt: "Striking portrait of a woman with braided hair in a natural setting.",
  },
  "portrait-fashion": {
    src: "/template-photos/african/portrait-fashion.jpg",
    alt: "Portrait of a woman in a beige dress standing confidently in nature under a blue sky.",
  },
  "salon-owner": {
    src: "/template-photos/african/salon-owner.jpg",
    alt: "Woman standing in a modern beauty shop, smiling confidently beside shelves of cosmetics.",
  },
  "spa-mask": {
    src: "/template-photos/african/spa-mask.jpg",
    alt: "Crop African American female with brown eyes cleansing pores with mud mask and looking away",
  },
  "spa-treatment": {
    src: "/template-photos/african/spa-treatment.jpg",
    alt: "A woman enjoying a peaceful spa treatment, lying topless with eyes closed on a white towel.",
  },
  "spa-care": {
    src: "/template-photos/african/spa-care.jpg",
    alt: "Portrait of a woman with a facial mask in a calm indoor setting, emphasizing skincare routine.",
  },
  "doctor-team": {
    src: "/template-photos/african/doctor-team.jpg",
    alt: "Black male and female doctors collaborating in a medical clinic with a tablet.",
  },
  "doctor-smile": {
    src: "/template-photos/african/doctor-smile.jpg",
    alt: "Cheerful male doctor wearing eyeglasses and a stethoscope, illustrating health care professionalism.",
  },
  school: {
    src: "/template-photos/african/school.jpg",
    alt: "Engaged students in uniforms attentively participating in a classroom setting.",
  },
  community: {
    src: "/template-photos/african/community.jpg",
    alt: "Smiling African family dressed in vibrant traditional clothing, sharing a joyful moment outdoors in Nigeria.",
  },
  family: {
    src: "/template-photos/african/family.jpg",
    alt: "A joyful moment of family bonding captured in a warm embrace indoors.",
  },
  music: {
    src: "/template-photos/african/music.jpg",
    alt: "Energetic black female singer in red dress performing passionately on stage with a microphone.",
  },
  fitness: {
    src: "/template-photos/african/fitness.jpg",
    alt: "Confident woman in activewear lifting dumbbells outdoors, embracing fitness and healthy lifestyle.",
  },
  chef: {
    src: "/template-photos/african/chef.jpg",
    alt: "Two chefs busy preparing dishes in a professional kitchen in Nakuru, Kenya.",
  },
  "chef-craft": {
    src: "/template-photos/african/chef-craft.jpg",
    alt: "Close-up of a chef seasoning an avocado dish, adding a touch of culinary art to gourmet cooking.",
  },
  wedding: {
    src: "/template-photos/african/wedding.jpg",
    alt: "Stunning Nigerian bride in traditional attire with rich cultural elements.",
  },
  travel: {
    src: "/template-photos/african/travel.jpg",
    alt: "Stylish African woman with headwrap and sunglasses posing by the rocks. Fashionable and serene outdoor scene.",
  },
  "travel-smile": {
    src: "/template-photos/african/travel-smile.jpg",
    alt: "Smiling woman in casual attire with suitcase and passport on yellow background, ready for travel.",
  },
  construction: {
    src: "/template-photos/african/construction.jpg",
    alt: "From below of African American man in helmet with hammer building house at work",
  },
  mechanic: {
    src: "/template-photos/african/mechanic.jpg",
    alt: "Positive young black male auto mechanic in comfortable clothes repairing vehicle during work in garage",
  },
  "barber-craft": {
    src: "/template-photos/african/barber-craft.jpg",
    alt: "Professional barber giving a precise haircut to a client in a stylish barbershop setting.",
  },
  "barber-care": {
    src: "/template-photos/african/barber-care.jpg",
    alt: "Barber expertly designs hairstyle for senior client using hair clippers in modern barbershop.",
  },
  "barber-welcome": {
    src: "/template-photos/african/barber-welcome.jpg",
    alt: "Professional barber drapes apron on client in stylish salon, preparing for a haircut session.",
  },
  "portrait-man": {
    src: "/template-photos/african/portrait-man.jpg",
    alt: "Close-up portrait of a man with an afro hairstyle against a vibrant red background.",
  },
  "portrait-elder": {
    src: "/template-photos/african/portrait-elder.jpg",
    alt: "Black and white portrait of a man in traditional African attire with a turban.",
  },
} as const;
type ReviewedPhoto = keyof typeof reviewedTemplatePhotos;
const templatePhotoSets: Record<string, readonly ReviewedPhoto[]> = {
  "Legal & Professional": ["business-professional", "lawyer", "lawyer-smile"],
  "Faith & Community": ["community", "family", "school"],
  Education: ["school", "community", "family"],
  "Music & Creative": ["music", "portrait-fashion", "portrait-braids"],
  "Beauty & Wellness": ["salon-owner", "portrait-braids", "portrait-fashion"],
  "Property & Services": ["construction", "business-woman", "mechanic"],
  "Food & Hospitality": ["chef", "chef-craft", "travel"],
  "Retail & Lifestyle": [
    "portrait-fashion",
    "business-elegance",
    "salon-owner",
  ],
  "Health & Care": ["doctor-team", "doctor-smile", "business-professional"],
};
for (const template of websiteTemplates) {
  const doc = template.document;
  if (doc.blank || template.kind === "blank") continue;
  const source = template.sourceId || template.id;
  const specific: Record<string, readonly ReviewedPhoto[]> = {
    "law-firm-counsel": ["business-professional", "lawyer", "lawyer-smile"],
    "family-law": ["family", "business-professional", "lawyer-smile"],
    "med-spa": ["spa-mask", "spa-care", "spa-treatment"],
    "spa-solace": ["spa-treatment", "spa-care", "spa-mask"],
    "barber-monochrome": ["barber-craft", "barber-care", "barber-welcome"],
    fitness: ["fitness", "portrait-man", "portrait-braids"],
    travel: ["travel", "travel-smile", "portrait-fashion"],
    events: ["wedding", "community", "family"],
    "auto-service": ["mechanic", "mechanic", "business-woman"],
    construction: ["construction", "business-woman", "business-professional"],
    "real-estate": [
      "business-woman",
      "business-professional",
      "business-elegance",
    ],
    photography: ["portrait-braids", "portrait-fashion", "portrait-elder"],
    hotel: ["travel", "chef", "travel-smile"],
  };
  const names =
    specific[source] ||
    templatePhotoSets[template.category] ||
    templatePhotoSets["Legal & Professional"];
  const photo = (index: number) =>
    reviewedTemplatePhotos[names[index % names.length]];
  doc.heroImage = photo(0).src;
  if (doc.aboutImage) doc.aboutImage = photo(1).src;
  doc.gallery = doc.gallery.map((item, index) => ({
    ...item,
    ...photo(index),
  }));
  doc.offerings = doc.offerings.map((item, index) =>
    item.image ? { ...item, image: photo(index).src } : item,
  );
  if (doc.beauty) {
    doc.beauty.aboutImage = photo(1).src;
    const portraits: readonly ReviewedPhoto[] =
      doc.beauty.design === "barber"
        ? ["portrait-man", "portrait-elder", "barber-welcome"]
        : ["salon-owner", "portrait-fashion", "portrait-braids"];
    doc.beauty.stylists = doc.beauty.stylists.map((person, index) => ({
      ...person,
      image: reviewedTemplatePhotos[portraits[index % portraits.length]].src,
    }));
  }
}

// Original dressmaker starter, informed by the supplied November reference archive.
// Add after the category photo pass so its reviewed fashion-specific images stay intact.
const atelierPhoto = (name: string) =>
  `/template-photos/african/atelier-${name}.jpg`;
const dressmakerDocument: WebsiteDocument = {
  ...JSON.parse(
    JSON.stringify(websiteTemplates.find((t) => t.id === "fashion")!.document),
  ),
  design: "dressmaker",
  demoContent: true,
  brandName: "Élan Atelier",
  eyebrow: "Bespoke dressmaking · Bridal & occasionwear",
  headline: "Made to be\nremembered.",
  intro:
    "A dress that feels like you. Thoughtfully designed, carefully fitted, and made for the moments you’ll keep forever.",
  ctaLabel: "Request a consultation",
  accent: "#686b55",
  paper: "#f5f4ed",
  ink: "#292b23",
  heroImage: atelierPhoto("bride"),
  seoTitle: "Élan Atelier | Bespoke Bridal & Occasionwear",
  seoDescription:
    "Discover bespoke bridal dresses and occasionwear at Élan Atelier. Explore the collection, our dressmaking process and start your personal consultation.",
  aboutTitle: "A little poetry in every stitch.",
  aboutText:
    "We begin with a conversation, a feeling, a moment you want to remember. From the first sketch to the final fitting, your story shapes every detail.\n\nOur atelier brings considered silhouettes, beautiful fabrics and thoughtful craftsmanship together to create something entirely yours.",
  offeringsTitle: "From our atelier",
  offerings: [
    {
      title: "The Ivory Story",
      description:
        "A considered bridal silhouette, created around your movement, your personality and your celebration. Discuss fabrics, finishing and fitting at your consultation.",
      image: atelierPhoto("veil"),
      price: "Made to order · Enquire for a personal quote",
    },
    {
      title: "The Silver Hour",
      description:
        "Fluid occasionwear with a sculptural finish. A starting point for a personal design, with the fit, length and details considered together.",
      image: atelierPhoto("silk"),
      price: "Made to order · Enquire for a personal quote",
    },
    {
      title: "The Golden Muse",
      description:
        "Expressive volume and a joyful colour story for a moment that deserves to be remembered. Explore your own interpretation with the atelier.",
      image: atelierPhoto("sun"),
      price: "Made to order · Enquire for a personal quote",
    },
    {
      title: "The Blue Reverie",
      description:
        "Soft structure and considered layers, shaped for your occasion. Discover a personal approach to colour, coverage and finishing.",
      image: atelierPhoto("blue"),
      price: "Made to order · Enquire for a personal quote",
    },
  ],
  featureTitle: "Our journey together",
  featureText:
    "A personal process, with room to dream and time to get the details right.",
  featureItems: [
    "The conversation — Tell us about your occasion, your inspiration and how you want to feel.",
    "The creation — We explore silhouette, fabric and finishing, then shape the design around you.",
    "The final fitting — Thoughtful adjustments bring everything together, ready for your moment.",
  ],
  galleryTitle: "In the making",
  gallery: [
    {
      src: atelierPhoto("studio"),
      alt: "Fashion designers working in a light-filled atelier",
      category: "The atelier",
    },
    {
      src: atelierPhoto("hands"),
      alt: "Close-up of hands guiding fabric through a sewing machine in Lagos",
      category: "Made with intention",
    },
    {
      src: atelierPhoto("mirror"),
      alt: "Bride admiring her dress in a mirror in black and white",
      category: "The finishing touch",
    },
    {
      src: atelierPhoto("work"),
      alt: "Seamstress working with fabric at an industrial sewing machine",
      category: "A slower kind of craft",
    },
  ],
  faqTitle: "Before we begin",
  faqs: [
    {
      question: "How does a bespoke commission begin?",
      answer:
        "Start with a consultation enquiry. Share your occasion, preferred date and any inspiration. The atelier will discuss the design process and confirm the next steps with you.",
    },
    {
      question: "Can I personalise a look from the collection?",
      answer:
        "The collection offers a starting point for a conversation. Fabric, colour, fit and finishing are discussed together before a commission is agreed.",
    },
    {
      question: "When should I enquire?",
      answer:
        "Get in touch as early as possible. Your atelier will confirm current availability, fitting requirements and a realistic lead time before you commit.",
    },
  ],
  contactTitle: "Let’s make it yours.",
  contactText:
    "Tell us about the moment you’re dressing for. We’d love to hear your ideas and help you explore what comes next.",
  serviceAreas: ["Your city · By appointment"],
  socials: [],
  reviews: [],
};
websiteTemplates.push({
  id: "dressmaker-atelier",
  name: "Dressmaker — Élan Atelier",
  category: "Retail & Lifestyle",
  layout: "catalogue",
  kind: "website",
  sourceId: "dressmaker-atelier",
  edition: "Bespoke",
  sectionOrder: ["about", "offerings", "feature", "gallery", "faq", "areas"],
  document: dressmakerDocument,
});

const jewelleryPhoto = (name: string) =>
  `/template-photos/african/jewel-${name}.jpg`;
const jewelleryDocument: WebsiteDocument = {
  ...JSON.parse(JSON.stringify(dressmakerDocument)),
  design: "jewellery",
  brandName: "Nacre & Gold",
  eyebrow: "Jewellery, with feeling.",
  headline: "Small details.\nExtraordinary days.",
  intro:
    "Considered pieces for your own kind of beautiful. Discover sculptural forms, soft details and the everyday pleasure of wearing something you love.",
  ctaLabel: "Explore the collection",
  accent: "#8c7550",
  paper: "#faf9f6",
  ink: "#24231f",
  heroImage: jewelleryPhoto("hero"),
  aboutImage: jewelleryPhoto("profile"),
  seoTitle: "Nacre & Gold | Considered Jewellery & Personal Style",
  seoDescription:
    "Explore the Nacre & Gold jewellery collection: earrings, necklaces and rings. Discover our story, find your favourite piece and enquire with the boutique.",
  aboutTitle: "The beauty of a personal detail.",
  aboutText:
    "Jewellery can hold a little of who we are: a favourite shape, a familiar texture, a feeling we return to. Nacre & Gold is a demonstration boutique inspired by those quiet, personal connections.\n\nUse this space to tell your own story, introduce your approach to choosing pieces and help customers understand what makes your collection yours.",
  offeringsTitle: "The considered edit",
  offerings: [
    {
      title: "Sculpted Leaf Earrings",
      description:
        "An organic silhouette with a softly textured finish. Ask the boutique about the material, dimensions, care and current availability before ordering.",
      category: "Earrings",
      image: jewelleryPhoto("hoops"),
      price: "Enquire for price",
    },
    {
      title: "The Ripple Hoops",
      description:
        "A sculptural pair with fluid curves and a light-catching surface. Enquire for verified product details, sizing and a personal quotation.",
      category: "Earrings",
      image: jewelleryPhoto("drop"),
      price: "Enquire for price",
    },
    {
      title: "The Fine Line Chain",
      description:
        "A clean, considered chain to wear your own way. The boutique can confirm the composition, length, fastening and available options.",
      category: "Necklaces",
      image: jewelleryPhoto("chain"),
      price: "Enquire for price",
    },
    {
      title: "The Keepsake Pendant",
      description:
        "A small statement with a thoughtful setting. Contact the boutique to discuss the piece, its specifications and your preferred delivery or collection arrangements.",
      category: "Necklaces",
      image: jewelleryPhoto("pendant"),
      price: "Enquire for price",
    },
    {
      title: "The Lightcatcher Ring",
      description:
        "A bright focal point in a classic silhouette. Request confirmed stone and metal specifications, sizing advice and availability directly from the boutique.",
      category: "Rings",
      image: jewelleryPhoto("solitaire"),
      price: "Enquire for price",
    },
    {
      title: "The Parallel Rings",
      description:
        "A complementary pair with a modern profile. Ask about sizing, materials, finishing and personal ordering options before making a purchase.",
      category: "Rings",
      image: jewelleryPhoto("rings"),
      price: "Enquire for price",
    },
  ],
  featureTitle: "A little light, every day.",
  featureText:
    "Expressive shapes. Thoughtful details. Jewellery that leaves room for you.",
  featureItems: [
    "Find your form — Explore the edit and discover the shapes you are drawn to.",
    "Ask the details — Confirm the materials, measurements and availability with your boutique.",
    "Make it personal — Discuss sizing, gifting and how you would like to receive your piece.",
  ],
  galleryTitle: "Worn your way",
  gallery: [
    {
      src: jewelleryPhoto("profile"),
      alt: "Profile portrait featuring an ornate earring and carefully braided hair",
      category: "A sculptural expression",
    },
    {
      src: jewelleryPhoto("editorial"),
      alt: "Fashion portrait with expressive gold-toned rings and statement earrings",
      category: "Everyday expression",
    },
    {
      src: jewelleryPhoto("hero"),
      alt: "Portrait with intricate earrings and warm, elegant styling",
      category: "The finishing detail",
    },
  ],
  faqTitle: "Care, sizing & ordering",
  faqs: [
    {
      question: "How do I order a piece?",
      answer:
        "Open a piece and send an enquiry to the boutique. Confirm its price, specifications and availability, then agree the payment and delivery or collection arrangements directly with the business.",
    },
    {
      question: "How should I care for my jewellery?",
      answer:
        "Care depends on the exact materials and finish. Ask the boutique for the manufacturer’s care instructions for your piece. Store pieces separately and check care guidance before using cleaning products.",
    },
    {
      question: "Can you help with ring sizes or a gift?",
      answer:
        "Share your requirements with the boutique before ordering. The business can confirm its sizing guidance, packaging options and any applicable exchange or adjustment policy.",
    },
  ],
  contactTitle: "Let’s find your next favourite.",
  contactText:
    "Ask about a piece, discuss a gift or find out more about the collection. Your boutique will confirm product details and ordering arrangements with you.",
  serviceAreas: ["Your city · Visits by arrangement"],
  socials: [],
  reviews: [],
};
websiteTemplates.push({
  id: "jewellery-luxe",
  name: "Jewellery Store — Nacre & Gold",
  category: "Retail & Lifestyle",
  layout: "catalogue",
  kind: "website",
  sourceId: "jewellery-luxe",
  edition: "Luxe",
  sectionOrder: ["offerings", "about", "feature", "gallery", "faq", "areas"],
  document: jewelleryDocument,
});

// Original November 9 starters. Reference screenshots guide the composition;
// editable text and licensed photographs remain part of the shared catalogue.
const occasionPhoto = (name: string) => `/template-photos/african/${name}.jpg`;
const bridalDocument: WebsiteDocument = {
  ...JSON.parse(
    JSON.stringify(
      websiteTemplates.find((t) => t.id === "hair-salon")!.document,
    ),
  ),
  brandName: "Aura Bridal",
  eyebrow: "Bridal beauty, thoughtfully yours",
  headline: "Your radiant\nbeginning awaits.",
  intro:
    "A calm moment. A look that feels like you. Considered bridal makeup and hairstyling for your most personal celebration.",
  ctaLabel: "Discover your bridal look",
  accent: "#756553",
  paper: "#fcfaf6",
  ink: "#302e29",
  heroImage: occasionPhoto("atelier-bride"),
  seoTitle: "Aura Bridal | Bridal Makeup & Hairstyling",
  seoDescription:
    "Explore Aura Bridal’s personal approach to wedding makeup and hairstyling. Discover bridal services, browse the gallery and request a consultation.",
  aboutTitle: "Beauty that feels like you.",
  aboutText:
    "Your wedding morning should feel unhurried. We make room to listen, understand your inspiration and create a look that lets you feel completely yourself.\n\nFrom a first conversation to your final touch-up, we bring a considered approach to skin, texture and finishing. Every detail begins with you.",
  offeringsTitle: "The Aura Bridal experience",
  offerings: [
    {
      title: "Bespoke bridal makeup",
      slug: "bridal-makeup",
      description:
        "A personal makeup look shaped around your skin, your style and the way you want to feel. Explore colour, coverage and finishing at a consultation.",
      image: occasionPhoto("atelier-veil"),
      price: "Personal quote after consultation",
      duration: "Timing agreed with your artist",
      benefits: [
        "Personal beauty consultation",
        "A considered skin-preparation plan",
        "Makeup tailored to your celebration",
      ],
      preparation:
        "Share your wedding date, location, inspiration and any skin sensitivities when you enquire.",
    },
    {
      title: "Considered bridal hairstyling",
      slug: "bridal-hairstyling",
      description:
        "From natural texture to a carefully sculpted silhouette, discover hairstyling that works with your dress, veil and personal expression.",
      image: occasionPhoto("atelier-mirror"),
      price: "Personal quote after consultation",
      duration: "Timing agreed with your stylist",
      benefits: [
        "A conversation about your hair and accessories",
        "Personal styling direction",
        "A finish considered for your celebration",
      ],
      preparation:
        "Tell us about your hair, chosen accessories and any styles you would like to explore.",
    },
    {
      title: "Your bridal circle",
      slug: "bridal-circle",
      description:
        "A thoughtful beauty plan for the people celebrating beside you. Discuss your group, the morning’s schedule and a shared direction with room for everyone’s individuality.",
      image: occasionPhoto("wedding"),
      price: "Group quote on enquiry",
      duration: "Schedule confirmed for your group",
      benefits: [
        "A shared beauty consultation",
        "An agreed getting-ready schedule",
        "Individual finishing touches",
      ],
      preparation:
        "Include the number of guests, getting-ready location and ceremony time in your enquiry.",
    },
  ],
  galleryTitle: "A glimpse of bridal bliss",
  gallery: [
    {
      src: occasionPhoto("atelier-veil"),
      alt: "Smiling African bride in a white dress and delicate veil",
      category: "The joyful moment",
    },
    {
      src: occasionPhoto("atelier-mirror"),
      alt: "Black bride admiring her reflection in a mirror",
      category: "The quiet preparation",
    },
    {
      src: occasionPhoto("atelier-bride"),
      alt: "African bride seated in an elegant wedding dress",
      category: "The personal finish",
    },
    {
      src: occasionPhoto("wedding"),
      alt: "Nigerian bride wearing richly detailed traditional wedding attire",
      category: "Your own expression",
    },
  ],
  featureTitle: "A little care, at every step.",
  featureText:
    "A thoughtful beauty experience, from your first idea to the day itself.",
  featureItems: [
    "Share your inspiration and the details of your celebration.",
    "Explore a personal look and agree your beauty plan.",
    "Enjoy the moment, with every finishing detail considered.",
  ],
  faqTitle: "Before your bridal appointment",
  faqs: [
    {
      question: "How do I begin?",
      answer:
        "Send a consultation request with your date, location and the services you are considering. Your artist will respond with availability and next steps before a booking is agreed.",
    },
    {
      question: "Can I arrange a trial?",
      answer:
        "Ask about a trial when you enquire. The studio will confirm what is available, what is included and any separate cost before you commit.",
    },
    {
      question: "Do you travel to wedding locations?",
      answer:
        "Share your getting-ready location and schedule. Your artist will confirm the service area, travel arrangements and any additional charges with you.",
    },
  ],
  contactTitle: "Let’s begin your story.",
  contactText:
    "Tell us about your celebration. Share your ideas, your wedding date and the little details that matter to you.",
  serviceAreas: [
    "Your city · By appointment",
    "Wedding-location visits by arrangement",
  ],
  socials: [],
  reviews: [],
  beauty: {
    version: 2,
    design: "bridal",
    demoContent: true,
    aboutImage: occasionPhoto("atelier-veil"),
    philosophy: [
      "Your own kind of beautiful",
      "A calm, personal experience",
      "Every complexion, thoughtfully considered",
    ],
    stylists: [],
    hours: [
      {
        day: "Consultations & wedding dates",
        hours: "By appointment · availability confirmed personally",
      },
    ],
    contact: { phone: "", email: "", address: "", whatsapp: "", mapUrl: "" },
    pages: [
      {
        path: "",
        title: "Aura Bridal | Bridal Makeup & Hairstyling",
        description:
          "Explore Aura Bridal’s personal approach to wedding makeup and hairstyling. Discover bridal services, browse the gallery and request a consultation.",
      },
      {
        path: "about",
        title: "Our Bridal Beauty Approach | Aura Bridal",
        description:
          "Meet the thoughtful approach behind Aura Bridal: personal beauty consultations, considered finishing and a calm experience shaped around your wedding.",
      },
      {
        path: "services",
        title: "Bridal Makeup & Hair Services | Aura Bridal",
        description:
          "Discover personal bridal makeup, hairstyling and beauty for your bridal circle. Explore what each service includes before requesting your consultation.",
      },
      {
        path: "gallery",
        title: "The Bridal Beauty Gallery | Aura Bridal",
        description:
          "Explore a gallery of bridal beauty inspiration, from joyful white-wedding moments to traditional Nigerian celebrations and considered personal finishing.",
      },
      {
        path: "book",
        title: "Request a Bridal Consultation | Aura Bridal",
        description:
          "Share your wedding date, beauty inspiration and preferred bridal services with Aura Bridal. Your artist will confirm availability and next steps personally.",
      },
      {
        path: "contact",
        title: "Contact the Bridal Studio | Aura Bridal",
        description:
          "Start a conversation with Aura Bridal about your wedding makeup and hair. Share your celebration details, location and questions with the bridal studio.",
      },
    ],
  },
};
websiteTemplates.push({
  id: "bridal-aura",
  name: "Bridal Beauty — Aura",
  category: "Beauty & Wellness",
  layout: "portrait",
  kind: "website",
  sourceId: "bridal-aura",
  edition: "Editorial",
  sectionOrder: [
    "about",
    "offerings",
    "gallery",
    "reviews",
    "feature",
    "faq",
    "areas",
  ],
  document: bridalDocument,
});

const nailDocument: WebsiteDocument = {
  ...JSON.parse(JSON.stringify(bridalDocument)),
  brandName: "Claw Culture",
  eyebrow: "Independent nail art & considered care",
  headline: "Where art\nmeets edge.",
  intro:
    "For the expressive, the experimental, the unapologetically you. Personal nail art, thoughtful prep and a little everyday rebellion.",
  ctaLabel: "Find your next set",
  accent: "#ed7750",
  paper: "#eeeae4",
  ink: "#211d18",
  heroImage: occasionPhoto("nail-muse"),
  seoTitle: "Claw Culture | Nail Art & Manicure Studio",
  seoDescription:
    "Discover expressive nail art and considered manicure care at Claw Culture. Explore our signature services, browse the gallery and request an appointment.",
  aboutTitle: "Small canvas. Big personality.",
  aboutText:
    "We see nails as a place to play. A flash of colour, an unexpected detail, a tiny artwork that goes everywhere you do.\n\nOur studio pairs expressive design with a thoughtful approach to preparation and care. Bring your inspiration. We’ll help you find your own finish.",
  offeringsTitle: "Our signature craft",
  offerings: [
    {
      title: "Chrome & effects",
      slug: "chrome-effects",
      description:
        "Explore reflective finishes, soft shimmer and a little unexpected shine. Choose a direction with your artist and build a set that feels like you.",
      image: occasionPhoto("nail-detail"),
      price: "Quote confirmed before your appointment",
      duration: "Length of visit confirmed on enquiry",
      benefits: [
        "Personal finish consultation",
        "Shape and colour considered together",
        "A finish agreed before work begins",
      ],
      preparation:
        "Tell us about your current nails, any existing product and your inspiration when you enquire.",
    },
    {
      title: "Hand-painted art",
      slug: "hand-painted-art",
      description:
        "Tiny details with a point of view. From a single accent to a full set of personal artwork, discuss your ideas and agree the design with your artist.",
      image: occasionPhoto("nail-pink"),
      price: "Personal quote for your chosen design",
      duration: "Timing depends on your design",
      benefits: [
        "An inspiration-led design conversation",
        "Artwork tailored to your chosen shape",
        "A clear quote before your visit",
      ],
      preparation:
        "Share inspiration images and let us know whether you are planning a new set or a refresh.",
    },
    {
      title: "Manicure & care",
      slug: "manicure-care",
      description:
        "A considered reset for hands and nails. Discuss your preferences, choose your shape and leave with a finish you can make your own.",
      image: occasionPhoto("nail-care"),
      price: "Enquire for current services and prices",
      duration: "Appointment length confirmed personally",
      benefits: [
        "A conversation about your nail care",
        "Thoughtful shaping and preparation",
        "Personal aftercare guidance",
      ],
      preparation:
        "Mention any sensitivities, nail concerns or existing product so your artist can advise you.",
    },
  ],
  galleryTitle: "The canvas collection",
  gallery: [
    {
      src: occasionPhoto("nail-pink"),
      alt: "Dark-skinned hand with softly coloured pink nail art",
      category: "Colour stories",
    },
    {
      src: occasionPhoto("nail-detail"),
      alt: "African model’s hand showing a polished metallic manicure",
      category: "A little shine",
    },
    {
      src: occasionPhoto("nail-portrait"),
      alt: "African woman in a white headscarf showing her expressive manicure",
      category: "Personal expression",
    },
    {
      src: occasionPhoto("nail-care"),
      alt: "A nail artist carefully shaping a dark-skinned client’s nails",
      category: "The craft",
    },
  ],
  featureTitle: "Ready for your next expression?",
  featureText: "Bring an idea. Find your finish. Make it your own.",
  featureItems: [
    "Show us what caught your eye.",
    "Agree your shape, finish and design with your artist.",
    "Leave with personal care guidance for your new set.",
  ],
  faqTitle: "Before you take a seat",
  faqs: [
    {
      question: "Can I bring my own inspiration?",
      answer:
        "Absolutely. Share a few ideas when you enquire so your artist can discuss the design, appointment time and quote with you.",
    },
    {
      question: "Do I need to remove my current set?",
      answer:
        "Tell us what is currently on your nails. The studio will advise on removal or preparation and confirm any additional time or cost before you book.",
    },
    {
      question: "Is my appointment confirmed when I send a request?",
      answer:
        "Sending a request starts a conversation. The studio confirms availability, your chosen service and any booking arrangements separately.",
    },
  ],
  contactTitle: "Your next set starts here.",
  contactText:
    "Tell us what you’re dreaming of. Share your preferred date and service, and the studio will get back to you with the details.",
  serviceAreas: ["Your city · Studio appointments"],
  beauty: {
    ...JSON.parse(JSON.stringify(bridalDocument.beauty)),
    design: "nail",
    aboutImage: occasionPhoto("nail-artist"),
    philosophy: [
      "Thoughtful prep, expressive finish",
      "Your ideas, made personal",
      "A little everyday art",
    ],
    hours: [
      {
        day: "Studio visits",
        hours: "By appointment · ask for current opening hours",
      },
    ],
    pages: [
      {
        path: "",
        title: "Claw Culture | Nail Art & Manicure Studio",
        description:
          "Discover expressive nail art and considered manicure care at Claw Culture. Explore our signature services, browse the gallery and request an appointment.",
      },
      {
        path: "about",
        title: "Our Nail Studio & Approach | Claw Culture",
        description:
          "Get to know Claw Culture’s approach to nail art: thoughtful preparation, personal design conversations and expressive finishes shaped around your ideas.",
      },
      {
        path: "services",
        title: "Nail Art & Manicure Services | Claw Culture",
        description:
          "Explore chrome effects, personal hand-painted nail art and manicure care at Claw Culture. Discuss your inspiration, design and quote before your visit.",
      },
      {
        path: "gallery",
        title: "The Nail Art Gallery | Claw Culture",
        description:
          "Find inspiration in Claw Culture’s nail art gallery, with personal colour stories, reflective finishes and a closer look at the craft behind every set.",
      },
      {
        path: "book",
        title: "Request a Nail Appointment | Claw Culture",
        description:
          "Ready for your next set? Share your preferred nail service, date and inspiration with Claw Culture. The studio will confirm your appointment separately.",
      },
      {
        path: "contact",
        title: "Contact the Nail Studio | Claw Culture",
        description:
          "Talk to Claw Culture about your next manicure or nail-art idea. Find studio contact details, opening arrangements and send your questions to the team.",
      },
    ],
  },
};
websiteTemplates.push({
  id: "nail-culture",
  name: "Nail Studio — Claw Culture",
  category: "Beauty & Wellness",
  layout: "studio",
  kind: "website",
  sourceId: "nail-culture",
  edition: "Expressive",
  sectionOrder: [
    "offerings",
    "gallery",
    "reviews",
    "about",
    "feature",
    "faq",
    "areas",
  ],
  document: nailDocument,
});

export const templatePageKind = (
  template: WebsiteTemplate,
): "website" | "landing" =>
  template.kind === "landing" || template.id === "blank-landing"
    ? "landing"
    : "website";
export const designedTemplateCount = websiteTemplates.filter(
  (t) => t.kind !== "blank",
).length;
export const getWebsiteTemplate = (id: string | null | undefined) =>
  websiteTemplates.find((t) => t.id === id);
export const templateEditorPath = (id: string) =>
  getWebsiteTemplate(id)
    ? `/business/website/template?template=${encodeURIComponent(id)}`
    : "/business/templates";
export const templateLoginPath = (id: string) =>
  getWebsiteTemplate(id)
    ? `/login?template=${encodeURIComponent(id)}`
    : "/login";
export function templateDraft(id: string, brandName?: string): WebsiteDocument {
  const template = getWebsiteTemplate(id);
  if (!template) throw new Error("Unknown website template.");
  const document = JSON.parse(
    JSON.stringify(template.document),
  ) as WebsiteDocument;
  if (brandName?.trim()) {
    document.brandName = brandName.trim().slice(0, 120);
    if (
      document.beauty?.design === "bridal" ||
      document.beauty?.design === "nail"
    ) {
      document.beauty.pages = document.beauty.pages.map((page) => ({
        ...page,
        title: page.title
          .replaceAll(template.document.brandName, document.brandName)
          .slice(0, 100),
        description: page.description
          .replaceAll(template.document.brandName, document.brandName)
          .slice(0, 320),
      }));
      document.seoDescription = document.seoDescription
        ?.replaceAll(template.document.brandName, document.brandName)
        .slice(0, 320);
    }
    if (document.design === "legal" && document.legalVariant !== "family")
      document.headline = document.brandName
        .toUpperCase()
        .replace(/\s&\s/, "\n& ");
    document.seoTitle = (
      document.design === "legal"
        ? `Considered counsel | ${document.brandName}`
        : document.beauty?.design === "bridal"
          ? `Bridal makeup & hairstyling | ${document.brandName}`
          : document.beauty?.design === "nail"
            ? `Nail art & manicure care | ${document.brandName}`
            : document.beauty?.design === "barber"
              ? `Precision cuts & beard care | ${document.brandName}`
              : document.beauty?.design === "atelier" ||
                  document.beauty?.design === "spa"
                ? `Personal beauty rituals | ${document.brandName}`
                : document.beauty
                  ? `Hair, with a personal touch | ${document.brandName}`
                  : `${document.brandName} | ${template.name}`
    ).slice(0, 100);
  }
  return document;
}
export function parseWebsiteDocument(raw: unknown): WebsiteDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid website content.");
  if (JSON.stringify(raw).length > 64000)
    throw new Error("Website content is too large.");
  const source = raw as Record<string, unknown>;
  const blank = source.blank === true;
  const text = (record: Record<string, unknown>, key: string, max: number) => {
    const value = record[key];
    if (
      typeof value !== "string" ||
      (!blank && !value.trim()) ||
      value.length > max
    )
      throw new Error(`Please check ${key}.`);
    return value.trim();
  };
  const image = (value: string) => {
    if (
      /^\/template-art\/[a-z0-9-]+\.svg$/.test(value) ||
      /^\/template-photos\/(?:beauty|legal|african)\/[a-z0-9-]+\.jpg$/.test(
        value,
      )
    )
      return value;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password)
        return value;
    } catch {}
    throw new Error("Images must use HTTPS or bundled template artwork.");
  };
  const list = (key: string, limit: number) => {
    const value = source[key];
    if (
      !Array.isArray(value) ||
      (!blank && !value.length) ||
      value.length > limit ||
      value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
    )
      throw new Error(`Please check ${key}.`);
    return value as Record<string, unknown>[];
  };
  if (source.version !== 1)
    throw new Error("Unsupported website content version.");
  const result: Record<string, unknown> = { version: 1 };
  if (source.design !== undefined) {
    if (!["legal", "dressmaker", "jewellery"].includes(String(source.design)))
      throw Error("Unsupported website design.");
    result.design = source.design;
    if (source.legalVariant !== undefined) {
      if (source.legalVariant !== "family")
        throw Error("Unsupported website legal variant.");
      result.legalVariant = "family";
    }
    if (typeof source.demoContent !== "boolean")
      throw Error("Please check demonstration content settings.");
    result.demoContent = source.demoContent;
    if (source.aboutImage !== undefined)
      result.aboutImage = image(text(source, "aboutImage", 2000));
  }
  if (blank) result.blank = true;
  for (const [key, max] of Object.entries({
    brandName: 120,
    eyebrow: 160,
    headline: 240,
    intro: 1000,
    ctaLabel: 60,
    aboutTitle: 200,
    aboutText: 5000,
    offeringsTitle: 160,
    galleryTitle: 160,
    featureTitle: 240,
    featureText: 2000,
    faqTitle: 160,
    contactTitle: 240,
    contactText: 2000,
  }))
    result[key] = text(source, key, max);
  for (const key of ["accent", "paper", "ink"]) {
    const value = text(source, key, 7);
    if (!/^#[0-9a-f]{6}$/i.test(value))
      throw new Error("Choose valid six-digit hex colours.");
    result[key] = value;
  }
  result.heroImage = image(text(source, "heroImage", 2000));
  result.offerings = list("offerings", 12).map((v) => {
    const offering: WebsiteOffering = {
      title: text(v, "title", 120),
      description: text(v, "description", 1200),
    };
    for (const [key, max] of [
      ["slug", 80],
      ["category", 80],
      ["duration", 80],
      ["price", 120],
      ["preparation", 1200],
    ] as const)
      if (v[key] !== undefined) {
        if (typeof v[key] !== "string" || v[key].length > max)
          throw Error(`Please check service ${key}.`);
        offering[key] = v[key].trim();
      }
    if (offering.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(offering.slug))
      throw Error("Please check service slug.");
    if (v.image !== undefined) offering.image = image(text(v, "image", 2000));
    if (v.benefits !== undefined) {
      if (
        !Array.isArray(v.benefits) ||
        v.benefits.length > 8 ||
        v.benefits.some(
          (b) => typeof b !== "string" || !b.trim() || b.length > 240,
        )
      )
        throw Error("Please check service benefits.");
      offering.benefits = v.benefits.map((b) => String(b).trim());
    }
    return offering;
  });
  result.gallery = list("gallery", 12).map((v) => ({
    src: image(text(v, "src", 2000)),
    alt: text(v, "alt", 200),
    ...(v.category !== undefined ? { category: text(v, "category", 80) } : {}),
  }));
  result.faqs = list("faqs", 12).map((v) => ({
    question: text(v, "question", 240),
    answer: text(v, "answer", 2000),
  }));
  if (
    !Array.isArray(source.featureItems) ||
    (!blank && !source.featureItems.length) ||
    source.featureItems.length > 12 ||
    source.featureItems.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 240,
    )
  )
    throw new Error("Please check your feature points.");
  result.featureItems = source.featureItems.map((v) => String(v).trim());
  if (source.logoUrl !== undefined)
    result.logoUrl = source.logoUrl ? image(text(source, "logoUrl", 2000)) : "";
  for (const [key, max] of [
    ["seoTitle", 100],
    ["seoDescription", 320],
  ] as const)
    if (source[key] !== undefined) {
      if (typeof source[key] !== "string" || source[key].length > max)
        throw new Error(`Please check ${key}.`);
      result[key] = source[key].trim();
    }
  if (source.serviceAreas !== undefined) {
    if (
      !Array.isArray(source.serviceAreas) ||
      source.serviceAreas.length > 30 ||
      source.serviceAreas.some(
        (v) => typeof v !== "string" || !v.trim() || v.length > 120,
      )
    )
      throw new Error("Please check service areas.");
    result.serviceAreas = source.serviceAreas.map((v) => String(v).trim());
  }
  if (source.socials !== undefined) {
    if (!Array.isArray(source.socials) || source.socials.length > 8)
      throw new Error("Please check social links.");
    result.socials = source.socials.map((v) => {
      if (
        !v ||
        typeof v !== "object" ||
        ![
          "instagram",
          "facebook",
          "linkedin",
          "youtube",
          "tiktok",
          "x",
        ].includes(v.platform)
      )
        throw new Error("Please check social platform.");
      const url = image(text(v, "url", 2000));
      if (!url.startsWith("https://"))
        throw new Error("Social links must use HTTPS.");
      return { platform: v.platform, url };
    });
  }
  if (source.reviews !== undefined) {
    if (!Array.isArray(source.reviews) || source.reviews.length > 20)
      throw new Error("Please check reviews.");
    result.reviews = source.reviews.map((v) => {
      if (
        !v ||
        typeof v !== "object" ||
        !Number.isInteger(v.rating) ||
        v.rating < 1 ||
        v.rating > 5
      )
        throw new Error("Please check review rating.");
      const name = text(v, "name", 120),
        quote = text(v, "quote", 2000);
      if (!name || !quote) throw new Error("Please check reviews.");
      return { name, quote, rating: v.rating };
    });
  }
  if (source.beauty !== undefined) {
    const b = source.beauty as Record<string, unknown>;
    if (!b || b.version !== 2 || typeof b.demoContent !== "boolean")
      throw Error("Please check beauty design version.");
    const values = (key: string, max: number) => {
      const a = b[key];
      if (
        !Array.isArray(a) ||
        a.length > max ||
        a.some((v) => !v || typeof v !== "object" || Array.isArray(v))
      )
        throw Error(`Please check beauty ${key}.`);
      return a as Record<string, unknown>[];
    };
    const contact = b.contact as Record<string, unknown>;
    if (!contact || typeof contact !== "object" || Array.isArray(contact))
      throw Error("Please check salon contact details.");
    const optionalText = (
      v: Record<string, unknown>,
      key: string,
      max: number,
    ) => {
      if (typeof v[key] !== "string" || v[key].length > max)
        throw Error(`Please check ${key}.`);
      return v[key].trim();
    };
    const email = optionalText(contact, "email", 254),
      phone = optionalText(contact, "phone", 40),
      whatsapp = optionalText(contact, "whatsapp", 40),
      mapUrl = optionalText(contact, "mapUrl", 2000);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw Error("Please check salon email.");
    if (
      [phone, whatsapp].some(
        (v) =>
          v &&
          (!/^\+?[\d ()-]{7,40}$/.test(v) ||
            v.replace(/\D/g, "").length < 7 ||
            v.replace(/\D/g, "").length > 15),
      )
    )
      throw Error("Please check salon phone.");
    if (mapUrl && !image(mapUrl).startsWith("https://"))
      throw Error("Please check map URL.");
    if (
      !Array.isArray(b.philosophy) ||
      b.philosophy.length > 8 ||
      b.philosophy.some(
        (v) => typeof v !== "string" || !v.trim() || v.length > 240,
      )
    )
      throw Error("Please check salon philosophy.");
    result.beauty = {
      version: 2,
      ...(b.design === "atelier" ||
      b.design === "luxe" ||
      b.design === "barber" ||
      b.design === "spa" ||
      b.design === "bridal" ||
      b.design === "nail"
        ? { design: b.design }
        : {}),
      demoContent: b.demoContent,
      aboutImage: image(text(b, "aboutImage", 2000)),
      philosophy: b.philosophy,
      stylists: values("stylists", 8).map((v) => ({
        name: text(v, "name", 100),
        role: text(v, "role", 120),
        bio: text(v, "bio", 1200),
        image: image(text(v, "image", 2000)),
      })),
      hours: values("hours", 14).map((v) => ({
        day: text(v, "day", 100),
        hours: text(v, "hours", 100),
      })),
      contact: {
        email,
        phone,
        whatsapp,
        mapUrl,
        address: optionalText(contact, "address", 500),
      },
      pages: values("pages", 24).map((v) => {
        const path = optionalText(v, "path", 120);
        if (
          !/^(?:about|services(?:\/[a-z0-9-]+)?|notes\/[a-z0-9-]+|gallery|book|contact)?$/.test(
            path,
          )
        )
          throw Error("Please check salon page path.");
        return {
          path,
          title: text(v, "title", 100),
          description: text(v, "description", 320),
        };
      }),
    };
    const slugs = (result.offerings as WebsiteOffering[]).map((o, i) =>
      beautyServiceSlug(o, i),
    );
    if (new Set(slugs).size !== slugs.length)
      throw Error("Please check duplicate service slugs.");
    if ((result.beauty as BeautyContent).design === "spa") {
      const notes = (result.faqs as WebsiteDocument["faqs"]).map((f, i) =>
        beautyNotePath(f.question, i),
      );
      if (new Set(notes).size !== notes.length)
        throw Error("Please use unique care-note titles.");
    }
    const pages = (result.beauty as BeautyContent).pages.map((p) => p.path);
    if (new Set(pages).size !== pages.length)
      throw Error("Please check duplicate page SEO settings.");
  }
  if (result.design === "legal") {
    const paths = beautyPagePaths(result as WebsiteDocument);
    if (new Set(paths).size !== paths.length)
      throw Error("Please use unique practice and article titles.");
  }
  if (result.design === "dressmaker" || result.design === "jewellery") {
    const slugs = (result.offerings as WebsiteOffering[]).map(
      beautyServiceSlug,
    );
    if (new Set(slugs).size !== slugs.length)
      throw Error("Please use unique collection names or URLs.");
  }
  if (result.design === "jewellery") {
    const categories = jewelleryCategories(result as WebsiteDocument);
    if (new Set(categories.map((c) => c.slug)).size !== categories.length)
      throw Error("Please use unique product category URLs.");
  }
  return result as WebsiteDocument;
}

export function beautyServiceSlug(service: WebsiteOffering, index: number) {
  return (
    service.slug ||
    service.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) ||
    `service-${index + 1}`
  );
}
export function beautyNotePath(question: string, index: number) {
  return (
    "notes/" + beautyServiceSlug({ title: question, description: "" }, index)
  );
}
export function beautyPagePaths(doc: WebsiteDocument) {
  if (doc.design === "legal")
    return [
      "",
      "about",
      "practice-areas",
      ...doc.offerings.map(
        (o, i) => "practice-areas/" + beautyServiceSlug(o, i),
      ),
      "attorneys",
      "insights",
      ...doc.faqs.map(
        (f, i) =>
          "insights/" +
          beautyServiceSlug({ title: f.question, description: "" }, i),
      ),
      "contact",
    ];
  return doc.beauty?.version === 2
    ? [
        "",
        "about",
        "services",
        ...doc.offerings.map((o, i) => "services/" + beautyServiceSlug(o, i)),
        "gallery",
        "book",
        "contact",
        ...(doc.beauty.design === "spa"
          ? doc.faqs.map((f, i) => beautyNotePath(f.question, i))
          : []),
      ]
    : [""];
}
export function beautyPageMeta(doc: WebsiteDocument, path: string) {
  if (doc.design === "legal") {
    const practice = doc.offerings.find(
      (o, i) => path === "practice-areas/" + beautyServiceSlug(o, i),
    );
    const article = doc.faqs.find(
      (f, i) =>
        path ===
        "insights/" +
          beautyServiceSlug({ title: f.question, description: "" }, i),
    );
    const label = (
      {
        about: doc.aboutTitle,
        "practice-areas": doc.offeringsTitle,
        attorneys: doc.galleryTitle,
        insights: doc.faqTitle,
        contact: doc.contactTitle,
      } as Record<string, string>
    )[path];
    return {
      title:
        path === ""
          ? doc.seoTitle || doc.brandName
          : `${practice?.title || article?.question || label || doc.brandName} | ${doc.brandName}`.slice(
              0,
              100,
            ),
      description: (
        practice?.description ||
        article?.answer ||
        (path === "about"
          ? doc.aboutText
          : path === "contact"
            ? doc.contactText
            : doc.seoDescription) ||
        doc.intro
      ).slice(0, 160),
    };
  }
  const custom = doc.beauty?.pages.find((p) => p.path === path);
  const service = doc.offerings.find(
    (o, i) => path === "services/" + beautyServiceSlug(o, i),
  );
  const note =
    doc.beauty?.design === "spa"
      ? doc.faqs.find((f, i) => beautyNotePath(f.question, i) === path)
      : undefined;
  return {
    title:
      (path === "" ? doc.seoTitle : undefined) ||
      custom?.title ||
      (note
        ? `${note.question} | ${doc.brandName}`.slice(0, 100)
        : service
          ? doc.beauty?.design === "bridal" || doc.beauty?.design === "nail"
            ? `${service.title} | ${doc.brandName}`.slice(0, 100)
            : service.title
          : doc.seoTitle || doc.brandName),
    description:
      (path === "" ? doc.seoDescription : undefined) ||
      custom?.description ||
      service?.description ||
      (note ? note.answer.slice(0, 155) : undefined) ||
      doc.seoDescription ||
      doc.intro,
  };
}

export function jewelleryCategories(doc: WebsiteDocument) {
  const names = [
    ...new Map(
      doc.offerings.map((o) => {
        const n = o.category?.trim() || "The collection";
        return [n.toLowerCase(), n] as const;
      }),
    ).values(),
  ];
  return names.map((name, i) => ({
    name,
    slug: beautyServiceSlug({ title: name, description: "" }, i),
  }));
}
/** Every website has real routes; landing-page templates retain anchor navigation. */
export function websitePagePaths(
  template: WebsiteTemplate,
  doc = template.document,
): string[] {
  if (templatePageKind(template) === "landing") return [""];
  if (doc.design === "legal" || doc.beauty?.version === 2)
    return beautyPagePaths(doc);
  if (doc.design === "jewellery")
    return [
      "",
      "shop",
      ...jewelleryCategories(doc).map((c) => "shop/" + c.slug),
      ...doc.offerings.map((o, i) => "pieces/" + beautyServiceSlug(o, i)),
      "about",
      "editorial",
      "care",
      "contact",
    ];
  if (doc.design === "dressmaker")
    return [
      "",
      "atelier",
      "collection",
      ...doc.offerings.map((o, i) => "collection/" + beautyServiceSlug(o, i)),
      "our-process",
      "gallery",
      "faqs",
      "contact",
    ];
  return [
    "",
    "about",
    "services",
    "contact",
    ...template.sectionOrder
      .filter((k) =>
        ["gallery", "areas", "reviews", "feature", "faq"].includes(k),
      )
      .map(
        (k) =>
          (
            ({
              areas: "service-areas",
              feature: "approach",
              faq: "faqs",
            }) as Record<string, string>
          )[k] || k,
      ),
  ];
}
export function websitePageMeta(
  template: WebsiteTemplate,
  doc: WebsiteDocument,
  path: string,
) {
  if (doc.design === "legal" || doc.beauty?.version === 2) {
    const meta = beautyPageMeta(doc, path);
    return {
      ...meta,
      description: meta.description.replace(/\s+/g, " ").slice(0, 160),
      heading: doc.brandName,
    };
  }
  const look =
    doc.design === "dressmaker" || doc.design === "jewellery"
      ? doc.offerings.find(
          (o, i) =>
            path ===
            (doc.design === "jewellery" ? "pieces/" : "collection/") +
              beautyServiceSlug(o, i),
        )
      : undefined;
  const category =
    doc.design === "jewellery"
      ? jewelleryCategories(doc).find((c) => path === "shop/" + c.slug)
      : undefined;
  const labels: Record<string, string> = {
    shop: "Shop the collection",
    editorial: "The journal",
    care: "Care & questions",
    about: "About us",
    services: "Services",
    gallery: "Gallery",
    "service-areas": "Service areas",
    reviews: "Customer reviews",
    approach: "Our approach",
    faqs: "Frequently asked questions",
    contact: "Contact us",
    atelier: "Our atelier",
    collection: "The collection",
    "our-process": "Our process",
  };
  const descriptions: Record<string, string> = {
    shop: doc.offerings.map((o) => o.title).join(" · "),
    editorial: doc.featureText,
    care: doc.faqs[0]?.answer || doc.intro,
    about: doc.aboutText,
    atelier: doc.aboutText,
    services: doc.offerings
      .map((o) => o.title + ": " + o.description)
      .join(" "),
    collection: doc.offerings.map((o) => o.title).join(" · "),
    "our-process": doc.featureText,
    approach: doc.featureText,
    gallery: doc.gallery.map((p) => p.alt).join(". "),
    faqs: doc.faqs[0]?.answer || doc.intro,
    contact: doc.contactText,
    "service-areas": doc.serviceAreas?.join(" · ") || doc.contactText,
    reviews:
      "Read genuine customer feedback about " +
      doc.brandName +
      " and get in touch to discuss your needs.",
  };
  const heading =
    look?.title ||
    category?.name ||
    labels[path] ||
    doc.headline ||
    doc.brandName;
  return {
    heading,
    title: path
      ? `${heading} | ${doc.brandName}`.slice(0, 100)
      : doc.seoTitle || `${doc.brandName} | ${template.name}`,
    description: (
      look?.description ||
      (category
        ? `Explore ${category.name.toLowerCase()} at ${doc.brandName}. ${doc.intro}`
        : "") ||
      (path ? descriptions[path] : doc.seoDescription) ||
      doc.intro ||
      `Learn more about ${doc.brandName || "this business"}, explore services and get in touch.`
    )
      .replace(/\s+/g, " ")
      .slice(0, 160),
  };
}
export function websitePageHref(base: string, path: string) {
  const prefix = base.replace(/\/$/, "");
  return path ? `${prefix}/${path}` : prefix || "/";
}
