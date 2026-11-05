/**
 * _layout.tsx — Tabs
 * Emplacement : app/(app)/(tabs)/_layout.tsx
 *
 * ⚠️  FIX "Training" dans la barre :
 *
 * OPTION A (recommandée) — Supprimer le dossier :
 *   Supprime le dossier app/(app)/(tabs)/training/ en entier.
 *   Place session.tsx directement dans app/(app)/session.tsx
 *   Puis relance : npx expo start --clear
 *
 * OPTION B — Si tu ne veux pas supprimer le dossier :
 *   Garde les lignes href: null ci-dessous, elles cachent l'onglet.
 *   Mais assure-toi de relancer avec --clear après modification.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/colors';
import { useUnreadCount } from '../../../src/messageEvents';

export default function TabLayout() {
  // Hauteur de la barre système Android (boutons ou gestes) / indicateur iOS
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  const unread = useUnreadCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + bottom,
          paddingBottom: bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
        },
      }}
    >
      {/* ── Onglets visibles ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'ACCUEIL',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="modes"
        options={{
          title: 'MODES',
          tabBarIcon: ({ color, size }) => <Ionicons name="game-controller-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'STATS',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'DÉFIS',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFIL',
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.primary, color: '#fff', fontSize: 10, fontWeight: '800' },
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />

    </Tabs>
  );
}