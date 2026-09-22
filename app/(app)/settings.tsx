import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/authContext';
import api from '../../src/api';
import { COLORS } from '../../src/colors';

type RowProps = {
  icon: string;
  iconColor?: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  value?: React.ReactNode;
  danger?: boolean;
  last?: boolean;
};

function Row({ icon, iconColor, label, subtitle, onPress, value, danger, last }: RowProps) {
  return (
    <TouchableOpacity
      style={[s.row, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      disabled={!onPress && !value}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[s.rowIcon, { backgroundColor: (iconColor || COLORS.primary) + '18' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor || COLORS.primary} />
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, danger && { color: '#FF4444' }]}>{label}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      {value !== undefined
        ? <View>{value}</View>
        : onPress
          ? <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
          : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données, statistiques et progression seront définitivement supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/users/me');
              logout();
            } catch {
              Alert.alert('Erreur', "Impossible de supprimer le compte pour le moment.");
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Es-tu sûr de vouloir te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  const handleChangePassword = () => {
    Alert.alert('Modifier le mot de passe', 'Un e-mail de réinitialisation va être envoyé à ton adresse.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Envoyer', onPress: async () => {
          try {
            await api.post('/auth/request-password-reset');
            Alert.alert('E-mail envoyé', 'Vérifie ta boîte mail.');
          } catch {
            Alert.alert('Erreur', 'Action impossible pour le moment.');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>PARAMÈTRES</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── COMPTE ── */}
        <Text style={s.sectionTitle}>COMPTE & SÉCURITÉ</Text>
        <View style={s.card}>
          <Row
            icon="lock-closed-outline"
            label="Modifier le mot de passe"
            subtitle="Réinitialisation par e-mail"
            onPress={handleChangePassword}
          />
          <Row
            icon="logo-google"
            iconColor="#EA4335"
            label="Lier Google"
            subtitle="Connexion rapide avec Google"
            onPress={() => Alert.alert('Bientôt disponible', 'La liaison Google arrive prochainement.')}
          />
          <Row
            icon="logo-apple"
            iconColor="#fff"
            label="Lier Apple"
            subtitle="Connexion rapide avec Apple"
            onPress={() => Alert.alert('Bientôt disponible', 'La liaison Apple arrive prochainement.')}
            last
          />
        </View>

        {/* ── CONFIDENTIALITÉ ── */}
        <Text style={s.sectionTitle}>CONFIDENTIALITÉ</Text>
        <View style={s.card}>
          <Row
            icon="earth-outline"
            label="Profil public"
            subtitle="Visible dans le classement"
            value={
              <Switch
                value={publicProfile}
                onValueChange={setPublicProfile}
                trackColor={{ false: '#333', true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
            last
          />
        </View>

        {/* ── NOTIFICATIONS ── */}
        <Text style={s.sectionTitle}>NOTIFICATIONS & SON</Text>
        <View style={s.card}>
          <Row
            icon="notifications-outline"
            label="Notifications push"
            subtitle="Alertes défis et amis"
            value={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#333', true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="volume-high-outline"
            label="Effets sonores"
            subtitle="Sons pendant les sessions"
            value={
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ false: '#333', true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="phone-portrait-outline"
            iconColor="#A78BFA"
            label="Retour haptique"
            subtitle="Vibrations lors des impacts"
            value={
              <Switch
                value={haptics}
                onValueChange={setHaptics}
                trackColor={{ false: '#333', true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
            last
          />
        </View>

        {/* ── SUPPORT ── */}
        <Text style={s.sectionTitle}>SUPPORT & LÉGAL</Text>
        <View style={s.card}>
          <Row
            icon="help-circle-outline"
            iconColor="#60A5FA"
            label="Centre d'aide"
            onPress={() => Alert.alert('Centre d\'aide', 'Documentation en cours de rédaction.')}
          />
          <Row
            icon="chatbubble-ellipses-outline"
            iconColor="#34D399"
            label="Nous contacter"
            onPress={() => Linking.openURL('mailto:support@monapp.com')}
          />
          <Row
            icon="document-text-outline"
            iconColor="rgba(255,255,255,0.4)"
            label="Conditions d'utilisation"
            onPress={() => Alert.alert('CGU', 'Redirection vers les CGU...')}
          />
          <Row
            icon="shield-checkmark-outline"
            iconColor="rgba(255,255,255,0.4)"
            label="Politique de confidentialité"
            onPress={() => Alert.alert('Confidentialité', 'Redirection...')}
            last
          />
        </View>

        {/* ── ZONE DANGER ── */}
        <Text style={s.sectionTitle}>ZONE DANGER</Text>
        <View style={s.card}>
          <Row
            icon="log-out-outline"
            iconColor="#F59E0B"
            label="Déconnexion"
            onPress={handleLogout}
          />
          <Row
            icon="trash-outline"
            iconColor="#FF4444"
            label="Supprimer mon compte"
            subtitle="Action irréversible ! toutes vos données seront perdues"
            danger
            onPress={handleDeleteAccount}
            last
          />
        </View>

        {/* ── VERSION ── */}
        <Text style={s.versionText}>Version 1.0.0 · Build 42</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  scroll: { padding: 20, paddingBottom: 60 },

  sectionTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10, marginTop: 24, marginLeft: 4 },
  card: { backgroundColor: '#111', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },

  versionText: { color: 'rgba(255,255,255,0.15)', fontSize: 12, textAlign: 'center', marginTop: 32 },
});