import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://doligrid.com"),
  title: "DoliGrid ERP | Pilotez toute votre entreprise",
  description:
    "DoliGrid ERP unifie ventes, finances, stocks, ressources humaines et projets sur une plateforme fiable et sécurisée.",
  openGraph: {
    title: "DoliGrid ERP | Une seule source de vérité",
    description:
      "L’ERP complet pour piloter vos ventes, finances, stocks, équipes et projets.",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${sora.variable} ${dmSans.variable}`}>{children}</body>
    </html>
  );
}
