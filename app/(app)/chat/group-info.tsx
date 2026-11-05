// app/(app)/chat/group-info.tsx — infos et gestion d'un groupe (photo, nom, membres, droits)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, ActivityIndicator,
  TextInput, Modal, FlatList, Pressable, ActionSheetIOS, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import api, { getFullError } from '../../../src/api';
import { COLORS } from '../../../src/colors';
import { emitMessagesChanged } from '../../../src/messageEvents';
import { pickPhoto } from '../../../src/attachments';

type Member = { id: string; name: string; avatar_url: string | null; role: 'admin' | 'member'; is_me: boolean };
type Group = {
  id: string; name: string; avatar_url: string | null; created_at?: string;
  my_role: 'admin' | 'member'; members: Member[];
};
type Action = { label: string; destructive?: boolean; onPress: () => void };

/** Menu d'actions natif (feuille iOS, boîte de dialogue Android). */
function showActions(title: string, actions: Action[]) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map(a => a.label), 'Annuler'],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter(i => i >= 0),
      },
      i => { if (i < actions.length) actions[i].onPress(); },
    );
  } else {
    Alert.alert(title, undefined, [
      ...actions.map(a => ({ text: a.label, style: a.destructive ? 'destructive' as const : 'default' as const, onPress: a.onPress })),
      { text: 'Annuler', style: 'cancel' as const },
    ]);
  }
}

