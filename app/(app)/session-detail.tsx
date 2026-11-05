// app/(app)/session-detail.tsx — détail d'une session passée (ouvert depuis Stats)
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../src/colors';

const MODE_NAMES: Record<string, string> = {
  flash: 'Mode Flash', 'multi-rush': 'Multi-Target Rush', 'force-challenge': 'Défi Force',
  'max-power': 'Max Power', sequence: 'Mode Séquence', 'memory-seq': 'Séquence Mémoire',
  'fake-targets': 'Fausses Cibles', 'sprint-60': 'Sprint 60s', endurance: 'Endurance',
  survival: 'Survie', 'combo-king': 'Combo King',
};

const num = (v: any): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) && n > 0 ? n : null;
};

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m} min ${r.toString().padStart(2, '0')} s` : `${r} s`;
};

type Stat = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };

export default function SessionDetailScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const session = useMemo(() => { try { return JSON.parse(data || '{}'); } catch { return {}; } }, [data]);

  const date = session.created_at ? new Date(session.created_at) : null;
  const mode = MODE_NAMES[session.mode] || (session.mode ? String(session.mode) : 'Session libre');
  const score = num(session.total_score) ?? num(session.score) ?? 0;
  const hits = num(session.total_hits) ?? num(session.total_shots);
  const duration = num(session.duration_s);

  // Chaque statistique n'apparaît que si elle a été enregistrée
  const stats: Stat[] = [
    hits != null && { icon: 'football-outline', label: 'Frappes', value: String(Math.round(hits)) },
    duration != null && hits != null && { icon: 'pulse-outline', label: 'Cadence', value: `${(hits / (duration / 60)).toFixed(1)} / min` },
    num(session.combo_max) != null && { icon: 'flame-outline', label: 'Meilleur combo', value: `×${Math.round(num(session.combo_max)!)}` },
    num(session.avg_force_n) != null && { icon: 'fitness-outline', label: 'Force moyenne', value: `${Math.round(num(session.avg_force_n)!)} N` },
    num(session.avg_force_g) != null && { icon: 'barbell-outline', label: 'Impact moyen', value: `${num(session.avg_force_g)!.toFixed(1)} g` },
    num(session.max_force_g) != null && { icon: 'trending-up-outline', label: 'Impact max', value: `${num(session.max_force_g)!.toFixed(1)} g` },
    num(session.avg_speed_kmh) != null && { icon: 'speedometer-outline', label: 'Vitesse moyenne', value: `${Math.round(num(session.avg_speed_kmh)!)} km/h` },
    num(session.avg_reaction_ms) != null && { icon: 'flash-outline', label: 'Réaction moyenne', value: `${Math.round(num(session.avg_reaction_ms)!)} ms` },
    duration != null && { icon: 'timer-outline', label: 'Durée', value: formatDuration(duration) },
    num(session.xp_gained) != null && { icon: 'star-outline', label: 'XP gagnée', value: `+${Math.round(num(session.xp_gained)!)}` },
  ].filter(Boolean) as Stat[];

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>DÉTAIL DE LA SESSION</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={s.hero}>
          <Text style={s.mode}>{mode}</Text>
          {date && (
            <Text style={s.date}>
              {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Text style={s.score}>{Math.round(score)}</Text>
          <Text style={s.scoreLbl}>POINTS</Text>
        </View>

        {stats.length > 0 ? (
          <View style={s.grid}>
            {stats.map(st => (
              <View key={st.label} style={s.cell}>
                <Ionicons name={st.icon} size={18} color={COLORS.primary} />
                <Text style={s.value}>{st.value}</Text>
                <Text style={s.label}>{st.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.empty}>Aucune mesure détaillée n'a été enregistrée pour cette session.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  hero: { alignItems: 'center', padding: 24, borderRadius: 20, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)' },
  mode: { color: '#fff', fontSize: 20, fontWeight: '900' },
  date: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  score: { color: COLORS.primary, fontSize: 52, fontWeight: '900', marginTop: 14 },
  scoreLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  cell: { flexGrow: 1, flexBasis: '45%', padding: 14, borderRadius: 14, backgroundColor: '#151515', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', gap: 4 },
  value: { color: '#fff', fontSize: 20, fontWeight: '900' },
  label: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700' },
  empty: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 24, fontSize: 13 },
});
