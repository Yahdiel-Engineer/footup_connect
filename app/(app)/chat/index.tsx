import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

type Conversation = {
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
  const [convRequests, setConvRequests] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [convRes, reqRes] = await Promise.all([
        api.get('/messages/conversations').catch(() => ({ data: [] })),
        api.get('/conversation-requests').catch(() => ({ data: [] })),
      ]);
      setConversations(convRes.data || []);
      setConvRequests((reqRes.data || []).length);
    } finally {
      setLoading(false);
    }
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
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>MESSAGES</Text>
        
        {/* Bouton demandes de conversation */}
        <TouchableOpacity 
          style={s.requestsBtn}
          onPress={() => router.push('/chat/requests')}
        >
          <Ionicons name="chatbubbles" size={22} color="#fff" />
          {convRequests > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{convRequests > 9 ? '9+' : convRequests}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.friend_id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubble-outline" size={56} color="rgba(255,255,255,0.08)" />
              <Text style={s.emptyTitle}>Aucune conversation</Text>
              <Text style={s.emptySub}>Tes conversations avec tes coéquipiers apparaîtront ici</Text>
              
              {convRequests > 0 && (
                <TouchableOpacity 
                  style={s.seeRequestsBtn}
                  onPress={() => router.push('/chat/requests')}
                >
                  <Text style={s.seeRequestsText}>
                    📩 {convRequests} demande{convRequests > 1 ? 's' : ''} de conversation
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.convRow}
              onPress={() => router.push({
                pathname: '/chat/[friendId]',
                params: { friendId: item.friend_id, name: item.name }
              })}
            >
              <View style={s.avatarWrap}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.avatar} />
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
                  {item.last_message || 'Nouvelle conversation'}
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
  title: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  
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