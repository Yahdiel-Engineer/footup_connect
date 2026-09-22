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
import { COLORS } from '../../../src/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />

      {/* ── Masqués de la barre (href: null = pas d'onglet) ── */}
      <Tabs.Screen name="training" options={{ href: null }} />
      <Tabs.Screen name="session"  options={{ href: null }} />
    </Tabs>
  );
}