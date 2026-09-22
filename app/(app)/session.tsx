/**
 * session.tsx
 *
 * EMPLACEMENT : app/(app)/session.tsx
 * (PAS dans (tabs)/training/ — ce dossier doit être supprimé)
 *
 * INTÉGRATION BLE :
 *   Quand l'ESP32 détecte un impact, il envoie via BLE :
 *     { force_g: number, timestamp_ms: number }
 *   Il suffit d'appeler registerHit(force_g, timestamp_ms) depuis ton module BLE.
 *
 * APRÈS SESSION :
 *   Les données sont envoyées à l'API via api.post('/sessions', { ... })
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/colors';
import api from '../../src/api';
import { updateChallengesAfterSession } from '../../src/challengeTracker';

// ─── Helpers ──────────────────────────────────────────────
const rgba = (hex: string, a: number) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return `rgba(30,215,96,${a})`; }
};

const fmt = (ms: number) => ms > 0 ? `${ms}ms` : '—';
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ─── Durées par mode ──────────────────────────────────────
const DURATIONS: Record<string, number> = {
  'flash': 30, 'multi-rush': 45, 'force-challenge': 60,
  'max-power': 30, 'sequence': 60, 'memory-seq': 90,
  'fake-targets': 60, 'sprint-60': 60, 'endurance': 120,
  'survival': 0, 'combo-king': 60,
};

// ─── Calcul du score ──────────────────────────────────────
// Basé sur ce qu'on peut RÉELLEMENT mesurer via l'accéléromètre :
//   - Force de l'impact (g)
//   - Temps de réaction (ms entre deux impacts)
//   - Combo (enchaînement)
// PAS de précision, PAS de ratés (non détectables sans cible intelligente)
function computePoints(forceG: number, reactionMs: number, combo: number, isComboMode: boolean): number {
  const base      = 100;
  const forceMult = forceG >= 20 ? 1.8 : forceG >= 15 ? 1.5 : forceG >= 10 ? 1.2 : 1.0;
  const speedMult = reactionMs > 0 && reactionMs < 300 ? 2.0
    : reactionMs < 500 ? 1.6
    : reactionMs < 800 ? 1.3
    : 1.0;
  const comboMult = isComboMode ? Math.min(1 + (combo - 1) * 0.5, 3.0) : 1.0;
  return Math.round(base * forceMult * speedMult * comboMult);
}

// ─── Types ────────────────────────────────────────────────
type Phase = 'waiting' | 'countdown' | 'playing' | 'finished';

interface HitRecord {
  timestamp: number;
  force_g:   number;
  reaction:  number;
  points:    number;
}

// ══════════════════════════════════════════════════════════
export default function SessionScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{
    slug: string; name: string; color: string;
    icon: string; description: string; difficulty: string; min_targets: string;
  }>();

  const color      = p.color || COLORS.primary;
  const slug       = p.slug  || 'flash';
  const totalTime  = DURATIONS[slug] ?? 60;
  const isSurvival = slug === 'survival';
  const isCombo    = slug === 'combo-king';

  // ── États ───────────────────────────────────────────────
  const [phase,     setPhase]     = useState<Phase>('waiting');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft,  setTimeLeft]  = useState(totalTime);
  const [score,     setScore]     = useState(0);
  const [hits,      setHits]      = useState<HitRecord[]>([]);
  const [combo,     setCombo]     = useState(0);
  const [maxCombo,  setMaxCombo]  = useState(0);
  const [lives,     setLives]     = useState(3);
  const [saving,              setSaving]              = useState(false);
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([]);

  // Simulated BLE state (remplace par ton vrai module BLE)
  const [bleOk, setBleOk] = useState(false);

  // ── Animations ──────────────────────────────────────────
  const scoreAnim = useRef(new Animated.Value(1)).current;
  const hitAnim   = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(1)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHit   = useRef<number>(0);

  const pop = (a: Animated.Value) => {
    a.setValue(0.4);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 5, stiffness: 280 }).start();
  };

  // ── Countdown ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    let c = 3; setCountdown(c);
    countRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      pop(countAnim); c--;
      if (c <= 0) {
        clearInterval(countRef.current!);
        lastHit.current = Date.now();
        setPhase('playing');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else { setCountdown(c); }
    }, 1000);
    return () => clearInterval(countRef.current!);
  }, [phase]);

  // ── Timer ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || totalTime === 0) return;
    setTimeLeft(totalTime);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); endSession(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  // ── Fin de session ───────────────────────────────────────
  const endSession = useCallback(() => {
    clearInterval(timerRef.current!);
    setPhase('finished');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  // ── Enregistrer un impact ────────────────────────────────
  // ⬇⬇⬇  POINT D'INTÉGRATION BLE  ⬇⬇⬇
  // Appelle cette fonction depuis ton module BLE quand l'ESP32
  // envoie un impact. Exemple :
  //   bleDevice.onData(data => registerHit(data.force_g, data.timestamp))
  //
  // forceG  : force de l'impact en g (depuis l'accéléromètre ESP32)
  // tsMs    : timestamp de l'impact en ms (Date.now() si non fourni)
  const registerHit = useCallback((forceG: number, tsMs?: number) => {
    if (phase !== 'playing') return;
    const now      = tsMs ?? Date.now();
    const reaction = lastHit.current > 0 ? now - lastHit.current : 0;
    lastHit.current = now;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    pop(scoreAnim);
    pop(hitAnim);

    setCombo(c => {
      const nc  = c + 1;
      const pts = computePoints(forceG, reaction, nc, isCombo);
      setMaxCombo(m => Math.max(m, nc));
      setScore(s => s + pts);
      setHits(h => [...h, { timestamp: now, force_g: forceG, reaction, points: pts }]);
      return nc;
    });
  }, [phase, isCombo]);

  // ── Vie perdue (mode Survie) ─────────────────────────────
  // Appelle quand l'ESP32 signale qu'une cible a expiré
  const lostLife = useCallback(() => {
    if (phase !== 'playing' || !isSurvival) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCombo(0);
    setLives(l => { const nl = l - 1; if (nl <= 0) endSession(); return Math.max(nl, 0); });
  }, [phase, isSurvival, endSession]);

  // ── Sauvegarder en BDD + mettre à jour les défis ─────────
  const saveSession = async () => {
    setSaving(true);

    const hitsArr = hits; // snapshot
    const sessionData = {
      slug,
      mode:          slug,
      score,
      total_hits:    hitsArr.length,
      max_combo:     maxCombo,
      avg_force_g:   hitsArr.length ? parseFloat((hitsArr.reduce((a, b) => a + b.force_g, 0) / hitsArr.length).toFixed(2)) : 0,
      max_force_g:   hitsArr.length ? parseFloat(Math.max(...hitsArr.map(h => h.force_g)).toFixed(2)) : 0,
      avg_reaction:  hitsArr.length ? Math.round(hitsArr.filter(h => h.reaction > 0).reduce((a, b) => a + b.reaction, 0) / hitsArr.length) : 0,
      duration_s:    totalTime > 0 ? totalTime - timeLeft : 0,
      xp_earned:     Math.round(score / 10 + hitsArr.length * 5),
      lives_lost:    isSurvival ? 3 - lives : 0,
    };

    try {
      // 1. Sauvegarder la session en BDD
      await api.post('/sessions', sessionData);
    } catch (e) {
      console.warn('Erreur sauvegarde session:', e);
    }

    try {
      // 2. Mettre à jour la progression des défis
      const { newlyCompleted } = await updateChallengesAfterSession(sessionData);
      if (newlyCompleted.length > 0) {
        setCompletedChallenges(newlyCompleted);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn('Erreur challenge tracker:', e);
    }

    setSaving(false);
  };

  useEffect(() => {
    if (phase === 'finished') saveSession();
  }, [phase]);

  // ── Calculs résultats ────────────────────────────────────
  const totalHits   = hits.length;
  const maxForce    = totalHits ? Math.max(...hits.map(h => h.force_g)) : 0;
  const avgForce    = totalHits ? hits.reduce((a, b) => a + b.force_g, 0) / totalHits : 0;
  const reactions   = hits.filter(h => h.reaction > 0).map(h => h.reaction);
  const avgReaction = reactions.length ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length) : 0;
  const minReaction = reactions.length ? Math.min(...reactions) : 0;
  const xpEarned    = Math.round(score / 10 + totalHits * 5);
  const timerPct    = totalTime > 0 ? timeLeft / totalTime : 1;

  // ── Grade ────────────────────────────────────────────────
  const grade = totalHits === 0 ? 'C'
    : maxCombo >= 15 && avgReaction < 350 ? 'S'
    : maxCombo >= 8  || avgReaction < 500 ? 'A'
    : totalHits >= 10 ? 'B' : 'C';
  const gradeCol = grade === 'S' ? '#FFD700' : grade === 'A' ? '#1ED760' : grade === 'B' ? color : 'rgba(255,255,255,0.3)';

  const resetReplay = () => {
    setScore(0); setHits([]); setCombo(0); setMaxCombo(0); setLives(3); setTimeLeft(totalTime);
    lastHit.current = 0; setSaving(false);
    setPhase('countdown');
  };

  // ══════════════════════════════════════════
  // VUE : EN ATTENTE / CONNEXION
  // ══════════════════════════════════════════
  if (phase === 'waiting') return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <View style={[s.modeChip, { backgroundColor: rgba(color, 0.15), borderColor: rgba(color, 0.35) }]}>
          <Ionicons name={p.icon as any} size={16} color={color} />
          <Text style={[s.modeChipTxt, { color }]}>{p.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Infos mode */}
      <View style={s.waitingBody}>
        <View style={[s.bigIcon, { backgroundColor: rgba(color, 0.1), borderColor: rgba(color, 0.3) }]}>
          <Ionicons name={p.icon as any} size={56} color={color} />
        </View>
        <Text style={s.waitingTitle}>{p.name}</Text>
        <Text style={s.waitingDesc}>{p.description}</Text>

        <View style={s.metaRow}>
          {totalTime > 0 && <View style={s.chip}><Ionicons name="timer-outline" size={13} color={COLORS.textSecondary} /><Text style={s.chipTxt}>{totalTime}s</Text></View>}
          {isSurvival && <View style={s.chip}><Ionicons name="heart-outline" size={13} color="#E91E63" /><Text style={[s.chipTxt, { color: '#E91E63' }]}>3 vies</Text></View>}
          <View style={s.chip}>
            <View style={s.diffRow}>
              {[1,2,3,4,5].map(i => <View key={i} style={[s.diffDot, { backgroundColor: i <= parseInt(p.difficulty) ? color : 'rgba(255,255,255,0.1)' }]} />)}
            </View>
          </View>
        </View>

        {/* Système de score */}
        <View style={s.scoreCard}>
          <Text style={s.scoreCardTitle}>SCORE EN TEMPS RÉEL</Text>
          <View style={s.scoreRow}><Ionicons name="flash" size={14} color="#FFB700" /><Text style={s.scoreRowTxt}>Vitesse → réaction rapide = +points</Text></View>
          <View style={s.scoreRow}><Ionicons name="fitness" size={14} color="#E040FB" /><Text style={s.scoreRowTxt}>Force → frappe forte = +points</Text></View>
          {isCombo && <View style={s.scoreRow}><Ionicons name="flame" size={14} color="#FF9800" /><Text style={s.scoreRowTxt}>Combo → enchaînement = jusqu'à ×3</Text></View>}
        </View>
      </View>

      {/* Statut BLE */}
      <View style={[s.bleCard, { borderColor: bleOk ? 'rgba(30,215,96,0.3)' : rgba(color, 0.3) }]}>
        <View style={[s.bleDot, { backgroundColor: bleOk ? '#1ED760' : '#FF6D00' }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.bleTitle, { color: bleOk ? '#1ED760' : '#FF6D00' }]}>
            {bleOk ? 'ESP32 connecté' : 'ESP32 non connecté'}
          </Text>
          <Text style={s.bleSub}>
            {bleOk ? 'Les impacts seront détectés automatiquement' : 'Connecte ton appareil pour enregistrer de vraies données'}
          </Text>
        </View>
      </View>

      {/* Bouton lancer */}
      <TouchableOpacity
        style={[s.launchBtn, { backgroundColor: color }]}
        onPress={() => setPhase('countdown')}
        activeOpacity={0.85}
      >
        <Ionicons name="play" size={22} color="#fff" />
        <Text style={s.launchBtnTxt}>LANCER</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  // ══════════════════════════════════════════
  // VUE : COUNTDOWN
  // ══════════════════════════════════════════
  if (phase === 'countdown') return (
    <View style={[s.container, s.center]}>
      <Animated.Text style={[s.countNum, { color, transform: [{ scale: countAnim }] }]}>
        {countdown}
      </Animated.Text>
      <Text style={s.countSub}>GO !</Text>
    </View>
  );

  // ══════════════════════════════════════════
  // VUE : JEU EN COURS
  // ══════════════════════════════════════════
  if (phase === 'playing') return (
    <SafeAreaView style={s.container}>
      {/* Header jeu */}
      <View style={s.gameTop}>
        <TouchableOpacity style={s.stopBtn} onPress={endSession}>
          <Ionicons name="stop" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {isSurvival
            ? <View style={s.livesRow}>{[1,2,3].map(i => <Ionicons key={i} name={i <= lives ? 'heart' : 'heart-outline'} size={24} color="#E91E63" />)}</View>
            : <>
                <View style={s.timerRow}>
                  <Ionicons name="timer-outline" size={14} color={color} />
                  <Text style={[s.timerTxt, { color }]}>{fmtTime(timeLeft)}</Text>
                </View>
                <View style={s.timerTrack}><View style={[s.timerFill, { width: `${timerPct * 100}%`, backgroundColor: color }]} /></View>
              </>
          }
        </View>
        {/* BLE indicator */}
        <View style={[s.bleMini, { backgroundColor: bleOk ? 'rgba(30,215,96,0.15)' : 'rgba(255,109,0,0.15)' }]}>
          <View style={[s.bleMiniDot, { backgroundColor: bleOk ? '#1ED760' : '#FF6D00' }]} />
        </View>
      </View>

      {/* Score */}
      <View style={s.scoreArea}>
        <Text style={s.scoreLbl}>SCORE</Text>
        <Animated.Text style={[s.scoreBig, { transform: [{ scale: scoreAnim }] }]}>
          {score.toLocaleString()}
        </Animated.Text>
        {combo >= 2 && (
          <View style={[s.comboPill, { backgroundColor: rgba(color, 0.18) }]}>
            <Ionicons name="flame" size={13} color={color} />
            <Text style={[s.comboTxt, { color }]}>COMBO ×{combo}</Text>
          </View>
        )}
      </View>

      {/* 3 métriques principales */}
      <View style={s.metricsRow}>
        {/* Nombre de tirs */}
        <View style={s.metricCard}>
          <View style={[s.metricIcon, { backgroundColor: rgba('#1ED760', 0.12) }]}>
            <Ionicons name="flash" size={18} color="#1ED760" />
          </View>
          <Animated.Text style={[s.metricBig, { color: '#1ED760', transform: [{ scale: hitAnim }] }]}>
            {totalHits}
          </Animated.Text>
          <Text style={s.metricLbl}>TIRS</Text>
        </View>

        {/* Force */}
        <View style={[s.metricCard, s.metricCardCenter, { borderColor: rgba(color, 0.15) }]}>
          <View style={[s.metricIcon, { backgroundColor: rgba('#E040FB', 0.12) }]}>
            <Ionicons name="fitness" size={18} color="#E040FB" />
          </View>
          <Text style={[s.metricBig, { color: '#E040FB' }]}>
            {maxForce > 0 ? `${maxForce.toFixed(1)}g` : '—'}
          </Text>
          <Text style={s.metricLbl}>FORCE MAX</Text>
        </View>

        {/* Vitesse */}
        <View style={s.metricCard}>
          <View style={[s.metricIcon, { backgroundColor: rgba('#FFB700', 0.12) }]}>
            <Ionicons name="speedometer" size={18} color="#FFB700" />
          </View>
          <Text style={[s.metricBig, { color: '#FFB700' }]}>
            {avgReaction > 0 ? `${avgReaction}` : '—'}
          </Text>
          <Text style={s.metricLbl}>{avgReaction > 0 ? 'MS MOY.' : 'VITESSE'}</Text>
        </View>
      </View>

      {/* Zone centrale — Attente ESP32 ou dernier impact */}
      <View style={[s.centerZone, { borderColor: rgba(color, 0.2) }]}>
        {totalHits === 0 ? (
          <>
            <View style={[s.pulseRing, { borderColor: rgba(color, 0.3) }]} />
            <Ionicons name="hardware-chip-outline" size={36} color={rgba(color, 0.4)} />
            <Text style={[s.waitTxt, { color: rgba(color, 0.5) }]}>En attente d'un impact…</Text>
            <Text style={s.waitSub}>L'ESP32 détectera automatiquement tes frappes</Text>
          </>
        ) : (
          <>
            <Text style={[s.lastHitForce, { color }]}>{hits[hits.length - 1]?.force_g.toFixed(1)}g</Text>
            <Text style={s.lastHitLbl}>DERNIÈRE FRAPPE</Text>
            {hits[hits.length - 1]?.reaction > 0 && (
              <Text style={s.lastHitReact}>{hits[hits.length - 1]?.reaction}ms de réaction</Text>
            )}
          </>
        )}
      </View>

      {/* Combo en bas */}
      <View style={s.bottomRow}>
        <View style={s.bottomStat}>
          <Ionicons name="flame-outline" size={14} color="rgba(255,255,255,0.3)" />
          <Text style={s.bottomStatTxt}>Meilleur combo : <Text style={{ color: '#FF9800' }}>×{maxCombo}</Text></Text>
        </View>
      </View>
    </SafeAreaView>
  );

  // ══════════════════════════════════════════
  // VUE : RÉSULTATS
  // ══════════════════════════════════════════
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.resultScroll} showsVerticalScrollIndicator={false}>

        {/* Grade + score */}
        <View style={s.resultTop}>
          <View style={[s.gradeCircle, { borderColor: gradeCol, backgroundColor: rgba(gradeCol, 0.1) }]}>
            <Text style={[s.gradeTxt, { color: gradeCol }]}>{grade}</Text>
          </View>
          <Text style={[s.resultScore, { color }]}>{score.toLocaleString()}</Text>
          <Text style={s.resultScoreLbl}>POINTS</Text>
          <View style={s.xpRow}>
            <Ionicons name="star" size={14} color="#FFD600" />
            <Text style={s.xpTxt}>+{xpEarned} XP {saving ? '(sauvegarde…)' : '✓'}</Text>
          </View>
        </View>

        {/* Défis complétés pendant cette session */}
        {completedChallenges.length > 0 && (
          <View style={s.challengesBanner}>
            <View style={s.challengesBannerHeader}>
              <Ionicons name="trophy" size={16} color="#FFD600" />
              <Text style={s.challengesBannerTitle}>
                {completedChallenges.length === 1 ? 'Défi complété !' : `${completedChallenges.length} défis complétés !`}
              </Text>
            </View>
            {completedChallenges.map((title, i) => (
              <View key={i} style={s.challengeItem}>
                <Ionicons name="checkmark-circle" size={14} color="#1ED760" />
                <Text style={s.challengeItemTxt}>{title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 4 stats principales */}
        <View style={s.statGrid}>
          <View style={s.statBox}>
            <Ionicons name="flash" size={22} color="#1ED760" />
            <Text style={[s.statBig, { color: '#1ED760' }]}>{totalHits}</Text>
            <Text style={s.statLbl}>Tirs enregistrés</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="fitness" size={22} color="#E040FB" />
            <Text style={[s.statBig, { color: '#E040FB' }]}>{maxForce > 0 ? `${maxForce.toFixed(1)}g` : '—'}</Text>
            <Text style={s.statLbl}>Force maximale</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="speedometer" size={22} color="#FFB700" />
            <Text style={[s.statBig, { color: '#FFB700' }]}>{avgReaction > 0 ? `${avgReaction}ms` : '—'}</Text>
            <Text style={s.statLbl}>Réaction moyenne</Text>
          </View>
          <View style={s.statBox}>
            <Ionicons name="flame" size={22} color="#FF9800" />
            <Text style={[s.statBig, { color: '#FF9800' }]}>×{maxCombo}</Text>
            <Text style={s.statLbl}>Meilleur combo</Text>
          </View>
        </View>

        {/* Stats détaillées */}
        {totalHits > 0 && (
          <View style={s.detailCard}>
            <Text style={s.detailTitle}>DÉTAILS</Text>
            {[
              { lbl: 'Force moyenne',       val: `${avgForce.toFixed(1)}g`,         icon: 'analytics-outline', col: '#E040FB' },
              { lbl: 'Meilleure réaction',  val: minReaction > 0 ? `${minReaction}ms` : '—', icon: 'flash-outline', col: '#FFB700' },
              { lbl: 'Cadence',             val: totalHits > 0 && totalTime > 0 ? `${(totalHits / (totalTime / 60)).toFixed(1)} tirs/min` : '—', icon: 'timer-outline', col: '#448AFF' },
            ].map(d => (
              <View key={d.lbl} style={s.detailRow}>
                <Ionicons name={d.icon as any} size={14} color={d.col} />
                <Text style={s.detailLbl}>{d.lbl}</Text>
                <Text style={[s.detailVal, { color: d.col }]}>{d.val}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Boutons */}
        <View style={s.resultBtns}>
          <TouchableOpacity style={[s.replayBtn, { borderColor: color }]} onPress={resetReplay}>
            <Ionicons name="refresh" size={18} color={color} />
            <Text style={[s.replayTxt, { color }]}>Rejouer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: color }]} onPress={() => router.back()}>
            <Text style={s.doneTxt}>Terminer</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center:    { justifyContent: 'center', alignItems: 'center' },

  // Waiting
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:       { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  modeChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  modeChipTxt:   { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  waitingBody:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  bigIcon:       { width: 100, height: 100, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  waitingTitle:  { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8 },
  waitingDesc:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  metaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipTxt:       { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  diffRow:       { flexDirection: 'row', gap: 3 },
  diffDot:       { width: 6, height: 6, borderRadius: 3 },
  scoreCard:     { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  scoreCardTitle:{ fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 4 },
  scoreRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreRowTxt:   { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  bleCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  bleDot:        { width: 10, height: 10, borderRadius: 5 },
  bleTitle:      { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  bleSub:        { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  launchBtn:     { marginHorizontal: 20, marginBottom: 24, borderRadius: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  launchBtnTxt:  { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 3 },

  // Countdown
  countNum: { fontSize: 150, fontWeight: '900', letterSpacing: -6 },
  countSub: { fontSize: 20, color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 4, marginTop: 8 },

  // Playing
  gameTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  stopBtn:    { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  timerRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  timerTxt:   { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  timerTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  timerFill:  { height: '100%', borderRadius: 2 },
  livesRow:   { flexDirection: 'row', gap: 8 },
  bleMini:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bleMiniDot: { width: 8, height: 8, borderRadius: 4 },
  scoreArea:  { alignItems: 'center', paddingVertical: 10 },
  scoreLbl:   { fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '800', letterSpacing: 4 },
  scoreBig:   { fontSize: 72, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  comboPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  comboTxt:   { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  metricsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 14, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  metricCardCenter: { borderWidth: 1 },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricBig:  { fontSize: 22, fontWeight: '900' },
  metricLbl:  { fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 1.5 },
  centerZone: { flex: 1, marginHorizontal: 20, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pulseRing:  { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5 },
  waitTxt:    { fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  waitSub:    { fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  lastHitForce:{ fontSize: 56, fontWeight: '900' },
  lastHitLbl: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 3 },
  lastHitReact:{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  bottomRow:  { paddingHorizontal: 20, paddingVertical: 14 },
  bottomStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomStatTxt:{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  // Results
  resultScroll: { paddingHorizontal: 20, paddingTop: 20 },
  resultTop:    { alignItems: 'center', marginBottom: 24 },
  gradeCircle:  { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  gradeTxt:     { fontSize: 36, fontWeight: '900' },
  resultScore:  { fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  resultScoreLbl:{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: '800', letterSpacing: 4 },
  xpRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(255,214,0,0.1)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  xpTxt:        { fontSize: 13, color: '#FFD600', fontWeight: '700' },
  statGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 14 },
  statBox:      { width: '47%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, alignItems: 'center', gap: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  statBig:      { fontSize: 24, fontWeight: '900' },
  statLbl:      { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  detailCard:   { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  detailTitle:  { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.25)', letterSpacing: 2, marginBottom: 12 },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailLbl:    { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  detailVal:    { fontSize: 14, fontWeight: '800' },
  resultBtns:   { flexDirection: 'row', gap: 12 },
  replayBtn:    { flex: 1, borderWidth: 1.5, borderRadius: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  replayTxt:    { fontSize: 15, fontWeight: '700' },
  doneBtn:      { flex: 1, borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  doneTxt:      { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Bannière défis complétés
  challengesBanner:     { backgroundColor: 'rgba(255,214,0,0.08)', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,214,0,0.25)' },
  challengesBannerHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  challengesBannerTitle: { fontSize: 14, fontWeight: '800', color: '#FFD600' },
  challengeItem:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  challengeItemTxt:      { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});