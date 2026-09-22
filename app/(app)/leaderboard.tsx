import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  ActivityIndicator, Image, LayoutAnimation, Platform, UIManager 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../src/api';
import { COLORS } from '../../src/colors';
import { useRouter } from 'expo-router';

// Activer les animations sur Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'global' ? '/leaderboard' : '/friends/leaderboard';
      const response = await api.get(endpoint);
      const data = Array.isArray(response.data) ? response.data : [];
      const rankedData = data.map((item: any, index: number) => ({
        ...item,
        rank: index + 1
      }));
      setLeaderboard(rankedData);
    } catch (e: any) {
      console.error("Erreur Leaderboard:", e.response?.status, e.message);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return 'rgba(255,255,255,0.1)';
  };

  // ✅ CORRIGÉ : Navigation vers le profil public
  const goToProfile = (userId: string | number) => {
    router.push({ 
      pathname: '/(app)/user/[id]', 
      params: { id: String(userId) } 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.title}>CLASSEMENT</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'global' && styles.activeTab]}
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.activeTabText]}>GLOBAL</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>AMIS</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>Aucun joueur trouvé</Text>
          ) : (
            leaderboard.map((item) => (
              <View key={item.id} style={styles.cardWrapper}>
                <TouchableOpacity 
                  style={[styles.userCard, expandedId === item.id && styles.expandedCard]} 
                  onPress={() => toggleExpand(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.rankBadge, { backgroundColor: getRankColor(item.rank) }]}>
                    <Text style={styles.rankText}>{item.rank}</Text>
                  </View>

                  <TouchableOpacity 
                    style={styles.avatarContainer}
                    onPress={() => goToProfile(item.id)}
                    activeOpacity={0.8}
                  >
                    {item.avatar_url ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={20} color={COLORS.textSecondary} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.subtext}>{item.club || 'Sans club'} • {item.position || 'N/A'}</Text>
                  </View>

                  <View style={styles.scoreContainer}>
                    <Text style={styles.score}>{item.score}</Text>
                    <Text style={styles.scoreLabel}>PTS</Text>
                  </View>
                </TouchableOpacity>

                {expandedId === item.id && (
                  <View style={styles.detailsContainer}>
                    <View style={styles.divider} />
                    <View style={styles.statsGrid}>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatVal}>{item.avg_power || 0}N</Text>
                        <Text style={styles.miniStatLbl}>FORCE</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatVal}>{item.total_shots || 0}</Text>
                        <Text style={styles.miniStatLbl}>TIRS</Text>
                      </View>
                      <View style={styles.miniStat}>
                        <Text style={styles.miniStatVal}>{item.avg_speed || 0} km/h</Text>
                        <Text style={styles.miniStatLbl}>VITESSE</Text>
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={styles.profileBtn}
                      onPress={() => goToProfile(item.id)}
                    >
                      <Text style={styles.profileBtnText}>VOIR LE PROFIL</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border
  },
  backBtn: { padding: 5 },
  title: { color: COLORS.white, fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  
  tabContainer: { flexDirection: 'row', padding: 15, gap: 10 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  activeTab: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '800', fontSize: 12 },
  activeTabText: { color: COLORS.white },

  loadingCenter: { flex: 1, justifyContent: 'center' },
  scrollContent: { padding: 15, paddingBottom: 40 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },

  cardWrapper: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  expandedCard: { borderBottomWidth: 0 },
  
  rankBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  
  avatarContainer: { marginRight: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  
  info: { flex: 1 },
  name: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  subtext: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  
  scoreContainer: { alignItems: 'flex-end' },
  score: { color: COLORS.primary, fontWeight: '900', fontSize: 20 },
  scoreLabel: { color: COLORS.primary, fontSize: 9, fontWeight: '800', marginTop: -4 },

  detailsContainer: { padding: 15, paddingTop: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  miniStat: { alignItems: 'center', flex: 1 },
  miniStatVal: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  miniStatLbl: { color: COLORS.textSecondary, fontSize: 9, fontWeight: '700', marginTop: 4 },
  
  profileBtn: { marginTop: 15, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 8, borderRadius: 8 },
  profileBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 }
});