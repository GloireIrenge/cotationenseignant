import "./globals.css";

export const metadata = {
  title: "Cota — Évaluation des enseignements",
  description: "Une plateforme simple et confidentielle pour évaluer la qualité des enseignements."
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
