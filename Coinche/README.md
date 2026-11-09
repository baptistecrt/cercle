# Le Cercle — jeux entre potes

Une salle de jeux en ligne pour jouer entre amis, chacun sur son PC :

| Jeu | Joueurs | Dossier |
|---|---|---|
| **Coinche** (belote coinchée) | 4 | `coinche/` |
| **Tarot** | 3 à 5 | `tarot/` |
| **Poker** (Texas Hold'em sans limite) | 2 à 8 | `poker/` |
| **Capitole** (règles du Monopoly, rues de Toulouse) | 2 à 6 | `capitole/` |
| **Archipel** (règles de Catan) | 3 ou 4 | `archipel/` |

Aucun serveur à installer : c'est un site statique. La connexion entre joueurs se fait directement de navigateur à navigateur (WebRTC via PeerJS).

## Mettre le site en ligne (2 minutes)

1. Va sur <https://app.netlify.com/drop> (connecte-toi avec ton compte Netlify).
2. Glisse-dépose **tout le dossier `Coinche`** dans la page.
3. Netlify te donne une adresse du type `https://xxxx.netlify.app` : c'est la page d'accueil avec tous les jeux.
   Tu peux la renommer dans *Site configuration → Change site name* (ex. `cercle-baptiste.netlify.app`).

Pour mettre à jour plus tard : *Deploys* → glisse à nouveau le dossier.

## Jouer avec tes potes

1. Ouvre le site, choisis un jeu.
2. Entre ton pseudo et clique **Créer une table**.
3. Clique **Copier le lien d'invitation** et envoie-le. Tu peux aussi donner le code à 5 caractères : tes potes le tapent sur la page d'accueil, le site sait à quel jeu il correspond.
4. Chacun clique sur une place. **Places au hasard** mélange l'ordre ; à la coinche, **Équipes au hasard** tire les équipes. S'il manque quelqu'un : **Ajouter un robot**.
5. Clique **Lancer la partie**.

⚠️ Celui qui crée la table est l'hôte : **il garde son onglet ouvert pendant la partie** (c'est son navigateur qui fait tourner le jeu).
S'il recharge la page par erreur, la partie reprend toute seule. Un joueur déconnecté revient à sa place en rouvrant le lien ; l'hôte peut aussi faire jouer un robot à sa place (bouton Réglages).

## Cacher ses cartes

Dans les jeux de cartes (coinche, tarot, poker) et à Archipel : bouton **Cacher mes cartes** en bas à droite, ou touche **H**.
Dans les réglages : « Cacher automatiquement mes cartes quand je quitte la fenêtre ».

## Les règles

Chaque jeu a un bouton **Règles** qui explique exactement ce qui est appliqué. En résumé :

- **Coinche** : enchères 80 → 160 puis capot, coinche ×2 et surcoinche ×4, obligations complètes (fournir, monter à l'atout, couper, surcouper, sous-couper ; libre si le partenaire est maître), belote-rebelote, 10 de der, capot 252.
- **Tarot** : règles FFT. Prise, garde, garde sans, garde contre ; chien et écart ; appel au roi à 5 ; excuse ; petit au bout ; poignées ; chelem.
- **Poker** : blindes qui montent (réglable), relance minimum, tapis, pots annexes, partage en cas d'égalité.
- **Capitole** : achat ou enchères, loyers doublés sur une couleur complète, construction équilibrée, banque limitée à 32 maisons et 12 hôtels, hypothèques, prison, cartes Hasard / Quartier, échanges entre joueurs, faillite. Option : partie limitée en tours, cagnotte au Jardin des Plantes.
- **Archipel** : placement en serpent, production, voleur sur le 7 (défausse de la moitié au-delà de 7 cartes), ports 3:1 et 2:1, échanges entre joueurs, cartes développement, route la plus longue, armée la plus puissante, objectif réglable (8 / 10 / 12 points).

## Si un ami n'arrive pas à se connecter

La connexion directe passe sur la plupart des box internet. Elle peut être bloquée sur un réseau d'entreprise ou d'école, et parfois en 4G : essaie alors depuis un autre réseau.

Options avancées (paramètres d'URL) :
- `?turn=turn:serveur:3478&turnuser=...&turnpass=...` pour ajouter un serveur relais TURN ;
- `?peerhost=...&peerport=...` pour utiliser ton propre serveur PeerJS (`npx peerjs --port 9000`) au lieu du serveur public gratuit.

## Hors ligne

Dans chaque jeu, **Jouer seul contre des robots** marche même sans mettre le site en ligne.

## Contenu du dossier

- `index.html` : la page d'accueil (le hub).
- `common/` : ce que les jeux partagent : réseau (`net.js`), salon et outils (`room.js`, `room.css`), cartes, polices, PeerJS.
- Un dossier par jeu, avec `engine.js` (les règles et les robots) et `app.js` (l'interface).
- Crédits : cartes « Vectorized Playing Cards » de Chris Aguilar (LGPL, voir `common/cards/`) ; polices Young Serif, Instrument Sans et Caveat (OFL) ; PeerJS (MIT).
- Capitole et Archipel reprennent les règles de Monopoly et de Catan sous des noms et des visuels originaux ; ces deux noms sont des marques de leurs éditeurs.
