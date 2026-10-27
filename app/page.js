import Link from "next/link";

const highlights = [
  { number: "01", title: "Un avis qui compte", text: "Évaluez chaque aspect du cours avec une note claire sur 10." },
  { number: "02", title: "Une démarche confidentielle", text: "Les réponses sont anonymes et consultables uniquement par l’administration." },
  { number: "03", title: "Des résultats utiles", text: "Les résultats sont calculés automatiquement et exportables dans Excel." }
];

export default function Home() {
  return (
    <main>
      <nav className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">C</span>
          <span>Cota<span className="brand-dot">.</span></span>
        </Link>
        <Link className="nav-link" href="/admin">Espace administration <span aria-hidden="true">↗</span></Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> ÉVALUATION DES ENSEIGNEMENTS</span>
          <h1>Votre regard<br />fait <span>progresser</span><br />les cours.</h1>
          <p>Partagez votre expérience de cours en quelques minutes. Votre retour aide les enseignants et l’établissement à faire évoluer la qualité de l’enseignement.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#comment-ca-marche">Découvrir la démarche <span aria-hidden="true">↓</span></a>
            <span className="hero-note"><span className="lock-icon" aria-hidden="true">⌑</span> Anonyme &amp; confidentiel</span>
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration de la cotation d'un cours">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-card">
            <div className="art-card-top"><span className="art-label">VOTRE ÉVALUATION</span><span className="art-menu">•••</span></div>
            <div className="art-score">8<span>/10</span></div>
            <div className="art-progress"><span /></div>
            <div className="art-stars" aria-label="8 sur 10">★ ★ ★ ★ ★</div>
            <div className="art-rule" />
            <div className="art-row"><span className="art-check">✓</span><span>Contenu du cours</span><b>9/10</b></div>
            <div className="art-row"><span className="art-check">✓</span><span>Communication</span><b>8/10</b></div>
            <div className="art-row"><span className="art-check">✓</span><span>Interaction</span><b>7/10</b></div>
            <div className="art-foot"><span className="art-avatar">É</span><span>Votre avis est précieux</span><span className="art-heart">✦</span></div>
          </div>
          <div className="art-float"><span className="float-icon">↗</span><span><b>100%</b><small>Votre voix compte</small></span></div>
          <div className="art-sparkle sparkle-one">✳</div>
          <div className="art-sparkle sparkle-two">✦</div>
        </div>
        <div className="hero-bottom"><span>ENSEMBLE, FAISONS GRANDIR LA QUALITÉ</span><span>↓</span></div>
      </section>

      <section id="comment-ca-marche" className="features-section">
        <div className="section-heading">
          <span className="eyebrow">SIMPLE, UTILE, CONFIDENTIEL</span>
          <h2>Un retour constructif,<br /><span>en toute simplicité.</span></h2>
        </div>
        <div className="feature-grid">
          {highlights.map((item) => (
            <article className="feature-card" key={item.number}>
              <span className="feature-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span className="feature-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
        <div className="student-cta">
          <div><span className="eyebrow">VOUS AVEZ REÇU UN LIEN ?</span><h2>Commencez votre évaluation.</h2><p>Ouvrez simplement le lien transmis par votre établissement pour donner votre avis.</p></div>
          <span className="cta-mark" aria-hidden="true">C.</span>
        </div>
      </section>

      <footer className="site-footer"><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cota<span className="brand-dot">.</span></span></Link><span>La qualité de l’enseignement se construit ensemble.</span><Link href="/admin">Administration ↗</Link></footer>
    </main>
  );
}
