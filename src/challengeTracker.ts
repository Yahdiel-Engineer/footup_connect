/**
 * challengeTracker.ts
 * Placer dans : src/challengeTracker.ts
 *
 * Ce module fait le lien entre une session terminée et les défis.
 * Il est appelé depuis session.tsx après chaque session.
 *
 * Fonctionnement :
 *  1. Charge la progression locale depuis AsyncStorage
 *  2. Pour chaque défi actif, calcule la progression selon les données de session
 *  3. Marque comme complété si target atteint
 *  4. Sauvegarde en local + tente de sync avec l'API
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyChallenges, WEEKLY_CHALLENGES, LIFETIME_CHALLENGES } from './badges-challenges-data';
import api from './api';

// ─── Types ────────────────────────────────────────────────
export interface SessionResult {
  slug:          string;   // mode joué (ex: 'memory-seq', 'sprint-60')
  total_hits:    number;   // nombre de tirs enregistrés
  max_combo:     number;   // meilleur combo de la session
  max_force_g:   number;   // force maximale en g
  avg_force_g:   number;   // force moyenne en g
  avg_reaction:  number;   // temps de réaction moyen en ms
  score:         number;   // score total
  duration_s:    number;   // durée en secondes
  lives_lost?:   number;   // vies perdues (mode survie)
}

interface ChallengeProgress {
  [challengeId: string]: {
    current_value: number;
    completed:     boolean;
    completed_at?: string;
  };
}

const PROGRESS_KEY     = 'footup_challenge_progress';
const DAILY_RESET_KEY  = 'footup_daily_reset_date';
const WEEKLY_RESET_KEY = 'footup_weekly_reset_date';

// ─── Helpers ──────────────────────────────────────────────
function todayStr()  { return new Date().toISOString().split('T')[0]; }
function mondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// ─── Calcule combien cette session contribue à un défi ────
function sessionContribution(challenge: any, session: SessionResult): number {
  const t = challenge.title.toLowerCase();
  const d = challenge.description.toLowerCase();
  const slug = session.slug;

  // ── Défis basés sur le MODE joué ──
  const modeMap: Record<string, string[]> = {
    'memory-seq':      ['séquence mémoire', 'mémoire', 'memory'],
    'sequence':        ['mode séquence', 'séquence'],
    'sprint-60':       ['sprint 60', 'sprint'],
    'flash':           ['mode flash', 'flash'],
    'multi-rush':      ['multi-target', 'rush'],
    'force-challenge': ['défi force', 'force'],
    'max-power':       ['max power', 'puissance'],
    'fake-targets':    ['fausses cibles', 'fake'],
    'survival':        ['survie', 'survival'],
    'combo-king':      ['combo king'],
    'endurance':       ['endurance'],
  };

  const modeKeywords = modeMap[slug] || [];
  const textMatch = modeKeywords.some(kw => t.includes(kw) || d.includes(kw));

  // Défi "Lance 1 session [mode]"
  if (challenge.target_value === 1 && textMatch) return 1;
  // Défi "Lance N sessions [mode]"
  if (challenge.target_value > 1 && textMatch && (t.includes('session') || t.includes('complet'))) return 1;

  // ── Défis basés sur le NOMBRE DE TIRS ──
  if (
    t.includes('touche') || t.includes('cibles') || t.includes('tirs') ||
    t.includes('impacts') || d.includes('cibles') || d.includes('impacts')
  ) {
    // "Touche X cibles en une session" → one-shot
    if (d.includes('en une session') || d.includes('en 60 secondes') || d.includes('par session')) {
      return session.total_hits >= challenge.target_value ? challenge.target_value : session.total_hits;
    }
    // Cumulatif (semaine / lifetime)
    return session.total_hits;
  }

  // ── Défis basés sur le SCORE ──
  if (t.includes('score') || t.includes('points') || d.includes('points')) {
    if (d.includes('en une session')) {
      return session.score >= challenge.target_value ? challenge.target_value : 0;
    }
    return session.score;
  }

  // ── Défis basés sur la FORCE ──
  if (t.includes('force') || d.includes('force') || d.includes('g de force')) {
    const match = d.match(/(\d+)g/);
    const required = match ? parseInt(match[1]) : 10;
    if (session.max_force_g >= required) return 1;
    return 0;
  }

  // ── Défis basés sur le COMBO ──
  if (t.includes('combo') || d.includes('combo')) {
    const match = d.match(/(\d+)\s*impacts?/);
    const required = match ? parseInt(match[1]) : 5;
    if (session.max_combo >= required) return 1;
    return 0;
  }

  // ── Défis basés sur la VITESSE / RÉACTION ──
  if (t.includes('réaction') || d.includes('ms') || d.includes('réagis')) {
    const match = d.match(/(\d+)ms/);
    const required = match ? parseInt(match[1]) : 400;
    if (session.avg_reaction > 0 && session.avg_reaction <= required) return 1;
    return 0;
  }

  // ── Défis "Lance X modes différents" ──
  if (d.includes('modes différents') || t.includes('modes différents')) return 1;

  // ── Défis "Complète X sessions" ──
  if (t.includes('sessions') || d.includes('sessions dans')) return 1;

  // ── Défis Survie ──
  if (slug === 'survival') {
    if (t.includes('survie') || d.includes('survie')) {
      if (d.includes('sans perdre') && (session.lives_lost ?? 0) === 0) return 1;
      if (d.includes('3 vies restantes') && (session.lives_lost ?? 0) === 0) return 1;
      return 1;
    }
  }

  // ── Défi générique "Lance une session" ──
  if (t.includes('lance') && (t.includes('session') || t.includes('mode'))) return 1;

  return 0;
}

// ─── Fonction principale ──────────────────────────────────
export async function updateChallengesAfterSession(session: SessionResult): Promise<{
  newlyCompleted: string[]; // titres des défis fraîchement complétés
}> {
  const newlyCompleted: string[] = [];

  try {
    // 1. Charger la progression locale
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    const progress: ChallengeProgress = raw ? JSON.parse(raw) : {};

    // 2. Reset quotidien si nouveau jour
    const lastDailyReset  = await AsyncStorage.getItem(DAILY_RESET_KEY);
    const lastWeeklyReset = await AsyncStorage.getItem(WEEKLY_RESET_KEY);
    const today   = todayStr();
    const monday  = mondayStr();

    if (lastDailyReset !== today) {
      // Supprimer la progression des défis daily
      getDailyChallenges().forEach(ch => { delete progress[ch.id]; });
      await AsyncStorage.setItem(DAILY_RESET_KEY, today);
    }
    if (lastWeeklyReset !== monday) {
      // Supprimer la progression des défis weekly
      WEEKLY_CHALLENGES.forEach(ch => { delete progress[ch.id]; });
      await AsyncStorage.setItem(WEEKLY_RESET_KEY, monday);
    }

    // 3. Tous les défis actifs
    const allChallenges = [
      ...getDailyChallenges(),
      ...WEEKLY_CHALLENGES,
      ...LIFETIME_CHALLENGES,
    ];

    // 4. Mettre à jour la progression
    for (const ch of allChallenges) {
      const current = progress[ch.id] ?? { current_value: 0, completed: false };
      if (current.completed) continue; // déjà fait, skip

      const contribution = sessionContribution(ch, session);
      if (contribution <= 0) continue;

      const newValue = current.current_value + contribution;
      const isNowComplete = newValue >= ch.target_value;

      progress[ch.id] = {
        current_value: Math.min(newValue, ch.target_value),
        completed:     isNowComplete,
        completed_at:  isNowComplete ? new Date().toISOString() : undefined,
      };

      if (isNowComplete) {
        newlyCompleted.push(ch.title);
        // Tenter de notifier l'API (non bloquant)
        api.post('/challenges/complete', {
          challenge_id: ch.id,
          score:        session.score,
        }).catch(() => {}); // silencieux si pas de connexion
      }
    }

    // 5. Sauvegarder en local
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));

  } catch (e) {
    console.warn('ChallengeTracker error:', e);
  }

  return { newlyCompleted };
}

// ─── Lire la progression pour challenges.tsx ─────────────
export async function loadChallengeProgress(): Promise<ChallengeProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/**
 * Merge la progression locale dans les défis pour l'affichage.
 * Appelle dans challenges.tsx pour que les barres de progression soient à jour.
 */
export async function getMergedChallenges(challenges: any[]): Promise<any[]> {
  const progress = await loadChallengeProgress();
  return challenges.map(ch => ({
    ...ch,
    current_value: progress[ch.id]?.current_value ?? ch.current_value ?? 0,
    completed:     progress[ch.id]?.completed     ?? ch.completed ?? false,
  }));
}