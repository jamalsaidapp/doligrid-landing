"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const navigation = [
  { label: "Accueil", href: "/#accueil" },
  { label: "Fonctionnalités", href: "/#fonctionnalites" },
  { label: "Accompagnement", href: "/#accompagnement" },
  { label: "Tarifs", href: "/#tarifs" },
  { label: "Sécurité", href: "/#securite" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closeMenu = () => setOpen(false);
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, []);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/#accueil" aria-label="DoliGrid ERP — Accueil">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>DoliGrid <strong>ERP</strong></span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="navigation-principale"
          onClick={() => setOpen((value) => !value)}
        >
          <i className={`bi ${open ? "bi-x-lg" : "bi-list"}`} aria-hidden="true" />
        </button>

        <nav
          id="navigation-principale"
          className={`main-nav ${open ? "is-open" : ""}`}
          aria-label="Navigation principale"
        >
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link className="button button-small" href="/request-demo" onClick={() => setOpen(false)}>
            Essai Gratuitement
            <i className="bi bi-arrow-up-right" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
