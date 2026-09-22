import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Keyboard, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import api, { getFullError } from '../../src/api';
import { COLORS } from '../../src/colors';
import { useAuth } from '../../src/authContext';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('player');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- VRAIE CONFIGURATION GOOGLE ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'TON_CLIENT_ID_ANDROID.apps.googleusercontent.com',
    iosClientId: 'TON_CLIENT_ID_IOS.apps.googleusercontent.com',
    webClientId: 'TON_CLIENT_ID_WEB.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) handleSocialLogin('/auth/google', authentication.idToken);
    }
  }, [response]);

  const handleSocialLogin = async (endpoint: string, token: string) => {
    setLoading(true);
    try {
      const { data } = await api.post(endpoint, { token });
      if (data.token) await login(data.token, data.user);
    } catch (e: any) {
      setError(getFullError(e));
      Alert.alert("Erreur", "Impossible de lier ce compte social.");
    } finally {
      setLoading(false);
    }
  };

  // --- VRAIE CONFIGURATION APPLE ---
  const handleAppleAuth = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (credential.identityToken) handleSocialLogin('/auth/apple', credential.identityToken);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert("Erreur", "Connexion Apple échouée.");
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Champs requis'); return; }
    
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/register';
      const payload = isLogin ? { email: email.trim(), password } : { email: email.trim(), password, name: name.trim(), role };
      
      const { data } = await api.post(endpoint, payload);
      if (data.token) {
        await login(data.token, data);
      } else {
        setIsLogin(true);
        Alert.alert("Succès", "Compte créé ! Connecte-toi maintenant.");
      }
    } catch (e: any) {
      setError(getFullError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Ionicons name="football" size={60} color={COLORS.primary} />
            <Text style={styles.logoText}>FOOT'UP</Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tab, isLogin && styles.tabActive]} onPress={() => setIsLogin(true)}>
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>CONNEXION</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, !isLogin && styles.tabActive]} onPress={() => setIsLogin(false)}>
              <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>INSCRIPTION</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formContainer}>
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor="#666" value={name} onChangeText={setName} />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{isLogin ? 'SE CONNECTER' : "S'INSCRIRE"}</Text>}
            </TouchableOpacity>

            <View style={styles.divider}><View style={styles.line}/><Text style={styles.dividerText}>OU</Text><View style={styles.line}/></View>

            <TouchableOpacity style={styles.socialBtn} onPress={() => promptAsync()} disabled={!request || loading}>
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.socialBtnText}>Continuer avec Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity style={[styles.socialBtn, {backgroundColor: '#333'}]} onPress={handleAppleAuth} disabled={loading}>
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={styles.socialBtnText}>Continuer avec Apple</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 25, justifyContent: 'center', flexGrow: 1 },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { color: COLORS.primary, fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 15, padding: 5, marginBottom: 25 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  formContainer: { gap: 15 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 15, paddingHorizontal: 15, height: 55, borderWidth: 1, borderColor: COLORS.border },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff' },
  submitButton: { backgroundColor: COLORS.primary, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  errorText: { color: COLORS.error, textAlign: 'center', fontSize: 13 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, marginHorizontal: 10, fontSize: 12 },
  socialBtn: { flexDirection: 'row', backgroundColor: '#1A1A2E', height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.border },
  socialBtnText: { color: '#fff', fontWeight: '600' }
});