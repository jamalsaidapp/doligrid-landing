import Link from "next/link";
import Header from "./components/Header";
import PricingCheckout, {
  type CheckoutPlan,
} from "./components/PricingCheckout";
import { getCoreLandingUrl } from "./api/leads/origin-policy.js";

const capabilities = [
  {
    icon: "bi-people",
    title: "CRM & Ventes",
    description:
      "Suivez vos prospects, opportunités et relations clients dans un seul espace. Accélérez vos cycles commerciaux.",
  },
  {
    icon: "bi-receipt",
    title: "Facturation & Paiements",
    description:
      "Éditez des factures professionnelles, gérez les abonnements et suivez les encaissements avec une traçabilité complète.",
  },
  {
    icon: "bi-box-seam",
    title: "Gestion des Stocks",
    description:
      "Pilotez vos niveaux de stock, entrepôts et catalogues produits avec une vision temps réel de vos opérations.",
  },
  {
    icon: "bi-person-badge",
    title: "Ressources Humaines",
    description:
      "Centralisez les fiches collaborateurs, congés et organigramme avec des droits d’accès par rôle.",
  },
  {
    icon: "bi-kanban",
    title: "Suivi de Projets",
    description:
      "Planifiez les tâches, assignez les équipes et suivez l’avancement pour tenir vos délais.",
  },
  {
    icon: "bi-bar-chart-line",
    title: "Analytique & Reporting",
    description:
      "Tableaux de bord et rapports opérationnels pour des décisions fiables et argumentées.",
  },
];

const fallbackPlans: CheckoutPlan[] = [
  {
    id: "fallback-auto-entrepreneur",
    name: "Auto-Entrepreneur",
    priceLabel: "120",
    features: [
      "Utilisateurs max : 1",
      "Stockage max : 1 Go",
      "Clients max : 15",
      "Fournisseurs max : 5",
      "Support 24/7",
      "Formation",
      "Sauvegarde",
    ],
  },
  {
    id: "fallback-agence",
    name: "Agence",
    priceLabel: "240",
    features: [
      "Utilisateurs max : 2",
      "Stockage max : 2 Go",
      "Clients max : 25",
      "Fournisseurs max : 15",
      "Support 24/7",
      "Formation",
      "Sauvegarde",
    ],
  },
  {
    id: "fallback-entreprise",
    name: "Entreprise",
    priceLabel: "600",
    popular: true,
    features: [
      "Utilisateurs max : 5",
      "Stockage max : 5 Go",
      "Clients max : 150",
      "Fournisseurs max : 100",
      "Support 24/7",
      "Formation",
      "Sauvegarde",
    ],
  },
  {
    id: "fallback-entreprise-plus",
    name: "Entreprise+",
    priceLabel: "1 200",
    features: [
      "Utilisateurs max : ∞",
      "Stockage max : 10 Go",
      "Clients max : ∞",
      "Fournisseurs max : ∞",
      "Support 24/7",
      "Formation",
      "Sauvegarde",
    ],
  },
];

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function featureLabels(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features
      .map((f) => {
        if (typeof f === "string") return f;
        if (f && typeof f === "object" && typeof (f as { text?: string }).text === "string") {
          return (f as { included?: boolean; text: string }).included === false
            ? null
            : (f as { text: string }).text;
        }
        return null;
      })
      .filter((t): t is string => !!t);
  }
  if (features && typeof features === "object") {
    const obj = features as Record<string, unknown>;
    if (Array.isArray(obj.marketingFeatures)) {
      return featureLabels(obj.marketingFeatures);
    }
  }
  return [];
}

