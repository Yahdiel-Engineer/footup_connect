/**
 * app/(app)/chat/[friendId].tsx
 * Messagerie directe style TikTok :
 * - Bandeau "demande de message" si pas encore coéquipier
 * - Gère les états : none | pending | incoming | accepted
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Pressable, Platform, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';
import { useLiveRefresh, emitMessagesChanged } from '../../../src/messageEvents';
import { useAttachmentComposer } from '../../../src/components/AttachmentComposer';
import * as Clipboard from 'expo-clipboard';
import { MessageAttachment, captionOf } from '../../../src/components/MessageAttachment';
import { MessageExtras } from '../../../src/attachments';


type FriendStatus = 'none' | 'pending' | 'incoming' | 'accepted';

interface Message extends MessageExtras {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

const rgba = (hex: string, a: number) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch { return `rgba(30,215,96,${a})`; }
};

export default function ConversationScreen() {
  const router = useRouter();
  const { friendId, name } = useLocalSearchParams<{ friendId: string; name: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState<string>('');
  const [friendInfo, setFriendInfo] = useState<any>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const lastTypingSent = useRef(0);
  const [friendTyping, setFriendTyping] = useState(false);

  // ── Chargement complet (profil, statut d'amitié) : à l'ouverture ──
  const loadProfile = useCallback(async () => {
    try {
      const [meRes, profileRes] = await Promise.all([
        api.get('/profile'),
        api.get(`/users/${friendId}/profile`).catch(() => ({ data: { friend_status: 'none', user: null } })),
      ]);
      setMyId(String(meRes.data?.id || ''));
      setFriendInfo(profileRes.data?.user || null);
      setFriendStatus(profileRes.data?.friend_status || 'none');
    } catch (e) {
      console.warn('Chat profile error:', e);
    }
  }, [friendId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Rafraîchissement léger : messages, lu/non lu, « écrit… » ──
  const loadMessages = useCallback(async () => {
    try {
      const [msgRes, statusRes] = await Promise.all([
        api.get(`/messages/${friendId}`),
        api.get(`/messages/${friendId}/status`).catch(() => ({ data: null })),
      ]);
      const next: Message[] = msgRes.data || [];
      setMessages(prev => {
        const hasUnread = next.some(m => m.sender_id === friendId && !m.read);
        if (hasUnread) {
          api.post(`/messages/${friendId}/read`).then(emitMessagesChanged).catch(() => {});
        }
        // ne re-rendre que si quelque chose a changé (nouveau message ou passage à « lu »)
        const sig = (l: Message[]) => l.map(m => `${m.id}:${m.read ? 1 : 0}`).join(',');
        return sig(prev) === sig(next) ? prev : next;
      });
      setFriendTyping(!!statusRes.data?.friend_typing);
    } catch (e) {
      console.warn('Chat load error:', e);
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useLiveRefresh(loadMessages, 3000);

  // ── Signal « en train d'écrire » (au plus une fois toutes les 3 s) ──
  const handleInputChange = (text: string) => {
    setInput(text);
    const now = Date.now();
    if (text.trim() && friendStatus === 'accepted' && now - lastTypingSent.current > 3000) {
      lastTypingSent.current = now;
      api.post(`/messages/${friendId}/typing`).catch(() => {});
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, friendTyping]);

  // ── Envoyer un message ────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (friendStatus !== 'accepted') return; // on n'écrit qu'à ses coéquipiers

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setInput('');

    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      sender_id: myId,
      content: text,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await api.post(`/messages/${friendId}`, { content: text });
      loadMessages();
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setInput(text);
      Alert.alert('Message non envoyé', e?.response?.data?.detail || 'Réessaie dans un instant.');
    } finally {
      setSending(false);
    }
  };

  // ── Accepter la demande d'ami ─────────────────────────
  const handleAcceptFriend = async () => {
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/friends/accept/${friendId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadProfile();
      loadMessages();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter cette demande.');
    } finally {
      setAccepting(false);
    }
  };


  // ── Pièces jointes : aperçu avant envoi ──
  const composer = useAttachmentComposer(`/messages/${friendId}`, () => loadMessages(), friendStatus === 'accepted');

  // ── Appui long sur un message : copier, supprimer ──
  const messageMenu = (item: Message, isMe: boolean) => {
    if (item.id.startsWith('temp_')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const actions: any[] = [];
    if (item.content && (!item.kind || item.kind === 'text')) {
      actions.push({ text: 'Copier', onPress: () => Clipboard.setStringAsync(item.content) });
    }
    if (isMe) {
      actions.push({
        text: 'Supprimer pour tout le monde', style: 'destructive',
        onPress: async () => {
          setMessages(prev => prev.filter(m => m.id !== item.id));
          try { await api.delete(`/messages/item/${item.id}`); emitMessagesChanged(); }
          catch (e: any) { Alert.alert('Suppression impossible', e?.response?.data?.detail || 'Réessaie.'); loadMessages(); }
        },
      });
    }
    if (actions.length === 0) return;
    Alert.alert(isMe ? 'Ton message' : 'Message', undefined, [...actions, { text: 'Annuler', style: 'cancel' }]);
  };

  // ── Envoyer une demande de coéquipier ─────────────────
  const handleAddFriend = async () => {
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/friends/request/${friendId}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFriendStatus('pending');
    } catch (e: any) {
      Alert.alert('Demande non envoyée', e?.response?.data?.detail || 'Réessaie dans un instant.');
    } finally {
      setAccepting(false);
    }
  };

  // ── Aller dans le profil ──────────────────────────────
  const handleGoToProfile = () => {
    Haptics.selectionAsync();
    router.push({ pathname: '/(app)/user/[id]', params: { id: friendId } });
  };

  // ── Formater l'heure ──────────────────────────────────
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch { return ''; }
  };

  // ── Render message ────────────────────────────────────
  const lastMineIndex = messages.reduce((acc, m, i) => (String(m.sender_id) === String(myId) ? i : acc), -1);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = String(item.sender_id) === String(myId);
    const prev = messages[index - 1];
    const showDate = !prev || formatDate(prev.created_at) !== formatDate(item.created_at);

    return (
      <>
        {showDate && (
          <View style={msgStyles.dateSep}>
            <Text style={msgStyles.dateTxt}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[msgStyles.row, isMe ? msgStyles.rowMe : msgStyles.rowOther]}>
          {!isMe && friendInfo?.avatar_url && (
            <Image source={{ uri: friendInfo.avatar_url }} style={msgStyles.avatar} />
          )}
          {!isMe && !friendInfo?.avatar_url && (
            <View style={msgStyles.avatarFallback}>
              <Text style={msgStyles.avatarInitial}>{(name || 'J').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Pressable
            onLongPress={() => messageMenu(item, isMe)}
            delayLongPress={300}
            style={[msgStyles.bubble, isMe ? msgStyles.bubbleMe : msgStyles.bubbleOther]}
          >
            {item.kind && item.kind !== 'text' && <MessageAttachment message={item} isMe={isMe} />}
            {!!captionOf(item.content, item.kind) && (
              <Text style={[msgStyles.content, isMe && msgStyles.contentMe]}>{captionOf(item.content, item.kind)}</Text>
            )}
            <Text style={[msgStyles.time, isMe && msgStyles.timeMe]}>{formatTime(item.created_at)}</Text>
          </Pressable>
        </View>
        {isMe && index === lastMineIndex && (
          <View style={msgStyles.receipt}>
            <Ionicons
              name={item.read ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={item.read ? COLORS.primary : 'rgba(255,255,255,0.35)'}
            />
            <Text style={[msgStyles.receiptTxt, item.read && { color: COLORS.primary }]}>
              {item.read ? 'Lu' : 'Envoyé'}
            </Text>
          </View>
        )}
      </>
    );
  };

  if (loading) return (
    <SafeAreaView style={s.container}>
      <View style={s.center}><ActivityIndicator color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  const displayName = friendInfo?.name || name || 'Joueur';
  const isAccepted = friendStatus === 'accepted';
  const isIncoming = friendStatus === 'incoming';
  const isPending = friendStatus === 'pending';

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={s.headerCenter} onPress={handleGoToProfile} activeOpacity={0.8}>
          {friendInfo?.avatar_url
            ? <Image source={{ uri: friendInfo.avatar_url }} style={s.headerAvatar} />
            : <View style={s.headerAvatarFallback}>
                <Text style={s.headerAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
          }
          <View>
            <Text style={s.headerName}>{displayName}</Text>
            <Text style={[s.headerStatus, { color: friendTyping ? COLORS.primary : isAccepted ? '#1ED760' : 'rgba(255,255,255,0.35)' }]}>
              {friendTyping ? 'écrit…' : isAccepted ? '● Coéquipier' : isIncoming ? '● Demande reçue' : isPending ? '● Demande envoyée' : '● Non coéquipier'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.profileBtn} onPress={handleGoToProfile}>
          <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {/* ── Bandeau : il faut être coéquipiers pour discuter ── */}
      {!isAccepted && (
        <View style={[s.statusBanner, isIncoming ? s.statusBannerIncoming : isPending ? s.statusBannerPending : s.statusBannerNone]}>
          <Ionicons
            name={isIncoming ? 'person-add-outline' : isPending ? 'time-outline' : 'people-outline'}
            size={16}
            color={isIncoming ? '#1ED760' : COLORS.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.statusBannerTitle}>
              {isIncoming ? `${displayName} veut devenir ton coéquipier` : isPending ? 'Demande de coéquipier envoyée' : "Vous n'êtes pas coéquipiers"}
            </Text>
            <Text style={s.statusBannerSub}>
              {isIncoming
                ? 'Accepte pour pouvoir discuter.'
                : isPending
                ? `Tu pourras écrire à ${displayName} dès que la demande sera acceptée.`
                : 'Ajoute ce joueur comme coéquipier pour pouvoir discuter.'}
            </Text>
          </View>
          {!isPending && (
            <TouchableOpacity
              style={s.acceptBtn}
              onPress={isIncoming ? handleAcceptFriend : handleAddFriend}
              disabled={accepting}
            >
              {accepting
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={s.acceptBtnTxt}>{isIncoming ? 'Accepter' : 'Ajouter'}</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.messagesList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={friendTyping ? (
            <View style={msgStyles.typing}>
              <Text style={msgStyles.typingTxt}>{displayName} écrit…</Text>
            </View>
          ) : undefined}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <Ionicons name="chatbubble-outline" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyChatTxt}>
                {isAccepted ? "Aucun message pour l'instant" : 'Pas encore de conversation'}
              </Text>
              <Text style={s.emptyChatSub}>
                {isAccepted ? 'Commence la conversation !' : 'Devenez coéquipiers pour discuter'}
              </Text>
            </View>
          }
        />

        {/* ── Input ── */}
        <View style={s.inputBar}>
          {composer.button}
          <TextInput
            style={s.input}
            placeholder={isAccepted ? 'Message…' : 'Réservé aux coéquipiers'}
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={input}
            onChangeText={handleInputChange}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={isAccepted}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: input.trim() && isAccepted ? COLORS.primary : 'rgba(255,255,255,0.07)' }]}
            onPress={handleSend}
            disabled={!input.trim() || sending || !isAccepted}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={input.trim() && isAccepted ? '#fff' : 'rgba(255,255,255,0.3)'} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {composer.modals}
    </SafeAreaView>
  );
}

