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

const SHEETS = {
  teachers: { name: "Enseignants", headers: ["teacher_id", "first_name", "post_name", "last_name", "academic_grade", "created_at"] },
  courses: { name: "Cours", headers: ["course_id", "teacher_id", "title", "domain", "promotion", "created_at"] },
  evaluations: { name: "Campagnes", headers: ["evaluation_id", "course_id", "title", "form_id", "form_url", "edit_url", "is_active", "created_at"] },
  responses: { name: "Cotations", headers: ["response_id", "evaluation_id", "received_at", "teacher", "academic_grade", "course", "domain", "promotion", "campaign", ...CRITERIA, "percentage"] }
};

function initialize() {
  ensureSheets_(getSpreadsheet_());
  const temporaryForm = FormApp.create("UNITECH - autorisation");
  DriveApp.getFileById(temporaryForm.getId()).setTrashed(true);
  const temporaryTrigger = ScriptApp.newTrigger("onFormSubmit").timeBased().after(60 * 60 * 1000).create();
  ScriptApp.deleteTrigger(temporaryTrigger);
}

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("API_SECRET");
    if (!expectedSecret || request.secret !== expectedSecret) return json_({ ok: false, error: "Accès refusé." });

    const spreadsheet = getSpreadsheet_();
    ensureSheets_(spreadsheet);
    let result;
    if (request.action === "dashboard") result = dashboard_(spreadsheet);
    else if (request.action === "createEvaluation") result = createEvaluation_(spreadsheet, request);
    else if (request.action === "toggleEvaluation") result = toggleEvaluation_(spreadsheet, request.evaluation_id);
    else result = { ok: false, error: "Action inconnue." };
    return json_(result);
  } catch (error) {
    return json_({ ok: false, error: error.message || "Erreur Apps Script." });
  }
}

function onFormSubmit(event) {
  const spreadsheet = getSpreadsheet_();
  ensureSheets_(spreadsheet);
  const formId = event.source.getId();
  const campaign = findCampaignByFormId_(spreadsheet, formId);
  if (!campaign || !campaign.is_active) return;

  const ratings = event.response.getItemResponses().map((itemResponse) => Number(itemResponse.getResponse()));
  if (ratings.length !== CRITERIA.length || ratings.some((score) => !Number.isInteger(score) || score < 0 || score > 10)) {
    throw new Error("Réponse incomplète ou note invalide.");
  }

  const teacher = findRowById_(getSheet_(spreadsheet, "teachers"), 0, campaign.teacher_id);
  const course = findRowById_(getSheet_(spreadsheet, "courses"), 0, campaign.course_id);
  const percentage = Math.round(ratings.reduce((sum, score) => sum + score, 0) / (CRITERIA.length * 10) * 100);
  getSheet_(spreadsheet, "responses").appendRow([
    Utilities.getUuid(), campaign.evaluation_id, event.response.getTimestamp(),
    teacher[1] + " " + teacher[2] + " " + teacher[3], teacher[4], course[2], course[3], course[4], campaign.title,
    ...ratings, percentage
  ]);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("La propriété SPREADSHEET_ID n’est pas configurée.");
  return SpreadsheetApp.openById(id);
}

function ensureSheets_(spreadsheet) {
  Object.keys(SHEETS).forEach((key) => {
    const definition = SHEETS[key];
    let sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) sheet = spreadsheet.insertSheet(definition.name);
    if (sheet.getLastRow() === 0) sheet.appendRow(definition.headers);
  });
}

function getSheet_(spreadsheet, key) {
  return spreadsheet.getSheetByName(SHEETS[key].name);
}

function dashboard_(spreadsheet) {
  const teachers = rows_(getSheet_(spreadsheet, "teachers"));
  const courses = rows_(getSheet_(spreadsheet, "courses"));
  const campaigns = rows_(getSheet_(spreadsheet, "evaluations"));
  const responses = rows_(getSheet_(spreadsheet, "responses"));

  const evaluations = campaigns.map((row) => {
    const courseRow = courses.find((course) => course[0] === row[1]);
    const teacherRow = courseRow && teachers.find((teacher) => teacher[0] === courseRow[1]);
    if (!courseRow || !teacherRow) return null;
    return {
      id: row[0],
      title: row[2],
      form_url: row[4],
      edit_url: row[5],
      is_active: row[6] === true || row[6] === "TRUE",
      created_at: iso_(row[7]),
      teacher: { id: teacherRow[0], first_name: teacherRow[1], post_name: teacherRow[2], last_name: teacherRow[3], academic_grade: teacherRow[4] },
      course: { id: courseRow[0], title: courseRow[2], domain: courseRow[3], promotion: courseRow[4] },
      responses: responses.filter((response) => response[1] === row[0]).map((response) => ({
        id: response[0],
        created_at: iso_(response[2]),
        ratings: Object.fromEntries(CRITERIA.map((criterion, index) => [criterion, Number(response[9 + index])])),
        percentage: Number(response[20])
      }))
    };
  }).filter(Boolean).reverse();

  return {
    ok: true,
    evaluations: evaluations,
    spreadsheet_url: spreadsheet.getUrl()
  };
}

