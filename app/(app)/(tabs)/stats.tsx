import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../src/api';
import { COLORS } from '../../../src/colors';

export default function StatsTab() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/sessions/stats?days=7');
      setStats(statsRes.data);
    } catch (e: any) {
      console.log('Stats indisponibles:', e.message);
      setStats(null);
    }

    try {
      const sessionsRes = await api.get('/sessions');
      setSessions(sessionsRes.data || []);
    } catch (e: any) {
      console.log('Sessions indisponibles:', e.message);
      setSessions([]);
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MES STATS</Text>
        <TouchableOpacity style={styles.leaderboardBtn} onPress={() => router.push('/leaderboard')}>
          <Ionicons name="trophy-outline" size={18} color={COLORS.primary} />
          <Text style={styles.leaderboardText}>CLASSEMENT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats?.total_shots || 0}</Text>
                <Text style={styles.statLbl}>TIRS</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats?.avg_power || 0}N</Text>
                <Text style={styles.statLbl}>FORCE MOY.</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats?.total_sessions || 0}</Text>
                <Text style={styles.statLbl}>SESSIONS</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statVal}>{stats?.max_speed || 0}m/s</Text>
                <Text style={styles.statLbl}>VITESSE MAX</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>SESSIONS RÉCENTES</Text>
            {sessions && sessions.length > 0 ? (
              sessions.map((s, i) => (
                <View key={s.session_id || i} style={styles.sessionItem}>
                  <View>
                    <Text style={styles.sessionDate}>{new Date(s.created_at).toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.sessionMode}>{(s.mode || 'libre').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.sessionScore}>{s.score || 0} PTS</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="stats-chart-outline" size={40} color={COLORS.textSecondary || 'rgba(255,255,255,0.3)'} />
                <Text style={styles.emptyText}>Aucune session enregistrée</Text>
                <Text style={styles.emptySubText}>Lance une session pour voir tes stats !</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, marginBottom: 20 },
  title:           { fontSize: 22, fontWeight: '900', color: COLORS.white || '#fff', letterSpacing: 3 },
  leaderboardBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.card || '#1A1A1A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border || 'rgba(255,255,255,0.08)' },
  leaderboardText: { color: COLORS.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  scrollContent:   { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle:    { fontSize: 11, fontWeight: '900', color: COLORS.textSecondary || 'rgba(255,255,255,0.35)', letterSpacing: 2, marginBottom: 15 },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
  statCard:        { flex: 1, flexBasis: '45%', backgroundColor: COLORS.card || '#1A1A1A', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border || 'rgba(255,255,255,0.08)' },
  statVal:         { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  statLbl:         { fontSize: 10, color: COLORS.textSecondary || 'rgba(255,255,255,0.35)', fontWeight: '700', marginTop: 4 },
  sessionItem:     { backgroundColor: COLORS.card || '#1A1A1A', padding: 16, borderRadius: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border || 'rgba(255,255,255,0.08)' },
  sessionDate:     { color: COLORS.white || '#fff', fontWeight: '700', fontSize: 14 },
  sessionMode:     { color: COLORS.textSecondary || 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  sessionScore:    { color: COLORS.primary, fontWeight: '900', fontSize: 18 },
  emptyContainer:  { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText:       { color: COLORS.white || '#fff', fontSize: 15, fontWeight: '700' },
  emptySubText:    { color: COLORS.textSecondary || 'rgba(255,255,255,0.35)', fontSize: 13 },
});