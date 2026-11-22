/* eslint-disable @next/next/no-img-element -- Compressed local/customer photography avoids runtime image transformation. */
"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUpRight, Bean, Coffee, LogIn, Menu, MessageCircle, X } from "lucide-react";
import { beautyServiceSlug, templateLoginPath, type WebsiteDocument, type WebsiteOffering, type WebsiteTemplate } from "@/lib/website-templates";
import { BeautyRequestForm, type BeautyRequest } from "./BeautyWebsite";
import type { TemplateContact } from "./TemplateWebsite";
import styles from "./CoffeeWebsite.module.css";

type Props = {
  template: WebsiteTemplate;
  document: WebsiteDocument;
  contact?: TemplateContact;
  preview?: boolean;
  hideBranding?: boolean;
  onInteraction?: (kind: "cta" | "contact") => void;
  onRequest?: (request: BeautyRequest) => Promise<{ ok: boolean; error?: string }>;
  businessSection?: ReactNode;
};

/** This particular coffee template is a single landing page. Every section stays on the page. */
export function CoffeeWebsite({ template, document: doc, contact = {}, preview = false, hideBranding = false, onInteraction, onRequest, businessSection }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [selectedSlug, setSelectedSlug] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const selectedItem = doc.offerings.find((item, index) => beautyServiceSlug(item, index) === selectedSlug);
  const categories = ["All", ...new Set(doc.offerings.map(item => item.category?.trim()).filter((value): value is string => Boolean(value)))];
  const visibleItems = category === "All" ? doc.offerings : doc.offerings.filter(item => item.category === category);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || "") ? contact.email : "";
  const phone = (contact.phone || "").replace(/[^+\d]/g, "");
  const address = [contact.address, contact.city, contact.state].filter(Boolean).join(", ");
  const navigation = [["about", "Our story"], ["offerings", "The menu"], ["approach", "Our craft"], ["gallery", "Moments"]];

  const photo = (src: string, alt: string, eager = false) => <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={event => {
    if (!event.currentTarget.dataset.fallback) {
      event.currentTarget.dataset.fallback = "true";
      event.currentTarget.src = "/template-photos/coffee/house-latte.jpg";
    }
  }} />;
  const button = (section: string, label: string, outline = false) => <a className={outline ? styles.outlineButton : styles.button} href={"#" + section} onClick={() => onInteraction?.("cta")}><span>{label}</span><ArrowUpRight size={20} aria-hidden="true" /></a>;
  const reveal = (children: ReactNode, className: string) => <motion.div className={className} initial={false} whileInView={reduceMotion ? undefined : { y: [18, 0] }} viewport={{ once: true, amount: .12 }} transition={{ duration: .45 }}>{children}</motion.div>;
  const chooseItem = (item: WebsiteOffering) => {
    setSelectedSlug(beautyServiceSlug(item, doc.offerings.indexOf(item)));
    onInteraction?.("contact");
  };

  return <div className={styles.site} data-layout="coffee" data-page-kind="landing" style={{ "--coffee-accent": doc.accent, "--coffee-paper": doc.paper, "--coffee-ink": doc.ink, "--beauty-accent": doc.ink, "--beauty-paper": doc.paper, "--beauty-ink": doc.ink } as CSSProperties} onKeyDown={event => {
    if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); }
  }}>
    <a className={styles.skip} href="#coffee-content">Skip to content</a>
    <header className={styles.header}>
      <a className={styles.brand} href="#home">{doc.logoUrl ? photo(doc.logoUrl, doc.brandName) : doc.brandName}</a>
      <nav className={menuOpen ? styles.navOpen : styles.nav} aria-label="Main website navigation">{navigation.map(([section, label]) => <a href={"#" + section} key={section} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav>
      <div className={styles.headerActions}><a className={styles.login} href={"https://business.jktl.com.ng" + templateLoginPath(template.id)} aria-label="Sign in to JKTL Business"><LogIn size={20} aria-hidden="true" /></a><span className={styles.desktopCta}>{button("contact", "Talk coffee")}</span><button ref={menuButton} type="button" className={styles.menuToggle} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}</button></div>
    </header>
    <main id="coffee-content">
      <section id="home" className={styles.hero}>
        <div className={styles.heroCopy}><p className={styles.eyebrow}><span />{doc.eyebrow}</p><motion.h1 initial={false} whileInView={reduceMotion ? undefined : { y: [12, 0] }} viewport={{ once: true }} transition={{ duration: .5 }}>{doc.headline.split("\n").map((line, index) => <span key={index}>{line}{" "}</span>)}</motion.h1><p className={styles.intro}>{doc.intro}</p><div className={styles.heroActions}>{button("offerings", doc.ctaLabel)}<a className={styles.understated} href="#about">Meet your coffee people <ArrowDown size={17} aria-hidden="true" /></a></div></div>
        <div className={styles.heroVisual}>{photo(doc.heroImage, "Latte art in a coffee cup", true)}<div className={styles.stamp}><Bean size={28} aria-hidden="true" /><span>A LITTLE<br />COFFEE JOY.</span></div><span className={styles.heroCaption}>GOOD THINGS ARE BREWING.</span></div>
      </section>
      <section className={styles.menuStrip} aria-label="Explore the coffee menu">{doc.offerings.map((item, index) => <a href="#offerings" onClick={() => setCategory(item.category || "All")} key={index}>{photo(item.image || doc.heroImage, "")}<span>{item.title}</span><ArrowUpRight size={17} aria-hidden="true" /></a>)}</section>
      {reveal(<><p className={styles.eyebrow}>A DAILY RITUAL. A LITTLE DIFFERENT.</p><h2>{doc.aboutTitle}</h2><p>{doc.aboutText}</p>{button("about", "This is our story", true)}</>, styles.manifesto)}
      <section id="offerings" className={styles.section}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE USUAL? OR SOMETHING NEW?</p><h2>{doc.offeringsTitle}</h2></div>{button("contact", "Ask the coffee team", true)}</div>
        <div className={styles.filters} role="group" aria-label="Filter the coffee menu">{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
        <p className={styles.menuCount} role="status">{visibleItems.length} {visibleItems.length === 1 ? "item" : "items"} to explore</p>
        <div className={styles.cards}>{visibleItems.map(item => <article key={beautyServiceSlug(item, doc.offerings.indexOf(item))}><a className={styles.cardImage} href="#contact" onClick={() => chooseItem(item)} tabIndex={-1} aria-hidden="true">{photo(item.image || doc.heroImage, "")}<span><ArrowUpRight size={24} aria-hidden="true" /></span></a><div className={styles.cardCopy}><p className={styles.eyebrow}>{item.category || "On the menu"}</p><h3>{item.title}</h3><p>{item.description}</p>{item.price && <p className={styles.price}>{item.price}</p>}<a className={styles.textLink} href="#contact" onClick={() => chooseItem(item)}>Ask about {item.title} <ArrowUpRight size={17} aria-hidden="true" /></a></div></article>)}</div>
      </section>
      <section id="approach" className={styles.process}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE LITTLE THINGS MATTER</p><h2>{doc.featureTitle}</h2></div><p>{doc.featureText}</p></div><div className={styles.processGrid}><ol>{doc.featureItems.map((item, index) => <li key={index}><span>0{index + 1}</span><p>{item}</p></li>)}</ol><div className={styles.processImage}>{photo(doc.gallery.find(item => item.src.includes("roasting"))?.src || doc.heroImage, "Coffee craft, from bean to cup")}<span><Bean size={24} aria-hidden="true" />A little craft in every cup.</span></div></div></section>
      <section id="about" className={styles.story}><div className={styles.storyPhoto}>{photo(doc.aboutImage || doc.heroImage, "African chefs at work in a professional kitchen")}</div>{reveal(<><p className={styles.eyebrow}>COFFEE IS BETTER TOGETHER</p><h2>{doc.aboutTitle}</h2><p>{doc.aboutText}</p>{button("contact", "Come say hello", true)}</>, styles.storyCopy)}</section>
      <section id="gallery" className={styles.section}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE SMALL MOMENTS, SAVOURED</p><h2>{doc.galleryTitle}</h2></div>{button("contact", "Make your own coffee moment", true)}</div><div className={styles.gallery}>{doc.gallery.map((item, index) => <figure key={index}>{photo(item.src, item.alt)}<figcaption>{item.alt}</figcaption></figure>)}</div></section>
      <section id="questions" className={styles.questions}><div><p className={styles.eyebrow}>A LITTLE MORE TO KNOW</p><h2>{doc.faqTitle}</h2><p>Something else on your mind?</p>{button("contact", "Ask the team", true)}</div><div>{doc.faqs.map((item, index) => <details key={index}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>
      <section className={styles.callout}><div><p className={styles.eyebrow}>YOUR NEXT COFFEE MOMENT</p><h2>{doc.contactTitle}</h2></div>{button("contact", "Say hello")}</section>
      <section id="contact" className={styles.enquiry}>
        <div><p className={styles.eyebrow}>GOOD CONVERSATIONS START HERE</p><h2>{selectedItem ? "Make it your next cup." : doc.contactTitle}</h2><p>{doc.contactText}</p>{selectedItem && <p className={styles.productNote}><Coffee size={22} aria-hidden="true" />Your enquiry: {selectedItem.title}</p>}{email && <p><a href={"mailto:" + email}>{email}</a></p>}{phone && <p><a href={"tel:" + phone}>{phone}</a></p>}{address && <p>{address}</p>}<p className={styles.small}>An enquiry starts a conversation. Orders, availability and prices are confirmed by the team.</p></div>
        <div className={styles.form}><h3>Leave us a note.</h3><BeautyRequestForm key={selectedSlug} kind="contact" contactLabel="A NOTE TO THE COFFEE TEAM" document={doc} initialMessage={selectedItem ? "I would like to enquire about " + selectedItem.title + "." : ""} onRequest={onRequest} /></div>
      </section>
      {businessSection && <section className={styles.section}>{businessSection}</section>}
    </main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}><div><a className={styles.footerBrand} href="#home">{doc.brandName}</a><p>{doc.eyebrow}</p><div className={styles.footerMark} aria-hidden="true"><Coffee size={60} strokeWidth={1} /></div></div><nav aria-label="Website sections">{[...navigation, ["questions", "Good questions"], ["contact", "Say hello"]].map(([section, label]) => <a key={section} href={"#" + section}>{label}</a>)}</nav><div className={styles.footerContact}><MessageCircle size={25} aria-hidden="true" /><h2>Make room<br />for a coffee.</h2><a className={styles.textLink} href="#contact">Let&apos;s talk <ArrowUpRight size={20} aria-hidden="true" /></a></div></div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} {doc.brandName}</span>{(preview || doc.demoContent) && <span>Sample menu & editorial photography</span>}{!hideBranding && <a href="https://jktl.com.ng" target="_blank" rel="noopener noreferrer">Built with JKTL <ArrowUpRight size={15} aria-hidden="true" /></a>}</div>
    </footer>
  </div>;
}