async function loadCheckoutPlans(): Promise<{
  plans: CheckoutPlan[];
  checkoutEnabled: boolean;
}> {
  try {
    const landingUrl = getCoreLandingUrl(
      process.env.CORE_API_URL,
      process.env.PRODUCT_SLUG || "doligrid",
    );
    const res = await fetch(landingUrl, { next: { revalidate: 60 } });
    if (!res.ok) {
      return { plans: fallbackPlans, checkoutEnabled: false };
    }
    const data = (await res.json()) as {
      plans?: Array<{
        id: string;
        name: string;
        slug?: string;
        title?: string;
        priceCents?: number;
        features?: unknown;
      }>;
    };
    const remote = Array.isArray(data.plans) ? data.plans : [];
    if (!remote.length) {
      return { plans: fallbackPlans, checkoutEnabled: false };
    }

    const byKey = new Map(
      remote.map((p) => [normalizeKey(p.slug || p.name || p.title || ""), p]),
    );

    const merged = fallbackPlans.map((fallback, index) => {
      const match =
        byKey.get(normalizeKey(fallback.name)) ||
        byKey.get(normalizeKey(fallback.slug || "")) ||
        remote[index];
      if (!match?.id) return fallback;
      const cents = Number(match.priceCents || 0);
      const priceLabel =
        cents > 0
          ? String(Math.round(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
          : fallback.priceLabel;
      const features = featureLabels(match.features);
      return {
        id: match.id,
        name: match.title || match.name || fallback.name,
        slug: match.slug,
        priceLabel,
        popular: fallback.popular,
        features: features.length ? features : fallback.features,
      } satisfies CheckoutPlan;
    });

    const allMatched = merged.every((p) => !p.id.startsWith("fallback-"));
    if (allMatched) {
      return { plans: merged, checkoutEnabled: true };
    }
    // Manager returned plans that don't align with marketing names — still enable checkout on remote IDs.
    return {
      plans: remote.map((p, index) => ({
        id: p.id,
        name: p.title || p.name,
        slug: p.slug,
        priceLabel: String(Math.round(Number(p.priceCents || 0) / 100)).replace(
          /\B(?=(\d{3})+(?!\d))/g,
          " ",
        ),
        popular: index === Math.min(2, remote.length - 1),
        features: featureLabels(p.features),
      })),
      checkoutEnabled: true,
    };
  } catch {
    return { plans: fallbackPlans, checkoutEnabled: false };
  }
}

const trustItems = [
  {
    icon: "bi-database-lock",
    title: "Multi-locataire",
    description:
      "Isolation stricte des données pour chaque organisation sur une plateforme partagée.",
  },
  {
    icon: "bi-shield-check",
    title: "Contrôle d’accès",
    description:
      "Permissions par rôle et connexions sécurisées pour limiter l’accès au strict nécessaire.",
  },
  {
    icon: "bi-headset",
    title: "Support expert",
    description:
      "Accompagnement réactif pour garder vos opérations disponibles quand chaque minute compte.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  light = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  light?: boolean;
}) {
  return (
    <div className={`section-heading ${light ? "section-heading-light" : ""}`}>
      <p className="eyebrow"><span aria-hidden="true">✦</span>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export default async function Home() {
  const { plans, checkoutEnabled } = await loadCheckoutPlans();

  return (
    <>
      <Header />
      <main>
        <section id="accueil" className="hero" aria-labelledby="hero-title">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="hero-kicker">
                <span><i className="bi bi-stars" aria-hidden="true" /></span>
                L’ERP qui aligne toute votre entreprise
              </p>
              <h1 id="hero-title">
                Pilotez toute votre entreprise depuis un seul ERP.
              </h1>
              <div className="hero-actions">
                <a className="button button-accent" href="#tarifs">
                  Découvrir les offres
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </a>
                <a className="text-link light-link" href="#fonctionnalites">
                  Explorer les fonctionnalités
                  <i className="bi bi-arrow-down" aria-hidden="true" />
                </a>
              </div>
              <ul className="hero-points" aria-label="Avantages clés">
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Données centralisées</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Accès sécurisé par rôle</li>
                <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Accompagnement expert</li>
              </ul>
            </div>

            <div className="dashboard-visual" aria-label="Aperçu illustré du tableau de bord DoliGrid ERP">
              <div className="dashboard-top">
                <div className="dashboard-logo">
                  <span className="brand-mark small" aria-hidden="true"><span /><span /><span /><span /></span>
                  DoliGrid
                </div>
                <div className="dashboard-search"><i className="bi bi-search" aria-hidden="true" />Rechercher</div>
                <div className="avatar" aria-hidden="true">DG</div>
              </div>
              <div className="dashboard-body">
                <aside className="dashboard-sidebar" aria-hidden="true">
                  {["bi-grid", "bi-people", "bi-receipt", "bi-box-seam", "bi-kanban"].map((icon, index) => (
                    <span className={index === 0 ? "active" : ""} key={icon}><i className={`bi ${icon}`} /></span>
                  ))}
                </aside>
                <div className="dashboard-content">
                  <div className="dash-title">
                    <div><small>Vue d’ensemble</small><strong>Bonjour, équipe</strong></div>
                    <span>Cette semaine <i className="bi bi-chevron-down" /></span>
                  </div>
                  <div className="metric-grid">
                    <div><span className="metric-icon green"><i className="bi bi-currency-exchange" /></span><small>Chiffre d’affaires</small><strong>128 400 Dh</strong><em>+12,4 %</em></div>
                    <div><span className="metric-icon purple"><i className="bi bi-person-plus" /></span><small>Nouveaux clients</small><strong>48</strong><em>+8,2 %</em></div>
                    <div><span className="metric-icon orange"><i className="bi bi-box-seam" /></span><small>Commandes</small><strong>326</strong><em>+16,8 %</em></div>
                  </div>
                  <div className="chart-card">
                    <div className="chart-heading"><strong>Performance</strong><span><i />Revenus</span></div>
                    <div className="chart" aria-hidden="true">
                      <span /><span /><span /><span />
                      <svg viewBox="0 0 500 130" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#1ad079" stopOpacity=".28" />
                            <stop offset="100%" stopColor="#1ad079" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path className="chart-fill" d="M0,112 C55,103 65,72 115,79 S190,111 235,59 S315,71 354,39 S430,50 500,7 L500,130 L0,130 Z" />
                        <path className="chart-line" d="M0,112 C55,103 65,72 115,79 S190,111 235,59 S315,71 354,39 S430,50 500,7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="floating-card floating-stock">
                <span className="metric-icon purple"><i className="bi bi-box2-heart" /></span>
                <div><small>Stock disponible</small><strong>92,8 %</strong></div>
              </div>
              <div className="floating-card floating-secure">
                <i className="bi bi-shield-check" aria-hidden="true" />
                <div><strong>Accès sécurisé</strong><small>Permissions actives</small></div>
              </div>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="section capabilities">
          <div className="container">
            <SectionHeading
              eyebrow="Fonctionnalités"
              title="Tout ce dont vos opérations ont besoin"
              description="Une suite ERP complète conçue pour les équipes qui exigent fiabilité, clarté et rapidité."
            />
            <div className="capability-grid">
              {capabilities.map((capability, index) => (
                <article className="capability-card" key={capability.title}>
                  <div className={`card-icon tone-${(index % 3) + 1}`}>
                    <i className={`bi ${capability.icon}`} aria-hidden="true" />
                  </div>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="accompagnement" className="section support">
          <div className="container">
            <div className="support-intro">
              <SectionHeading
                eyebrow="Accompagnement"
                title="Formation / Support"
                description="Notre équipe est à votre écoute pour vous proposer des projets de formation à partir d’une analyse de vos besoins."
              />
              <div className="support-note">
                <i className="bi bi-chat-heart" aria-hidden="true" />
                <span><strong>Un interlocuteur à votre écoute</strong>De l’analyse à l’adoption, nous avançons avec vos équipes.</span>
              </div>
            </div>
            <div className="support-grid">
              <article className="support-card training-card">
                <div>
                  <span className="support-number">01</span>
                  <p className="eyebrow">Développez vos compétences</p>
                  <h3>Formation sur mesure</h3>
                  <p>Diagnostic de vos besoins, parcours adapté à vos équipes et montée en compétence sur DoliGrid ERP.</p>
                  <a className="button button-dark" href="mailto:conseil@doligrid.com?subject=Formation%20DoliGrid%20ERP">
                    Parler à un conseiller <i className="bi bi-arrow-right" aria-hidden="true" />
                  </a>
                </div>
                <div className="support-art training-art" aria-hidden="true">
                  <span className="art-window"><i className="bi bi-play-fill" /></span>
                  <span className="art-person"><i className="bi bi-person-fill" /></span>
                  <span className="art-badge"><i className="bi bi-mortarboard-fill" /> Formation</span>
                </div>
              </article>
              <article className="support-card expert-card">
                <div>
                  <span className="support-number">02</span>
                  <p className="eyebrow">Restez opérationnel</p>
                  <h3>Support expert</h3>
                  <p>Une assistance réactive pour sécuriser vos opérations, résoudre les incidents et accompagner votre quotidien.</p>
                  <a className="button button-light" href="mailto:support@doligrid.com?subject=Demande%20de%20support">
                    Contacter le support <i className="bi bi-arrow-right" aria-hidden="true" />
                  </a>
                </div>
                <div className="support-art expert-art" aria-hidden="true">
                  <span className="pulse-ring"><i className="bi bi-headset" /></span>
                  <span className="status-pill"><i /> Équipe disponible</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="tarifs" className="section pricing">
          <div className="container">
            <SectionHeading
              eyebrow="Tarifs"
              title="Des offres claires à chaque étape"
              description="Commencez avec un essai gratuit. Évoluez quand votre équipe est prête — sans surprise."
            />
            <PricingCheckout plans={plans} checkoutEnabled={checkoutEnabled} />
          </div>
        </section>

        <section id="securite" className="section trust">
          <div className="container">
            <div className="trust-panel">
              <div className="trust-grid">
                <SectionHeading
                  light
                  eyebrow="Confiance & sécurité"
                  title="Conçu pour les équipes qui ne peuvent pas s’arrêter"
                  description="Accès par rôle, connexions chiffrées et infrastructure managée pour protéger et rendre vos données disponibles."
                />
                <div className="trust-items">
                  {trustItems.map((item) => (
                    <article key={item.title}>
                      <span><i className={`bi ${item.icon}`} aria-hidden="true" /></span>
                      <div><h3>{item.title}</h3><p>{item.description}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta" aria-labelledby="cta-title">
          <div className="container">
            <div className="cta-inner">
              <div>
                <p className="eyebrow"><span aria-hidden="true">✦</span>Prêt à avancer ?</p>
                <h2 id="cta-title">Donnez à vos équipes une vision claire et partagée.</h2>
              </div>
              <Link className="button button-accent" href="/request-demo">
                Demander un essai gratuit <i className="bi bi-arrow-right" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <a className="brand brand-light" href="#accueil" aria-label="DoliGrid ERP — Retour à l’accueil">
              <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
              <span>DoliGrid <strong>ERP</strong></span>
            </a>
            <p>Une plateforme ERP fiable pour réunir vos opérations et faire avancer vos équipes.</p>
            <a href="mailto:contact@doligrid.com">contact@doligrid.com</a>
          </div>
          <div>
            <h3>Produit</h3>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#securite">Sécurité</a>
          </div>
          <div>
            <h3>Accompagnement</h3>
            <a href="#accompagnement">Formation</a>
            <a href="mailto:support@doligrid.com">Support</a>
            <a href="mailto:conseil@doligrid.com">Conseil</a>
          </div>
          <div>
            <h3>Contact</h3>
            <a href="mailto:commercial@doligrid.com">Service commercial</a>
            <a href="mailto:contact@doligrid.com">Nous écrire</a>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>© {new Date().getFullYear()} DoliGrid ERP. Tous droits réservés.</p>
          <p>Des opérations plus simples. Des décisions plus fiables.</p>
        </div>
      </footer>
    </>
  );
}
