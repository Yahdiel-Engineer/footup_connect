// src/components/AttachmentSheet.tsx — menu « + » du chat : photo, appareil photo, fichier, session
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api';
import { COLORS } from '../colors';

export type AttachmentChoice = 'library' | 'camera' | 'document' | { sessionId: string; session: Record<string, any> };

const MODE_NAMES: Record<string, string> = {
  flash: 'Mode Flash', 'multi-rush': 'Multi-Target Rush', 'force-challenge': 'Défi Force',
  'max-power': 'Max Power', sequence: 'Mode Séquence', 'memory-seq': 'Séquence Mémoire',
  'fake-targets': 'Fausses Cibles', 'sprint-60': 'Sprint 60s', endurance: 'Endurance',
  survival: 'Survie', 'combo-king': 'Combo King',
};

type Props = { visible: boolean; onClose: () => void; onChoose: (choice: AttachmentChoice) => void };

export function AttachmentSheet({ visible, onClose, onChoose }: Props) {
  const insets = useSafeAreaInsets();
  const [pickingSession, setPickingSession] = useState(false);
  const [sessions, setSessions] = useState<any[] | null>(null);

  useEffect(() => {
    if (!visible) { setPickingSession(false); return; }
  }, [visible]);

  useEffect(() => {
    if (!pickingSession || sessions) return;
    api.get('/sessions').then(r => setSessions(r.data || [])).catch(() => setSessions([]));
  }, [pickingSession]);

  const choose = (c: AttachmentChoice) => { onClose(); setTimeout(() => onChoose(c), 250); };

  const options: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }[] = [
    { icon: 'images', label: 'Photo', color: '#448AFF', onPress: () => choose('library') },
    { icon: 'camera', label: 'Appareil photo', color: '#1ED760', onPress: () => choose('camera') },
    { icon: 'document-attach', label: 'Fichier', color: '#FFB700', onPress: () => choose('document') },
    { icon: 'trophy', label: 'Session', color: COLORS.primary, onPress: () => setPickingSession(true) },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={st.handle} />
        {!pickingSession ? (
          <>
            <Text style={st.title}>Joindre</Text>
            <View style={st.grid}>
              {options.map(o => (
                <TouchableOpacity key={o.label} style={st.option} onPress={o.onPress} activeOpacity={0.8}>
                  <View style={[st.optionIcon, { backgroundColor: o.color }]}>
                    <Ionicons name={o.icon} size={24} color="#fff" />
                  </View>
                  <Text style={st.optionLabel}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={st.row}>
              <TouchableOpacity onPress={() => setPickingSession(false)} accessibilityLabel="Retour">
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={[st.title, { marginBottom: 0 }]}>Partager une session</Text>
            </View>
            {sessions === null ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
            ) : sessions.length === 0 ? (
              <Text style={st.empty}>Aucune session enregistrée pour l'instant.</Text>
            ) : (
              <FlatList
                data={sessions.slice(0, 20)}
                keyExtractor={s => String(s.id)}
                style={{ maxHeight: 360, marginTop: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={st.session} onPress={() => choose({ sessionId: String(item.id), session: item })}>
                    <Ionicons name="trophy-outline" size={18} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.sessionName}>{MODE_NAMES[item.mode] || item.mode || 'Session'}</Text>
                      <Text style={st.sessionDate}>
                        {new Date(item.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}{item.total_hits || item.total_shots || 0} frappes
                      </Text>
                    </View>
                    <Text style={st.sessionScore}>{item.total_score || item.score || 0} pts</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: '#151515', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 14 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', gap: 8, width: '24%' },
  optionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginVertical: 30 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' },
  sessionName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sessionDate: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  sessionScore: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
});
