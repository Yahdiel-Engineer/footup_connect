// app/(app)/chat/group/[groupId].tsx — conversation de groupe
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, ActivityIndicator, Image, Alert, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api, { getFullError } from '../../../../src/api';
import { COLORS } from '../../../../src/colors';
import { useLiveRefresh, emitMessagesChanged } from '../../../../src/messageEvents';
import { useAttachmentComposer } from '../../../../src/components/AttachmentComposer';
import * as Clipboard from 'expo-clipboard';
import { MessageAttachment, captionOf } from '../../../../src/components/MessageAttachment';
import { MessageExtras } from '../../../../src/attachments';


type GroupMessage = MessageExtras & {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_avatar?: string | null;
  content: string;
  created_at: string;
  read_by: number;
  read_by_names?: string[];
};
type Member = { id: string; name: string; avatar_url: string | null; role: 'admin' | 'member' };
type Group = { id: string; name: string; avatar_url?: string | null; my_role: string; members: Member[] };

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};
const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return "Aujourd'hui";
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch { return ''; }
};

export default function GroupChatScreen() {
  const router = useRouter();
  const { groupId, name } = useLocalSearchParams<{ groupId: string; name?: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [myId, setMyId] = useState('');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const lastTypingSent = useRef(0);

  useFocusEffect(useCallback(() => {
    Promise.all([api.get(`/groups/${groupId}`), api.get('/profile')])
      .then(([g, me]) => { setGroup(g.data); setMyId(String(me.data?.id || '')); })
      .catch(e => Alert.alert('Groupe indisponible', getFullError(e), [{ text: 'OK', onPress: () => router.back() }]));
  }, [groupId]));

  // Rafraîchissement léger : messages, « lu par », qui écrit
  const refresh = useCallback(async () => {
    try {
      const [m, st] = await Promise.all([
        api.get(`/groups/${groupId}/messages`),
        api.get(`/groups/${groupId}/status`).catch(() => ({ data: { typing: [] } })),
      ]);
      const next: GroupMessage[] = m.data || [];
      setMessages(prev => {
        const sig = (l: GroupMessage[]) => l.map(x => `${x.id}:${x.read_by}`).join(',');
        if (sig(prev) === sig(next)) return prev;
        // nouveaux messages reçus : marquer le groupe comme lu
        api.post(`/groups/${groupId}/read`).then(emitMessagesChanged).catch(() => {});
        return next;
      });
      setTyping(st.data?.typing || []);
    } catch (e) {
      console.warn('Group load error:', e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useLiveRefresh(refresh, 3000);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, typing.length]);

  const onChange = (text: string) => {
    setInput(text);
    const now = Date.now();
    if (text.trim() && now - lastTypingSent.current > 3000) {
      lastTypingSent.current = now;
      api.post(`/groups/${groupId}/typing`).catch(() => {});
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setInput('');
    const temp: GroupMessage = {
      id: `tmp-${Date.now()}`, sender_id: myId, sender_name: 'Moi', content: text,
      created_at: new Date().toISOString(), read_by: 0,
    };
    setMessages(prev => [...prev, temp]);
    try {
      await api.post(`/groups/${groupId}/messages`, { content: text });
      refresh();
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== temp.id));
      setInput(text);
      Alert.alert('Message non envoyé', getFullError(e));
    } finally {
      setSending(false);
    }
  };



  // ── Pièces jointes : aperçu avant envoi ──
  const composer = useAttachmentComposer(`/groups/${groupId}/messages`, () => refresh());

  // ── Appui long : copier, qui a lu, supprimer (auteur ou admin) ──
  const messageMenu = (item: GroupMessage, isMe: boolean) => {
    if (item.id.startsWith('tmp-')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const actions: any[] = [];
    if (item.content && (!item.kind || item.kind === 'text')) {
      actions.push({ text: 'Copier', onPress: () => Clipboard.setStringAsync(item.content) });
    }
    if (isMe) {
      const names = item.read_by_names || [];
      actions.push({
        text: 'Infos de lecture',
        onPress: () => Alert.alert('Lu par', names.length ? names.join('\n') : "Personne ne l'a encore lu."),
      });
    }
    if (isMe || group?.my_role === 'admin') {
      actions.push({
        text: isMe ? 'Supprimer pour tout le monde' : `Supprimer le message de ${item.sender_name}`, style: 'destructive',
        onPress: async () => {
          setMessages(prev => prev.filter(x => x.id !== item.id));
          try { await api.delete(`/groups/${groupId}/messages/${item.id}`); emitMessagesChanged(); }
          catch (e) { Alert.alert('Suppression impossible', getFullError(e)); refresh(); }
        },
      });
    }
    if (actions.length === 0) return;
    Alert.alert(isMe ? 'Ton message' : item.sender_name, undefined, [...actions, { text: 'Annuler', style: 'cancel' }]);
  };

  const openInfo = () => router.push({ pathname: '/chat/group-info', params: { groupId } });
  const openProfile = (userId: string | null) => {
    if (userId && userId !== myId) router.push({ pathname: '/(app)/user/[id]', params: { id: userId } });
  };

  const others = (group?.members.length ?? 1) - 1;
  const lastMineIndex = messages.reduce((acc, m, i) => (String(m.sender_id) === myId ? i : acc), -1);
  const title = group?.name || name || 'Groupe';
  const subtitle = typing.length
    ? `${typing.join(', ')} ${typing.length > 1 ? 'écrivent' : 'écrit'}…`
    : group ? group.members.map(m => m.name.split(' ')[0]).join(', ') : '';

  const renderItem = ({ item, index }: { item: GroupMessage; index: number }) => {
    const isMe = String(item.sender_id) === myId;
    const prev = messages[index - 1];
    const showDate = !prev || formatDate(prev.created_at) !== formatDate(item.created_at);
    const showName = !isMe && (!prev || prev.sender_id !== item.sender_id || showDate);
    return (
      <>
        {showDate && <View style={m.dateSep}><Text style={m.dateTxt}>{formatDate(item.created_at)}</Text></View>}
        <View style={[m.row, isMe ? m.rowMe : m.rowOther]}>
          {!isMe && (showName
            ? (
              <TouchableOpacity onPress={() => openProfile(item.sender_id)}>
                {item.sender_avatar
                  ? <Image source={{ uri: item.sender_avatar }} style={m.avatar} />
                  : <View style={m.avatarFallback}><Text style={m.avatarTxt}>{item.sender_name.charAt(0).toUpperCase()}</Text></View>}
              </TouchableOpacity>
            )
            : <View style={{ width: 28 }} />)}
          <Pressable
            onLongPress={() => messageMenu(item, isMe)}
            delayLongPress={300}
            style={[m.bubble, isMe ? m.bubbleMe : m.bubbleOther]}
          >
            {showName && <Text style={m.sender} onPress={() => openProfile(item.sender_id)}>{item.sender_name}</Text>}
            {item.kind && item.kind !== 'text' && <MessageAttachment message={item} isMe={isMe} />}
            {!!captionOf(item.content, item.kind) && (
              <Text style={[m.content, isMe && { color: '#fff' }]}>{captionOf(item.content, item.kind)}</Text>
            )}
            <Text style={[m.time, isMe && { color: 'rgba(255,255,255,0.6)' }]}>{formatTime(item.created_at)}</Text>
          </Pressable>
        </View>
        {isMe && index === lastMineIndex && !item.id.startsWith('tmp-') && (
          <View style={m.receipt}>
            <Ionicons name={item.read_by > 0 ? 'checkmark-done' : 'checkmark'} size={13}
              color={item.read_by > 0 ? COLORS.primary : 'rgba(255,255,255,0.35)'} />
            <Text style={[m.receiptTxt, item.read_by > 0 && { color: COLORS.primary }]}>
              {item.read_by === 0 ? 'Envoyé' : item.read_by >= others ? 'Lu par tous' : `Lu par ${item.read_by}`}
            </Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerCenter} onPress={openInfo} activeOpacity={0.8}>
          {group?.avatar_url
            ? <Image source={{ uri: group.avatar_url }} style={s.groupAvatar} />
            : <View style={s.groupAvatar}><Ionicons name="people" size={19} color={COLORS.primary} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{title}</Text>
            <Text style={[s.headerSub, typing.length > 0 && { color: COLORS.primary }]} numberOfLines={1}>{subtitle}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={openInfo}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {loading ? (
          <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={x => x.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 12, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="chatbubbles-outline" size={40} color="rgba(255,255,255,0.12)" />
                <Text style={s.emptyTxt}>Lance la discussion du groupe</Text>
              </View>
            }
          />
        )}
        <View style={s.inputBar}>
          {composer.button}
          <TextInput
            style={s.input}
            placeholder="Message au groupe…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={input}
            onChangeText={onChange}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: input.trim() ? COLORS.primary : 'rgba(255,255,255,0.07)' }]}
            onPress={send}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={input.trim() ? '#fff' : 'rgba(255,255,255,0.3)'} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {composer.modals}
    </SafeAreaView>
  );
}

const m = StyleSheet.create({
  dateSep: { alignItems: 'center', marginVertical: 14 },
  dateTxt: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4, paddingHorizontal: 16 },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  bubble: { maxWidth: '74%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, gap: 2 },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1E1E1E', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  sender: { fontSize: 13, fontWeight: '800', color: COLORS.primary, marginBottom: 3 },
  content: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  time: { fontSize: 9, color: 'rgba(255,255,255,0.3)', alignSelf: 'flex-end' },
  receipt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, paddingHorizontal: 18, marginTop: 2, marginBottom: 6 },
  receiptTxt: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.primary },
  headerName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTxt: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' },
  input: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