// ─── Styles messages ──────────────────────────────────────
const msgStyles = StyleSheet.create({
  dateSep: { alignItems: 'center', marginVertical: 16 },
  dateTxt: { fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4, paddingHorizontal: 16 },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, marginBottom: 2 },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarInitial: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  bubble: { maxWidth: '72%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1E1E1E', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  content: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  contentMe: { color: '#fff' },
  time: { fontSize: 9, color: 'rgba(255,255,255,0.3)', alignSelf: 'flex-end' },
  timeMe: { color: 'rgba(255,255,255,0.6)' },
  receipt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, paddingHorizontal: 18, marginTop: 2, marginBottom: 6 },
  receiptTxt: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  typing: { alignSelf: 'flex-start', marginLeft: 16, marginTop: 6, backgroundColor: '#1E1E1E', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  typingTxt: { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' },
});

// ─── Styles globaux ───────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.primary },
  headerAvatarInitial: { fontSize: 16, fontWeight: '900', color: COLORS.primary },
  headerName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  headerStatus: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  profileBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  
  statusBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginHorizontal: 12, marginTop: 10, borderRadius: 16, borderWidth: 1 },
  statusBannerNone: { backgroundColor: rgba(COLORS.primary, 0.08), borderColor: rgba(COLORS.primary, 0.25) },
  statusBannerIncoming: { backgroundColor: 'rgba(30,215,96,0.08)', borderColor: 'rgba(30,215,96,0.25)' },
  statusBannerPending: { backgroundColor: 'rgba(255,183,0,0.08)', borderColor: 'rgba(255,183,0,0.25)' }, // ✅ NOUVEAU
  statusBannerTitle: { fontSize: 13, fontWeight: '800', color: '#fff', marginBottom: 2 },
  statusBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 16 },
  acceptBtn: { backgroundColor: '#1ED760', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: 'center' },
  acceptBtnTxt: { fontSize: 12, fontWeight: '800', color: '#000' },

  messagesList: { paddingTop: 16, paddingBottom: 12, flexGrow: 1 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyChatTxt: { fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
  emptyChatSub: { fontSize: 12, color: 'rgba(255,255,255,0.2)' },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.07)' },
  input: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 14, maxHeight: 100, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});