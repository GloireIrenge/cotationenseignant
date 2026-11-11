"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

const CRITERIA = [
  "Régularité",
  "Respect de la charge horaire",
  "Présentation du contenu et des objectifs du cours",
  "Maîtrise et communication de la matière",
  "Maîtrise de la langue française",
  "Communication de la bibliographie du cours",
  "Utilisation des TIC (outils informatiques)",
  "Organisation des interrogations",
  "Syllabus du cours livré à temps",
  "Sens de responsabilité",
  "Interaction et participation des étudiants"
];

const INITIAL_CAMPAIGN = {
  first_name: "",
  post_name: "",
  last_name: "",
  academic_grade: "",
  course_title: "",
  domain: "",
  promotion: "",
  evaluation_title: ""
};

async function callAdminApi(password, payload) {
  const response = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${password}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La requête a échoué.");
  return result;
}

function teacherName(teacher) {
  return [teacher?.first_name, teacher?.post_name, teacher?.last_name].filter(Boolean).join(" ");
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [campaign, setCampaign] = useState(INITIAL_CAMPAIGN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const savedPassword = sessionStorage.getItem("unitech-admin-password");
    if (!savedPassword) {
      setAuthChecked(true);
      return;
    }
    setPassword(savedPassword);
    callAdminApi(savedPassword, { action: "dashboard" })
      .then((data) => {
        setEvaluations(data.evaluations || []);
        setSpreadsheetUrl(data.spreadsheet_url || "");
      })
      .catch((loadError) => {
        sessionStorage.removeItem("unitech-admin-password");
        setPassword("");
        setError(loadError.message);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await callAdminApi(passwordInput, { action: "dashboard" });
      sessionStorage.setItem("unitech-admin-password", passwordInput);
      setPassword(passwordInput);
      setEvaluations(data.evaluations || []);
      setSpreadsheetUrl(data.spreadsheet_url || "");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
      setAuthChecked(true);
    }
  }

  async function refreshDashboard() {
    const data = await callAdminApi(password, { action: "dashboard" });
    setEvaluations(data.evaluations || []);
    setSpreadsheetUrl(data.spreadsheet_url || "");
  }

  async function createEvaluation(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await callAdminApi(password, { action: "createEvaluation", ...campaign });
      setCampaign(INITIAL_CAMPAIGN);
      await refreshDashboard();
      setNotice("Le formulaire Google est prêt. Vous pouvez partager son lien.");
      if (result.evaluation?.form_url) {
        navigator.clipboard.writeText(result.evaluation.form_url).catch(() => {});
      }
    } catch (createError) {
      setError(createError.message || "Impossible de créer le formulaire.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEvaluation(evaluation) {
    setError("");
    try {
      await callAdminApi(password, { action: "toggleEvaluation", evaluation_id: evaluation.id });
      await refreshDashboard();
    } catch (toggleError) {
      setError(toggleError.message);
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Lien Google Forms copié.");
    } catch {
      setError("Impossible de copier le lien depuis ce navigateur.");
    }
  }

  function exportEvaluation(evaluation) {
    const rows = evaluation.responses.map((response, index) => ({
      "N° réponse": index + 1,
      Enseignant: teacherName(evaluation.teacher),
      "Grade académique": evaluation.teacher.academic_grade,
      Cours: evaluation.course.title,
      Domaine: evaluation.course.domain,
      Promotion: evaluation.course.promotion,
      ...Object.fromEntries(CRITERIA.map((criterion) => [criterion, response.ratings[criterion] ?? ""])),
      "Pourcentage": `${response.percentage}%`,
      "Date de réception": new Date(response.created_at).toLocaleString("fr-FR")
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Cotations");
    XLSX.writeFile(workbook, `cotation-${evaluation.course.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`);
  }

  const totalResponses = evaluations.reduce((sum, evaluation) => sum + evaluation.responses.length, 0);
  const globalAverage = totalResponses
    ? Math.round(evaluations.reduce((sum, evaluation) => sum + evaluation.responses.reduce((responseSum, response) => responseSum + response.percentage, 0), 0) / totalResponses)
    : 0;

  if (!authChecked) return <main className="admin-shell"><p className="loading-card">Chargement…</p></main>;
  if (!password) return (
    <main className="login-shell">
      <Link className="brand" href="/"><img className="brand-logo" src="/unitech-logo.svg" alt="" /><span>UNITECH</span></Link>
      <div className="login-card">
        <span className="eyebrow">ESPACE ADMINISTRATION</span>
        <h1>Connexion<span>.</span></h1>
        <p>Entrez le mot de passe administrateur pour gérer les campagnes de cotation.</p>
        <form className="admin-form" onSubmit={signIn}>
          <label>Mot de passe<input type="password" autoComplete="current-password" value={passwordInput} onChange={(event) => setPasswordInput(event.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary form-submit" disabled={busy}>{busy ? "Connexion…" : "Ouvrir l’administration"}<span>↗</span></button>
        </form>
        <Link className="text-link" href="/">← Retour à l’accueil</Link>
      </div>
    </main>
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="brand" href="/"><img className="brand-logo" src="/unitech-logo.svg" alt="" /><span>UNITECH</span></Link>
        <div className="admin-user"><span className="admin-user-dot" /> Administration <button onClick={() => { sessionStorage.removeItem("unitech-admin-password"); setPassword(""); }}>Se déconnecter ↗</button></div>
      </header>
      <section className="admin-main">
        <div className="admin-heading"><div><span className="eyebrow">TABLEAU DE BORD</span><h1>Bonjour, <span>Admin.</span></h1><p>Créez un formulaire et partagez le lien aux étudiants.</p></div><a className="button button-outline" href={spreadsheetUrl} target="_blank" rel="noreferrer" aria-disabled={!spreadsheetUrl}>Ouvrir Google Sheets ↗</a></div>
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        <div className="stats-grid">
          <StatCard label="Enseignants évalués" value={new Set(evaluations.map((evaluation) => evaluation.teacher.id)).size} mark="✳" />
          <StatCard label="Formulaires créés" value={evaluations.length} mark="▤" />
          <StatCard label="Réponses reçues" value={totalResponses} mark="↗" />
          <StatCard label="Moyenne globale" value={`${globalAverage}%`} mark="◎" />
        </div>

        <section className="admin-panel create-evaluation-panel">
          <div className="panel-heading"><div><span className="eyebrow">NOUVELLE COTATION</span><h2>Enseignant, cours et formulaire</h2><p>Un seul envoi crée le formulaire Google et son lien étudiant.</p></div><span className="panel-icon">＋</span></div>
          <form className="admin-form campaign-form" onSubmit={createEvaluation}>
            <div className="input-row"><label>Prénom<input value={campaign.first_name} onChange={(event) => setCampaign({ ...campaign, first_name: event.target.value })} required /></label><label>Post-nom<input value={campaign.post_name} onChange={(event) => setCampaign({ ...campaign, post_name: event.target.value })} required /></label><label>Nom<input value={campaign.last_name} onChange={(event) => setCampaign({ ...campaign, last_name: event.target.value })} required /></label></div>
            <div className="input-row"><label>Grade académique<input placeholder="Ex. Professeur" value={campaign.academic_grade} onChange={(event) => setCampaign({ ...campaign, academic_grade: event.target.value })} required /></label><label>Intitulé du cours<input value={campaign.course_title} onChange={(event) => setCampaign({ ...campaign, course_title: event.target.value })} required /></label><label>Domaine<input value={campaign.domain} onChange={(event) => setCampaign({ ...campaign, domain: event.target.value })} required /></label><label>Promotion<input placeholder="Ex. L2 / G3" value={campaign.promotion} onChange={(event) => setCampaign({ ...campaign, promotion: event.target.value })} required /></label></div>
            <div className="input-row campaign-submit-row"><label>Intitulé de la cotation<input placeholder="Ex. Premier semestre 2026" value={campaign.evaluation_title} onChange={(event) => setCampaign({ ...campaign, evaluation_title: event.target.value })} required /></label><button className="button button-primary form-submit" disabled={busy}>{busy ? "Création du formulaire…" : "Créer et copier le lien"}<span>↗</span></button></div>
          </form>
        </section>

        <section className="results-section">
          <div className="results-heading"><div><span className="eyebrow">RÉSULTATS AUTOMATIQUES</span><h2>Cotations par enseignant</h2></div><span className="results-total">{evaluations.length} campagne{evaluations.length !== 1 ? "s" : ""}</span></div>
          {!evaluations.length ? <div className="empty-state"><span>✳</span><h3>Aucune cotation pour le moment</h3><p>Créez votre première campagne pour générer un formulaire étudiant.</p></div> : (
            <div className="evaluation-list">{evaluations.map((evaluation) => {
              const responses = evaluation.responses || [];
              const average = responses.length ? Math.round(responses.reduce((sum, response) => sum + response.percentage, 0) / responses.length) : 0;
              return <article className="evaluation-result" key={evaluation.id}>
                <div className="evaluation-result-head"><div className="result-course-icon">▤</div><div className="result-course-info"><span className="course-label">{evaluation.course.promotion} · {evaluation.course.domain} · {evaluation.title}</span><h3>{evaluation.course.title}</h3><p>{teacherName(evaluation.teacher)} · {evaluation.teacher.academic_grade}</p></div><span className={evaluation.is_active ? "status-pill active" : "status-pill"}>{evaluation.is_active ? "Ouverte" : "Fermée"}</span></div>
                <div className="evaluation-link-row"><a className="link-display" href={evaluation.form_url} target="_blank" rel="noreferrer">{evaluation.form_url}</a><button className="button button-outline small-button" onClick={() => copyLink(evaluation.form_url)}>Copier le lien ↗</button><button className="text-button" onClick={() => toggleEvaluation(evaluation)}>{evaluation.is_active ? "Fermer" : "Ouvrir"}</button></div>
                <div className="result-summary"><div><strong>{responses.length}</strong><span>réponse{responses.length !== 1 ? "s" : ""}</span></div><div><strong>{responses.length ? `${average}%` : "—"}</strong><span>moyenne de l’enseignant</span></div><button className="button button-primary export-button" disabled={!responses.length} onClick={() => exportEvaluation(evaluation)}>Exporter Excel ↓</button></div>
                {responses.length > 0 && <details className="responses-details"><summary>Voir les pourcentages par étudiant</summary><div className="table-scroll"><table><thead><tr><th>Réponse</th>{CRITERIA.map((criterion) => <th key={criterion}>{criterion}</th>)}<th>Pourcentage</th><th>Reçue le</th></tr></thead><tbody>{responses.map((response, index) => <tr key={response.id}><td>#{String(index + 1).padStart(3, "0")}</td>{CRITERIA.map((criterion) => <td key={criterion}>{response.ratings[criterion] ?? "—"}/10</td>)}<td><b>{response.percentage}%</b></td><td>{new Date(response.created_at).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table></div></details>}
              </article>;
            })}</div>
          )}
        </section>
      </section>
      <footer className="admin-footer"><span>UNITECH · Espace administration</span><Link href="/">Voir la page d’accueil ↗</Link></footer>
    </main>
  );
}

function StatCard({ label, value, mark }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><i>{mark}</i></div>;
}