export default function GroupInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/groups/${groupId}`);
      setGroup(data);
      setName(data.name);
    } catch (e) {
      Alert.alert('Groupe indisponible', getFullError(e), [{ text: 'OK', onPress: () => router.back() }]);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<any>, success?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res?.data?.members) setGroup(res.data);
      if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      emitMessagesChanged();
      return true;
    } catch (e) {
      Alert.alert('Action impossible', getFullError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!group) {
    return <SafeAreaView style={s.container}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  const isAdmin = group.my_role === 'admin';
  const admins = group.members.filter(m => m.role === 'admin').length;

  // ── Photo du groupe ──
  const changePhoto = () => {
    const upload = async (source: 'camera' | 'library') => {
      const photo = await pickPhoto(source);
      if (!photo) return;
      const fd = new FormData();
      fd.append('file', { uri: photo.uri, name: photo.name, type: photo.mime } as any);
      run(() => api.post(`/groups/${groupId}/avatar`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, transformRequest: d => d, timeout: 60000,
      }), 'ok');
    };
    showActions('Photo du groupe', [
      { label: 'Choisir une photo', onPress: () => upload('library') },
      { label: 'Prendre une photo', onPress: () => upload('camera') },
      ...(group.avatar_url ? [{ label: 'Supprimer la photo', destructive: true, onPress: () => run(() => api.delete(`/groups/${groupId}/avatar`)) }] : []),
    ]);
  };

  const saveName = async () => {
    const n = name.trim();
    if (!n || n === group.name) { setEditingName(false); setName(group.name); return; }
    if (await run(() => api.patch(`/groups/${groupId}`, { name: n }), 'ok')) setEditingName(false);
  };

  // ── Actions sur un membre ──
  const memberActions = (m: Member) => {
    if (m.is_me) return;
    const actions: Action[] = [
      { label: 'Voir le profil', onPress: () => router.push({ pathname: '/(app)/user/[id]', params: { id: m.id } }) },
      { label: 'Envoyer un message', onPress: () => router.push({ pathname: '/chat/[friendId]', params: { friendId: m.id, name: m.name } }) },
    ];
    if (isAdmin) {
      actions.push(m.role === 'admin'
        ? { label: 'Retirer le rôle d\'admin', onPress: () => run(() => api.post(`/groups/${groupId}/members/${m.id}/role`, { role: 'member' }), 'ok') }
        : { label: 'Nommer admin', onPress: () => run(() => api.post(`/groups/${groupId}/members/${m.id}/role`, { role: 'admin' }), 'ok') });
      actions.push({
        label: 'Retirer du groupe', destructive: true,
        onPress: () => Alert.alert(`Retirer ${m.name} ?`, 'Ce joueur ne verra plus les messages du groupe.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Retirer', style: 'destructive', onPress: () => run(() => api.delete(`/groups/${groupId}/members/${m.id}`), 'ok') },
        ]),
      });
    }
    showActions(m.name, actions);
  };

  // ── Ajouter des membres ──
  const openAdd = async () => {
    setSelected(new Set());
    setAdding(true);
    setFriends(null);
    try {
      const { data } = await api.get('/friends');
      const inGroup = new Set(group.members.map(m => m.id));
      setFriends((data || []).filter((f: any) => !inGroup.has(String(f.id))));
    } catch { setFriends([]); }
  };
  const confirmAdd = async () => {
    if (selected.size === 0) return;
    if (await run(() => api.post(`/groups/${groupId}/members`, { member_ids: [...selected].map(Number) }), 'ok')) setAdding(false);
  };

  // ── Quitter / supprimer ──
  const leave = () => Alert.alert('Quitter le groupe ?', isAdmin && admins === 1 && group.members.length > 1
    ? 'Tu es le seul admin : le membre le plus ancien deviendra admin.'
    : 'Tu ne recevras plus ses messages.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Quitter', style: 'destructive', onPress: async () => {
      if (await run(() => api.post(`/groups/${groupId}/leave`))) router.dismissTo('/chat');
    } },
  ]);
  const remove = () => Alert.alert('Supprimer le groupe ?', 'Le groupe et tous ses messages seront supprimés pour tout le monde.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      if (await run(() => api.delete(`/groups/${groupId}`))) router.dismissTo('/chat');
    } },
  ]);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>INFOS DU GROUPE</Text>
        <View style={{ width: 40 }}>{busy && <ActivityIndicator color={COLORS.primary} />}</View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Photo + nom ── */}
        <View style={s.hero}>
          <TouchableOpacity onPress={isAdmin ? changePhoto : undefined} activeOpacity={isAdmin ? 0.8 : 1} disabled={!isAdmin}>
            {group.avatar_url
              ? <Image source={{ uri: group.avatar_url }} style={s.avatar} />
              : <View style={[s.avatar, s.avatarEmpty]}><Ionicons name="people" size={44} color={COLORS.primary} /></View>}
            {isAdmin && <View style={s.cam}><Ionicons name="camera" size={15} color="#fff" /></View>}
          </TouchableOpacity>

          {editingName ? (
            <View style={s.nameEdit}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                maxLength={60}
                autoFocus
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={saveName} style={s.saveBtn}><Text style={s.saveTxt}>OK</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.nameRow} onPress={() => isAdmin && setEditingName(true)} disabled={!isAdmin}>
              <Text style={s.groupName}>{group.name}</Text>
              {isAdmin && <Ionicons name="pencil" size={15} color="rgba(255,255,255,0.4)" />}
            </TouchableOpacity>
          )}
          <Text style={s.meta}>
            Groupe · {group.members.length} membres
            {group.created_at ? ` · créé le ${new Date(group.created_at).toLocaleDateString('fr-FR')}` : ''}
          </Text>
          {!isAdmin && <Text style={s.hint}>Seuls les admins peuvent modifier le groupe.</Text>}
        </View>

        {/* ── Membres ── */}
        <View style={s.sectionHead}>
          <Text style={s.section}>{group.members.length} MEMBRES</Text>
        </View>
        <View style={s.card}>
          {isAdmin && (
            <TouchableOpacity style={s.row} onPress={openAdd}>
              <View style={[s.memberAvatar, s.addIcon]}><Ionicons name="person-add" size={18} color="#fff" /></View>
              <Text style={[s.memberName, { color: COLORS.primary }]}>Ajouter des membres</Text>
            </TouchableOpacity>
          )}
          {group.members.map(m => (
            <TouchableOpacity key={m.id} style={s.row} onPress={() => memberActions(m)} activeOpacity={m.is_me ? 1 : 0.7}>
              {m.avatar_url
                ? <Image source={{ uri: m.avatar_url }} style={s.memberAvatar} />
                : <View style={[s.memberAvatar, s.avatarEmpty]}><Text style={s.initial}>{m.name.charAt(0).toUpperCase()}</Text></View>}
              <Text style={s.memberName} numberOfLines={1}>{m.is_me ? 'Toi' : m.name}</Text>
              {m.role === 'admin' && <View style={s.adminTag}><Text style={s.adminTxt}>Admin</Text></View>}
              {!m.is_me && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Actions ── */}
        <View style={[s.card, { marginTop: 24 }]}>
          <TouchableOpacity style={s.row} onPress={leave}>
            <Ionicons name="exit-outline" size={20} color={COLORS.primary} />
            <Text style={[s.memberName, { color: COLORS.primary }]}>Quitter le groupe</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={s.row} onPress={remove}>
              <Ionicons name="trash-outline" size={20} color={COLORS.primary} />
              <Text style={[s.memberName, { color: COLORS.primary }]}>Supprimer le groupe</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Ajout de membres ── */}
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={s.backdrop} onPress={() => setAdding(false)} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.sheetTitle}>Ajouter des coéquipiers</Text>
          {friends === null ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : friends.length === 0 ? (
            <Text style={s.hint}>Tous tes coéquipiers sont déjà dans le groupe.</Text>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={f => String(f.id)}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const id = String(item.id);
                const on = selected.has(id);
                return (
                  <TouchableOpacity style={s.row} onPress={() => setSelected(prev => {
                    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
                  })}>
                    {item.avatar_url
                      ? <Image source={{ uri: item.avatar_url }} style={s.memberAvatar} />
                      : <View style={[s.memberAvatar, s.avatarEmpty]}><Text style={s.initial}>{item.name?.charAt(0).toUpperCase()}</Text></View>}
                    <Text style={s.memberName}>{item.name}</Text>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? COLORS.primary : 'rgba(255,255,255,0.25)'} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <TouchableOpacity style={[s.addBtn, selected.size === 0 && { opacity: 0.4 }]} onPress={confirmAdd}>
            <Text style={s.addBtnTxt}>Ajouter{selected.size > 0 ? ` (${selected.size})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  hero: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 20, gap: 6 },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  avatarEmpty: { backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center' },
  cam: { position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  groupName: { color: '#fff', fontSize: 22, fontWeight: '900' },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'stretch' },
  nameInput: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 17, fontWeight: '700' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  saveTxt: { color: '#fff', fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  hint: { color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center', marginVertical: 8 },
  sectionHead: { marginHorizontal: 20, marginTop: 12, marginBottom: 8 },
  section: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  card: { marginHorizontal: 16, borderRadius: 16, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  addIcon: { backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  memberName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  adminTag: { backgroundColor: 'rgba(255,23,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  adminTxt: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#151515', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  sheetTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  addBtn: { marginTop: 12, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
