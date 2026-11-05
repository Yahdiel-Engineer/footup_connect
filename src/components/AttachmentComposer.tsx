// src/components/AttachmentComposer.tsx
// Bouton « + » du chat : choix (photo, appareil, fichier, session) → APERÇU → envoi.
// Rien n'est envoyé tant que l'utilisateur n'a pas validé l'aperçu.
import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import api from '../api';
import { COLORS } from '../colors';
import { emitMessagesChanged } from '../messageEvents';
import { pickFile, upload, formatSize, Picked } from '../attachments';
import { AttachmentSheet, AttachmentChoice } from './AttachmentSheet';
import { MessageAttachment } from './MessageAttachment';

type Draft =
  | { type: 'file'; picked: Picked; isImage: boolean }
  | { type: 'session'; sessionId: string; session: Record<string, any> };

/**
 * `endpoint` : où poster le message (ex. `/messages/12` ou `/groups/3/messages`).
 * Renvoie le bouton « + » (à placer dans la barre de saisie) et les fenêtres à monter dans l'écran.
 */
export function useAttachmentComposer(endpoint: string, onSent: () => void, enabled = true) {
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  const onChoose = async (choice: AttachmentChoice) => {
    try {
      if (typeof choice === 'object') {
        setDraft({ type: 'session', sessionId: choice.sessionId, session: choice.session });
      } else {
        const picked = await pickFile(choice);
        if (!picked) return; // annulé
        setDraft({ type: 'file', picked, isImage: picked.mime.startsWith('image/') });
      }
      setCaption('');
    } catch (e: any) {
      Alert.alert('Fichier indisponible', e?.message || 'Réessaie avec un autre fichier.');
    }
  };

  const cancel = () => { if (!sending) { setDraft(null); setCaption(''); } };

  const send = async () => {
    if (!draft || sending) return;
    setSending(true);
    try {
      const body: Record<string, any> = { content: caption.trim() };
      if (draft.type === 'session') body.session_id = draft.sessionId;
      else body.attachment = await upload(draft.picked);
      await api.post(endpoint, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft(null);
      setCaption('');
      onSent();
      emitMessagesChanged();
    } catch (e: any) {
      Alert.alert('Envoi impossible', e?.response?.data?.detail || e?.message || 'Réessaie dans un instant.');
    } finally {
      setSending(false);
    }
  };

  const button = enabled ? (
    <TouchableOpacity style={st.plusBtn} onPress={() => setSheetOpen(true)} accessibilityLabel="Joindre">
      <Ionicons name="add" size={24} color="#fff" />
    </TouchableOpacity>
  ) : null;

  const modals = (
    <>
      <AttachmentSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onChoose={onChoose} />
      <Modal visible={!!draft} animationType="slide" onRequestClose={cancel}>
        <KeyboardAvoidingView behavior="padding" style={[st.preview, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <View style={st.previewHead}>
            <TouchableOpacity onPress={cancel} style={st.headBtn} accessibilityLabel="Annuler">
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={st.previewTitle}>
              {draft?.type === 'session' ? 'Partager la session' : draft?.type === 'file' && draft.isImage ? 'Envoyer la photo' : 'Envoyer le fichier'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={st.previewBody}>
            {draft?.type === 'file' && draft.isImage && (
              <Image source={{ uri: draft.picked.uri }} style={st.previewImg} resizeMode="contain" />
            )}
            {draft?.type === 'file' && !draft.isImage && (
              <View style={st.fileCard}>
                <Ionicons name="document-text" size={56} color={COLORS.primary} />
                <Text style={st.fileName} numberOfLines={3}>{draft.picked.name}</Text>
                {!!draft.picked.size && <Text style={st.fileSize}>{formatSize(draft.picked.size)}</Text>}
              </View>
            )}
            {draft?.type === 'session' && (
              <View pointerEvents="none">
                <MessageAttachment message={{ kind: 'session', session_data: draft.session }} isMe={false} />
              </View>
            )}
          </View>

          <View style={st.captionBar}>
            <TextInput
              style={st.caption}
              placeholder="Ajouter une légende…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={caption}
              onChangeText={setCaption}
              maxLength={1000}
              multiline
              editable={!sending}
            />
            <TouchableOpacity style={st.sendBtn} onPress={send} disabled={sending} accessibilityLabel="Envoyer">
              {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );

  return { button, modals };
}

const st = StyleSheet.create({
  plusBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  preview: { flex: 1, backgroundColor: '#000' },
  previewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  previewTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  previewBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewImg: { width: '100%', height: '100%' },
  fileCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 20, backgroundColor: '#151515', maxWidth: 300 },
  fileName: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  fileSize: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  captionBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10 },
  caption: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11, color: '#fff', fontSize: 14, maxHeight: 110 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});
