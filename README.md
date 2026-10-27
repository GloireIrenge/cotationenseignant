# Cota — Évaluation des enseignements

Application Next.js avec Supabase pour gérer les enseignants, leurs cours et des évaluations anonymes partagées par lien.

## Fonctionnalités

- Connexion réservée à l’administration.
- Gestion des enseignants (nom, post-nom, prénom et grade académique) et des cours.
- Création et fermeture de liens d’évaluation par cours.
- Formulaire étudiant anonyme, avec 11 critères notés de 0 à 10.
- Calcul de l’appréciation globale et affichage des résultats individuels.
- Export Excel `.xlsx` de chaque évaluation.
- Politiques Supabase RLS : seuls les admins consultent les cotations ; les étudiants ne passent que par des fonctions SQL qui valident les liens et les notes.

## Mise en route

1. Créez un projet Supabase et ouvrez **SQL Editor**.
2. Exécutez le contenu de [`supabase/schema.sql`](./supabase/schema.sql).
3. Dans **Authentication → Users**, créez l’utilisateur de l’administrateur.
4. Copiez l’UUID de cet utilisateur. Dans le SQL Editor, exécutez la dernière instruction commentée du schéma en remplaçant `UUID_DE_L_UTILISATEUR` par l’UUID réel :

   ```sql
   update public.profiles set role = 'admin' where id = 'UUID_DE_L_UTILISATEUR';
   ```

5. Dupliquez `.env.example` sous le nom `.env.local` et renseignez l’URL du projet Supabase et sa clé publique `anon` (ou `publishable key`).
6. Installez les dépendances et démarrez l’application :

   ```bash
   npm install
   npm run dev
   ```

   L’espace admin est accessible sur `/admin`. Les liens étudiants sont générés par l’admin et ont la forme `/eval/<jeton>`.

## Déploiement sur Vercel

Importez le dépôt dans Vercel, puis ajoutez `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les variables d’environnement du projet pour chaque environnement concerné. Redéployez après leur ajout. La clé `anon` est prévue pour le navigateur ; **ne mettez jamais la clé `service_role` dans les variables `NEXT_PUBLIC_*` ni dans le code client**.

Dans Supabase, ajoutez le domaine de déploiement Vercel aux URL autorisées dans **Authentication → URL Configuration**. Créez les utilisateurs administrateurs uniquement depuis le tableau de bord Supabase.

## Confidentialité et limites

Les étudiants ne saisissent pas leur identité ; les résultats sauvegardés contiennent leurs notes et la date d’envoi, sans nom ni adresse e-mail. Pour éviter les doublons accidentels, le navigateur conserve un identifiant local aléatoire par lien ; comme le formulaire est anonyme, cette protection n’empêche pas un étudiant déterminé d’utiliser un autre navigateur ou appareil.

Les quotas gratuits de Vercel et Supabase peuvent évoluer. Configurez la durée de conservation des données selon les règles de votre établissement et supprimez les campagnes/réponses lorsque leur conservation n’est plus nécessaire.
