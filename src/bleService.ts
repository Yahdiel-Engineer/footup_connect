// src/bleService.ts
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase, insertSensorData } from './supabaseService';

// ─── Types ───
export type TargetState = 'available' | 'connecting' | 'connected' | 'disconnected';

export interface BLETarget {
  id: string;
  name: string;
  rssi: number;
  state: TargetState;
  connected: boolean;
  signal: 'Fort' | 'Moyen' | 'Faible';
  battery: number;
  ledColor: string;
  ledMode: string;
  ledBrightness: number;
  isReal: boolean;
  pairingVerified: boolean;
  lastData?: {
    x: number; y: number; z: number;
    force: number; acceleration: number; vitesse: number;
    timestamp: number;
  };
}

// UUID de la caractéristique BLE contenant le pairing token (ESP32)
const PAIRING_CHARACTERISTIC_UUID = '0000abcd-0000-1000-8000-00805f9b34fb';

// ─── BLE Manager ───
let BleManager: any = null;
let isInRealMode = false;

try {
  const blePlx = require('react-native-ble-plx');
  BleManager = new blePlx.BleManager();
  isInRealMode = true;
  console.log('BLE library loaded — mode réel activé');
} catch (e) {
  console.log('BLE library not available (Expo Go mode)');
  isInRealMode = false;
}

// ─── État interne ───
const connectedDevices = new Map<string, BLETarget>();
const dataSubscriptions = new Map<string, any>();

// ─── Utilitaires ───
function rssiToSignal(rssi: number): 'Fort' | 'Moyen' | 'Faible' {
  if (rssi > -60) return 'Fort';
  if (rssi > -75) return 'Moyen';
  return 'Faible';
}

export function isBLEAvailable(): boolean {
  return BleManager !== null && Platform.OS !== 'web';
}

export function isRealMode(): boolean {
  return isInRealMode;
}

// ─── Permissions ───
export async function requestBLEPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return true;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission requise',
        'La localisation est nécessaire pour scanner les appareils Bluetooth.',
        [{ text: 'OK' }]
      );
      return false;
    }

    if (Platform.OS === 'android' && Platform.Version >= 31) {
      const btScan    = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      const btConnect = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      if (btScan !== 'granted' || btConnect !== 'granted') {
        Alert.alert('Permission Bluetooth requise', 'Autorisez le Bluetooth pour scanner les cibles.');
        return false;
      }
    }

    return true;
  } catch (e) {
    console.log('Permission error:', e);
    return false;
  }
}

// ─── Vérification du pairing token via Supabase ───
async function verifyPairingToken(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('targets')
      .select('target_id, is_active')
      .eq('pairing_token', token)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.warn('Pairing token non reconnu:', token);
      return false;
    }

    console.log('Cible vérifiée ✅:', data.target_id);
    return true;
  } catch (e) {
    console.warn('Erreur vérification token:', e);
    return false;
  }
}

// ─── Lecture du token BLE d'une cible réelle ───
async function readPairingToken(deviceId: string): Promise<string | null> {
  try {
    const characteristic = await BleManager.readCharacteristicForDevice(
      deviceId,
      '0000abcd-0000-1000-8000-00805f9b34fb', // Service UUID
      PAIRING_CHARACTERISTIC_UUID
    );
    if (characteristic?.value) {
      // Décoder base64 → string
      return atob(characteristic.value);
    }
    return null;
  } catch (e) {
    console.warn('Impossible de lire le token BLE:', e);
    return null;
  }
}

// ─── Scan ───
export async function scanForTargets(
  onTargetFound: (target: BLETarget) => void,
  onScanComplete: () => void,
  durationMs: number = 10000
): Promise<void> {
  const hasPermission = await requestBLEPermissions();

  if (isBLEAvailable() && hasPermission) {
    // Scan BLE réel
    try {
      const foundDevices = new Set<string>();

      BleManager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
        if (error) {
          console.log('BLE scan error:', error);
          return;
        }
        if (device?.name && !foundDevices.has(device.id)) {
          // Filtre : nom doit contenir "footup" (insensible à la casse)
          if (device.name.toLowerCase().includes('footup')) {
            foundDevices.add(device.id);
            const target: BLETarget = {
              id: device.id,
              name: device.name,
              rssi: device.rssi || -70,
              state: 'available',
              connected: false,
              signal: rssiToSignal(device.rssi || -70),
              battery: 0, // lu lors de la connexion
              ledColor: '#FF1744',
              ledMode: 'static',
              ledBrightness: 100,
              isReal: true,
              pairingVerified: false,
            };
            onTargetFound(target);
          }
        }
      });

      setTimeout(() => {
        BleManager.stopDeviceScan();
        onScanComplete();
      }, durationMs);

    } catch (e) {
      console.log('BLE scan failed:', e);
      // Pas de simulation — scan réel impossible → 0 cibles
      onScanComplete();
    }
  } else {
    // Pas de BLE disponible (Expo Go) → scan immédiat avec 0 résultat
    console.log('BLE non disponible — 0 cible trouvée');
    setTimeout(() => {
      onScanComplete();
    }, 2000); // Simule un délai de scan réaliste
  }
}

