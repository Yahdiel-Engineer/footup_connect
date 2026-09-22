/**
 * badges-challenges-data.ts
 * 
 * Données statiques pour les badges (60+) et les défis.
 * Importer dans challenges.tsx pour remplacer DEFAULT_BADGES et les défis vides.
 * 
 * Usage :
 *   import { ALL_BADGES, getDailyChallenges, WEEKLY_CHALLENGES, LIFETIME_CHALLENGES } from './badges-challenges-data';
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type BadgeTier   = 'bronze' | 'silver' | 'gold' | 'special';
export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface Badge {
  badge_id:    string;
  title:       string;
  description: string;
  icon:        string;
  tier:        BadgeTier;
  rarity:      BadgeRarity;
  xp_reward:   number;
  earned:      boolean;
  category:    string;
}

export interface Challenge {
  id:            string;
  title:         string;
  description:   string;
  icon:          string;
  color:         string;
  xp_reward:     number;
  difficulty:    number;
  target_value:  number;
  current_value: number;
  reset_type:    'daily' | 'weekly' | 'lifetime';
  category:      string;
  completed:     boolean;
  is_featured?:  boolean;
  is_custom?:    boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// BADGES — 64 badges répartis en 8 catégories
// ═════════════════════════════════════════════════════════════════════════════

export const ALL_BADGES: Badge[] = [

  // ── ⚡ VITESSE / RÉACTION ─────────────────────────────────────────────────
  {
    badge_id: 'spd_1', category: 'vitesse',
    title: 'Première Frappe',
    description: 'Touche ta première cible',
    icon: 'flash-outline', tier: 'bronze', rarity: 'common', xp_reward: 25, earned: false,
  },
  {
    badge_id: 'spd_2', category: 'vitesse',
    title: 'Éclair',
    description: 'Réagis en moins de 400ms',
    icon: 'flash', tier: 'bronze', rarity: 'common', xp_reward: 75, earned: false,
  },
  {
    badge_id: 'spd_3', category: 'vitesse',
    title: 'Foudre',
    description: 'Réagis en moins de 300ms',
    icon: 'thunderstorm-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 150, earned: false,
  },
  {
    badge_id: 'spd_4', category: 'vitesse',
    title: 'Réflexes Felins',
    description: 'Réagis en moins de 250ms sur 5 frappes consécutives',
    icon: 'eye', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },
  {
    badge_id: 'spd_5', category: 'vitesse',
    title: 'Ninja',
    description: 'Réagis en moins de 200ms',
    icon: 'speedometer', tier: 'gold', rarity: 'rare', xp_reward: 350, earned: false,
  },
  {
    badge_id: 'spd_6', category: 'vitesse',
    title: 'Vitesse Lumière',
    description: 'Réagis en moins de 150ms — est-ce possible ?',
    icon: 'planet', tier: 'special', rarity: 'legendary', xp_reward: 1000, earned: false,
  },
  {
    badge_id: 'spd_7', category: 'vitesse',
    title: 'Sprint Master',
    description: 'Touche 30 cibles en 60 secondes',
    icon: 'timer', tier: 'silver', rarity: 'uncommon', xp_reward: 175, earned: false,
  },
  {
    badge_id: 'spd_8', category: 'vitesse',
    title: 'Machine',
    description: 'Touche 50 cibles en 60 secondes',
    icon: 'timer', tier: 'gold', rarity: 'rare', xp_reward: 400, earned: false,
  },

  // ── 💪 FORCE / PUISSANCE ──────────────────────────────────────────────────
  {
    badge_id: 'pwr_1', category: 'force',
    title: 'Premier Impact',
    description: 'Effectue ton premier impact',
    icon: 'fitness-outline', tier: 'bronze', rarity: 'common', xp_reward: 25, earned: false,
  },
  {
    badge_id: 'pwr_2', category: 'force',
    title: 'Frappe Solide',
    description: 'Atteins 5g de force sur un impact',
    icon: 'fitness-outline', tier: 'bronze', rarity: 'common', xp_reward: 50, earned: false,
  },
  {
    badge_id: 'pwr_3', category: 'force',
    title: 'Puissance +',
    description: 'Atteins 10g de force sur un impact',
    icon: 'fitness', tier: 'bronze', rarity: 'common', xp_reward: 100, earned: false,
  },
  {
    badge_id: 'pwr_4', category: 'force',
    title: 'Marteau',
    description: 'Atteins 15g de force sur un impact',
    icon: 'fitness', tier: 'silver', rarity: 'uncommon', xp_reward: 175, earned: false,
  },
  {
    badge_id: 'pwr_5', category: 'force',
    title: 'Bulldozer',
    description: 'Atteins 20g de force sur un impact',
    icon: 'fitness', tier: 'gold', rarity: 'rare', xp_reward: 300, earned: false,
  },
  {
    badge_id: 'pwr_6', category: 'force',
    title: 'Force de la Nature',
    description: 'Atteins 25g de force — au-delà du maximum',
    icon: 'nuclear-outline', tier: 'special', rarity: 'legendary', xp_reward: 1000, earned: false,
  },
  {
    badge_id: 'pwr_7', category: 'force',
    title: 'Constance',
    description: 'Maintiens une force moyenne de 10g sur toute une session',
    icon: 'analytics-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },

  // ── 🔥 COMBO ──────────────────────────────────────────────────────────────
  {
    badge_id: 'cmb_1', category: 'combo',
    title: 'Double',
    description: 'Enchaîne 2 impacts',
    icon: 'flame-outline', tier: 'bronze', rarity: 'common', xp_reward: 30, earned: false,
  },
  {
    badge_id: 'cmb_2', category: 'combo',
    title: 'Triple',
    description: 'Enchaîne 3 impacts',
    icon: 'flame-outline', tier: 'bronze', rarity: 'common', xp_reward: 50, earned: false,
  },
  {
    badge_id: 'cmb_3', category: 'combo',
    title: 'Combo King',
    description: 'Enchaîne 10 impacts',
    icon: 'flame', tier: 'silver', rarity: 'uncommon', xp_reward: 150, earned: false,
  },
  {
    badge_id: 'cmb_4', category: 'combo',
    title: 'Inarrêtable',
    description: 'Enchaîne 20 impacts',
    icon: 'flame', tier: 'gold', rarity: 'rare', xp_reward: 350, earned: false,
  },
  {
    badge_id: 'cmb_5', category: 'combo',
    title: 'Feu Sacré',
    description: 'Enchaîne 50 impacts',
    icon: 'flame', tier: 'special', rarity: 'legendary', xp_reward: 900, earned: false,
  },

  // ── 🧠 COGNITIF / SÉQUENCE ────────────────────────────────────────────────
  {
    badge_id: 'cog_1', category: 'cognitif',
    title: 'Séquenceur',
    description: 'Complète le Mode Séquence pour la première fois',
    icon: 'git-branch-outline', tier: 'bronze', rarity: 'common', xp_reward: 75, earned: false,
  },
  {
    badge_id: 'cog_2', category: 'cognitif',
    title: 'Mémoire de Fer',
    description: 'Reproduis parfaitement une Séquence Mémoire',
    icon: 'bulb-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },
  {
    badge_id: 'cog_3', category: 'cognitif',
    title: 'Séquence Parfaite',
    description: 'Complète 5 sessions Séquence sans erreur',
    icon: 'git-branch', tier: 'gold', rarity: 'rare', xp_reward: 400, earned: false,
  },
  {
    badge_id: 'cog_4', category: 'cognitif',
    title: 'Vision de l\'Aigle',
    description: 'Complète Fausses Cibles en ignorant 100% des fausses cibles',
    icon: 'eye', tier: 'silver', rarity: 'uncommon', xp_reward: 225, earned: false,
  },
  {
    badge_id: 'cog_5', category: 'cognitif',
    title: 'Cerveau d\'or',
    description: 'Complète 10 sessions Séquence Mémoire',
    icon: 'bulb', tier: 'gold', rarity: 'rare', xp_reward: 500, earned: false,
  },

  // ── 🏆 MODES DE JEU ───────────────────────────────────────────────────────
  {
    badge_id: 'gmd_1', category: 'modes',
    title: 'Premier Mode',
    description: 'Lance ton premier mode de jeu',
    icon: 'game-controller-outline', tier: 'bronze', rarity: 'common', xp_reward: 25, earned: false,
  },
  {
    badge_id: 'gmd_2', category: 'modes',
    title: 'Survivaliste',
    description: 'Termine le mode Survie avec 3 vies restantes',
    icon: 'heart', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },
  {
    badge_id: 'gmd_3', category: 'modes',
    title: 'Indestructible',
    description: 'Termine le mode Survie sans perdre de vie',
    icon: 'shield', tier: 'gold', rarity: 'rare', xp_reward: 400, earned: false,
  },
  {
    badge_id: 'gmd_4', category: 'modes',
    title: 'Endurant',
    description: 'Termine une session Endurance complète',
    icon: 'trending-up-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 175, earned: false,
  },
  {
    badge_id: 'gmd_5', category: 'modes',
    title: 'Tous les Modes',
    description: 'Lance chacun des 11 modes au moins une fois',
    icon: 'apps', tier: 'gold', rarity: 'rare', xp_reward: 600, earned: false,
  },
  {
    badge_id: 'gmd_6', category: 'modes',
    title: 'Légende FootUp',
    description: 'Complète 100 sessions de jeu',
    icon: 'trophy', tier: 'special', rarity: 'legendary', xp_reward: 2000, earned: false,
  },
  {
    badge_id: 'gmd_7', category: 'modes',
    title: 'Rush Infernal',
    description: 'Touche 5 cibles simultanées dans Multi-Target Rush',
    icon: 'radio', tier: 'gold', rarity: 'rare', xp_reward: 350, earned: false,
  },

  // ── 📈 SCORE / POINTS ─────────────────────────────────────────────────────
  {
    badge_id: 'scr_1', category: 'score',
    title: 'Débutant',
    description: 'Atteins 500 points en une session',
    icon: 'star-outline', tier: 'bronze', rarity: 'common', xp_reward: 50, earned: false,
  },
  {
    badge_id: 'scr_2', category: 'score',
    title: 'Compétiteur',
    description: 'Atteins 1 000 points en une session',
    icon: 'star-outline', tier: 'bronze', rarity: 'common', xp_reward: 100, earned: false,
  },
  {
    badge_id: 'scr_3', category: 'score',
    title: 'Performeur',
    description: 'Atteins 2 500 points en une session',
    icon: 'star-half-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 175, earned: false,
  },
  {
    badge_id: 'scr_4', category: 'score',
    title: 'Elite',
    description: 'Atteins 5 000 points en une session',
    icon: 'star', tier: 'silver', rarity: 'uncommon', xp_reward: 250, earned: false,
  },
  {
    badge_id: 'scr_5', category: 'score',
    title: 'Champion',
    description: 'Atteins 10 000 points en une session',
    icon: 'star', tier: 'gold', rarity: 'rare', xp_reward: 500, earned: false,
  },
  {
    badge_id: 'scr_6', category: 'score',
    title: 'Score Légendaire',
    description: 'Atteins 25 000 points en une session',
    icon: 'star', tier: 'special', rarity: 'legendary', xp_reward: 1500, earned: false,
  },
  {
    badge_id: 'scr_7', category: 'score',
    title: 'Millionnaire',
    description: 'Cumule 1 000 000 points toutes sessions confondues',
    icon: 'diamond-outline', tier: 'special', rarity: 'legendary', xp_reward: 2500, earned: false,
  },

  // ── 🔥 STREAK / RÉGULARITÉ ────────────────────────────────────────────────
  {
    badge_id: 'str_1', category: 'streak',
    title: 'Premier Jour',
    description: 'Connecte-toi pour la première fois',
    icon: 'today-outline', tier: 'bronze', rarity: 'common', xp_reward: 25, earned: false,
  },
  {
    badge_id: 'str_2', category: 'streak',
    title: '3 Jours de Suite',
    description: 'Connecte-toi 3 jours consécutifs',
    icon: 'flame-outline', tier: 'bronze', rarity: 'common', xp_reward: 75, earned: false,
  },
  {
    badge_id: 'str_3', category: 'streak',
    title: 'Semaine Complète',
    description: 'Connecte-toi 7 jours consécutifs',
    icon: 'flame', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },
  {
    badge_id: 'str_4', category: 'streak',
    title: '2 Semaines Non-Stop',
    description: 'Connecte-toi 14 jours consécutifs',
    icon: 'flame', tier: 'silver', rarity: 'uncommon', xp_reward: 350, earned: false,
  },
  {
    badge_id: 'str_5', category: 'streak',
    title: 'Mois de Feu',
    description: 'Connecte-toi 30 jours consécutifs',
    icon: 'flame', tier: 'gold', rarity: 'rare', xp_reward: 700, earned: false,
  },
  {
    badge_id: 'str_6', category: 'streak',
    title: 'Éternel Entraîneur',
    description: 'Connecte-toi 100 jours consécutifs',
    icon: 'infinite', tier: 'special', rarity: 'legendary', xp_reward: 3000, earned: false,
  },

  // ── 🎯 DÉFIS ──────────────────────────────────────────────────────────────
  {
    badge_id: 'def_1', category: 'defis',
    title: 'Relève le Défi',
    description: 'Complète ton premier défi',
    icon: 'trophy-outline', tier: 'bronze', rarity: 'common', xp_reward: 50, earned: false,
  },
  {
    badge_id: 'def_2', category: 'defis',
    title: 'Chasseur de Défis',
    description: 'Complète 10 défis',
    icon: 'trophy-outline', tier: 'bronze', rarity: 'common', xp_reward: 100, earned: false,
  },
  {
    badge_id: 'def_3', category: 'defis',
    title: 'Défis Master',
    description: 'Complète 50 défis',
    icon: 'trophy', tier: 'silver', rarity: 'uncommon', xp_reward: 300, earned: false,
  },
  {
    badge_id: 'def_4', category: 'defis',
    title: 'Conquérant',
    description: 'Complète tous les défis du jour 7 jours de suite',
    icon: 'trophy', tier: 'gold', rarity: 'rare', xp_reward: 600, earned: false,
  },
  {
    badge_id: 'def_5', category: 'defis',
    title: 'Défi Créatif',
    description: 'Crée et complète ton premier défi perso',
    icon: 'create-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 150, earned: false,
  },

  // ── 👥 SOCIAL ─────────────────────────────────────────────────────────────
  {
    badge_id: 'soc_1', category: 'social',
    title: 'Partage',
    description: 'Partage un résultat pour la première fois',
    icon: 'share-social-outline', tier: 'bronze', rarity: 'common', xp_reward: 30, earned: false,
  },
  {
    badge_id: 'soc_2', category: 'social',
    title: 'Influenceur',
    description: 'Partage 10 résultats',
    icon: 'share-social-outline', tier: 'bronze', rarity: 'common', xp_reward: 75, earned: false,
  },
  {
    badge_id: 'soc_3', category: 'social',
    title: 'Communauté',
    description: 'Ajoute 5 amis sur l\'application',
    icon: 'people-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 150, earned: false,
  },

  // ── 🌟 SPÉCIAUX / SECRETS ─────────────────────────────────────────────────
  {
    badge_id: 'spc_1', category: 'special',
    title: 'Beta Testeur',
    description: 'Tu as utilisé l\'app pendant la phase bêta',
    icon: 'code-slash-outline', tier: 'special', rarity: 'legendary', xp_reward: 500, earned: false,
  },
  {
    badge_id: 'spc_2', category: 'special',
    title: 'Nuit Blanche',
    description: 'Lance une session entre minuit et 5h du matin',
    icon: 'moon-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 200, earned: false,
  },
  {
    badge_id: 'spc_3', category: 'special',
    title: 'Lève-Tôt',
    description: 'Lance une session avant 7h du matin',
    icon: 'sunny-outline', tier: 'silver', rarity: 'uncommon', xp_reward: 175, earned: false,
  },
  {
    badge_id: 'spc_4', category: 'special',
    title: 'Explorateur',
    description: 'Explore toutes les sections de l\'application',
    icon: 'compass-outline', tier: 'bronze', rarity: 'common', xp_reward: 75, earned: false,
  },
  {
    badge_id: 'spc_5', category: 'special',
    title: 'Perfectionniste',
    description: 'Obtiens le grade S dans 5 sessions différentes',
    icon: 'ribbon-outline', tier: 'gold', rarity: 'rare', xp_reward: 500, earned: false,
  },
  {
    badge_id: 'spc_6', category: 'special',
    title: 'Légende Vivante',
    description: 'Obtiens tous les autres badges',
    icon: 'diamond', tier: 'special', rarity: 'legendary', xp_reward: 10000, earned: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// DÉFIS QUOTIDIENS — 7 sets (un par jour de la semaine)
// getDailyChallenges(dayOfWeek) retourne les défis du jour (0=Lundi ... 6=Dimanche)
// ═════════════════════════════════════════════════════════════════════════════

const DAILY_SETS: Challenge[][] = [
  // Lundi (0)
  [
    { id: 'd_mon_1', title: 'Lundi Sprint', description: 'Touche 20 cibles en mode Sprint 60s', icon: 'timer', color: '#FF6D00', xp_reward: 75, difficulty: 2, target_value: 20, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_mon_2', title: 'Force du Lundi', description: 'Atteins 10g de force sur 3 impacts', icon: 'fitness', color: '#E040FB', xp_reward: 80, difficulty: 2, target_value: 3, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_mon_3', title: 'Réveil Express', description: 'Lance une session avant 10h', icon: 'sunny-outline', color: '#FFB700', xp_reward: 60, difficulty: 1, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_mon_4', title: 'Combo Lundi', description: 'Enchaîne un combo de 5', icon: 'flame', color: '#FF9800', xp_reward: 70, difficulty: 2, target_value: 5, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Mardi (1)
  [
    { id: 'd_tue_1', title: 'Réaction Éclair', description: 'Touche 15 cibles en mode Flash', icon: 'flash', color: '#FFB700', xp_reward: 80, difficulty: 2, target_value: 15, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_tue_2', title: 'Max Power', description: 'Lance une session Max Power', icon: 'fitness-outline', color: '#FF1744', xp_reward: 60, difficulty: 1, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_tue_3', title: 'Séquence du Jour', description: 'Complète 2 sessions Mode Séquence', icon: 'git-branch-outline', color: '#448AFF', xp_reward: 90, difficulty: 3, target_value: 2, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_tue_4', title: 'Frappe Légère', description: 'Touche 10 cibles rapidement', icon: 'flash-outline', color: '#1ED760', xp_reward: 55, difficulty: 1, target_value: 10, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Mercredi (2)
  [
    { id: 'd_wed_1', title: 'Mercredi Cognitif', description: 'Complète Fausses Cibles sans erreur', icon: 'eye', color: '#1ED760', xp_reward: 100, difficulty: 4, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_wed_2', title: 'Mémoire Active', description: 'Lance une session Séquence Mémoire', icon: 'bulb-outline', color: '#00BCD4', xp_reward: 85, difficulty: 3, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_wed_3', title: 'Rush du Milieu', description: 'Touche 25 cibles dans n\'importe quel mode', icon: 'radio', color: '#FF6D00', xp_reward: 70, difficulty: 2, target_value: 25, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_wed_4', title: 'Combo ×3', description: 'Obtiens le multiplicateur combo maximal', icon: 'flame', color: '#FF9800', xp_reward: 90, difficulty: 3, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Jeudi (3)
  [
    { id: 'd_thu_1', title: 'Jeudi Survie', description: 'Termine le mode Survie', icon: 'heart', color: '#E91E63', xp_reward: 110, difficulty: 4, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_thu_2', title: 'Puissance Jeudi', description: 'Atteins 15g de force sur un impact', icon: 'fitness', color: '#E040FB', xp_reward: 95, difficulty: 3, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_thu_3', title: '3 Modes Différents', description: 'Lance 3 modes différents dans la journée', icon: 'apps', color: '#448AFF', xp_reward: 80, difficulty: 2, target_value: 3, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_thu_4', title: 'Score 2000', description: 'Atteins 2000 points en une session', icon: 'star', color: '#FFD700', xp_reward: 85, difficulty: 3, target_value: 2000, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Vendredi (4)
  [
    { id: 'd_fri_1', title: 'Vendredi Combo', description: 'Enchaîne un combo de 10 impacts', icon: 'flame', color: '#FF9800', xp_reward: 120, difficulty: 3, target_value: 10, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_fri_2', title: 'Sprint Final', description: 'Touche 40 cibles en mode Sprint 60s', icon: 'timer', color: '#FF6D00', xp_reward: 100, difficulty: 3, target_value: 40, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_fri_3', title: 'Flash Friday', description: 'Touche 20 cibles en mode Flash', icon: 'flash', color: '#FFB700', xp_reward: 80, difficulty: 2, target_value: 20, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_fri_4', title: 'Fin de Semaine', description: 'Complète 5 sessions dans la journée', icon: 'game-controller-outline', color: '#1ED760', xp_reward: 90, difficulty: 3, target_value: 5, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Samedi (5)
  [
    { id: 'd_sat_1', title: 'Samedi Intense', description: 'Touche 50 cibles en une seule session', icon: 'flash', color: '#FF1744', xp_reward: 130, difficulty: 4, target_value: 50, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: true },
    { id: 'd_sat_2', title: 'Endurance Week-end', description: 'Complète une session Endurance', icon: 'trending-up', color: '#4CAF50', xp_reward: 110, difficulty: 3, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_sat_3', title: 'Force Max', description: 'Lance 2 sessions Max Power', icon: 'fitness', color: '#FF1744', xp_reward: 90, difficulty: 2, target_value: 2, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_sat_4', title: 'Score de Champion', description: 'Atteins 5000 points en une session', icon: 'trophy', color: '#FFD700', xp_reward: 150, difficulty: 4, target_value: 5000, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
  // Dimanche (6)
  [
    { id: 'd_sun_1', title: 'Dimanche Zen', description: 'Lance 1 session de ton choix', icon: 'game-controller-outline', color: '#00BCD4', xp_reward: 50, difficulty: 1, target_value: 1, current_value: 0, reset_type: 'daily', category: 'daily', completed: false, is_featured: false },
    { id: 'd_sun_2', title: 'Révision Mémoire', description: 'Lance 2 sessions Séquence Mémoire', icon: 'bulb', color: '#00BCD4', xp_reward: 100, difficulty: 3, target_value: 2, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_sun_3', title: 'Dernier Sprint', description: 'Touche 30 cibles dans n\'importe quel mode', icon: 'timer-outline', color: '#FF6D00', xp_reward: 80, difficulty: 2, target_value: 30, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
    { id: 'd_sun_4', title: 'Bilan XP', description: 'Complète 3 défis du jour', icon: 'star-outline', color: '#FFD700', xp_reward: 120, difficulty: 2, target_value: 3, current_value: 0, reset_type: 'daily', category: 'daily', completed: false },
  ],
];

/**
 * Retourne les défis du jour courant
 * dayOfWeek : 0=Lundi, 1=Mardi, ..., 6=Dimanche (JS getDay() retourne 0=Dimanche, on ajuste)
 */
