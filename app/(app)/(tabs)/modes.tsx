import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/colors';

type Category = 'all' | 'reaction' | 'force' | 'sequence' | 'cognitive' | 'time' | 'game';

const CATEGORIES: { id: Category; label: string; icon: any }[] = [
  { id: 'all',       label: 'Tous',      icon: 'apps' },
  { id: 'reaction',  label: 'Réaction',  icon: 'flash' },
  { id: 'force',     label: 'Force',     icon: 'fitness' },
  { id: 'sequence',  label: 'Séquence',  icon: 'git-branch' },
  { id: 'cognitive', label: 'Cognitif',  icon: 'eye' },
  { id: 'time',      label: 'Temps',     icon: 'timer' },
  { id: 'game',      label: 'Jeux',      icon: 'game-controller' },
];

const MODES = [
  { name: 'Mode Flash',        slug: 'flash',           category: 'reaction',  description: 'Une cible s\'allume — touche-la le plus vite possible.',           icon: 'flash',       color: '#FFB700', difficulty: 2, min_targets: 1 },
  { name: 'Multi-Target Rush', slug: 'multi-rush',      category: 'reaction',  description: 'Plusieurs cibles s\'allument simultanément. Touche-les toutes.',    icon: 'radio',       color: '#FF6D00', difficulty: 3, min_targets: 2 },
  { name: 'Défi Force',        slug: 'force-challenge', category: 'force',     description: 'Frappe exactement à la puissance demandée par l\'ESP32.',           icon: 'speedometer', color: '#E040FB', difficulty: 2, min_targets: 1 },
  { name: 'Max Power',         slug: 'max-power',       category: 'force',     description: 'Frappe le plus fort possible sur chaque cible.',                   icon: 'fitness',     color: '#FF1744', difficulty: 1, min_targets: 1 },
  { name: 'Mode Séquence',     slug: 'sequence',        category: 'sequence',  description: 'Les cibles s\'allument dans un ordre précis. Suis-le.',            icon: 'git-branch',  color: '#448AFF', difficulty: 3, min_targets: 2 },
  { name: 'Séquence Mémoire',  slug: 'memory-seq',      category: 'sequence',  description: 'Mémorise la séquence puis reproduis-la sans indices visuels.',     icon: 'bulb',        color: '#00BCD4', difficulty: 4, min_targets: 2 },
  { name: 'Fausses Cibles',    slug: 'fake-targets',    category: 'cognitive', description: 'Ignore les cibles rouges, touche seulement les vertes.',           icon: 'eye',         color: '#1ED760', difficulty: 4, min_targets: 2 },
  { name: 'Sprint 60s',        slug: 'sprint-60',       category: 'time',      description: 'Maximum de touches en 60 secondes. Vas-y à fond.',                 icon: 'timer',       color: '#FF6D00', difficulty: 2, min_targets: 2 },
  { name: 'Endurance',         slug: 'endurance',       category: 'time',      description: 'Session longue avec difficulté croissante. Tiens le plus longtemps.', icon: 'trending-up', color: '#4CAF50', difficulty: 3, min_targets: 2 },
  { name: 'Survie',            slug: 'survival',        category: 'game',      description: '3 vies — chaque cible expirée t\'en coûte une.',                  icon: 'heart',       color: '#E91E63', difficulty: 4, min_targets: 2 },
  { name: 'Combo King',        slug: 'combo-king',      category: 'game',      description: 'Enchaîne les impacts pour multiplier ton score jusqu\'à ×3.',      icon: 'flame',       color: '#FF9800', difficulty: 3, min_targets: 2 },
];

const hexToRgba = (hex: string, alpha: number) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch { return `rgba(0,200,100,${alpha})`; }
};

export default function ModesScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const filteredModes = activeCategory === 'all'
    ? MODES
    : MODES.filter(m => m.category === activeCategory);

  const handleModePress = (mode: typeof MODES[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // La session est dans app/(app)/session.tsx — Stack dans app/(app)/_layout.tsx
    router.push({
      pathname: '/(app)/session' as any,
      params: {
        slug:        mode.slug,
        name:        mode.name,
        color:       mode.color,
        icon:        mode.icon,
        description: mode.description,
        difficulty:  String(mode.difficulty),
        min_targets: String(mode.min_targets),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ENTRAÎNEMENT</Text>
        <Text style={styles.subtitle}>Choisis ton mode de jeu</Text>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveCategory(cat.id); }}
                activeOpacity={0.7}
              >
                <Ionicons name={cat.icon} size={16} color={isActive ? '#fff' : COLORS.textSecondary} />
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.modesScroll} showsVerticalScrollIndicator={false}>
        {filteredModes.map((mode) => (
          <TouchableOpacity
            key={mode.slug}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => handleModePress(mode)}
          >
            <View style={styles.cardMain}>
              <View style={[styles.iconContainer, { backgroundColor: hexToRgba(mode.color, 0.15), borderColor: hexToRgba(mode.color, 0.3) }]}>
                <Ionicons name={mode.icon as any} size={28} color={mode.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{mode.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{mode.description}</Text>
              </View>
              <View style={[styles.playBadge, { backgroundColor: hexToRgba(mode.color, 0.2), borderColor: hexToRgba(mode.color, 0.4) }]}>
                <Ionicons name="play" size={12} color={mode.color} />
                <Text style={[styles.playText, { color: mode.color }]}>JOUER</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.badge}>
                <View style={styles.diffDots}>
                  {[1,2,3,4,5].map(i => (
                    <View key={i} style={[styles.dot, { backgroundColor: i <= mode.difficulty ? mode.color : 'rgba(255,255,255,0.1)' }]} />
                  ))}
                </View>
                <Text style={styles.badgeText}>Niv. {mode.difficulty}</Text>
              </View>
              <View style={styles.badge}>
                <Ionicons name="hardware-chip-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.badgeText}>Min. {mode.min_targets} {mode.min_targets > 1 ? 'cibles' : 'cible'}</Text>
              </View>
            </View>
            <View style={[styles.bottomBar, { backgroundColor: hexToRgba(mode.color, 0.5) }]} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  header:           { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 15 },
  title:            { fontSize: 28, fontWeight: '900', color: COLORS.white, letterSpacing: 1.5 },
  subtitle:         { fontSize: 13, color: COLORS.primary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  filterWrapper:    { height: 50, marginBottom: 15 },
  filterScroll:     { paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  filterPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:       { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  filterTextActive: { color: '#fff' },
  modesScroll:      { paddingHorizontal: 20, gap: 14 },
  card:             { backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardMain:         { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  iconContainer:    { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  cardText:         { flex: 1 },
  cardTitle:        { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 4 },
  cardDesc:         { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 },
  playBadge:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  playText:         { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardFooter:       { flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.2)', borderTopWidth: 1, borderTopColor: COLORS.border },
  badge:            { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText:        { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  diffDots:         { flexDirection: 'row', gap: 3 },
  dot:              { width: 6, height: 6, borderRadius: 3 },
  bottomBar:        { height: 2 },
});