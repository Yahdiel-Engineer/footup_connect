// app/(app)/chat/new-group.tsx — création d'un groupe avec des coéquipiers
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Image, Alert, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api, { getFullError } from '../../../src/api';
import { COLORS } from '../../../src/colors';

type Friend = { id: number; name: string; avatar_url: string | null; club?: string | null; position?: string | null };

export default function NewGroupScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/friends')
      .then(r => setFriends(r.data || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canCreate = name.trim().length > 0 && selected.size > 0 && !creating;

  const create = async () => {
    if (!name.trim()) { Alert.alert('Nom du groupe', 'Donne un nom au groupe.'); return; }
    if (selected.size === 0) { Alert.alert('Membres', 'Choisis au moins un coéquipier.'); return; }
    setCreating(true);
    try {
      const { data } = await api.post('/groups', { name: name.trim(), member_ids: [...selected] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/chat/group/[groupId]', params: { groupId: data.id, name: data.name } });
    } catch (e) {
      Alert.alert('Création impossible', getFullError(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>NOUVEAU GROUPE</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={s.nameBox}>
          <View style={s.groupIcon}><Ionicons name="people" size={22} color={COLORS.primary} /></View>
          <TextInput
            style={s.nameInput}
            placeholder="Nom du groupe (ex. EIGSI FC)"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
        </View>

        <Text style={s.section}>
          COÉQUIPIERS {selected.size > 0 ? `· ${selected.size} sélectionné${selected.size > 1 ? 's' : ''}` : ''}
        </Text>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={f => String(f.id)}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="person-add-outline" size={40} color="rgba(255,255,255,0.15)" />
                <Text style={s.emptyTxt}>Ajoute d'abord des coéquipiers pour créer un groupe.</Text>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/search-users')}>
                  <Text style={s.secondaryBtnTxt}>Rechercher des joueurs</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => {
              const on = selected.has(item.id);
              return (
                <TouchableOpacity style={s.row} onPress={() => toggle(item.id)} activeOpacity={0.8}>
                  {item.avatar_url
                    ? <Image source={{ uri: item.avatar_url }} style={s.avatar} />
                    : <View style={s.avatarFallback}><Text style={s.avatarTxt}>{(item.name || '?').charAt(0).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{item.name}</Text>
                    {!!(item.position || item.club) && (
                      <Text style={s.rowSub}>{[item.position, item.club].filter(Boolean).join(' · ')}</Text>
                    )}
                  </View>
                  <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? COLORS.primary : 'rgba(255,255,255,0.25)'} />
                </TouchableOpacity>
              );
            }}
          />
        )}

        <View style={s.footer}>
          <TouchableOpacity style={[s.createBtn, !canCreate && s.createBtnOff]} onPress={create} activeOpacity={0.85}>
            {creating
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.createTxt}>Créer le groupe</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { padding: 40, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  nameBox: { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 12, borderRadius: 16, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  groupIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginHorizontal: 20, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: COLORS.primary, fontWeight: '800', fontSize: 17 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  rowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', gap: 12, padding: 40 },
  emptyTxt: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontSize: 13 },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1A1A1A' },
  secondaryBtnTxt: { color: '#fff', fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  createBtnOff: { opacity: 0.4 },
  createTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
