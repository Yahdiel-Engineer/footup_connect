/**
 * app/(app)/chat/[friendId].tsx
 * Messagerie directe style TikTok :
 * - Bandeau "demande de message" si pas encore coéquipier
 * - Gère les états : none | pending | incoming | accepted
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

type FriendStatus = 'none' | 'pending' | 'incoming' | 'accepted';

interface Message {
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
  const [convRequest, setConvRequest] = useState<any>(null); // ✅ NOUVEAU
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Charger messages + statut ─────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const [msgRes, meRes, profileRes] = await Promise.all([
        api.get(`/messages/${friendId}`),
        api.get('/profile'),
        api.get(`/users/${friendId}/profile`).catch(() => ({ data: { friend_status: 'none', user: null } })),
      ]);

      setMessages(msgRes.data || []);
      setMyId(String(meRes.data?.id || ''));
      setFriendInfo(profileRes.data?.user || null);
      setFriendStatus(profileRes.data?.friend_status || 'none');
      
      // ✅ NOUVEAU : Vérifier s'il y a une demande de conversation
      try {
        const convRes = await api.get(`/messages/${friendId}/status`);
        setConvRequest(convRes.data?.conversation_request || null);
      } catch {
        setConvRequest(null);
      }

      api.post(`/messages/${friendId}/read`).catch(() => {});
    } catch (e) {
      console.warn('Chat load error:', e);
    } finally {
      setLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current!);
  }, [loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Envoyer un message ────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // ✅ NOUVEAU : Si non-amis et pas de demande acceptée, on envoie une demande de conversation
    if (friendStatus !== 'accepted' && !convRequest) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSending(true);
      setInput('');
      
      try {
        const res = await api.post(`/messages/${friendId}`, { content: text });
        if (res.data?.type === 'conversation_request') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setConvRequest(res.data);
          Alert.alert('Demande envoyée', 'En attente d\'acceptation pour discuter.');
        }
      } catch (e: any) {
        Alert.alert('Erreur', e?.response?.data?.detail || 'Impossible d\'envoyer');
        setInput(text);
      } finally {
        setSending(false);
      }
      return;
    }

    // ✅ Si amis ou demande acceptée → message normal
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
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setInput(text);
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
      loadMessages();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter cette demande.');
    } finally {
      setAccepting(false);
    }
  };

  // ── Accepter la demande de conversation ───────────────
  const handleAcceptConversation = async () => {
    if (!convRequest?.request_id) return;
    setAccepting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/conversation-requests/${convRequest.request_id}/accept`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadMessages();
    } catch {
      Alert.alert('Erreur', 'Impossible d\'accepter la conversation.');
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
          <View style={[msgStyles.bubble, isMe ? msgStyles.bubbleMe : msgStyles.bubbleOther]}>
            <Text style={[msgStyles.content, isMe && msgStyles.contentMe]}>{item.content}</Text>
            <Text style={[msgStyles.time, isMe && msgStyles.timeMe]}>{formatTime(item.created_at)}</Text>
          </View>
        </View>
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
  const hasPendingConv = convRequest && convRequest.status === 'pending';

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
            <Text style={[s.headerStatus, { color: isAccepted ? '#1ED760' : 'rgba(255,255,255,0.35)' }]}>
              {isAccepted ? '● Coéquipier' : isIncoming ? '● Demande reçue' : hasPendingConv ? '● En attente' : '● Non coéquipier'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.profileBtn} onPress={handleGoToProfile}>
          <Ionicons name="person-outline" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      {/* ── Bandeau statut ── */}
      {!isAccepted && (
        <View style={[s.statusBanner, isIncoming ? s.statusBannerIncoming : hasPendingConv ? s.statusBannerPending : s.statusBannerNone]}>
          <Ionicons
            name={isIncoming ? 'person-add-outline' : hasPendingConv ? 'time-outline' : 'information-circle-outline'}
            size={16}
            color={isIncoming ? '#1ED760' : hasPendingConv ? COLORS.primary : COLORS.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.statusBannerTitle}>
              {isIncoming ? `${displayName} veut se connecter` : hasPendingConv ? 'Demande en attente' : 'Demande de message'}
            </Text>
            <Text style={s.statusBannerSub}>
              {isIncoming
                ? 'Accepte la demande pour devenir coéquipiers.'
                : hasPendingConv
                ? 'Votre demande de conversation est en attente d\'acceptation.'
                : 'Vous n\'êtes pas encore coéquipiers. Les messages apparaissent comme des demandes.'}
            </Text>
          </View>
          {isIncoming && (
            <TouchableOpacity style={s.acceptBtn} onPress={handleAcceptFriend} disabled={accepting}>
              {accepting ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.acceptBtnTxt}>Accepter</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Messages ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={s.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <Ionicons name="chatbubble-outline" size={40} color="rgba(255,255,255,0.1)" />
              <Text style={s.emptyChatTxt}>
                {hasPendingConv ? 'Demande envoyée...' : 'Aucun message pour l\'instant'}
              </Text>
              <Text style={s.emptyChatSub}>
                {hasPendingConv ? 'En attente d\'acceptation' : 'Commence la conversation !'}
              </Text>
            </View>
          }
        />

        {/* ── Input ── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder={
              isAccepted ? 'Message…' 
              : hasPendingConv ? 'Demande envoyée…' 
              : 'Envoyer une demande de message…'
            }
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={!hasPendingConv} // ✅ Bloqué si demande en attente
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: input.trim() && !hasPendingConv ? COLORS.primary : 'rgba(255,255,255,0.07)' }]}
            onPress={handleSend}
            disabled={!input.trim() || sending || hasPendingConv}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={input.trim() && !hasPendingConv ? '#fff' : 'rgba(255,255,255,0.3)'} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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