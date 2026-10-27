"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function getRespondentId(token) {
  const key = `cota-respondent-${token}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export default function EvaluationPage() {
  const { token } = useParams();
  const [evaluation, setEvaluation] = useState(null);
  const [ratings, setRatings] = useState({});
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !token) {
      setStatus("unavailable");
      return;
    }
    let active = true;
    supabase.rpc("get_public_evaluation", { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data) {
        setStatus("not-found");
        return;
      }
      setEvaluation(data);
      setStatus("ready");
    });
    return () => { active = false; };
  }, [token]);

  const complete = evaluation?.criteria?.length && evaluation.criteria.every((criterion) => Number.isInteger(ratings[criterion.id]));
  const percentage = complete
    ? Math.round((Object.values(ratings).reduce((sum, score) => sum + score, 0) / (evaluation.criteria.length * 10)) * 100)
    : 0;

  async function submit(event) {
    event.preventDefault();
    if (!complete || sending) return;
    setSending(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("submit_public_evaluation", {
        p_token: token,
        p_respondent_id: getRespondentId(token),
        p_ratings: evaluation.criteria.map((criterion) => ({
          criterion_id: criterion.id,
          value: ratings[criterion.id]
        }))
      });
      if (error) throw error;
      if (!data?.ok) {
        setMessage(data?.error || "Votre réponse n’a pas pu être enregistrée.");
        return;
      }
      setStatus("submitted");
    } catch (error) {
      setMessage(error.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  if (status === "loading") return <main className="evaluation-shell"><div className="loading-card">Chargement de l’évaluation…</div></main>;
  if (status === "unavailable") return <MessagePage title="Configuration requise" text="L’application n’est pas encore reliée à Supabase. Contactez l’administrateur de la plateforme." />;
  if (status === "not-found") return <MessagePage title="Lien indisponible" text="Cette évaluation n’existe pas ou n’est plus ouverte." />;
  if (status === "submitted") return <main className="evaluation-shell"><div className="success-card"><span className="success-icon">✓</span><span className="eyebrow">ÉVALUATION ENREGISTRÉE</span><h1>Merci pour votre retour !</h1><p>Votre réponse a bien été transmise de manière anonyme.</p><div className="result-score"><strong>{percentage}%</strong><span>Votre appréciation globale</span></div><Link className="text-link" href="/">Retour à l’accueil ↗</Link></div></main>;

  return (
    <main className="evaluation-shell">
      <header className="evaluation-header">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>Cota<span className="brand-dot">.</span></span></Link>
        <span className="privacy-badge"><span>●</span> Réponse anonyme</span>
      </header>
      <div className="evaluation-content">
        <div className="evaluation-intro">
          <span className="eyebrow">ÉVALUATION DU COURS</span>
          <h1>Votre avis<br /><span>fait la différence.</span></h1>
          <p>Attribuez une note de 0 à 10 à chaque critère. Vos réponses sont confidentielles et seront utilisées pour améliorer la qualité des cours.</p>
        </div>
        <aside className="course-card">
          <div className="course-card-icon">✳</div>
          <div><span className="course-label">ENSEIGNANT</span><h2>{evaluation.teacher.name}</h2><p>{evaluation.teacher.academic_grade || "Enseignant"}</p></div>
          <div className="course-divider" />
          <div><span className="course-label">COURS</span><h3>{evaluation.course.title}</h3><p>{[evaluation.course.domain, evaluation.course.promotion].filter(Boolean).join(" · ")}</p></div>
        </aside>

        <form className="rating-form" onSubmit={submit}>
          <div className="form-heading"><div><span className="eyebrow">LES CRITÈRES</span><h2>Comment évaluez-vous ce cours ?</h2></div><span className="rating-scale">NOTES DE 0 À 10</span></div>
          <div className="criteria-list">
            {evaluation.criteria.map((criterion, index) => (
              <fieldset className="criterion-card" key={criterion.id}>
                <legend><span className="criterion-number">{String(index + 1).padStart(2, "0")}</span><span>{criterion.label}<i aria-label="obligatoire">*</i></span></legend>
                <div className="score-options" role="group" aria-label={`Note pour ${criterion.label}`}>
                  {Array.from({ length: 11 }, (_, score) => (
                    <button className={ratings[criterion.id] === score ? "score-option selected" : "score-option"} key={score} type="button" onClick={() => setRatings((current) => ({ ...current, [criterion.id]: score }))} aria-pressed={ratings[criterion.id] === score}>{score}</button>
                  ))}
                </div>
                <div className="score-hints"><span>Pas du tout satisfait</span><span>Très satisfait</span></div>
              </fieldset>
            ))}
          </div>
          <div className="submit-panel">
            <div className="live-score"><span>VOTRE APPRÉCIATION GLOBALE</span><strong>{complete ? `${percentage}%` : "—"}</strong><small>{complete ? "Moyenne de vos notes" : "Complétez tous les critères"}</small></div>
            <div className="submit-action"><p><span>⌑</span> Vos réponses restent anonymes.</p><button className="button button-primary" type="submit" disabled={!complete || sending}>{sending ? "Envoi en cours…" : "Envoyer mon évaluation"} <span aria-hidden="true">↗</span></button></div>
          </div>
          {message && <p className="form-error" role="alert">{message}</p>}
        </form>
      </div>
      <footer className="evaluation-footer">Cota · La qualité de l’enseignement se construit ensemble.</footer>
    </main>
  );
}

function MessagePage({ title, text }) {
  return <main className="evaluation-shell"><div className="success-card"><span className="eyebrow">COTA</span><h1>{title}</h1><p>{text}</p><Link className="text-link" href="/">Retour à l’accueil ↗</Link></div></main>;
}
