import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../src/api';
import { COLORS } from '../../src/colors';

type User = {
  id: number;
  name: string;
  avatar_url: string | null;
  club: string | null;
  position: string | null;
  requestSent?: boolean;
};

export default function SearchUsersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(text.trim())}`);
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const sendRequest = async (user: User) => {
    setSending(user.id);
    try {
      await api.post(`/friends/request/${user.id}`);
      setResults(prev =>
        prev.map(u => u.id === user.id ? { ...u, requestSent: true } : u)
      );
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Impossible d'envoyer la demande";
      Alert.alert('Erreur', msg);
    } finally {
      setSending(null);
    }
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>AJOUTER UN COÉQUIPIER</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── BARRE DE RECHERCHE ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.primary} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={search}
          placeholder="Recherche par nom..."
          placeholderTextColor="rgba(255,255,255,0.25)"
          autoFocus
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
        {!loading && query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── RÉSULTATS ── */}
      {results.length === 0 && query.length >= 2 && !loading ? (
        <View style={s.empty}>
          <Ionicons name="person-outline" size={48} color="rgba(255,255,255,0.1)" />
          <Text style={s.emptyTitle}>Aucun joueur trouvé</Text>
          <Text style={s.emptySub}>Essaie un autre nom ou prénom</Text>
        </View>
      ) : query.length < 2 ? (
        <View style={s.hint}>
          <Ionicons name="people-outline" size={52} color="rgba(255,255,255,0.08)" />
          <Text style={s.hintText}>Tape au moins 2 lettres{'\n'}pour rechercher un joueur</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={s.userRow}>
              {/* Avatar */}
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarInitials}>{getInitials(item.name)}</Text>
                </View>
              )}

              {/* Infos */}
              <View style={s.userInfo}>
                <Text style={s.userName}>{item.name}</Text>
                <Text style={s.userSub}>
                  {[item.position, item.club].filter(Boolean).join(' · ') || 'Joueur FootUp'}
                </Text>
              </View>

              {/* Bouton */}
              {item.requestSent ? (
                <View style={s.sentBadge}>
                  <Ionicons name="checkmark" size={14} color={COLORS.primary} />
                  <Text style={s.sentText}>Envoyé</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => sendRequest(item)}
                  disabled={sending === item.id}
                >
                  {sending === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="person-add" size={16} color="#fff" />}
                </TouchableOpacity>
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, paddingHorizontal: 16, height: 50,
    backgroundColor: '#111', borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  searchIcon: {},
  searchInput: { flex: 1, color: '#fff', fontSize: 16 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.primary + '40'
  },
  avatarInitials: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  userInfo: { flex: 1 },
  userName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 3 },

  addBtn: {
    backgroundColor: COLORS.primary, width: 40, height: 40,
    borderRadius: 20, justifyContent: 'center', alignItems: 'center'
  },
  sentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.primary + '40'
  },
  sentText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '700' },
  emptySub: { color: 'rgba(255,255,255,0.2)', fontSize: 13 },

  hint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 40 },
  hintText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});