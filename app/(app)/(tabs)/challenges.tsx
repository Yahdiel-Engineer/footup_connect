import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Share, Modal, TextInput, Alert,
  Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

// ─── Données locales (badges + défis) ────────────────────
// Adapte le chemin selon où tu as placé le fichier
import {
  ALL_BADGES,
  getDailyChallenges,
  WEEKLY_CHALLENGES,
  LIFETIME_CHALLENGES,
  type Badge,
  type Challenge,
} from '../../../src/badges-challenges-data';
import { getMergedChallenges } from '../../../src/challengeTracker';

// ─── Types ───────────────────────────────────────────────
type Tab        = 'daily' | 'weekly' | 'lifetime' | 'badges';
type BadgeTier  = 'bronze' | 'silver' | 'gold' | 'special';
type Rarity     = 'common' | 'uncommon' | 'rare' | 'legendary';
type BadgeFilter = 'all' | 'earned' | 'locked';

const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', special: '#FF1744',
};
const RARITY_COLORS: Record<Rarity, string> = {
  common: 'rgba(255,255,255,0.3)', uncommon: '#448AFF', rare: '#E040FB', legendary: '#FFD700',
};

// ─── Barre de progression ─────────────────────────────────
function ProgressBar({ current, target, color }: { current: number; target: number; color: string }) {
  const pct  = Math.min(current / target, 1);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, {
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        backgroundColor: color,
      }]} />
    </View>
  );
}
const pb = StyleSheet.create({
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill:  { height: '100%', borderRadius: 2 },
});

// ─── Carte badge ──────────────────────────────────────────
function BadgeCard({ badge }: { badge: Badge }) {
  const tier       = (badge.tier   || 'bronze') as BadgeTier;
  const rarity     = (badge.rarity || 'common') as Rarity;
  const tierColor  = TIER_COLORS[tier];
  const rarityColor = RARITY_COLORS[rarity];

  return (
    <View style={[
      bc.card,
      !badge.earned && bc.cardLocked, // État gris si pas validé
      badge.earned && { borderColor: 'rgba(30,215,96,0.3)' }, // Bordure verte si validé
    ]}>
      {/* Checkmark vert uniquement si gagné */}
      {badge.earned && (
        <View style={bc.checkBadge}>
          <Ionicons name="checkmark" size={10} color="#fff" />
        </View>
      )}
      
      <View style={[
        bc.iconWrap, 
        badge.earned ? { borderColor: tierColor } : { borderColor: 'rgba(255,255,255,0.05)' }
      ]}>
        <Ionicons
          name={(badge.icon || 'star-outline') as any}
          size={28}
          color={badge.earned ? tierColor : 'rgba(255,255,255,0.05)'}
        />
      </View>

      <View style={[
        bc.tierPill, 
        { backgroundColor: badge.earned ? tierColor + '22' : 'transparent', 
          borderColor: badge.earned ? tierColor + '55' : 'rgba(255,255,255,0.1)' }
      ]}>
        <Text style={[bc.tierTxt, { color: badge.earned ? tierColor : 'rgba(255,255,255,0.2)' }]}>
          {tier.toUpperCase()}
        </Text>
      </View>

      <Text style={[bc.title, !badge.earned && { color: 'rgba(255,255,255,0.2)' }]} numberOfLines={2}>
        {badge.title}
      </Text>
      
      {badge.earned && badge.xp_reward > 0 && (
        <View style={bc.xpRow}>
          <Ionicons name="star" size={9} color="#FFD600" />
          <Text style={bc.xpTxt}>+{badge.xp_reward} XP</Text>
        </View>
      )}
    </View>
  );
}