export function getDailyChallenges(): Challenge[] {
  const jsDay = new Date().getDay(); // 0=Dimanche, 1=Lundi, ...
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convertit en 0=Lundi, ..., 6=Dimanche
  return DAILY_SETS[dayIndex] || DAILY_SETS[0];
}

// ═════════════════════════════════════════════════════════════════════════════
// DÉFIS HEBDOMADAIRES — Remis à zéro chaque lundi
// ═════════════════════════════════════════════════════════════════════════════

export const WEEKLY_CHALLENGES: Challenge[] = [
  {
    id: 'w_1', title: 'Centurion',
    description: 'Touche 100 cibles dans la semaine (tous modes confondus)',
    icon: 'flash', color: '#FFB700', xp_reward: 250, difficulty: 2,
    target_value: 100, current_value: 0, reset_type: 'weekly', category: 'performance', completed: false, is_featured: true,
  },
  {
    id: 'w_2', title: 'Semaine Complète',
    description: 'Lance au moins une session chaque jour de la semaine',
    icon: 'calendar', color: '#1ED760', xp_reward: 300, difficulty: 2,
    target_value: 7, current_value: 0, reset_type: 'weekly', category: 'streak', completed: false,
  },
  {
    id: 'w_3', title: 'Force Semaine',
    description: 'Atteins 15g de force au moins 5 fois dans la semaine',
    icon: 'fitness', color: '#E040FB', xp_reward: 275, difficulty: 3,
    target_value: 5, current_value: 0, reset_type: 'weekly', category: 'force', completed: false,
  },
  {
    id: 'w_4', title: 'Maître du Combo',
    description: 'Enchaîne un combo de 10 au moins 3 fois dans la semaine',
    icon: 'flame', color: '#FF9800', xp_reward: 250, difficulty: 3,
    target_value: 3, current_value: 0, reset_type: 'weekly', category: 'combo', completed: false,
  },
  {
    id: 'w_5', title: 'Tour des Modes',
    description: 'Lance 6 modes différents dans la semaine',
    icon: 'apps', color: '#448AFF', xp_reward: 200, difficulty: 2,
    target_value: 6, current_value: 0, reset_type: 'weekly', category: 'modes', completed: false,
  },
  {
    id: 'w_6', title: 'Score Hebdo 10K',
    description: 'Cumule 10 000 points dans la semaine',
    icon: 'star', color: '#FFD700', xp_reward: 350, difficulty: 3,
    target_value: 10000, current_value: 0, reset_type: 'weekly', category: 'score', completed: false,
  },
  {
    id: 'w_7', title: 'Survivant de la Semaine',
    description: 'Complète 3 sessions Survie dans la semaine',
    icon: 'heart', color: '#E91E63', xp_reward: 300, difficulty: 4,
    target_value: 3, current_value: 0, reset_type: 'weekly', category: 'modes', completed: false,
  },
  {
    id: 'w_8', title: 'Vitesse Semaine',
    description: 'Réagis en moins de 350ms au moins 10 fois dans la semaine',
    icon: 'speedometer', color: '#FF6D00', xp_reward: 275, difficulty: 3,
    target_value: 10, current_value: 0, reset_type: 'weekly', category: 'vitesse', completed: false,
  },
  {
    id: 'w_9', title: 'Entraîneur Assidu',
    description: 'Accumule 30 minutes de sessions dans la semaine',
    icon: 'time-outline', color: '#4CAF50', xp_reward: 225, difficulty: 2,
    target_value: 30, current_value: 0, reset_type: 'weekly', category: 'endurance', completed: false,
  },
  {
    id: 'w_10', title: 'Mémoire de la Semaine',
    description: 'Complète 5 sessions Séquence Mémoire dans la semaine',
    icon: 'bulb', color: '#00BCD4', xp_reward: 300, difficulty: 4,
    target_value: 5, current_value: 0, reset_type: 'weekly', category: 'cognitif', completed: false,
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// DÉFIS LIFETIME — Permanents, progressifs
// ═════════════════════════════════════════════════════════════════════════════

export const LIFETIME_CHALLENGES: Challenge[] = [
  {
    id: 'lt_1', title: '1 000 Cibles',
    description: 'Touche 1 000 cibles au total depuis le début',
    icon: 'flash', color: '#FFB700', xp_reward: 500, difficulty: 2,
    target_value: 1000, current_value: 0, reset_type: 'lifetime', category: 'performance', completed: false,
  },
  {
    id: 'lt_2', title: '10 000 Cibles',
    description: 'Touche 10 000 cibles au total',
    icon: 'flash', color: '#FF6D00', xp_reward: 2000, difficulty: 3,
    target_value: 10000, current_value: 0, reset_type: 'lifetime', category: 'performance', completed: false,
  },
  {
    id: 'lt_3', title: '100 000 Cibles',
    description: 'Touche 100 000 cibles au total — le vrai marathon',
    icon: 'flash', color: '#FF1744', xp_reward: 10000, difficulty: 5,
    target_value: 100000, current_value: 0, reset_type: 'lifetime', category: 'performance', completed: false,
  },
  {
    id: 'lt_4', title: '50 Sessions',
    description: 'Complète 50 sessions de jeu au total',
    icon: 'game-controller-outline', color: '#448AFF', xp_reward: 750, difficulty: 2,
    target_value: 50, current_value: 0, reset_type: 'lifetime', category: 'modes', completed: false,
  },
  {
    id: 'lt_5', title: '200 Sessions',
    description: 'Complète 200 sessions de jeu au total',
    icon: 'game-controller', color: '#448AFF', xp_reward: 3000, difficulty: 4,
    target_value: 200, current_value: 0, reset_type: 'lifetime', category: 'modes', completed: false,
  },
  {
    id: 'lt_6', title: 'Poing de Fer',
    description: 'Atteins 20g de force au moins 50 fois au total',
    icon: 'fitness', color: '#E040FB', xp_reward: 1500, difficulty: 4,
    target_value: 50, current_value: 0, reset_type: 'lifetime', category: 'force', completed: false,
  },
  {
    id: 'lt_7', title: 'Streak 30 Jours',
    description: 'Maintiens un streak de 30 jours consécutifs',
    icon: 'flame', color: '#FF9800', xp_reward: 2000, difficulty: 4,
    target_value: 30, current_value: 0, reset_type: 'lifetime', category: 'streak', completed: false,
  },
  {
    id: 'lt_8', title: 'XP 50 000',
    description: 'Cumule 50 000 XP',
    icon: 'star', color: '#FFD700', xp_reward: 3000, difficulty: 4,
    target_value: 50000, current_value: 0, reset_type: 'lifetime', category: 'progression', completed: false,
  },
  {
    id: 'lt_9', title: 'Roi du Combo',
    description: 'Obtiens le multiplicateur ×3 au moins 100 fois au total',
    icon: 'flame', color: '#FF9800', xp_reward: 2500, difficulty: 4,
    target_value: 100, current_value: 0, reset_type: 'lifetime', category: 'combo', completed: false,
  },
  {
    id: 'lt_10', title: 'Vitesse de l\'Éclair',
    description: 'Réagis en moins de 300ms au total 500 fois',
    icon: 'speedometer', color: '#FFB700', xp_reward: 4000, difficulty: 5,
    target_value: 500, current_value: 0, reset_type: 'lifetime', category: 'vitesse', completed: false,
  },
  {
    id: 'lt_11', title: 'Défis Légendaire',
    description: 'Complète 100 défis au total',
    icon: 'trophy', color: '#FFD700', xp_reward: 5000, difficulty: 5,
    target_value: 100, current_value: 0, reset_type: 'lifetime', category: 'defis', completed: false,
  },
];