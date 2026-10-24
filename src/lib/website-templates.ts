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
export type WebsiteDocument = {
  version: 1;
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
  offerings: { title: string; description: string }[];
  galleryTitle: string;
  gallery: { src: string; alt: string }[];
  featureTitle: string;
  featureText: string;
  featureItems: string[];
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  contactTitle: string;
  contactText: string;
};
export type WebsiteTemplate = {
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
export const websiteTemplates: WebsiteTemplate[] = seeds.map((s) => ({
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
  if (brandName?.trim()) document.brandName = brandName.trim().slice(0, 120);
  return document;
}
export function parseWebsiteDocument(raw: unknown): WebsiteDocument {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid website content.");
  if (JSON.stringify(raw).length > 64000)
    throw new Error("Website content is too large.");
  const source = raw as Record<string, unknown>;
  const text = (record: Record<string, unknown>, key: string, max: number) => {
    const value = record[key];
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new Error(`Please check ${key}.`);
    return value.trim();
  };
  const image = (value: string) => {
    if (/^\/template-art\/[a-z0-9-]+\.svg$/.test(value)) return value;
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
      !value.length ||
      value.length > limit ||
      value.some((v) => !v || typeof v !== "object" || Array.isArray(v))
    )
      throw new Error(`Please check ${key}.`);
    return value as Record<string, unknown>[];
  };
  if (source.version !== 1)
    throw new Error("Unsupported website content version.");
  const result: Record<string, unknown> = { version: 1 };
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
  result.offerings = list("offerings", 12).map((v) => ({
    title: text(v, "title", 120),
    description: text(v, "description", 1200),
  }));
  result.gallery = list("gallery", 12).map((v) => ({
    src: image(text(v, "src", 2000)),
    alt: text(v, "alt", 200),
  }));
  result.faqs = list("faqs", 12).map((v) => ({
    question: text(v, "question", 240),
    answer: text(v, "answer", 2000),
  }));
  if (
    !Array.isArray(source.featureItems) ||
    !source.featureItems.length ||
    source.featureItems.length > 12 ||
    source.featureItems.some(
      (v) => typeof v !== "string" || !v.trim() || v.length > 240,
    )
  )
    throw new Error("Please check your feature points.");
  result.featureItems = source.featureItems.map((v) => String(v).trim());
  return result as WebsiteDocument;
}