// ─── Connexion à une cible spécifique ───
export async function connectToTarget(
  targetId: string,
  sessionId?: string,
  onDataReceived?: (targetId: string, data: any) => void,
  onStateChange?: (targetId: string, state: TargetState) => void
): Promise<boolean> {
  const target = connectedDevices.get(targetId) || { id: targetId, pairingVerified: false, isReal: false } as any;

  onStateChange?.(targetId, 'connecting');

  if (isBLEAvailable() && target.isReal) {
    try {
      // 1. Connexion BLE
      await BleManager.connectToDevice(targetId);
      await BleManager.discoverServicesForDevice(targetId);

      // 2. Lire et vérifier le pairing token
      const token = await readPairingToken(targetId);
      if (!token) {
        Alert.alert('Connexion refusée', 'Impossible de lire le token de cette cible.');
        await BleManager.cancelDeviceConnection(targetId);
        onStateChange?.(targetId, 'disconnected');
        return false;
      }

      const isVerified = await verifyPairingToken(token);
      if (!isVerified) {
        Alert.alert(
          'Cible non autorisée',
          'Cette cible n\'est pas enregistrée dans votre système FootUp. Connexion refusée.'
        );
        await BleManager.cancelDeviceConnection(targetId);
        onStateChange?.(targetId, 'disconnected');
        return false;
      }

      // 3. Token valide → connexion acceptée
      connectedDevices.set(targetId, { ...target, state: 'connected', connected: true, pairingVerified: true });
      onStateChange?.(targetId, 'connected');

      // 4. Écoute les données capteur via BLE
      if (sessionId) {
        startRealDataMonitoring(targetId, sessionId, onDataReceived);
      }

      return true;

    } catch (e) {
      console.log('Connexion BLE échouée:', e);
      onStateChange?.(targetId, 'disconnected');
      return false;
    }
  }

  // Expo Go — pas de connexion simulée
  Alert.alert(
    'BLE non disponible',
    'Le Bluetooth n\'est pas disponible dans Expo Go. Utilisez un build natif pour connecter les cibles.',
    [{ text: 'OK' }]
  );
  onStateChange?.(targetId, 'disconnected');
  return false;
}

// ─── Déconnexion ───
export async function disconnectTarget(
  targetId: string,
  onStateChange?: (targetId: string, state: TargetState) => void
): Promise<void> {
  const subscription = dataSubscriptions.get(targetId);
  if (subscription) {
    clearInterval(subscription);
    dataSubscriptions.delete(targetId);
  }

  if (isBLEAvailable()) {
    try { await BleManager.cancelDeviceConnection(targetId); } catch {}
  }

  const target = connectedDevices.get(targetId);
  if (target) {
    connectedDevices.set(targetId, { ...target, state: 'disconnected', connected: false });
  }
  onStateChange?.(targetId, 'disconnected');
}

// ─── Données réelles BLE (ESP32 → caractéristique NOTIFY) ───
function startRealDataMonitoring(
  targetId: string,
  sessionId: string,
  onDataReceived?: (targetId: string, data: any) => void
): void {
  // À implémenter quand l'ESP32 est prêt
  // BleManager.monitorCharacteristicForDevice(targetId, serviceUUID, charUUID, callback)
  console.log(`Monitoring BLE data pour ${targetId} — en attente ESP32`);
}

// ─── Getters ───
export function getConnectedTargets(): BLETarget[] {
  return Array.from(connectedDevices.values()).filter(t => t.state === 'connected');
}

export function getAllDiscoveredTargets(): BLETarget[] {
  return Array.from(connectedDevices.values());
}

// ─── LED ───
export async function configureLED(
  targetId: string,
  color: string,
  mode: string,
  brightness: number
): Promise<boolean> {
  const target = connectedDevices.get(targetId);
  if (!target || target.state !== 'connected') return false;

  // En mode réel : écrire dans une caractéristique BLE LED
  // Pour l'instant : mise à jour locale uniquement
  connectedDevices.set(targetId, { ...target, ledColor: color, ledMode: mode, ledBrightness: brightness });
  return true;
}

// ─── Nettoyage ───
export function destroyBLE(): void {
  dataSubscriptions.forEach(interval => clearInterval(interval));
  dataSubscriptions.clear();
  connectedDevices.clear();

  if (BleManager) {
    try { BleManager.destroy(); } catch {}
  }
}
