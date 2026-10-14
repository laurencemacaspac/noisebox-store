"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";

const slides = [
  { eyebrow: "FOR DJS", line1: "Fuel your", line2: "next set.", description: "Find vinyl, CDs, and rare gems from independent sellers around the world.", image: "/hero/slide-1.webp" },
  { eyebrow: "FOR HOME LISTENERS", line1: "A deeper", line2: "way to listen.", description: "Build your collection with vinyl, CDs, and unique music merch.", image: "/hero/slide-2.webp" },
  { eyebrow: "FOR COLLECTORS", line1: "Rare finds.", line2: "Real music.", description: "Discover limited editions, first pressings, box sets, and more from independent sellers.", image: "/hero/slide-3.webp" },
];

export default function HeroSlideshow() {
  const [active, setActive] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".nb-header");
    if (!header) return;

    const measure = () => setHeaderHeight(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const go = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);
  const heroStyle = { "--nb-header-height": `${headerHeight}px` } as CSSProperties;

  return (
    <section className="nb-hero" style={heroStyle} aria-label="Discover music at Noisebox" aria-roledescription="carousel">
      {slides.map((slide, index) => (
        <div key={slide.eyebrow} className={`nb-hero-panel ${index === active ? "is-active" : ""}`} aria-hidden={index !== active} style={{ backgroundImage: `url('${slide.image}')` }}>
          <div className="nb-hero-inner">
            <p className="nb-hero-eyebrow">{slide.eyebrow}</p>
            <h1>{slide.line1}<br /><span>{slide.line2}</span></h1>
            <p className="nb-hero-description">{slide.description}</p>
            <div className="nb-hero-actions">
              <Link href="/#shop" className="nb-hero-primary" tabIndex={index === active ? 0 : -1}>EXPLORE MUSIC</Link>
              <Link href="/seller" className="nb-hero-secondary" tabIndex={index === active ? 0 : -1}>START SELLING</Link>
            </div>
          </div>
        </div>
      ))}
      <button className="nb-hero-arrow nb-hero-prev" onClick={() => go(-1)} aria-label="Previous slide">‹</button>
      <button className="nb-hero-arrow nb-hero-next" onClick={() => go(1)} aria-label="Next slide">›</button>
      <div className="nb-hero-dots" aria-label="Choose slide">
        {slides.map((slide, index) => <button key={slide.eyebrow} type="button" onClick={() => setActive(index)} aria-label={`Show slide ${index + 1}: ${slide.eyebrow}`} aria-current={active === index ? "true" : undefined} className={active === index ? "is-active" : ""}>{String(index + 1).padStart(2, "0")}</button>)}
      </div>
    </section>
  );
}