const bc = StyleSheet.create({
  card:         { width: '48%', backgroundColor: '#1A1A1A', borderRadius: 18, padding: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', gap: 6 },
  cardLocked:   { opacity: 0.35 },
  cardLegendary:{ borderColor: 'rgba(255,215,0,0.3)' },
  checkIcon:    { position: 'absolute', top: 8, right: 8 },
  iconWrap:     { width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.background, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  tierPill:     { borderRadius: 8, borderWidth: 0.5, paddingHorizontal: 8, paddingVertical: 2 },
  tierTxt:      { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  title:        { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: 0.3 },
  desc:         { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 14 },
  rarityPill:   { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  rarityTxt:    { fontSize: 9, fontWeight: '700' },
  xpRow:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xpTxt:        { fontSize: 9, color: '#FFD600', fontWeight: '700' },
  checkBadge:   { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: '#1ED760', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});

// ─── Carte défi ───────────────────────────────────────────
function ChallengeCard({ ch, onComplete, onShare }: {
  ch: Challenge; onComplete?: () => void; onShare?: () => void;
}) {
  // Si complété -> Vert. Sinon -> Couleur du défi ou Bleu par défaut.
  const statusColor = ch.completed ? '#1ED760' : (ch.color || COLORS.primary);
  const pctText = ch.target_value > 0 ? `${ch.current_value || 0}/${ch.target_value}` : '';

  return (
    <View style={[cc.card, ch.completed && { borderColor: 'rgba(30,215,96,0.3)' }]}>
      {/* Barre latérale qui devient verte au succès */}
      <View style={[cc.accent, { backgroundColor: statusColor }]} />
      
      <View style={cc.body}>
        <View style={cc.top}>
          <View style={[
            cc.iconCircle, 
            { borderColor: statusColor + '55', backgroundColor: statusColor + '14' }
          ]}>
            <Ionicons 
              name={ch.completed ? "checkmark-circle" : (ch.icon || 'trophy-outline') as any} 
              size={22} 
              color={statusColor} 
            />
          </View>
          
          <View style={cc.info}>
            <View style={cc.titleRow}>
              <Text style={[cc.title, ch.completed && { color: '#1ED760' }]} numberOfLines={1}>
                {ch.title}
              </Text>
            </View>
            <Text style={cc.desc}>{ch.description}</Text>
          </View>

          <View style={cc.actions}>
            {ch.completed ? (
              <TouchableOpacity style={cc.shareBtn} onPress={onShare}>
                <Ionicons name="share-social-outline" size={16} color="#1ED760" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[cc.completeBtn, { backgroundColor: statusColor }]} 
                onPress={onComplete}
              >
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!ch.completed && ch.target_value > 1 && (
          <View style={cc.progressSection}>
            <ProgressBar current={ch.current_value || 0} target={ch.target_value} color={statusColor} />
            <Text style={cc.progressTxt}>{pctText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const cc = StyleSheet.create({
  card:           { backgroundColor: '#1A1A1A', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', overflow: 'hidden', marginBottom: 10 },
  cardDone:       { borderColor: 'rgba(30,215,96,0.2)' },
  cardFeatured:   { borderColor: 'rgba(255,215,0,0.2)' },
  featuredBanner: { position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 10, zIndex: 1 },
  featuredTxt:    { fontSize: 8, color: '#FFD600', fontWeight: '700', letterSpacing: 0.5 },
  accent:         { width: 4 },
  body:           { flex: 1, padding: 14 },
  top:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconCircle:     { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:           { flex: 1 },
  titleRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  title:          { fontSize: 13, fontWeight: '700', color: '#fff', flex: 1 },
  dailyTag:       { backgroundColor: 'rgba(255,183,0,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  dailyTagTxt:    { fontSize: 9, color: '#FFB700', fontWeight: '700' },
  desc:           { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16, marginBottom: 6 },
  metaRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xpTxt:          { fontSize: 10, color: '#FFD600', fontWeight: '700' },
  diffRow:        { flexDirection: 'row', gap: 3 },
  diffDot:        { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  actions:        { alignItems: 'center', gap: 6, flexShrink: 0 },
  doneBadge:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(30,215,96,0.15)', borderWidth: 1, borderColor: 'rgba(30,215,96,0.3)', alignItems: 'center', justifyContent: 'center' },
  shareBtn:       { padding: 6 },
  completeBtn:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  goBtn:          { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressSection:{ marginTop: 4 },
  progressTxt:    { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4, textAlign: 'right' },
});

// ─── Badge category pills ─────────────────────────────────
const BADGE_CATEGORIES = [
  { id: 'all',        label: 'Tous' },
  { id: 'vitesse',    label: 'Vitesse' },
  { id: 'force',      label: 'Force' },
  { id: 'combo',      label: 'Combo' },
  { id: 'cognitif',   label: 'Cognitif' },
  { id: 'modes',      label: 'Modes' },
  { id: 'score',      label: 'Score' },
  { id: 'streak',     label: 'Streak' },
  { id: 'defis',      label: 'Défis' },
  { id: 'special',    label: 'Spéciaux' },
];

// ══════════════════════════════════════════════════════════
// ÉCRAN PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function ChallengesScreen() {
  const [apiChallenges, setApiChallenges] = useState<Challenge[]>([]);
  const [apiBadges,     setApiBadges]     = useState<Badge[]>([]);
  const [userStats,     setUserStats]     = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<Tab>('daily');
  const [showCreate,    setShowCreate]    = useState(false);
  const [badgeFilter,   setBadgeFilter]   = useState<BadgeFilter>('all');
  const [badgeCat,      setBadgeCat]      = useState('all');
  const [newChallenge,  setNewChallenge]  = useState({ title: '', description: '', target: '' });
  const [customChallenges, setCustomChallenges] = useState<Challenge[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [chRes, bdRes] = await Promise.all([
        api.get('/challenges').catch(() => ({ data: [] })),
        api.get('/badges').catch(()  => ({ data: [] })),
      ]);
      setApiChallenges(chRes.data || []);

      if (bdRes.data?.length) {
        const apiMap: Record<string, boolean> = {};
        (bdRes.data as any[]).forEach((b: any) => { apiMap[b.badge_id] = b.earned; });
        const merged = ALL_BADGES.map(b => ({
          ...b,
          earned: apiMap[b.badge_id] ?? b.earned,
        }));
        setApiBadges(merged);
      } else {
        setApiBadges(ALL_BADGES);
      }

      const s = await AsyncStorage.getItem('user');
      if (s) setUserStats(JSON.parse(s));
    } catch {
      setApiBadges(ALL_BADGES);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api.post('/challenges/complete', { challenge_id: id, score: 0 });
      loadData();
    } catch {}
  };

  const handleShare = async (title: string) => {
    try {
      await Share.share({ message: `J'ai relevé le défi "${title}" sur Foot'Up Connect ! 🎯⚽` });
    } catch {}
  };

  const handleCreateChallenge = async () => {
    if (!newChallenge.title.trim() || !newChallenge.description.trim()) {
      Alert.alert('Champs manquants', 'Remplis le titre et la description.');
      return;
    }
    try {
      await api.post('/challenges', {
        title:       newChallenge.title,
        description: newChallenge.description,
        type:        'custom',
        targets:     parseInt(newChallenge.target) || 10,
        time_limit:  60,
      });
      // Ajoute aussi en local pour affichage immédiat
      const newLocal: Challenge = {
        id:            `custom_${Date.now()}`,
        title:         newChallenge.title,
        description:   newChallenge.description,
        icon:          'create-outline',
        color:         COLORS.primary,
        xp_reward:     parseInt(newChallenge.target) || 50,
        difficulty:    2,
        target_value:  parseInt(newChallenge.target) || 10,
        current_value: 0,
        reset_type:    'lifetime',
        category:      'custom',
        completed:     false,
        is_custom:     true,
      };
      setCustomChallenges(c => [newLocal, ...c]);
      setShowCreate(false);
      setNewChallenge({ title: '', description: '', target: '' });
      Keyboard.dismiss();
      loadData();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le défi.');
    }
  };

  // ── Données finales avec progression locale mergée ────────
  // Priorité : API > données locales + progression AsyncStorage
  const [mergedDaily,    setMergedDaily]    = useState<Challenge[]>([]);
  const [mergedWeekly,   setMergedWeekly]   = useState<Challenge[]>([]);
  const [mergedLifetime, setMergedLifetime] = useState<Challenge[]>([]);

  useEffect(() => {
    const rawDaily    = apiChallenges.filter(c => c.reset_type === 'daily').length > 0
      ? apiChallenges.filter(c => c.reset_type === 'daily')
      : getDailyChallenges();
    const rawWeekly   = apiChallenges.filter(c => c.reset_type === 'weekly').length > 0
      ? apiChallenges.filter(c => c.reset_type === 'weekly')
      : WEEKLY_CHALLENGES;
    const rawLifetime = [
      ...customChallenges,
      ...(apiChallenges.filter(c => c.reset_type === 'lifetime' || c.is_custom).length > 0
        ? apiChallenges.filter(c => c.reset_type === 'lifetime' || c.is_custom)
        : LIFETIME_CHALLENGES),
    ];

    Promise.all([
      getMergedChallenges(rawDaily),
      getMergedChallenges(rawWeekly),
      getMergedChallenges(rawLifetime),
    ]).then(([d, w, l]) => {
      setMergedDaily(d);
      setMergedWeekly(w);
      setMergedLifetime(l);
    });
  }, [apiChallenges, customChallenges]);

  // ── Filtrage badges ──────────────────────────────────────
  let displayedBadges = apiBadges;
  if (badgeCat !== 'all')     displayedBadges = displayedBadges.filter(b => b.category === badgeCat);
  if (badgeFilter === 'earned') displayedBadges = displayedBadges.filter(b => b.earned);
  if (badgeFilter === 'locked') displayedBadges = displayedBadges.filter(b => !b.earned);

  const completedToday = mergedDaily.filter(c => c.completed).length;
  const earnedBadges   = apiBadges.filter(b => b.earned).length;
  const totalBadges    = apiBadges.length;
  const streak         = userStats?.streak_days || 0;

  if (loading) return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Défis & Badges</Text>
            <Text style={s.subtitle}>{completedToday} défis · {earnedBadges}/{totalBadges} badges</Text>
          </View>
          {streak > 0 && (
            <View style={s.streakBadge}>
              <Ionicons name="flame" size={16} color="#FF6D00" />
              <Text style={s.streakNum}>{streak}</Text>
              <Text style={s.streakLbl}>jours</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {([
            { key: 'daily',    label: "Aujourd'hui", icon: 'today-outline' },
            { key: 'weekly',   label: 'Semaine',      icon: 'calendar-outline' },
            { key: 'lifetime', label: 'Défis',        icon: 'trophy-outline' },
            { key: 'badges',   label: `Badges (${earnedBadges})`, icon: 'medal-outline' },
          ] as { key: Tab; label: string; icon: any }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
              onPress={() => { setTab(t.key); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={14} color={tab === t.key ? '#fff' : 'rgba(255,255,255,0.4)'} />
              <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Aujourd'hui ── */}
        {tab === 'daily' && (
          <View>
            <View style={s.sectionHeader}>
              <Ionicons name="today-outline" size={14} color="rgba(255,255,255,0.3)" />
              <Text style={s.sectionLbl}>Défis du jour — bonus XP ×1.5</Text>
              <View style={s.progressPill}>
                <Text style={s.progressPillTxt}>{completedToday}/{mergedDaily.length}</Text>
              </View>
            </View>
            {mergedDaily.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={36} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyTxt}>Tout est complété !</Text>
                <Text style={s.emptySub}>Reviens demain pour de nouveaux défis</Text>
              </View>
            ) : mergedDaily.map(ch => (
              <ChallengeCard key={ch.id} ch={ch}
                onComplete={() => handleComplete(ch.id)}
                onShare={() => handleShare(ch.title)} />
            ))}
          </View>
        )}

        {/* ── Semaine ── */}
        {tab === 'weekly' && (
          <View>
            <View style={s.sectionHeader}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.3)" />
              <Text style={s.sectionLbl}>Remis à zéro chaque lundi</Text>
            </View>
            {mergedWeekly.map(ch => (
              <ChallengeCard key={ch.id} ch={ch}
                onComplete={() => handleComplete(ch.id)}
                onShare={() => handleShare(ch.title)} />
            ))}
          </View>
        )}

        {/* ── Défis lifetime ── */}
        {tab === 'lifetime' && (
          <View>
            <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={s.createBtnTxt}>Créer un défi perso</Text>
            </TouchableOpacity>
            <View style={s.sectionHeader}>
              <Ionicons name="trophy-outline" size={14} color="rgba(255,255,255,0.3)" />
              <Text style={s.sectionLbl}>Défis permanents</Text>
            </View>
            {mergedLifetime.map(ch => (
              <ChallengeCard key={ch.id} ch={ch}
                onComplete={() => handleComplete(ch.id)}
                onShare={() => handleShare(ch.title)} />
            ))}
          </View>
        )}

        {/* ── Badges ── */}
        {tab === 'badges' && (
          <View>
            {/* Filtre earned/locked */}
            <View style={s.badgeFilterRow}>
              {(['all', 'earned', 'locked'] as BadgeFilter[]).map(f => (
                <TouchableOpacity key={f}
                  style={[s.filterBtn, badgeFilter === f && s.filterBtnActive]}
                  onPress={() => setBadgeFilter(f)}>
                  <Text style={[s.filterTxt, badgeFilter === f && s.filterTxtActive]}>
                    {f === 'all' ? `Tous (${totalBadges})`
                      : f === 'earned' ? `Obtenus (${earnedBadges})`
                      : `Verrouillés (${totalBadges - earnedBadges})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filtre catégorie */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
              {BADGE_CATEGORIES.map(cat => (
                <TouchableOpacity key={cat.id}
                  style={[s.catBtn, badgeCat === cat.id && s.catBtnActive]}
                  onPress={() => setBadgeCat(cat.id)}>
                  <Text style={[s.catTxt, badgeCat === cat.id && s.catTxtActive]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Grille */}
            <View style={s.badgeGrid}>
              {displayedBadges.map(b => <BadgeCard key={b.badge_id} badge={b} />)}
            </View>
            {displayedBadges.length === 0 && (
              <View style={s.emptyCard}>
                <Ionicons name="medal-outline" size={36} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyTxt}>Aucun badge ici</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Modal créer défi (keyboard-aware) ── */}
      <Modal visible={showCreate} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={s.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={s.modalCard}>
                  <View style={s.modalHeader}>
                    <Text style={s.modalTitle}>Nouveau défi</Text>
                    <TouchableOpacity onPress={() => { setShowCreate(false); Keyboard.dismiss(); }}>
                      <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
                    </TouchableOpacity>
                  </View>
                  <TextInput style={s.modalInput} placeholder="Titre du défi"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={newChallenge.title}
                    onChangeText={v => setNewChallenge(p => ({ ...p, title: v }))}
                    returnKeyType="next" />
                  <TextInput style={s.modalInput} placeholder="Description"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={newChallenge.description}
                    onChangeText={v => setNewChallenge(p => ({ ...p, description: v }))}
                    multiline returnKeyType="next" />
                  <TextInput style={s.modalInput} placeholder="Objectif (ex: 50 impacts)"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="numeric"
                    value={newChallenge.target}
                    onChangeText={v => setNewChallenge(p => ({ ...p, target: v }))}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateChallenge} />
                  <View style={s.modalBtns}>
                    <TouchableOpacity style={s.modalCancel} onPress={() => { setShowCreate(false); Keyboard.dismiss(); }}>
                      <Text style={s.modalCancelTxt}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.modalConfirm} onPress={handleCreateChallenge}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={s.modalConfirmTxt}>Créer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:         { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:          { fontSize: 22, fontWeight: '700', color: '#fff' },
  subtitle:       { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  streakBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,109,0,0.12)', borderWidth: 0.5, borderColor: 'rgba(255,109,0,0.3)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  streakNum:      { fontSize: 18, fontWeight: '700', color: '#FF6D00' },
  streakLbl:      { fontSize: 9, color: 'rgba(255,109,0,0.7)', fontWeight: '700', letterSpacing: 1 },

  tabRow:         { paddingBottom: 14, gap: 8 },
  tabBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabTxt:         { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTxtActive:   { color: '#fff' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  sectionLbl:     { flex: 1, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase' },
  progressPill:   { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  progressPillTxt:{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700' },

  createBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, marginBottom: 16 },
  createBtnTxt:   { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },

  badgeFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  filterBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  filterBtnActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTxt:      { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  catRow:         { paddingBottom: 12, gap: 8 },
  catBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  catBtnActive:   { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' },
  catTxt:         { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '700' },
  catTxtActive:   { color: '#fff' },
  badgeGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  emptyCard:      { backgroundColor: '#1A1A1A', borderRadius: 20, padding: 32, alignItems: 'center', gap: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  emptyTxt:       { color: '#fff', fontSize: 15, fontWeight: '600' },
  emptySub:       { color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center' },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: '#1A1A1A', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle:     { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalInput:     { backgroundColor: COLORS.background, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', padding: 14, color: '#fff', fontSize: 14 },
  modalBtns:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel:    { flex: 1, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, alignItems: 'center' },
  modalCancelTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  modalConfirm:   { flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  modalConfirmTxt:{ color: '#fff', fontSize: 13, fontWeight: '700' },
});