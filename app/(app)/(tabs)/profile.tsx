import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, ScrollView, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useFocusEffect(
    React.useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, sRes, fRes, rRes, mRes] = await Promise.all([
        api.get('/profile').catch(() => ({ data: null })),
        api.get('/sessions/stats').catch(() => ({ data: null })),
        api.get('/friends').catch(() => ({ data: [] })),
        api.get('/friends/requests').catch(() => ({ data: [] })),
        api.get('/messages/unread-count').catch(() => ({ data: { count: 0 } })),
      ]);
      setUser(uRes.data);
      setStats(sRes.data);
      setFriends(fRes.data || []);
      setFriendRequests((rRes.data || []).length);
      setUnreadMessages(mRes.data?.count || 0);
    } finally {
      setLoading(false);
    }
  };

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
      } catch (e) { console.error('Avatar upload failed', e); }
      finally { setUploadingAvatar(false); }
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const statItems = [
    { label: 'SESSIONS', value: stats?.total_sessions ?? '—', icon: 'flash' },
    { label: 'PUISSANCE', value: stats?.avg_power ? `${Math.round(stats.avg_power)}N` : '—', icon: 'fitness' },
    { label: 'POINTS', value: stats?.total_score ?? '0', icon: 'trophy' }, 
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.title}>MON PROFIL</Text>
          <View style={s.headerRight}>
            {/* Demandes d'amis */}
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/friend-requests')}>
              <Ionicons name="person-add-outline" size={22} color="#fff" />
              {friendRequests > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{friendRequests > 9 ? '9+' : friendRequests}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* ✅ Messages - ouvre le chat avec les demandes intégrées */}
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push('/chat')}>
              <Ionicons name="chatbubbles-outline" size={22} color="#fff" />
              {unreadMessages > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO ── */}
        <View style={s.hero}>
          <View style={s.avatarWrap}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarLoading]}>
                <Text style={s.avatarInitials}>
                  {user?.name?.substring(0, 2).toUpperCase() || '??'}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.userName}>{user?.name || 'Joueur'}</Text>
          {user?.club ? (
            <View style={s.clubRow}>
              <Ionicons name="shield-half" size={12} color={COLORS.primary} />
              <Text style={s.clubText}>{user.club}</Text>
            </View>
          ) : null}
          {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
        </View>

        {/* ── STATS ── */}
        <View style={s.statsRow}>
          {statItems.map((item, i) => (
            <View key={i} style={[s.statCard, i === 1 && s.statCardCenter]}>
              <Ionicons name={item.icon as any} size={18} color={COLORS.primary} style={{ marginBottom: 8 }} />
              <Text style={s.statValue}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── COÉQUIPIERS ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>COÉQUIPIERS</Text>
            <TouchableOpacity onPress={() => router.push('/search-users')} style={s.addBtn}>
              <Ionicons name="person-add" size={14} color={COLORS.primary} />
              <Text style={s.addBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {friends.length === 0 ? (
            <TouchableOpacity style={s.emptyFriends} onPress={() => router.push('/search-users')}>
              <Ionicons name="people-outline" size={32} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyFriendsText}>Aucun coéquipier pour l'instant</Text>
              <Text style={s.emptyFriendsSub}>Recherche des joueurs pour les ajouter</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {friends.map((f, i) => (
                <TouchableOpacity
                  key={i} style={s.friendCard}
                  onPress={() => router.push({ pathname: '/chat/[friendId]', params: { friendId: f.id, name: f.name } })}
                >
                  <View style={s.friendAvatarWrap}>
                    <Image
                      source={{ uri: f.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name || 'U')}&background=1A1A1A&color=fff&size=100` }}
                      style={s.friendAvatar}
                    />
                  </View>
                  <Text style={s.friendName} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.friendSub} numberOfLines={1}>{f.position || f.club || '—'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── INFOS ── */}
        {(user?.region || user?.position || user?.age || user?.phone) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>INFOS</Text>
            <View style={s.infoCard}>
              {[
                { icon: 'location-outline', label: 'Région', value: user?.region },
                { icon: 'body-outline', label: 'Poste', value: user?.position },
                { icon: 'calendar-outline', label: 'Âge', value: user?.age ? `${user.age} ans` : null },
                { icon: 'call-outline', label: 'Téléphone', value: user?.phone },
              ].filter(i => i.value).map((item, idx, arr) => (
                <View key={idx} style={[s.infoRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Ionicons name={item.icon as any} size={16} color={COLORS.primary} />
                  <Text style={s.infoLabel}>{item.label}</Text>
                  <Text style={s.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── ACTIONS ── */}
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/edit-profile')}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={s.actionBtnText}>Modifier le profil</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#111' }]} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
          <Text style={s.actionBtnText}>Paramètres</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { position: 'relative', width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 20 },
  badge: { position: 'absolute', top: 4, right: 4, backgroundColor: COLORS.primary, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  hero: { alignItems: 'center', marginBottom: 28 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, borderColor: COLORS.primary },
  avatarLoading: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  avatarInitials: { color: '#fff', fontSize: 28, fontWeight: '900' },
  camBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: COLORS.primary, borderRadius: 12, padding: 5, borderWidth: 2, borderColor: COLORS.background },
  userName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 6 },
  clubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  clubText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  bio: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', maxWidth: width * 0.7, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: '#111', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statCardCenter: { borderColor: COLORS.primary + '40' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 4 },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  emptyFriends: { backgroundColor: '#111', borderRadius: 16, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  emptyFriendsText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptyFriendsSub: { color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 4 },
  friendCard: { alignItems: 'center', marginRight: 18, width: 68 },
  friendAvatarWrap: { position: 'relative' },
  friendAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#1A1A1A', borderWidth: 2, borderColor: '#1A1A1A' },
  friendName: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  friendSub: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2, textAlign: 'center' },
  infoCard: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.primary, borderRadius: 14, padding: 17, marginBottom: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, flex: 1 },
});