# UNITECH — Évaluation des enseignements

Application Next.js pour créer des campagnes de cotation anonymes avec Google Forms et Google Sheets. L’administrateur saisit l’enseignant et son cours en une seule fois; l’application génère le formulaire étudiant, enregistre les réponses dans le tableur et calcule le pourcentage de chaque réponse.

## Configuration Google

1. Créez un Google Sheet dédié. Son identifiant se trouve dans l’adresse, entre `/d/` et `/edit`.
2. Créez un projet sur [script.google.com](https://script.google.com) et copiez le contenu de [`google-apps-script/Code.gs`](./google-apps-script/Code.gs) dans `Code.gs`.
3. Dans les paramètres du projet Apps Script, ajoutez les propriétés de script `SPREADSHEET_ID` (identifiant du tableur) et `API_SECRET` (une longue valeur aléatoire).
4. Dans l’éditeur Apps Script, exécutez `initialize` et acceptez les autorisations demandées. Cette étape initialise les onglets et autorise Forms et les déclencheurs.
5. Déployez le projet comme **application Web**, exécutée en tant que vous et accessible à **Tout le monde**. Copiez l’URL `/exec` du déploiement.
6. Copiez `.env.example` vers `.env.local`, puis définissez `ADMIN_PASSWORD`, `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET`. La valeur secrète doit être identique à la propriété `API_SECRET` d’Apps Script. Ne préfixez aucune de ces variables par `NEXT_PUBLIC_`.
7. Installez les dépendances et démarrez l’application :

   ```bash
   npm install
   npm run dev
   ```

L’espace d’administration est disponible sur `/admin`. À la première création de campagne, Apps Script crée les onglets de données, un formulaire Google et son déclencheur. Les réponses apparaissent dans le formulaire et sont copiées dans l’onglet `Cotations` avec leur pourcentage calculé. Le tableau de bord affiche les résultats par campagne/enseignant. Les onglets `Enseignants`, `Cours` et `Campagnes` sont également créés automatiquement.

Les liens étudiants ouvrent directement Google Forms. Les étudiants ne sont pas invités à saisir leur identité et aucune adresse e-mail n’est collectée. Chaque réponse est calculée selon la formule `somme des notes / 110 × 100`.

## Déploiement

Pour Vercel, ajoutez les trois variables `ADMIN_PASSWORD`, `GOOGLE_APPS_SCRIPT_URL` et `GOOGLE_APPS_SCRIPT_SECRET` aux paramètres du projet, puis redéployez. L’application Next.js sert de proxy protégé entre le navigateur et Apps Script; le secret Google reste côté serveur. Le déploiement Apps Script doit rester accessible à tous pour que le serveur puisse l’appeler, et son code vérifie le secret partagé.

Partagez le Google Sheet avec les personnes qui doivent consulter les données. Ne partagez jamais le secret Apps Script ou le mot de passe admin. En cas de modification du script, créez une nouvelle version du déploiement Web App.

## Confidentialité

Le formulaire ne collecte aucune identité ni adresse e-mail. Google Forms et le tableur restent soumis aux paramètres de conservation et aux règles de confidentialité du compte Google utilisé pour déployer le script. Le pourcentage individuel est calculé à la réception; la moyenne affichée dans le tableau de bord est la moyenne des pourcentages de la campagne.
