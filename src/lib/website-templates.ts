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
  design?: "atelier" | "luxe" | "barber";
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
    heroImage: `https://images.pexels.com/photos/${s.photo}/pexels-photo-${s.photo}.jpeg?auto=compress&cs=tinysrgb&w=1400`,
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
const unsplashPhotos = [
  "1589829545856-d10d557cf95f",
  "1438032005730-c779502df39b",
  "1503676260728-1c00da094a0b",
  "1516280440614-37939bbacd81",
  "1570172619644-dfd03ed5d881",
  "1560066984-138dadb4c035",
  "1504307651254-35680f356dfd",
  "1600585154340-be6161a56a0c",
  "1517248135467-4c7edcad34c4",
  "1566073771259-6a8506099945",
  "1441986300917-64674bd600d8",
  "1473181488821-2d23949a045a",
  "1486262715619-67b85e0b08d3",
  "1519494026892-80bbd2d6fd0d",
  "1534438327276-14e5300c3a48",
  "1516035069371-29a1b244cc32",
  "1511795409834-ef04bbd61622",
  "1488646953014-85cb44e25828",
  "1521737711867-e3b97375f902",
  "1559027615-cd4628902d4a",
];
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
  (base, index) =>
    editions.map((edition, i) => {
      const doc = JSON.parse(JSON.stringify(base.document)) as WebsiteDocument;
      const photo = unsplashPhotos[index];
      doc.heroImage = `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=1600&q=85`;
      doc.gallery = [0, 1, 2].map((n) => ({
        src: `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=${800 + n * 100}&h=${650 + n * 100}&q=80`,
        alt: `${base.name} inspiration — Unsplash photograph ${n + 1}`,
      }));
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
    document.seoTitle = (
      document.beauty?.design === "barber"
        ? `Precision cuts & beard care | ${document.brandName}`
        : document.beauty?.design === "atelier"
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
      /^\/template-photos\/beauty\/[a-z0-9-]+\.jpg$/.test(value)
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
      ...(b.design === "atelier" || b.design === "luxe" || b.design === "barber"
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
          !/^(?:about|services(?:\/[a-z0-9-]+)?|gallery|book|contact)?$/.test(
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
    const pages = (result.beauty as BeautyContent).pages.map((p) => p.path);
    if (new Set(pages).size !== pages.length)
      throw Error("Please check duplicate page SEO settings.");
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
export function beautyPagePaths(doc: WebsiteDocument) {
  return doc.beauty?.version === 2
    ? [
        "",
        "about",
        "services",
        ...doc.offerings.map((o, i) => "services/" + beautyServiceSlug(o, i)),
        "gallery",
        "book",
        "contact",
      ]
    : [""];
}
export function beautyPageMeta(doc: WebsiteDocument, path: string) {
  const custom = doc.beauty?.pages.find((p) => p.path === path);
  const service = doc.offerings.find(
    (o, i) => path === "services/" + beautyServiceSlug(o, i),
  );
  return {
    title:
      (path === "" ? doc.seoTitle : undefined) ||
      custom?.title ||
      (service ? service.title : doc.seoTitle || doc.brandName),
    description:
      (path === "" ? doc.seoDescription : undefined) ||
      custom?.description ||
      service?.description ||
      doc.seoDescription ||
      doc.intro,
  };
}
