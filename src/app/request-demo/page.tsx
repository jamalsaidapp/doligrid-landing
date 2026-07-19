import type { Metadata } from "next";
import Header from "../components/Header";
import DemoRequestForm from "./DemoRequestForm";

export const metadata: Metadata = {
  title: "Demander un essai | DoliGrid ERP",
  description:
    "Demandez un essai de DoliGrid ERP et échangez avec notre équipe sur les besoins de votre entreprise.",
};

export default function RequestDemoPage() {
  return (
    <>
      <Header />
      <main className="demo-page">
        <div className="demo-orb demo-orb-one" aria-hidden="true" />
        <div className="demo-orb demo-orb-two" aria-hidden="true" />

        <div className="container demo-layout">
          <section className="demo-intro" aria-labelledby="demo-title">
            <p className="eyebrow"><span aria-hidden="true">✦</span>Votre essai DoliGrid</p>
            <h1 id="demo-title">Découvrez un ERP pensé pour toute votre entreprise.</h1>
            <p className="demo-lead">
              Présentez-nous votre contexte. Notre équipe vous aidera à identifier les
              fonctionnalités adaptées à vos opérations.
            </p>
            <ul className="demo-benefits">
              <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Échange centré sur vos besoins</li>
              <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Présentation adaptée à votre activité</li>
              <li><i className="bi bi-check-circle-fill" aria-hidden="true" />Aucun engagement</li>
            </ul>
          </section>

          <section className="demo-card" aria-labelledby="form-title">
            <div className="demo-card-heading">
              <span className="demo-card-icon" aria-hidden="true">
                <i className="bi bi-chat-square-text" />
              </span>
              <div>
                <p>Parlons de votre projet</p>
                <h2 id="form-title">Demander un essai</h2>
              </div>
            </div>
            <DemoRequestForm />
          </section>
        </div>
      </main>
    </>
  );
}
