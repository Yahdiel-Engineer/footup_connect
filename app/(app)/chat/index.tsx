import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useIsFocused } from 'expo-router';
import { useLiveRefresh } from '../../../src/messageEvents';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

type Conversation = {
  kind: 'direct' | 'group';
  key: string;
  member_count?: number;
  friend_id: string;
  name: string;
  avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_online: boolean;
};

export default function ChatListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  // Conversations privées + groupes, triés par dernier message ; rafraîchi tant que l'écran est affiché
  const loadData = useCallback(async () => {
    try {
      const [convRes, groupRes] = await Promise.all([
        api.get('/messages/conversations').catch(() => ({ data: [] })),
        api.get('/groups').catch(() => ({ data: [] })),
      ]);
      const direct: Conversation[] = (convRes.data || []).map((c: any) => ({ ...c, kind: 'direct', key: `d${c.friend_id}` }));
      const groups: Conversation[] = (groupRes.data || []).map((g: any) => ({
        kind: 'group', key: `g${g.id}`, friend_id: g.id, name: g.name, avatar_url: g.avatar_url,
        last_message: g.last_message, last_message_at: g.last_message_at,
        unread_count: g.unread_count, is_online: false, member_count: g.member_count,
      }));
      setConversations([...direct, ...groups].sort((a, b) => (b.last_message_at || '').localeCompare(a.last_message_at || '')));
    } finally {
      setLoading(false);
    }
  }, []);

  useLiveRefresh(loadData, 5000, isFocused);

  // ── Appui long : supprimer une conversation (pour moi) ou gérer un groupe ──
  const conversationMenu = (item: Conversation) => {
    if (item.kind === 'group') {
      Alert.alert(item.name, undefined, [
        { text: 'Infos du groupe', onPress: () => router.push({ pathname: '/chat/group-info', params: { groupId: item.friend_id } }) },
        {
          text: 'Quitter le groupe', style: 'destructive',
          onPress: () => Alert.alert('Quitter le groupe ?', 'Tu ne recevras plus ses messages.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: async () => {
              setConversations(prev => prev.filter(c => c.key !== item.key));
              try { await api.post(`/groups/${item.friend_id}/leave`); } catch { loadData(); }
            } },
          ]),
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(
      'Supprimer la conversation ?',
      `Les messages avec ${item.name} seront effacés de ton côté. ${item.name} garde son historique.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          setConversations(prev => prev.filter(c => c.key !== item.key));
          try { await api.post(`/messages/${item.friend_id}/clear`); }
          catch (e: any) { Alert.alert('Suppression impossible', e?.response?.data?.detail || 'Réessaie.'); loadData(); }
        } },
      ],
    );
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 60) return `${mins}m`;
      if (hours < 24) return `${hours}h`;
      return `${days}j`;
    } catch { return ''; }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[s.title, { flex: 1 }]}>MESSAGES</Text>
        <TouchableOpacity style={s.newGroupBtn} onPress={() => router.push('/chat/new-group')} activeOpacity={0.85}>
          <Ionicons name="people" size={16} color="#fff" />
          <Text style={s.newGroupTxt}>Créer un groupe</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.key}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubble-outline" size={56} color="rgba(255,255,255,0.08)" />
              <Text style={s.emptyTitle}>Aucune conversation</Text>
              <Text style={s.emptySub}>Tes conversations et tes groupes apparaîtront ici</Text>
              <TouchableOpacity style={s.seeRequestsBtn} onPress={() => router.push('/chat/new-group')}>
                <Text style={s.seeRequestsText}>Créer un groupe</Text>
              </TouchableOpacity>

            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.convRow}
              onLongPress={() => conversationMenu(item)}
              delayLongPress={350}
              onPress={() => item.kind === 'group'
                ? router.push({ pathname: '/chat/group/[groupId]', params: { groupId: item.friend_id, name: item.name } })
                : router.push({ pathname: '/chat/[friendId]', params: { friendId: item.friend_id, name: item.name } })}
            >
              <View style={s.avatarWrap}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.avatar} />
                ) : item.kind === 'group' ? (
                  <View style={s.avatarFallback}>
                    <Ionicons name="people" size={22} color={COLORS.primary} />
                  </View>
                ) : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarInitials}>{getInitials(item.name)}</Text>
                  </View>
                )}
                {item.unread_count > 0 && (
                  <View style={s.unreadDot} />
                )}
              </View>

              <View style={s.convInfo}>
                <View style={s.convHeader}>
                  <Text style={s.convName}>{item.name}</Text>
                  <Text style={s.convTime}>{formatTime(item.last_message_at)}</Text>
                </View>
                <Text style={s.convMessage} numberOfLines={1}>
                  {item.last_message || (item.kind === 'group' ? `Groupe · ${item.member_count} membres` : 'Nouvelle conversation')}
                </Text>
              </View>

              {item.unread_count > 0 && (
                <View style={s.unreadBadge}>
                  <Text style={s.unreadText}>{item.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2, marginLeft: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  newGroupBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  newGroupTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  
  requestsBtn: {
    position: 'relative',
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#E040FB',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  list: { padding: 16, paddingBottom: 40 },
  
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  
  avatarWrap: { position: 'relative' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '40'
  },
  avatarInitials: { color: COLORS.primary, fontWeight: '800', fontSize: 18 },
  unreadDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.background,
  },

  convInfo: { flex: 1 },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  convTime: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  convMessage: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  unreadBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 80,
  },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '700' },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  
  seeRequestsBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(224,64,251,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(224,64,251,0.3)',
  },
  seeRequestsText: { color: '#E040FB', fontWeight: '700', fontSize: 13 },
});