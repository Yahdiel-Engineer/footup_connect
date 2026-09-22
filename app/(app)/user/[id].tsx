/**
 * app/(app)/user/[id].tsx
 *
 * Profil public d'un joueur.
 * Naviguer depuis : router.push({ pathname: '/(app)/user/[id]', params: { id: userId } })
 * Enregistré dans app/(app)/_layout.tsx : <Stack.Screen name="user/[id]" />
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Image, TouchableOpacity, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

// ─── Types ────────────────────────────────────────────────
type FriendStatus = 'none' | 'pending' | 'incoming' | 'accepted';

interface PlayerStats {
  total_sessions: number;
  total_score:    number;
  total_shots:    number;
  avg_power:      number; // Newtons
  avg_speed:      number; // km/h (calculé depuis avg_reaction)
}

interface ProfileData {
  user:          any;
  stats:         PlayerStats;
  friend_status: FriendStatus;
}

// ─── Helper couleur hexa → rgba ───────────────────────────
const rgba = (hex: string, a: number) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return `rgba(30,215,96,${a})`; }
};

// ══════════════════════════════════════════════════════════
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const [data,    setData]    = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false); // bouton en cours d'action

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/${id}/profile`);
      setData(res.data);
    } catch {
      Alert.alert('Erreur', 'Impossible de charger ce profil.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Envoyer une demande d'ami ───────────────────────────
  const handleAddFriend = async () => {
    setActing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/friends/request/${id}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch {
      Alert.alert('Erreur', 'Demande déjà envoyée ou impossible.');
    } finally {
      setActing(false);
    }
  };

  // ── Accepter une demande reçue ──────────────────────────
  const handleAccept = async () => {
    setActing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/friends/accept/${id}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter cette demande.');
    } finally {
      setActing(false);
    }
  };

  // ── Aller dans le chat ──────────────────────────────────
  const handleMessage = () => {
    if (!data) return;
    Haptics.selectionAsync();
    router.push({
      pathname: '/(app)/chat/[friendId]' as any,
      params: { friendId: id, name: data.user?.name },
    });
  };

  // ── Loading ─────────────────────────────────────────────
  if (loading) return (
    <SafeAreaView style={s.container}>
      <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
    </SafeAreaView>
  );

  if (!data) return (
    <SafeAreaView style={s.container}>
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.3)" />
        <Text style={s.emptyTxt}>Profil introuvable</Text>
      </View>
    </SafeAreaView>
  );

  const { user, stats, friend_status } = data;
  const isAccepted = friend_status === 'accepted';
  const isPending  = friend_status === 'pending';
  const isIncoming = friend_status === 'incoming';

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>PROFIL JOUEUR</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + infos ── */}
        <View style={s.profileCard}>
          <View style={[s.avatarWrap, { borderColor: COLORS.primary }]}>
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              : <View style={s.avatarFallback}>
                  <Text style={s.avatarInitial}>
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
            }
            {isAccepted && (
              <View style={s.friendBadge}>
                <Ionicons name="people" size={10} color="#fff" />
              </View>
            )}
          </View>

          <Text style={s.userName}>{user?.name || 'Joueur'}</Text>
          <Text style={s.userSub}>
            {[user?.club, user?.position, user?.region].filter(Boolean).join(' · ') || 'Aucune info'}
          </Text>
          {user?.bio && <Text style={s.userBio}>{user.bio}</Text>}

          {/* ── Boutons style TikTok ── */}
          <View style={s.actionsRow}>
            {/* Pas encore ami */}
            {friend_status === 'none' && (
              <TouchableOpacity
                style={[s.mainBtn, { backgroundColor: COLORS.primary }]}
                onPress={handleAddFriend}
                disabled={acting}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={s.mainBtnTxt}>S'ABONNER</Text>
              </TouchableOpacity>
            )}

            {/* Demande envoyée — en attente */}
            {isPending && (
              <View style={[s.mainBtn, s.mainBtnGhost]}>
                <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.5)" />
                <Text style={[s.mainBtnTxt, { color: 'rgba(255,255,255,0.5)' }]}>EN ATTENTE</Text>
              </View>
            )}

            {/* Demande reçue — peut accepter */}
            {isIncoming && (
              <TouchableOpacity
                style={[s.mainBtn, { backgroundColor: '#1ED760' }]}
                onPress={handleAccept}
                disabled={acting}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={16} color="#000" />
                <Text style={[s.mainBtnTxt, { color: '#000' }]}>ACCEPTER</Text>
              </TouchableOpacity>
            )}

            {/* Déjà ami */}
            {isAccepted && (
              <View style={[s.mainBtn, s.mainBtnGhost]}>
                <Ionicons name="people" size={16} color="#1ED760" />
                <Text style={[s.mainBtnTxt, { color: '#1ED760' }]}>COÉQUIPIER</Text>
              </View>
            )}

            {/* Bouton message — toujours visible */}
            <TouchableOpacity style={s.msgBtn} onPress={handleMessage} activeOpacity={0.85}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
              <Text style={s.mainBtnTxt}>MESSAGE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Score total ── */}
        <View style={[s.scoreCard, { borderColor: rgba(COLORS.primary, 0.3) }]}>
          <View style={[s.scoreIcon, { backgroundColor: rgba(COLORS.primary, 0.15) }]}>
            <Ionicons name="trophy" size={24} color={COLORS.primary} />
          </View>
          <View>
            <Text style={[s.scoreVal, { color: COLORS.primary }]}>
              {stats.total_score.toLocaleString()} PTS
            </Text>
            <Text style={s.scoreSub}>
              Score total · {stats.total_sessions} session{stats.total_sessions > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* ── Stats principales : Force / Tirs / Vitesse ── */}
        <Text style={s.sectionLabel}>PERFORMANCES RÉELLES</Text>
        <View style={s.statsGrid}>
          <View style={s.statItem}>
            <View style={[s.statIconWrap, { backgroundColor: rgba('#E040FB', 0.12) }]}>
              <Ionicons name="fitness" size={18} color="#E040FB" />
            </View>
            <Text style={[s.statVal, { color: '#E040FB' }]}>
              {stats.avg_power > 0 ? `${stats.avg_power}N` : '—'}
            </Text>
            <Text style={s.statLbl}>FORCE MOY.</Text>
          </View>

          <View style={s.statDivider} />

          <View style={s.statItem}>
            <View style={[s.statIconWrap, { backgroundColor: rgba('#1ED760', 0.12) }]}>
              <Ionicons name="flash" size={18} color="#1ED760" />
            </View>
            <Text style={[s.statVal, { color: '#1ED760' }]}>
              {stats.total_shots > 0 ? stats.total_shots.toLocaleString() : '—'}
            </Text>
            <Text style={s.statLbl}>TIRS</Text>
          </View>

          <View style={s.statDivider} />

          <View style={s.statItem}>
            <View style={[s.statIconWrap, { backgroundColor: rgba('#FFB700', 0.12) }]}>
              <Ionicons name="speedometer" size={18} color="#FFB700" />
            </View>
            <Text style={[s.statVal, { color: '#FFB700' }]}>
              {stats.avg_speed > 0 ? `${stats.avg_speed}` : '—'}
            </Text>
            <Text style={s.statLbl}>KM/H MOY.</Text>
          </View>
        </View>

        {/* ── Si pas encore ami : bandeau info ── */}
        {!isAccepted && (
          <View style={s.notFriendBanner}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={s.notFriendTxt}>
              {isIncoming
                ? `${user?.name} t'a envoyé une demande. Accepte pour voir plus de stats et chatter librement.`
                : 'Abonne-toi pour devenir coéquipier et accéder à la messagerie directe.'}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTxt:       { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '600' },

  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:        { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },

  scroll:         { paddingHorizontal: 20, paddingTop: 8 },
  profileCard:    { alignItems: 'center', marginBottom: 24 },

  avatarWrap:     { width: 110, height: 110, borderRadius: 55, borderWidth: 3, overflow: 'hidden', marginBottom: 16, position: 'relative' },
  avatar:         { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { fontSize: 44, fontWeight: '900', color: COLORS.primary },
  friendBadge:    { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1ED760', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },

  userName:       { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
  userSub:        { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 },
  userBio:        { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20, marginBottom: 8 },

  actionsRow:     { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  mainBtn:        { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  mainBtnGhost:   { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  mainBtnTxt:     { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  msgBtn:         { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

  scoreCard:      { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1A1A1A', borderRadius: 20, padding: 18, marginBottom: 20, borderWidth: 1 },
  scoreIcon:      { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scoreVal:       { fontSize: 22, fontWeight: '900' },
  scoreSub:       { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', marginTop: 2 },

  sectionLabel:   { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 },
  statsGrid:      { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 20, padding: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  statItem:       { flex: 1, alignItems: 'center', gap: 8 },
  statIconWrap:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statVal:        { fontSize: 19, fontWeight: '900' },
  statLbl:        { fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 1.5 },
  statDivider:    { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },

  notFriendBanner:{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: rgba(COLORS.primary, 0.08), borderRadius: 16, padding: 14, borderWidth: 1, borderColor: rgba(COLORS.primary, 0.2) },
  notFriendTxt:   { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
});