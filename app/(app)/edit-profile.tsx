import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/api';
import { COLORS } from '../../src/colors';

const POSITIONS = ['Attaquant', 'Milieu', 'Défenseur', 'Gardien'];

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [pendingLocalUri, setPendingLocalUri] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [formData, setFormData] = useState({
    name: '', age: '', club: '', position: '', region: '', phone: '', bio: '',
  });

  useEffect(() => { loadUserData(); }, []);

  const loadUserData = async () => {
    try {
      const { data } = await api.get('/profile');
      setCurrentAvatarUrl(data.avatar_url || null);
      setFormData({
        name: data.name || '', age: data.age ? String(data.age) : '',
        club: data.club || '', position: data.position || '',
        region: data.region || '', phone: data.phone || '', bio: data.bio || '',
      });
    } catch {
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  const previewUri = pendingDelete ? null : (pendingLocalUri ?? currentAvatarUrl);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        mediaTypes: ['images'] as any,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingLocalUri(result.assets[0].uri);
        setPendingDelete(false);
      }
    } catch (e: any) {
      // Permission refusée par l'OS
      Alert.alert(
        'Accès à la galerie refusé',
        "Va dans Réglages → FootUp → Photos et autorise l'accès.",
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir Réglages', onPress: () => Linking.openSettings() }
        ]
      );
    }
  };

  const stageDelete = () => {
    Alert.alert('Supprimer la photo', 'La photo sera supprimée seulement quand tu appuies sur "Sauvegarder".', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Marquer pour suppression', style: 'destructive', onPress: () => { setPendingDelete(true); setPendingLocalUri(null); } }
    ]);
  };

  const handleAvatarPress = () => {
    if (previewUri) {
      Alert.alert('Photo de profil', 'Que veux-tu faire ?', [
        { text: 'Changer la photo', onPress: pickImage },
        { text: 'Supprimer la photo', style: 'destructive', onPress: stageDelete },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } else { pickImage(); }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { Alert.alert('Champ requis', 'Le nom est obligatoire'); return; }
    setSaving(true);
    try {
      // 1. Sauvegarde des textes
      await api.put('/profile', {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
      });

      // 2. Upload de la nouvelle photo si choisie
      if (pendingLocalUri) {
        const uriParts = pendingLocalUri.split('.');
        const fileType = uriParts[uriParts.length - 1].toLowerCase();
        const uploadData = new FormData();
        // @ts-ignore
        uploadData.append('file', {
          uri: pendingLocalUri,
          name: `avatar.${fileType}`,
          type: `image/${fileType}`,
        });
        await api.post('/profile/avatar', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      // 3. Suppression si demandée
      else if (pendingDelete) {
        await api.delete('/profile/avatar').catch(() => {});
      }

      Alert.alert('Succès', 'Profil mis à jour !');
      router.back();
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof typeof formData, val: string) => setFormData(prev => ({ ...prev, [key]: val }));

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.topBarBtn}>
          <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>MODIFIER LE PROFIL</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={s.topBarBtn}>
          {saving ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={s.saveBtnText}>Sauvegarder</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={s.avatarWrap} activeOpacity={0.8}>
              {previewUri
                ? <Image source={{ uri: previewUri }} style={s.avatarImg} />
                : <View style={s.avatarPlaceholder}><Ionicons name="person" size={44} color="rgba(255,255,255,0.15)" /></View>}
              <View style={s.camOverlay}><Ionicons name="camera" size={16} color="#fff" /></View>
            </TouchableOpacity>

            <Text style={s.avatarHint}>
              {previewUri ? 'Appuie pour changer la photo' : 'Appuie pour ajouter une photo'}
            </Text>

            {(pendingLocalUri || currentAvatarUrl) && !pendingDelete && (
              <TouchableOpacity onPress={() => { setPendingLocalUri(null); setCurrentAvatarUrl(null); setPendingDelete(true); }}>
                <Text style={s.deleteText}>Supprimer la photo</Text>
              </TouchableOpacity>
            )}
            {pendingDelete && (
              <TouchableOpacity onPress={() => setPendingDelete(false)}>
                <Text style={s.cancelText}>↩ Annuler la suppression</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.form}>
            <Sec title="IDENTITÉ">
              <F label="Nom complet" value={formData.name} onChange={v => update('name', v)} placeholder="Ex : Karim Benzema" />
              <F label="Âge" value={formData.age} onChange={v => update('age', v)} placeholder="Ex : 24" keyboard="numeric" />
              <F label="Téléphone" value={formData.phone} onChange={v => update('phone', v)} placeholder="Ex : +33 6 12 34 56 78" keyboard="phone-pad" last />
            </Sec>
            <Sec title="FOOTBALL">
              <F label="Club" value={formData.club} onChange={v => update('club', v)} placeholder="Ex : Olympique de Lyon" />
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>POSTE</Text>
                <View style={s.positionRow}>
                  {POSITIONS.map(pos => (
                    <TouchableOpacity key={pos} onPress={() => update('position', pos)} style={[s.posBadge, formData.position === pos && s.posBadgeActive]}>
                      <Text style={[s.posBadgeText, formData.position === pos && s.posBadgeTextActive]}>{pos}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <F label="Région" value={formData.region} onChange={v => update('region', v)} placeholder="Ex : Île-de-France" last />
            </Sec>
            <Sec title="BIO">
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>À PROPOS DE TOI</Text>
                <TextInput style={[s.input, s.bioInput]} value={formData.bio} onChangeText={v => update('bio', v)}
                  placeholder="Présente-toi en quelques mots..." placeholderTextColor="rgba(255,255,255,0.2)"
                  multiline numberOfLines={4} maxLength={200} />
                <Text style={s.charCount}>{formData.bio.length}/200</Text>
              </View>
            </Sec>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function F({ label, value, onChange, placeholder, keyboard, last }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: any; last?: boolean;
}) {
  return (
    <View style={[s.fieldWrap, !last && s.fieldBorder]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.2)" keyboardType={keyboard || 'default'} autoCorrect={false} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  topBarBtn: { minWidth: 60, height: 36, justifyContent: 'center' },
  topBarTitle: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  saveBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15, textAlign: 'right' },
  scroll: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, borderColor: COLORS.primary },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  camOverlay: { position: 'absolute', bottom: 4, right: 4, backgroundColor: COLORS.primary, borderRadius: 14, padding: 7, borderWidth: 2, borderColor: COLORS.background },
  avatarHint: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.primary + '40', backgroundColor: COLORS.primary + '10' },
  pendingDeleteBadge: { borderColor: '#FF444440', backgroundColor: '#FF444410' },
  pendingText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  deleteText: { color: '#FF4444', fontSize: 12, marginTop: 4, fontWeight: '600' },
  cancelText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, textDecorationLine: 'underline' },
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionTitle: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  sectionCard: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  fieldWrap: { paddingHorizontal: 16, paddingVertical: 14 },
  fieldBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  fieldLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input: { color: '#fff', fontSize: 15, paddingVertical: 2 },
  bioInput: { height: 90, textAlignVertical: 'top', lineHeight: 22 },
  charCount: { color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'right', marginTop: 6 },
  positionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  posBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  posBadgeActive: { backgroundColor: COLORS.primary + '25', borderColor: COLORS.primary },
  posBadgeText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  posBadgeTextActive: { color: COLORS.primary },
});