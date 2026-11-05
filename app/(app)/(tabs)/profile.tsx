import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';
import { useAuth } from '../../../src/authContext';
import { useUnreadCount } from '../../../src/messageEvents';

const XP_PER_LEVEL = 1000;
const LEVEL_TITLES = ['Débutant', 'Espoir', 'Confirmé', 'Titulaire', 'Capitaine', 'Expert', 'Légende'];

function levelInfo(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const inLevel = xp % XP_PER_LEVEL;
  const title = LEVEL_TITLES[Math.min(Math.floor((level - 1) / 3), LEVEL_TITLES.length - 1)];
  return { level, inLevel, progress: inLevel / XP_PER_LEVEL, title };
}

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
  sub?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const unreadMessages = useUnreadCount();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<number>(0);
  const [badges, setBadges] = useState<{ earned: number; total: number }>({ earned: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const [uRes, sRes, fRes, rRes, bRes] = await Promise.all([
        api.get('/profile').catch(() => ({ data: null })),
        api.get('/sessions/stats').catch(() => ({ data: null })),
        api.get('/friends').catch(() => ({ data: [] })),
        api.get('/friends/requests').catch(() => ({ data: [] })),
        api.get('/badges').catch(() => ({ data: [] })),
      ]);
      setUser(uRes.data);
      setStats(sRes.data);
      setFriends(fRes.data || []);
      setFriendRequests((rRes.data || []).length);
      const all = bRes.data || [];
      setBadges({ earned: all.filter((b: any) => b.earned).length, total: all.length });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { loadData(); }, [loadData]));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 });
    if (!result.canceled) {
      setUploadingAvatar(true);
      try {
        const fd = new FormData();
        fd.append('file', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
        await api.post('/profile/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          transformRequest: (data) => data,
        });
        await loadData();
      } catch (e) { Alert.alert('Photo non enregistrée', 'Réessaie dans un instant.'); }
      finally { setUploadingAvatar(false); }
    }
  };

  const confirmLogout = () => Alert.alert('Se déconnecter ?', '', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Se déconnecter', style: 'destructive', onPress: logout },
  ]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const lvl = levelInfo(Number(user?.xp) || 0);
  const subtitle = [user?.position, user?.club].filter(Boolean).join(' · ');

  const statItems = [
    { label: 'Sessions', value: stats?.total_sessions ?? 0, icon: 'flash' as const },
    { label: 'Puissance moy.', value: stats?.avg_power ? `${Math.round(stats.avg_power)} N` : '—', icon: 'fitness' as const },
    { label: 'Vitesse max', value: stats?.max_speed ? `${Math.round(stats.max_speed)} km/h` : '—', icon: 'speedometer' as const },
    { label: 'Points', value: stats?.total_score ?? 0, icon: 'trophy' as const },
  ];

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'SOCIAL',
      items: [
        { icon: 'chatbubbles-outline', label: 'Messages et groupes', badge: unreadMessages, onPress: () => router.push('/chat') },
        { icon: 'person-add-outline', label: "Demandes d'amis", badge: friendRequests, onPress: () => router.push('/friend-requests') },
        { icon: 'podium-outline', label: 'Classement', onPress: () => router.push('/leaderboard') },
      ],
    },
    {
      title: 'MON COMPTE',
      items: [
        { icon: 'create-outline', label: 'Modifier le profil', sub: 'Photo, poste, club, bio', onPress: () => router.push('/edit-profile') },
        { icon: 'bluetooth-outline', label: 'Mes cibles', sub: 'Associer et configurer les modules', onPress: () => router.push('/(app)/(tabs)') },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/settings') },
        { icon: 'settings-outline', label: 'Paramètres', sub: 'Compte, sécurité, confidentialité', onPress: () => router.push('/settings') },
      ],
    },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* ── EN-TÊTE ── */}
        <View style={s.topBar}>
          <Text style={s.title}>MON PROFIL</Text>
          <View style={s.topActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/friend-requests')} accessibilityLabel="Demandes d'amis">
              <Ionicons name="person-add-outline" size={19} color="#fff" />
              {friendRequests > 0 && (
                <View style={s.dot}><Text style={s.dotText}>{friendRequests > 9 ? '9+' : friendRequests}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/chat')} accessibilityLabel="Messages">
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
              {unreadMessages > 0 && (
                <View style={s.dot}><Text style={s.dotText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/settings')} accessibilityLabel="Paramètres">
              <Ionicons name="settings-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── IDENTITÉ ── */}
        <View style={s.hero}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={s.avatarWrap} accessibilityLabel="Changer la photo">
            {user?.avatar_url
              ? <Image source={{ uri: user.avatar_url }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarEmpty]}>
                  <Text style={s.avatarInitials}>{user?.name?.substring(0, 2).toUpperCase() || '??'}</Text>
                </View>}
            <View style={s.camBadge}>
              {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={13} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.userName} numberOfLines={1}>{user?.name || 'Joueur'}</Text>
            {!!subtitle && <Text style={s.userSub} numberOfLines={1}>{subtitle}</Text>}
            {!!user?.region && (
              <View style={s.regionRow}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.4)" />
                <Text style={s.regionTxt}>{user.region}</Text>
              </View>
            )}
          </View>
        </View>
        {!!user?.bio && <Text style={s.bio}>{user.bio}</Text>}

        {/* ── NIVEAU ── */}
        <View style={s.card}>
          <View style={s.levelHead}>
            <Text style={s.levelTxt}>Niveau {lvl.level} · <Text style={{ color: COLORS.primary }}>{lvl.title}</Text></Text>
            <Text style={s.xpTxt}>{lvl.inLevel} / {XP_PER_LEVEL} XP</Text>
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${Math.round(lvl.progress * 100)}%` }]} /></View>
        </View>

        {/* ── STATISTIQUES ── */}
        <View style={s.statsGrid}>
          {statItems.map(item => (
            <View key={item.label} style={s.statBox}>
              <Ionicons name={item.icon} size={16} color={COLORS.primary} />
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── BADGES ── */}
        <TouchableOpacity style={[s.card, s.badgeCard]} onPress={() => router.push('/(app)/(tabs)/challenges')} activeOpacity={0.85}>
          <View style={s.badgeIcon}><Ionicons name="ribbon" size={20} color={COLORS.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Badges</Text>
            <Text style={s.rowSub}>{badges.earned} obtenu{badges.earned > 1 ? 's' : ''} sur {badges.total}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
        </TouchableOpacity>

        {/* ── COÉQUIPIERS ── */}
        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>COÉQUIPIERS · {friends.length}</Text>
          <TouchableOpacity onPress={() => router.push('/search-users')} style={s.addBtn}>
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={s.addBtnText}>Ajouter</Text>
          </TouchableOpacity>
        </View>
        {friends.length === 0 ? (
          <TouchableOpacity style={[s.card, { alignItems: 'center', gap: 4 }]} onPress={() => router.push('/search-users')}>
            <Text style={s.rowLabel}>Aucun coéquipier pour l'instant</Text>
            <Text style={s.rowSub}>Recherche des joueurs pour les ajouter</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {friends.map(f => (
              <TouchableOpacity
                key={f.id}
                style={s.friend}
                onPress={() => router.push({ pathname: '/chat/[friendId]', params: { friendId: f.id, name: f.name } })}
              >
                {f.avatar_url
                  ? <Image source={{ uri: f.avatar_url }} style={s.friendAvatar} />
                  : <View style={[s.friendAvatar, s.avatarEmpty]}><Text style={s.friendInitial}>{f.name?.charAt(0).toUpperCase()}</Text></View>}
                <Text style={s.friendName} numberOfLines={1}>{f.name?.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── MENUS ── */}
        {sections.map(section => (
          <View key={section.title}>
            <Text style={[s.sectionTitle, { marginHorizontal: 20, marginTop: 24, marginBottom: 8 }]}>{section.title}</Text>
            <View style={s.menu}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[s.menuRow, i === section.items.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                  activeOpacity={0.8}
                >
                  <Ionicons name={item.icon} size={19} color="rgba(255,255,255,0.75)" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{item.label}</Text>
                    {!!item.sub && <Text style={s.rowSub}>{item.sub}</Text>}
                  </View>
                  {!!item.badge && item.badge > 0 && (
                    <View style={s.badge}><Text style={s.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text></View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={[s.menu, s.menuRow, s.logout]} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={19} color={COLORS.primary} />
          <Text style={[s.rowLabel, { color: COLORS.primary }]}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', gap: 8 },
  dot: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  dotText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: COLORS.primary },
  avatarEmpty: { backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: COLORS.primary, fontSize: 24, fontWeight: '900' },
  camBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  userName: { color: '#fff', fontSize: 21, fontWeight: '900' },
  userSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3, fontWeight: '600' },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  regionTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  bio: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginTop: 6 },

  card: { marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  levelTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  xpTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  bar: { height: 7, borderRadius: 4, backgroundColor: '#262626', marginTop: 10, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: COLORS.primary },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 14 },
  statBox: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 14, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', gap: 4 },
  statValue: { color: '#fff', fontSize: 19, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },

  badgeCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  friend: { alignItems: 'center', width: 62, gap: 6 },
  friendAvatar: { width: 54, height: 54, borderRadius: 27 },
  friendInitial: { color: COLORS.primary, fontWeight: '900', fontSize: 18 },
  friendName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  menu: { marginHorizontal: 16, borderRadius: 16, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  logout: { marginTop: 24, borderBottomWidth: 0.5 },
});
