"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const INITIAL_TEACHER = { first_name: "", post_name: "", last_name: "", academic_grade: "" };
const INITIAL_COURSE = { teacher_id: "", title: "", domain: "", promotion: "" };

function teacherName(teacher) {
  return [teacher?.first_name, teacher?.post_name, teacher?.last_name].filter(Boolean).join(" ");
}

function responsePercentage(response, criteriaCount) {
  const values = response.ratings?.map((rating) => rating.value) || [];
  if (values.length !== criteriaCount || !criteriaCount) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / (criteriaCount * 10) * 100);
}

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [teacherForm, setTeacherForm] = useState(INITIAL_TEACHER);
  const [courseForm, setCourseForm] = useState(INITIAL_COURSE);
  const [evaluationForm, setEvaluationForm] = useState({ course_id: "", title: "" });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthChecked(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setIsAdmin(session ? null : false);
      if (!session) {
        setTeachers([]);
        setCourses([]);
        setEvaluations([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadDashboard(user);
  }, [user]);

  async function loadDashboard(currentUser) {
    setBusy(true);
    setError("");
    try {
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", currentUser.id).single();
      if (profileError) throw profileError;
      const allowed = profile.role === "admin";
      setIsAdmin(allowed);
      if (!allowed) return;
      const [teacherResult, courseResult, evaluationResult, criteriaResult] = await Promise.all([
        supabase.from("teachers").select("*").order("last_name"),
        supabase.from("courses").select("*, teachers(id, first_name, post_name, last_name, academic_grade)").order("created_at", { ascending: false }),
        supabase.from("evaluations").select("id, title, share_token, is_active, created_at, courses(id, title, domain, promotion, teachers(id, first_name, post_name, last_name, academic_grade)), responses(id, created_at, ratings(criterion_id, value))").order("created_at", { ascending: false }),
        supabase.from("criteria").select("id, label, position").order("position")
      ]);
      for (const result of [teacherResult, courseResult, evaluationResult, criteriaResult]) {
        if (result.error) throw result.error;
      }
      setTeachers(teacherResult.data || []);
      setCourses(courseResult.data || []);
      setEvaluations(evaluationResult.data || []);
      setCriteria(criteriaResult.data || []);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger les données.");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword(login);
    if (signInError) setError(signInError.message);
    setBusy(false);
  }

  async function createTeacher(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("teachers").insert(teacherForm);
    if (insertError) setError(insertError.message);
    else {
      setTeacherForm(INITIAL_TEACHER);
      setNotice("Enseignant ajouté.");
      await loadDashboard(user);
    }
    setBusy(false);
  }

  async function createCourse(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("courses").insert(courseForm);
    if (insertError) setError(insertError.message);
    else {
      setCourseForm(INITIAL_COURSE);
      setNotice("Cours ajouté.");
      await loadDashboard(user);
    }
    setBusy(false);
  }

  async function createEvaluation(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("evaluations").insert({
      course_id: evaluationForm.course_id,
      title: evaluationForm.title.trim()
    });
    if (insertError) setError(insertError.message);
    else {
      setEvaluationForm({ course_id: "", title: "" });
      setNotice("Lien d’évaluation créé.");
      await loadDashboard(user);
    }
    setBusy(false);
  }

  async function toggleEvaluation(evaluation) {
    const { error: updateError } = await supabase.from("evaluations").update({ is_active: !evaluation.is_active }).eq("id", evaluation.id);
    if (updateError) setError(updateError.message);
    else await loadDashboard(user);
  }

  async function copyLink(token) {
    setError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/eval/${token}`);
      setNotice("Lien copié dans le presse-papiers.");
    } catch (copyError) {
      setError(copyError.message || "Impossible de copier le lien depuis ce navigateur.");
    }
  }

  function exportEvaluation(evaluation) {
    const course = evaluation.courses;
    const rows = (evaluation.responses || []).map((response, index) => {
      const scores = Object.fromEntries((response.ratings || []).map((rating) => [rating.criterion_id, rating.value]));
      return {
        "N° réponse": index + 1,
        "Enseignant": teacherName(course?.teachers),
        "Grade académique": course?.teachers?.academic_grade || "",
        "Cours": course?.title || "",
        "Domaine": course?.domain || "",
        "Promotion": course?.promotion || "",
        ...Object.fromEntries(criteria.map((criterion) => [criterion.label, scores[criterion.id] ?? ""])),
        "Pourcentage": `${responsePercentage(response, criteria.length)}%`,
        "Date de réception": new Date(response.created_at).toLocaleString("fr-FR")
      };
    });
    if (!rows.length) {
      setError("Aucune réponse à exporter pour cette évaluation.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map((key) => ({ wch: Math.min(Math.max(key.length + 3, 14), 34) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Résultats");
    XLSX.writeFile(workbook, `cotation-${(course?.title || "cours").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.xlsx`);
  }

  const totalResponses = evaluations.reduce((sum, evaluation) => sum + (evaluation.responses?.length || 0), 0);
  const globalAverage = useMemo(() => {
    const allResponses = evaluations.flatMap((evaluation) => (evaluation.responses || []).map((response) => responsePercentage(response, criteria.length)));
    return allResponses.length ? Math.round(allResponses.reduce((sum, score) => sum + score, 0) / allResponses.length) : 0;
  }, [evaluations, criteria.length]);

  if (!authChecked) return <main className="admin-shell"><p className="loading-card">Chargement…</p></main>;
  if (!supabaseConfigured) return <SetupRequired />;
  if (!user) return <LoginPage login={login} setLogin={setLogin} signIn={signIn} busy={busy} error={error} />;
  if (isAdmin === null) return <main className="admin-shell"><div className="admin-denied">{error ? <><div className="alert alert-error" role="alert">{error}</div><button className="button button-outline" onClick={() => loadDashboard(user)}>Réessayer</button></> : <p className="loading-card">Vérification des accès…</p>}</div></main>;
  if (!isAdmin && !busy) return <main className="admin-shell"><div className="admin-denied"><span className="eyebrow">ACCÈS RESTREINT</span><h1>Ce compte n’a pas le rôle administrateur.</h1><p>Demandez à l’administrateur principal d’activer votre accès dans Supabase.</p><button className="button button-outline" onClick={() => supabase.auth.signOut()}>Se déconnecter</button></div></main>;

  return (
    <main className="admin-shell">
      <header className="admin-topbar"><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cota<span className="brand-dot">.</span></span></Link><div className="admin-user"><span className="admin-user-dot" /> Administration <button onClick={() => supabase.auth.signOut()}>Se déconnecter ↗</button></div></header>
      <section className="admin-main">
        <div className="admin-heading"><div><span className="eyebrow">TABLEAU DE BORD</span><h1>Bonjour, <span>Admin.</span></h1><p>Gérez vos cours, partagez les liens et consultez les retours des étudiants.</p></div><span className="dashboard-mark">C.</span></div>
        {error && <div className="alert alert-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="alert alert-success" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        <div className="stats-grid">
          <StatCard label="Enseignants" value={teachers.length} mark="✳" />
          <StatCard label="Cours enregistrés" value={courses.length} mark="▤" />
          <StatCard label="Réponses reçues" value={totalResponses} mark="↗" />
          <StatCard label="Moyenne globale" value={`${globalAverage}%`} mark="◎" />
        </div>

        <div className="admin-grid">
          <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">01 / ENSEIGNANTS</span><h2>Ajouter un enseignant</h2></div><span className="panel-icon">✳</span></div>
            <form className="admin-form" onSubmit={createTeacher}>
              <div className="input-row"><label>Prénom<input value={teacherForm.first_name} onChange={(event) => setTeacherForm({ ...teacherForm, first_name: event.target.value })} required /></label><label>Post-nom<input value={teacherForm.post_name} onChange={(event) => setTeacherForm({ ...teacherForm, post_name: event.target.value })} required /></label></div>
              <label>Nom<input value={teacherForm.last_name} onChange={(event) => setTeacherForm({ ...teacherForm, last_name: event.target.value })} required /></label>
              <label>Grade académique<input placeholder="Ex. Professeur, Chef de travaux…" value={teacherForm.academic_grade} onChange={(event) => setTeacherForm({ ...teacherForm, academic_grade: event.target.value })} required /></label>
              <button className="button button-primary form-submit" disabled={busy}>Ajouter l’enseignant <span>＋</span></button>
            </form>
          </section>
          <section className="admin-panel"><div className="panel-heading"><div><span className="eyebrow">02 / COURS</span><h2>Enregistrer un cours</h2></div><span className="panel-icon blue">▤</span></div>
            <form className="admin-form" onSubmit={createCourse}>
              <label>Enseignant<select value={courseForm.teacher_id} onChange={(event) => setCourseForm({ ...courseForm, teacher_id: event.target.value })} required><option value="">Choisir un enseignant</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}</select></label>
              <label>Titre du cours<input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required /></label>
              <div className="input-row"><label>Domaine<input value={courseForm.domain} onChange={(event) => setCourseForm({ ...courseForm, domain: event.target.value })} required /></label><label>Promotion<input placeholder="Ex. L2 / G3" value={courseForm.promotion} onChange={(event) => setCourseForm({ ...courseForm, promotion: event.target.value })} required /></label></div>
              <button className="button button-primary form-submit blue-button" disabled={busy || !teachers.length}>Enregistrer le cours <span>＋</span></button>
              {!teachers.length && <small className="form-hint">Ajoutez d’abord un enseignant pour enregistrer un cours.</small>}
            </form>
          </section>
        </div>

        <section className="admin-panel create-evaluation-panel"><div className="panel-heading"><div><span className="eyebrow">03 / CAMPAGNE DE COTATION</span><h2>Créer et partager un lien</h2><p>Chaque lien donne accès à une évaluation anonyme d’un cours.</p></div><span className="panel-icon">↗</span></div>
          <form className="admin-form evaluation-create-form" onSubmit={createEvaluation}>
            <label>Cours à évaluer<select value={evaluationForm.course_id} onChange={(event) => setEvaluationForm({ ...evaluationForm, course_id: event.target.value })} required><option value="">Sélectionner un cours</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title} — {teacherName(course.teachers)} ({course.promotion})</option>)}</select></label>
            <label>Intitulé de l’évaluation<input placeholder="Ex. Cotation du premier semestre" value={evaluationForm.title} onChange={(event) => setEvaluationForm({ ...evaluationForm, title: event.target.value })} required /></label>
            <button className="button button-primary form-submit" disabled={busy || !courses.length}>Créer le lien d’évaluation <span>↗</span></button>
          </form>
        </section>

        <section className="results-section"><div className="results-heading"><div><span className="eyebrow">04 / RÉSULTATS</span><h2>Évaluations &amp; cotations</h2></div><span className="results-total">{evaluations.length} lien{evaluations.length !== 1 ? "s" : ""}</span></div>
          {busy && !evaluations.length ? <div className="empty-state">Chargement des évaluations…</div> : evaluations.length === 0 ? <div className="empty-state"><span>✳</span><h3>Aucune évaluation pour le moment</h3><p>Enregistrez un cours puis créez son premier lien de cotation.</p></div> : (
            <div className="evaluation-list">{evaluations.map((evaluation) => {
              const course = evaluation.courses;
              const responses = evaluation.responses || [];
              const average = responses.length ? Math.round(responses.reduce((sum, response) => sum + responsePercentage(response, criteria.length), 0) / responses.length) : 0;
              return <article className="evaluation-result" key={evaluation.id}>
                <div className="evaluation-result-head"><div className="result-course-icon">▤</div><div className="result-course-info"><span className="course-label">{course?.promotion} · {course?.domain}</span><h3>{course?.title}</h3><p>{teacherName(course?.teachers)}{course?.teachers?.academic_grade ? ` · ${course.teachers.academic_grade}` : ""}</p></div><span className={evaluation.is_active ? "status-pill active" : "status-pill"}>{evaluation.is_active ? "Ouverte" : "Fermée"}</span></div>
                <div className="evaluation-link-row"><span className="link-display">{typeof window !== "undefined" ? `${window.location.origin}/eval/${evaluation.share_token}` : `/eval/${evaluation.share_token}`}</span><button className="button button-outline small-button" onClick={() => copyLink(evaluation.share_token)}>Copier le lien ↗</button><button className="text-button" onClick={() => toggleEvaluation(evaluation)}>{evaluation.is_active ? "Fermer" : "Ouvrir"}</button></div>
                <div className="result-summary"><div><strong>{responses.length}</strong><span>réponse{responses.length !== 1 ? "s" : ""}</span></div><div><strong>{responses.length ? `${average}%` : "—"}</strong><span>moyenne</span></div><button className="button button-primary export-button" disabled={!responses.length} onClick={() => exportEvaluation(evaluation)}>Télécharger Excel <span>↓</span></button></div>
                {responses.length > 0 && <details className="responses-details"><summary>Consulter les réponses individuelles</summary><div className="table-scroll"><table><thead><tr><th>Réponse</th>{criteria.map((criterion) => <th key={criterion.id}>{criterion.label}</th>)}<th>Pourcentage</th><th>Reçue le</th></tr></thead><tbody>{responses.map((response, index) => {
                  const scores = Object.fromEntries((response.ratings || []).map((rating) => [rating.criterion_id, rating.value]));
                  return <tr key={response.id}><td>#{String(index + 1).padStart(3, "0")}</td>{criteria.map((criterion) => <td key={criterion.id}>{scores[criterion.id] ?? "—"}/10</td>)}<td><b>{responsePercentage(response, criteria.length)}%</b></td><td>{new Date(response.created_at).toLocaleDateString("fr-FR")}</td></tr>;
                })}</tbody></table></div></details>}
              </article>;
            })}</div>
          )}
        </section>
      </section>
      <footer className="admin-footer"><span>Cota<span className="brand-dot">.</span> · Espace administration</span><Link href="/">Voir la page d’accueil ↗</Link></footer>
    </main>
  );
}

function LoginPage({ login, setLogin, signIn, busy, error }) {
  return <main className="login-shell"><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cota<span className="brand-dot">.</span></span></Link><div className="login-card"><span className="eyebrow">ESPACE SÉCURISÉ</span><h1>Bon retour<span>.</span></h1><p>Connectez-vous pour gérer les évaluations des enseignements.</p><form className="admin-form" onSubmit={signIn}><label>Adresse e-mail<input type="email" autoComplete="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required /></label><label>Mot de passe<input type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary form-submit" disabled={busy}>{busy ? "Connexion…" : "Se connecter"} <span>↗</span></button></form><Link className="text-link" href="/">← Retour à l’accueil</Link></div><span className="login-side-note">LA QUALITÉ SE CONSTRUIT ENSEMBLE.</span></main>;
}

function SetupRequired() {
  return <main className="login-shell"><Link className="brand" href="/"><span className="brand-mark">C</span><span>Cota<span className="brand-dot">.</span></span></Link><div className="login-card"><span className="eyebrow">CONFIGURATION REQUISE</span><h1>Reliez Supabase<span>.</span></h1><p>Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans votre fichier .env.local en développement ou dans les variables d’environnement de Vercel.</p><Link className="text-link" href="/">← Retour à l’accueil</Link></div></main>;
}

function StatCard({ label, value, mark }) {
  return <div className="stat-card"><span>{label}</span><strong>{value}</strong><i>{mark}</i></div>;
}