function createEvaluation_(spreadsheet, request) {
  const values = {};
  ["first_name", "post_name", "last_name", "academic_grade", "course_title", "domain", "promotion", "evaluation_title"].forEach((key) => {
    values[key] = String(request[key] || "").trim();
    if (!values[key]) throw new Error("Tous les champs sont obligatoires.");
  });

  const teachersSheet = getSheet_(spreadsheet, "teachers");
  const teacherMatch = rows_(teachersSheet).find((row) =>
    [row[1], row[2], row[3], row[4]].map(normalize_).join("|") ===
    [values.first_name, values.post_name, values.last_name, values.academic_grade].map(normalize_).join("|")
  );
  const teacherId = teacherMatch ? teacherMatch[0] : Utilities.getUuid();
  if (!teacherMatch) teachersSheet.appendRow([teacherId, values.first_name, values.post_name, values.last_name, values.academic_grade, new Date()]);

  const coursesSheet = getSheet_(spreadsheet, "courses");
  const courseMatch = rows_(coursesSheet).find((row) => row[1] === teacherId &&
    [row[2], row[3], row[4]].map(normalize_).join("|") ===
    [values.course_title, values.domain, values.promotion].map(normalize_).join("|")
  );
  const courseId = courseMatch ? courseMatch[0] : Utilities.getUuid();
  if (!courseMatch) coursesSheet.appendRow([courseId, teacherId, values.course_title, values.domain, values.promotion, new Date()]);

  const form = withStage_("Création du formulaire", () =>
    FormApp.create(values.evaluation_title + " — " + values.course_title)
  );
  withStage_("Configuration du formulaire", () => {
    form.setDescription(
      "Évaluation anonyme de " + values.course_title + "\n" +
      "Enseignant : " + values.first_name + " " + values.post_name + " " + values.last_name + "\n" +
      "Promotion : " + values.promotion + "\n\n" +
      "Attribuez une note de 0 à 10 à chaque critère. Aucune adresse e-mail n’est collectée."
    );
    form.setCollectEmail(false);
    form.setLimitOneResponsePerUser(false);
    form.setConfirmationMessage("Merci. Votre cotation a été enregistrée.");
  });
  CRITERIA.forEach((criterion) => withStage_("Ajout du critère « " + criterion + " »", () => {
    form.addScaleItem()
      .setTitle(criterion)
      .setBounds(0, 10)
      .setLabels("Pas du tout satisfait", "Très satisfait")
      .setRequired(true);
  }));
  withStage_("Liaison au Google Sheet", () =>
    form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId())
  );

  const evaluationId = Utilities.getUuid();
  withStage_("Création du déclencheur de réponse", () =>
    ScriptApp.newTrigger("onFormSubmit").forForm(form).onFormSubmit().create()
  );
  withStage_("Enregistrement de la campagne", () =>
    getSheet_(spreadsheet, "evaluations").appendRow([
      evaluationId, courseId, values.evaluation_title, form.getId(), form.getPublishedUrl(), form.getEditUrl(), true, new Date()
    ])
  );

  return {
    ok: true,
    evaluation: { id: evaluationId, form_url: form.getPublishedUrl() }
  };
}

function withStage_(stage, callback) {
  try {
    return callback();
  } catch (error) {
    throw new Error(stage + " : " + (error.message || String(error)));
  }
}

function toggleEvaluation_(spreadsheet, evaluationId) {
  const sheet = getSheet_(spreadsheet, "evaluations");
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex((row, index) => index > 0 && row[0] === evaluationId);
  if (rowIndex < 1) return { ok: false, error: "Campagne introuvable." };
  const row = values[rowIndex];
  const nextState = !(row[6] === true || row[6] === "TRUE");
  FormApp.openById(row[3]).setAcceptingResponses(nextState);
  sheet.getRange(rowIndex + 1, 7).setValue(nextState);
  return { ok: true };
}

function findCampaignByFormId_(spreadsheet, formId) {
  const row = rows_(getSheet_(spreadsheet, "evaluations")).find((item) => item[3] === formId);
  if (!row) return null;
  const course = findRowById_(getSheet_(spreadsheet, "courses"), 0, row[1]);
  return { evaluation_id: row[0], course_id: row[1], title: row[2], form_id: row[3], is_active: row[6] === true || row[6] === "TRUE", teacher_id: course[1] };
}

function findRowById_(sheet, column, id) {
  return rows_(sheet).find((row) => row[column] === id);
}

function rows_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function normalize_(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function iso_(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
