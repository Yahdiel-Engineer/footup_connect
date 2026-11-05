// src/components/MessageAttachment.tsx — contenu d'une bulle : photo, fichier ou session partagée
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Linking, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../colors';
import { formatSize, MessageExtras } from '../attachments';

const MODE_NAMES: Record<string, string> = {
  flash: 'Mode Flash', 'multi-rush': 'Multi-Target Rush', 'force-challenge': 'Défi Force',
  'max-power': 'Max Power', sequence: 'Mode Séquence', 'memory-seq': 'Séquence Mémoire',
  'fake-targets': 'Fausses Cibles', 'sprint-60': 'Sprint 60s', endurance: 'Endurance',
  survival: 'Survie', 'combo-king': 'Combo King',
};

/** Libellés automatiques ajoutés par l'API quand il n'y a pas de légende : on ne les répète pas. */
export function captionOf(content: string | undefined, kind?: string): string {
  if (!content) return '';
  if (kind === 'image' && content === '📷 Photo') return '';
  if (kind === 'file' && content.startsWith('📎 ')) return '';
  if (kind === 'session' && content === '🏆 Session partagée') return '';
  return content;
}

export function MessageAttachment({ message, isMe }: { message: MessageExtras; isMe: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState(false);

  if (message.kind === 'image' && message.attachment_url) {
    return (
      <>
        <TouchableOpacity onPress={() => setZoom(true)} activeOpacity={0.9}>
          <Image source={{ uri: message.attachment_url }} style={st.photo} resizeMode="cover" />
        </TouchableOpacity>
        <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
          <Pressable style={st.viewer} onPress={() => setZoom(false)}>
            <Image source={{ uri: message.attachment_url }} style={st.viewerImg} resizeMode="contain" />
            <TouchableOpacity style={[st.close, { top: insets.top + 12 }]} onPress={() => setZoom(false)} accessibilityLabel="Fermer">
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </Modal>
      </>
    );
  }

  if (message.kind === 'file' && message.attachment_url) {
    return (
      <TouchableOpacity
        style={[st.file, isMe && st.fileMe]}
        onPress={() => Linking.openURL(message.attachment_url!)}
        activeOpacity={0.85}
      >
        <Ionicons name="document-text" size={26} color={isMe ? '#fff' : COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={st.fileName} numberOfLines={2}>{message.attachment_name || 'Fichier'}</Text>
          <Text style={[st.fileMeta, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
            {[formatSize(message.attachment_size), 'Toucher pour ouvrir'].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Ionicons name="download-outline" size={18} color={isMe ? '#fff' : 'rgba(255,255,255,0.5)'} />
      </TouchableOpacity>
    );
  }

  if (message.kind === 'session' && message.session_data) {
    const s = message.session_data;
    const score = s.total_score || s.score || 0;
    const hits = s.total_hits || s.total_shots;
    const force = s.avg_force_n ? `${Math.round(s.avg_force_n)} N` : s.avg_force_g ? `${Number(s.avg_force_g).toFixed(1)} g` : null;
    return (
      <TouchableOpacity
        style={[st.session, isMe && st.sessionMe]}
        onPress={() => router.push({ pathname: '/session-detail', params: { data: JSON.stringify(s) } })}
        activeOpacity={0.85}
      >
        <View style={st.sessionHead}>
          <Ionicons name="trophy" size={16} color="#FFD700" />
          <Text style={st.sessionMode} numberOfLines={1}>{MODE_NAMES[s.mode] || s.mode || 'Session'}</Text>
        </View>
        <Text style={st.sessionScore}>{Math.round(score)} <Text style={st.sessionPts}>pts</Text></Text>
        <View style={st.sessionStats}>
          {hits ? <Text style={st.sessionStat}>{hits} frappes</Text> : null}
          {force ? <Text style={st.sessionStat}>{force}</Text> : null}
          {s.combo_max ? <Text style={st.sessionStat}>combo ×{s.combo_max}</Text> : null}
        </View>
        <Text style={st.sessionMore}>Voir le détail ›</Text>
      </TouchableOpacity>
    );
  }

  return null;
}

const st = StyleSheet.create({
  photo: { width: 220, height: 220, borderRadius: 14, backgroundColor: '#222' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '85%' },
  close: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  fileMe: { backgroundColor: 'rgba(0,0,0,0.18)' },
  fileName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  fileMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },
  session: { minWidth: 210, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.35)', gap: 4 },
  sessionMe: { backgroundColor: 'rgba(0,0,0,0.2)' },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionMode: { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 },
  sessionScore: { color: '#FFD700', fontSize: 26, fontWeight: '900' },
  sessionPts: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  sessionStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sessionStat: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  sessionMore: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', marginTop: 4 },
});
