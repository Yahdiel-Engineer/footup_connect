import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Animated, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  BLETarget, scanForTargets, connectToTarget, disconnectTarget,
  isBLEAvailable, requestBLEPermissions, configureLED
} from '../../../src/bleService';
import { COLORS } from '../../../src/colors';

const LED_COLORS = ['#FF1744', '#00E676', '#448AFF', '#FFD600', '#E040FB', '#FFFFFF'];
const LED_MODES  = ['static', 'blink', 'pulse', 'off'];

function signalBars(signal: string) {
  const levels = signal === 'Fort' ? 4 : signal === 'Moyen' ? 2 : 1;
  return Array.from({ length: 4 }, (_, i) => i < levels);
}

function signalColor(signal: string) {
  if (signal === 'Fort')   return '#1ED760';
  if (signal === 'Moyen')  return '#FFB700';
  return 'rgba(255,255,255,0.3)';
}

export default function HomeScreen() {
  const router = useRouter();
  const [targets,       setTargets]       = useState<BLETarget[]>([]);
  const [scanning,      setScanning]      = useState(false);
  const [user,          setUser]          = useState<any>(null);
  const [showLed,       setShowLed]       = useState<string | null>(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [connectingId,  setConnectingId]  = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;
  const bleAvailable = isBLEAvailable();

  useEffect(() => { loadUser(); checkPermissions(); }, []);

  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      ringAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [scanning]);

  const loadUser = async () => {
    try {
      const s = await AsyncStorage.getItem('user');
      if (s) setUser(JSON.parse(s));
    } catch {}
  };

  const checkPermissions = async () => {
    const granted = await requestBLEPermissions();
    if (granted) handleScan();
  };

  const handleScan = useCallback(() => {
    setScanning(true);
    setTargets([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    scanForTargets(
      (target) => {
        setTargets(prev => prev.find(t => t.id === target.id) ? prev : [...prev, target]);
        Haptics.selectionAsync();
      },
      () => {
        setScanning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      6000
    );
  }, []);

  const handleConnect = async (targetId: string) => {
    const target = targets.find(t => t.id === targetId);
    if (!target) return;

    if (target.connected) {
      await disconnectTarget(targetId, (id, state) => {
        setTargets(prev => prev.map(t => t.id === id ? { ...t, state, connected: false } : t));
      });
      return;
    }

    setConnectingId(targetId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const success = await connectToTarget(
      targetId, undefined,
      (id, data) => setTargets(prev => prev.map(t => t.id === id ? { ...t, lastData: { ...data, timestamp: Date.now() } } : t)),
      (id, state) => setTargets(prev => prev.map(t => t.id === id ? { ...t, state, connected: state === 'connected' } : t))
    );

    if (success) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setConnectingId(null);
  };

  const handleLED = async (targetId: string, color: string, mode: string, brightness: number) => {
    await configureLED(targetId, color, mode, brightness);
    setTargets(prev => prev.map(t => t.id === targetId ? { ...t, ledColor: color, ledMode: mode, ledBrightness: brightness } : t));
  };

  const handleLaunchSession = () => {
    if (connectedCount === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    router.push('/(app)/(tabs)/modes');
  };

  const onRefresh = () => {
    setRefreshing(true);
    handleScan();
    setTimeout(() => setRefreshing(false), 6000);
  };

  const connectedTargets  = targets.filter(t => t.connected);
  const availableTargets  = targets.filter(t => !t.connected);
  const connectedCount    = connectedTargets.length;

  // Step indicator state
  const step = scanning ? 1 : connectedCount > 0 ? 3 : targets.length > 0 ? 2 : 1;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── Header ─── */}
        <View style={s.header}>
          <View>
            <View style={s.logoRow}>
              <View style={s.logoIcon}>
                <Ionicons name="football-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={s.logoText}>FOOT'UP</Text>
              <Text style={s.logoSub}>CONNECT</Text>
            </View>
            <Text style={s.greeting}>Bonjour {user?.name || 'Joueur'}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={[s.bleBadge, { backgroundColor: bleAvailable ? 'rgba(30,215,96,0.08)' : 'rgba(255,183,0,0.08)', borderColor: bleAvailable ? 'rgba(30,215,96,0.2)' : 'rgba(255,183,0,0.2)' }]}>
              <View style={[s.bleDot, { backgroundColor: bleAvailable ? '#1ED760' : '#FFB700' }]} />
              <Text style={[s.bleText, { color: bleAvailable ? '#1ED760' : '#FFB700' }]}>BLE</Text>
            </View>
            <View style={s.connBadge}>
              <Text style={[s.connNum, connectedCount > 0 && { color: '#1ED760' }]}>{connectedCount}</Text>
              <Text style={s.connLbl}>CIBLES</Text>
            </View>
          </View>
        </View>

        {/* ─── Step Indicator ─── */}
        <View style={s.stepsRow}>
          {[
            { n: 1, label: 'Scanner' },
            { n: 2, label: 'Connecter' },
            { n: 3, label: 'Entraîner' },
          ].map((st, i) => {
            const done   = step > st.n;
            const active = step === st.n;
            return (
              <React.Fragment key={st.n}>
                <View style={s.stepItem}>
                  <View style={[
                    s.stepCircle,
                    done   && s.stepCircleDone,
                    active && s.stepCircleActive,
                  ]}>
                    {done
                      ? <Ionicons name="checkmark" size={11} color="#1ED760" />
                      : <Text style={[s.stepNum, active && { color: '#fff' }, done && { color: '#1ED760' }]}>{st.n}</Text>
                    }
                  </View>
                  <Text style={[s.stepLabel, done && { color: '#1ED760' }, active && { color: '#fff' }]}>{st.label}</Text>
                </View>
                {i < 2 && <View style={s.stepLine} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* ─── Hero Scan Section ─── */}
        <View style={s.heroCard}>
          <Animated.View style={[s.outerRing, { opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }) }]}>
            <Animated.View style={[s.innerRing, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.coreCircle}>
                <Ionicons name={scanning ? 'radio-outline' : 'bluetooth'} size={24} color={COLORS.primary} />
              </View>
            </Animated.View>
          </Animated.View>

          <Text style={s.heroTitle}>
            {scanning ? 'Recherche en cours…' : connectedCount > 0 ? 'Prêt à s\'entraîner' : 'Trouver vos cibles'}
          </Text>
          <Text style={s.heroSub}>
            {scanning
              ? 'Détection des cibles ESP32 à proximité…'
              : connectedCount > 0
                ? `${connectedCount} cible${connectedCount > 1 ? 's' : ''} connectée${connectedCount > 1 ? 's' : ''} et opérationnelle${connectedCount > 1 ? 's' : ''}`
                : 'Assurez-vous que vos cibles ESP32 sont allumées et proches.'
            }
          </Text>

          {!scanning && (
            <TouchableOpacity style={s.scanBtn} onPress={handleScan} activeOpacity={0.8}>
              <Ionicons name="search-outline" size={16} color="#fff" />
              <Text style={s.scanBtnText}>{targets.length > 0 ? 'Scanner à nouveau' : 'Scanner les cibles'}</Text>
            </TouchableOpacity>
          )}
          {scanning && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 4 }} />}
        </View>

        {/* ─── Status Bar ─── */}
        <View style={[
          s.statusBar,
          connectedCount > 0 && { backgroundColor: 'rgba(30,215,96,0.06)', borderColor: 'rgba(30,215,96,0.2)' },
          scanning && { backgroundColor: 'rgba(255,183,0,0.06)', borderColor: 'rgba(255,183,0,0.2)' },
        ]}>
          <View style={s.statusLeft}>
            <View style={[
              s.statusDot,
              { backgroundColor: scanning ? '#FFB700' : connectedCount > 0 ? '#1ED760' : COLORS.primary },
            ]} />
            <Text style={[
              s.statusMsg,
              { color: scanning ? '#FFB700' : connectedCount > 0 ? '#1ED760' : 'rgba(255,255,255,0.6)' },
            ]}>
              {scanning
                ? 'Scan en cours…'
                : connectedCount > 0
                  ? `${connectedCount} cible${connectedCount > 1 ? 's' : ''} prête${connectedCount > 1 ? 's' : ''}`
                  : targets.length > 0
                    ? `${targets.length} cible${targets.length > 1 ? 's' : ''} détectée${targets.length > 1 ? 's' : ''} — Connectez-les`
                    : 'Aucune cible connectée'
              }
            </Text>
          </View>
          {!scanning && (
            <Text style={s.statusHint}>
              {connectedCount > 0 ? 'Appuyez sur Démarrer' : 'Scannez pour découvrir'}
            </Text>
          )}
        </View>

        {/* ─── Connected Targets ─── */}
        {connectedTargets.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Cibles connectées</Text>
            {connectedTargets.map(target => (
              <View key={target.id} style={[s.targetCard, s.targetCardConnected]}>
                <View style={s.targetTop}>
                  <View style={s.targetLeft}>
                    <View style={[s.statusIndicator, { backgroundColor: '#1ED760' }]} />
                    <View>
                      <Text style={s.targetName}>{target.name}</Text>
                      <View style={s.targetMetaRow}>
                        {/* Signal bars */}
                        <View style={s.signalBars}>
                          {signalBars(target.signal).map((active, i) => (
                            <View key={i} style={[s.bar, { height: 4 + i * 3, backgroundColor: active ? signalColor(target.signal) : 'rgba(255,255,255,0.12)' }]} />
                          ))}
                        </View>
                        <Text style={s.targetMeta}>{target.signal} · {target.rssi} dBm</Text>
                        {target.pairingVerified && (
                          <View style={s.verifiedBadge}>
                            <Ionicons name="shield-checkmark" size={9} color="#1ED760" />
                            <Text style={s.verifiedText}>Vérifié</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={s.targetActions}>
                    <TouchableOpacity
                      style={s.ledIconBtn}
                      onPress={() => { setShowLed(showLed === target.id ? null : target.id); Haptics.selectionAsync(); }}
                    >
                      <View style={[s.ledDot, { backgroundColor: target.ledColor }]} />
                      <Ionicons name="bulb-outline" size={14} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.connectedBtn} onPress={() => handleConnect(target.id)} activeOpacity={0.8}>
                      <Text style={s.connectedBtnText}>Connecté</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* LED Panel */}
                {showLed === target.id && (
                  <View style={s.ledPanel}>
                    <View style={s.ledPanelHeader}>
                      <Text style={s.ledPanelTitle}>Config LED</Text>
                      <TouchableOpacity onPress={() => setShowLed(null)}>
                        <Text style={s.ledPanelClose}>Fermer ↑</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.ledColors}>
                      {LED_COLORS.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[s.ledColorDot, { backgroundColor: c }, target.ledColor === c && s.ledColorDotActive]}
                          onPress={() => { handleLED(target.id, c, target.ledMode, target.ledBrightness); Haptics.selectionAsync(); }}
                        />
                      ))}
                    </View>
                    <View style={s.ledModes}>
                      {LED_MODES.map(m => (
                        <TouchableOpacity
                          key={m}
                          style={[s.ledModeBtn, target.ledMode === m && s.ledModeBtnActive]}
                          onPress={() => { handleLED(target.id, target.ledColor, m, target.ledBrightness); Haptics.selectionAsync(); }}
                        >
                          <Text style={[s.ledModeText, target.ledMode === m && s.ledModeTextActive]}>
                            {m === 'static' ? 'Fixe' : m === 'blink' ? 'Cligno.' : m === 'pulse' ? 'Pulse' : 'Off'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* ─── Available Targets ─── */}
        {availableTargets.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{connectedCount > 0 ? 'Disponibles' : 'Cibles détectées'}</Text>
            {availableTargets.map(target => (
              <View key={target.id} style={s.targetCard}>
                <View style={s.targetTop}>
                  <View style={s.targetLeft}>
                    <View style={[s.statusIndicator, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                    <View>
                      <Text style={s.targetName}>{target.name}</Text>
                      <View style={s.targetMetaRow}>
                        <View style={s.signalBars}>
                          {signalBars(target.signal).map((active, i) => (
                            <View key={i} style={[s.bar, { height: 4 + i * 3, backgroundColor: active ? signalColor(target.signal) : 'rgba(255,255,255,0.12)' }]} />
                          ))}
                        </View>
                        <Text style={s.targetMeta}>{target.signal} · {target.rssi} dBm</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.connectBtn, connectingId === target.id && { opacity: 0.6 }]}
                    onPress={() => handleConnect(target.id)}
                    disabled={connectingId === target.id}
                    activeOpacity={0.8}
                  >
                    {connectingId === target.id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.connectBtnText}>Connecter</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

      </ScrollView>

      {/* ─── Sticky Bottom CTA ─── */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.launchBtn, connectedCount === 0 && s.launchBtnDisabled]}
          onPress={handleLaunchSession}
          disabled={connectedCount === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={18} color={connectedCount > 0 ? '#fff' : 'rgba(255,255,255,0.25)'} />
          <Text style={[s.launchBtnText, connectedCount === 0 && { color: 'rgba(255,255,255,0.25)' }]}>
            {connectedCount === 0
              ? 'Connectez une cible pour démarrer'
              : `Démarrer l'entraînement — ${connectedCount} cible${connectedCount > 1 ? 's' : ''}`
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.scanSecondaryBtn, scanning && { opacity: 0.5 }]}
          onPress={handleScan}
          disabled={scanning}
          activeOpacity={0.8}
        >
          <Ionicons name={scanning ? 'radio-outline' : 'search-outline'} size={16} color={COLORS.primary} />
          <Text style={s.scanSecondaryText}>{scanning ? 'Scan en cours…' : 'Scanner à nouveau'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: COLORS.background },
  scroll:             { paddingHorizontal: 16, paddingBottom: 160 },

  header:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginBottom: 14 },
  logoRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon:           { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,23,68,0.12)', borderWidth: 1, borderColor: 'rgba(255,23,68,0.25)', alignItems: 'center', justifyContent: 'center' },
  logoText:           { fontSize: 18, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
  logoSub:            { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 3, alignSelf: 'flex-end', marginBottom: 2 },
  greeting:           { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bleBadge:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5 },
  bleDot:             { width: 6, height: 6, borderRadius: 3 },
  bleText:            { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  connBadge:          { alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  connNum:            { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  connLbl:            { fontSize: 7, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5 },

  stepsRow:           { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  stepItem:           { alignItems: 'center', gap: 4 },
  stepCircle:         { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive:   { backgroundColor: COLORS.primary },
  stepCircleDone:     { backgroundColor: 'rgba(30,215,96,0.15)', borderWidth: 1, borderColor: 'rgba(30,215,96,0.3)' },
  stepNum:            { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },
  stepLabel:          { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 0.3 },
  stepLine:           { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 6, marginBottom: 14 },

  heroCard:           { backgroundColor: '#1A1A1A', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', padding: 24, alignItems: 'center', marginBottom: 12 },
  outerRing:          { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,23,68,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,23,68,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  innerRing:          { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,23,68,0.07)', borderWidth: 1.5, borderColor: 'rgba(255,23,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  coreCircle:         { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,23,68,0.12)', borderWidth: 1.5, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  heroTitle:          { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  heroSub:            { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  scanBtn:            { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  scanBtnText:        { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  statusBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  statusLeft:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:          { width: 8, height: 8, borderRadius: 4 },
  statusMsg:          { fontSize: 13, fontWeight: '600' },
  statusHint:         { fontSize: 11, color: 'rgba(255,255,255,0.25)' },

  sectionTitle:       { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, marginBottom: 10, paddingHorizontal: 2 },

  targetCard:         { backgroundColor: '#1A1A1A', borderRadius: 18, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 10, overflow: 'hidden' },
  targetCardConnected: { borderColor: 'rgba(30,215,96,0.2)' },
  targetTop:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  targetLeft:         { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusIndicator:    { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  targetName:         { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  targetMetaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  signalBars:         { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 13 },
  bar:                { width: 3, borderRadius: 1.5 },
  targetMeta:         { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  verifiedBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(30,215,96,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'rgba(30,215,96,0.25)' },
  verifiedText:       { fontSize: 9, fontWeight: '700', color: '#1ED760', letterSpacing: 0.5 },
  targetActions:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledIconBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  ledDot:             { width: 8, height: 8, borderRadius: 4 },
  connectedBtn:       { backgroundColor: 'rgba(30,215,96,0.1)', borderWidth: 0.5, borderColor: 'rgba(30,215,96,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  connectedBtnText:   { fontSize: 12, fontWeight: '700', color: '#1ED760' },
  connectBtn:         { backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  connectBtnText:     { fontSize: 12, fontWeight: '700', color: '#fff' },

  ledPanel:           { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', padding: 14 },
  ledPanelHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ledPanelTitle:      { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase' },
  ledPanelClose:      { fontSize: 11, color: 'rgba(255,23,68,0.6)' },
  ledColors:          { flexDirection: 'row', gap: 10, marginBottom: 12 },
  ledColorDot:        { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  ledColorDotActive:  { borderColor: '#fff' },
  ledModes:           { flexDirection: 'row', gap: 6 },
  ledModeBtn:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.background },
  ledModeBtnActive:   { backgroundColor: COLORS.primary },
  ledModeText:        { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  ledModeTextActive:  { color: '#fff' },

  bottomBar:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.background, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12, gap: 8 },
  launchBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16 },
  launchBtnDisabled:  { backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  launchBtnText:      { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  scanSecondaryBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 12, borderWidth: 0.5, borderColor: 'rgba(255,23,68,0.3)' },
  scanSecondaryText:  { fontSize: 13, fontWeight: '600', color: COLORS.primary, letterSpacing: 0.5 },
});