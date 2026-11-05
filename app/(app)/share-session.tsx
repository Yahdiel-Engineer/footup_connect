// app/(app)/share-session.tsx — partager une session à un coéquipier ou à un groupe
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SectionList, ActivityIndicator, Image, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api, { getFullError } from '../../src/api';
import { COLORS } from '../../src/colors';
import { emitMessagesChanged } from '../../src/messageEvents';

type Target = { key: string; type: 'friend' | 'group'; id: string; name: string; avatar_url?: string | null; sub?: string };

export default function ShareSessionScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [sections, setSections] = useState<{ title: string; data: Target[] }[] | null>(null);
  const [note, setNote] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/friends').catch(() => ({ data: [] })),
      api.get('/groups').catch(() => ({ data: [] })),
    ]).then(([f, g]) => {
      const groups: Target[] = (g.data || []).map((x: any) => ({
        key: `g${x.id}`, type: 'group', id: String(x.id), name: x.name, avatar_url: x.avatar_url, sub: `${x.member_count} membres`,
      }));
      const friends: Target[] = (f.data || []).map((x: any) => ({
        key: `f${x.id}`, type: 'friend', id: String(x.id), name: x.name, avatar_url: x.avatar_url,
        sub: [x.position, x.club].filter(Boolean).join(' · '),
      }));
      setSections([
        ...(groups.length ? [{ title: 'GROUPES', data: groups }] : []),
        ...(friends.length ? [{ title: 'COÉQUIPIERS', data: friends }] : []),
      ]);
    });
  }, []);

  const share = async (t: Target) => {
    if (sentTo.has(t.key) || sending) return;
    setSending(t.key);
    try {
      const url = t.type === 'group' ? `/groups/${t.id}/messages` : `/messages/${t.id}`;
      await api.post(url, { session_id: sessionId, content: note.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSentTo(prev => new Set(prev).add(t.key));
      emitMessagesChanged();
    } catch (e) {
      Alert.alert('Partage impossible', getFullError(e));
    } finally {
      setSending(null);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>PARTAGER LA SESSION</Text>
        <View style={{ width: 40 }} />
      </View>

      <TextInput
        style={s.note}
        placeholder="Ajouter un message (facultatif)"
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={note}
        onChangeText={setNote}
        maxLength={300}
      />

      {sections === null ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : sections.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={40} color="rgba(255,255,255,0.15)" />
          <Text style={s.emptyTxt}>Ajoute des coéquipiers pour partager tes sessions.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={t => t.key}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderSectionHeader={({ section }) => <Text style={s.section}>{section.title}</Text>}
          renderItem={({ item }) => {
            const done = sentTo.has(item.key);
            return (
              <View style={s.row}>
                {item.type === 'group'
                  ? <View style={s.avatarFallback}><Ionicons name="people" size={20} color={COLORS.primary} /></View>
                  : item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={s.avatar} />
                    : <View style={s.avatarFallback}><Text style={s.initial}>{item.name?.charAt(0).toUpperCase()}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  {!!item.sub && <Text style={s.sub}>{item.sub}</Text>}
                </View>
                <TouchableOpacity
                  style={[s.sendBtn, done && s.sentBtn]}
                  onPress={() => share(item)}
                  disabled={done || !!sending}
                  activeOpacity={0.85}
                >
                  {sending === item.key
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[s.sendTxt, done && { color: '#1ED760' }]}>{done ? 'Envoyé' : 'Envoyer'}</Text>}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  note: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1A1A1A', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  section: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginHorizontal: 20, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  initial: { color: COLORS.primary, fontWeight: '800', fontSize: 17 },
  name: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  sendBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minWidth: 84, alignItems: 'center' },
  sentBtn: { backgroundColor: 'rgba(30,215,96,0.12)' },
  sendTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 12, padding: 40 },
  emptyTxt: { color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
});
