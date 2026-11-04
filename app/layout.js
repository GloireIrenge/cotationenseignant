import "./globals.css";

export const metadata = {
  title: "UNITECH — Évaluation des enseignements",
  description: "La plateforme UNITECH pour évaluer la qualité des enseignements.",
  icons: { icon: "/unitech-logo.svg" }
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
