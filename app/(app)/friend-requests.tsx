import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../src/api';
import { COLORS } from '../../src/colors';

type FriendRequest = {
  request_id: number;
  user_id: number;
  name: string;
  avatar_url: string | null;
  club: string | null;
  created_at: string;
};

export default function FriendRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/friends/requests');
      setRequests(data || []);
    } catch { setRequests([]); }
    finally { setLoading(false); }
  };

  const accept = async (req: FriendRequest) => {
    setProcessing(req.request_id);
    try {
      await api.put(`/friends/request/${req.request_id}/accept`);
      setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
      Alert.alert('✅ Accepté', `Tu es maintenant coéquipier avec ${req.name} !`);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter la demande');
    } finally { setProcessing(null); }
  };

  const decline = async (req: FriendRequest) => {
    Alert.alert('Refuser', `Refuser la demande de ${req.name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser', style: 'destructive', onPress: async () => {
          setProcessing(req.request_id);
          try {
            await api.put(`/friends/request/${req.request_id}/decline`);
            setRequests(prev => prev.filter(r => r.request_id !== req.request_id));
          } catch {
            Alert.alert('Erreur', 'Impossible de refuser');
          } finally { setProcessing(null); }
        }
      }
    ]);
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `Il y a ${mins} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${days}j`;
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>DEMANDES REÇUES</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : requests.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={56} color="rgba(255,255,255,0.08)" />
          <Text style={s.emptyTitle}>Aucune demande en attente</Text>
          <Text style={s.emptySub}>Les demandes de coéquipiers apparaîtront ici</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => String(item.request_id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.card}>
              {/* Avatar */}
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarInitials}>{getInitials(item.name)}</Text>
                </View>
              )}

              {/* Infos */}
              <View style={s.info}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.sub}>{item.club || 'Joueur FootUp'}</Text>
                <Text style={s.time}>{formatDate(item.created_at)}</Text>
              </View>

              {/* Boutons */}
              {processing === item.request_id ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <View style={s.actions}>
                  <TouchableOpacity style={s.acceptBtn} onPress={() => accept(item)}>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.declineBtn} onPress={() => decline(item)}>
                    <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  list: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '40' },
  avatarInitials: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  info: { flex: 1 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  time: { color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  declineBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '700' },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
});