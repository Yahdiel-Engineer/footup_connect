// src/bleService.ts
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import * as Location from 'expo-location';
import api from './api';

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

// ─── Identifiants Bluetooth : identiques au firmware (Documents/footup_esp32.ino) ───
export const SERVICE_UUID      = '0000ff00-0000-1000-8000-00805f9b34fb';
const CHAR_SENSOR_UUID         = '0000ff01-0000-1000-8000-00805f9b34fb'; // NOTIFY : impacts (JSON)
const CHAR_LED_UUID            = '0000ff02-0000-1000-8000-00805f9b34fb'; // WRITE  : "couleur:mode:luminosité"
const CHAR_PAIRING_UUID        = '0000abcd-0000-1000-8000-00805f9b34fb'; // READ   : jeton d'appairage

/** Impact reçu d'une cible (champs envoyés par sendImpactBLE du firmware). */
export type Impact = {
  targetId: string;
  acceleration: number; // g (au-dessus de 1 g de gravité)
  force: number;        // N
  vitesse: number;      // m/s
  x: number; y: number; z: number;
  timestamp: number;
};

// ─── Diffusion des impacts aux écrans (session, accueil) ───
type ImpactListener = (impact: Impact) => void;
const impactListeners = new Set<ImpactListener>();
export function onImpact(listener: ImpactListener): () => void {
  impactListeners.add(listener);
  return () => { impactListeners.delete(listener); };
}

// base64 <-> texte (les valeurs BLE de react-native-ble-plx sont en base64).
// Le firmware n'échange que de l'ASCII (jeton hexadécimal, JSON, "#RRGGBB:mode:80") : atob/btoa suffisent.
const toBase64 = (s: string) => btoa(s);
const fromBase64 = (b: string) => atob(b);

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
const disconnectSubscriptions = new Map<string, any>();

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
// iOS : la demande Bluetooth est faite par le système au premier scan (texte dans app.json).
// Android 12+ : BLUETOOTH_SCAN / BLUETOOTH_CONNECT. Android < 12 : la localisation est exigée pour scanner.
export async function requestBLEPermissions(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') return true;

    if (Platform.Version >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      const ok = Object.values(res).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
      if (!ok) Alert.alert('Permission Bluetooth requise', 'Autorise le Bluetooth (appareils à proximité) pour trouver les cibles.');
      return ok;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Sur cette version d\'Android, la localisation est nécessaire pour scanner les cibles Bluetooth.');
      return false;
    }
    return true;
  } catch (e) {
    console.log('Permission error:', e);
    return false;
  }
}

/** Attend que le Bluetooth du téléphone soit prêt (iOS met parfois une seconde au démarrage). */
async function waitForBluetoothOn(timeoutMs = 6000): Promise<boolean> {
  try {
    if ((await BleManager.state()) === 'PoweredOn') return true;
  } catch {}
  return new Promise(resolve => {
    let done = false;
    const sub = BleManager.onStateChange((state: string) => {
      if (state === 'PoweredOn' && !done) { done = true; sub.remove(); resolve(true); }
    }, true);
    setTimeout(() => { if (!done) { done = true; sub.remove(); resolve(false); } }, timeoutMs);
  });
}

// ─── Vérification du jeton d'appairage par l'API ───
// Première connexion : la cible est enregistrée. Une cible désactivée est refusée.
async function verifyPairingToken(token: string, name: string): Promise<'ok' | 'refused' | 'unchecked'> {
  try {
    await api.post('/targets/pair', { token, name }, { timeout: 20000 });
    return 'ok';
  } catch (e: any) {
    if (e?.response?.status === 403) return 'refused';
    // API injoignable ou table absente : on laisse tester la cible (prototype)
    console.warn('Jeton non vérifié :', e?.response?.data?.detail || e?.message);
    return 'unchecked';
  }
}

// ─── Lecture du jeton d'appairage ───
async function readPairingToken(deviceId: string): Promise<string | null> {
  try {
    const characteristic = await BleManager.readCharacteristicForDevice(deviceId, SERVICE_UUID, CHAR_PAIRING_UUID);
    return characteristic?.value ? fromBase64(characteristic.value) : null;
  } catch (e) {
    console.warn('Impossible de lire le jeton BLE :', e);
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
      if (!(await waitForBluetoothOn())) {
        Alert.alert('Bluetooth désactivé', 'Active le Bluetooth du téléphone puis relance le scan.');
        onScanComplete();
        return;
      }
      const foundDevices = new Set<string>();

      BleManager.startDeviceScan(null, { allowDuplicates: false }, (error: any, device: any) => {
        // le nom publicitaire peut être absent sur iOS : on garde alors le nom local
        if (error) {
          console.log('BLE scan error:', error);
          return;
        }
        const deviceName: string | undefined = device?.name || device?.localName;
        if (deviceName && !foundDevices.has(device.id)) {
          // Filtre : nom doit contenir "footup" (insensible à la casse)
          if (deviceName.toLowerCase().includes('footup')) {
            foundDevices.add(device.id);
            const target: BLETarget = {
              id: device.id,
              name: deviceName,
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
            const known = connectedDevices.get(device.id);
            if (!known || known.state !== 'connected') connectedDevices.set(device.id, target);
            onTargetFound(known?.state === 'connected' ? known : target);
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
      // MTU : par défaut Android ne transporte que 20 octets par notification, or le JSON
      // d'un impact en fait ~150 → on demande 247 octets (iOS négocie seul, l'option est ignorée)
      if (!(await BleManager.isDeviceConnected(targetId).catch(() => false))) {
        await BleManager.connectToDevice(targetId, { requestMTU: 247, timeout: 15000 });
      }
      await BleManager.discoverAllServicesAndCharacteristicsForDevice(targetId);

      // 2. Jeton d'appairage lu sur la cible (prouve que c'est bien un module FootUp)
      const token = await readPairingToken(targetId);
      if (!token) {
        Alert.alert('Connexion refusée', "Impossible de lire le jeton de cette cible. Redémarre l'ESP32 et réessaie.");
        await BleManager.cancelDeviceConnection(targetId).catch(() => {});
        onStateChange?.(targetId, 'disconnected');
        return false;
      }

      // 3. Cible connectée tout de suite (sans attendre l'API, qui peut être en veille sur Render)
      connectedDevices.set(targetId, { ...target, state: 'connected', connected: true, pairingVerified: false });
      onStateChange?.(targetId, 'connected');

      // 4. Vraie déconnexion (cible éteinte, hors de portée…)
      disconnectSubscriptions.get(targetId)?.remove?.();
      disconnectSubscriptions.set(targetId, BleManager.onDeviceDisconnected(targetId, () => {
        dataSubscriptions.get(targetId)?.remove?.();
        dataSubscriptions.delete(targetId);
        disconnectSubscriptions.get(targetId)?.remove?.();
        disconnectSubscriptions.delete(targetId);
        const t = connectedDevices.get(targetId);
        if (t) connectedDevices.set(targetId, { ...t, state: 'disconnected', connected: false });
        onStateChange?.(targetId, 'disconnected');
      }));

      // 5. Écoute des impacts (notifications BLE)
      startRealDataMonitoring(targetId, onDataReceived);

      // 6. Vérification du jeton par l'API, en arrière-plan : seule une cible refusée est déconnectée
      verifyPairingToken(token, target.name || targetId).then(async verdict => {
        if (verdict === 'refused') {
          Alert.alert('Cible non autorisée', "Cette cible est désactivée dans le système FootUp.");
          await disconnectTarget(targetId, onStateChange);
        } else if (verdict === 'ok') {
          const t = connectedDevices.get(targetId);
          if (t) connectedDevices.set(targetId, { ...t, pairingVerified: true });
        }
      });

      return true;

    } catch (e: any) {
      console.log('Connexion BLE échouée:', e);
      await BleManager.cancelDeviceConnection(targetId).catch(() => {});
      Alert.alert(
        'Connexion impossible',
        `${e?.message || e}\n\nVérifie que la cible est allumée et qu'elle n'est pas déjà utilisée par un autre téléphone, puis réessaie.`,
      );
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
  dataSubscriptions.get(targetId)?.remove?.();
  dataSubscriptions.delete(targetId);
  disconnectSubscriptions.get(targetId)?.remove?.();
  disconnectSubscriptions.delete(targetId);

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
  onDataReceived?: (targetId: string, data: any) => void,
): void {
  dataSubscriptions.get(targetId)?.remove?.();
  const sub = BleManager.monitorCharacteristicForDevice(
    targetId, SERVICE_UUID, CHAR_SENSOR_UUID,
    (error: any, characteristic: any) => {
      if (error) {
        // la déconnexion réelle est suivie par onDeviceDisconnected ; ici on journalise seulement
        console.log('Écoute des impacts interrompue :', error?.message);
        return;
      }
      if (!characteristic?.value) return;
      try {
        const d = JSON.parse(fromBase64(characteristic.value));
        const impact: Impact = {
          targetId,
          acceleration: Number(d.acceleration) || 0,
          force: Number(d.force) || 0,
          vitesse: Number(d.vitesse) || 0,
          x: Number(d.x) || 0, y: Number(d.y) || 0, z: Number(d.z) || 0,
          timestamp: Date.now(),
        };
        const t = connectedDevices.get(targetId);
        if (t) connectedDevices.set(targetId, { ...t, lastData: { ...impact } });
        onDataReceived?.(targetId, impact);
        impactListeners.forEach(l => l(impact));
      } catch (e) {
        console.warn('Trame BLE illisible :', e);
      }
    },
  );
  dataSubscriptions.set(targetId, sub);
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

  if (isBLEAvailable() && target.isReal) {
    try {
      // format attendu par LedCallbacks du firmware : "#RRGGBB:mode:0-100"
      await BleManager.writeCharacteristicWithResponseForDevice(
        targetId, SERVICE_UUID, CHAR_LED_UUID, toBase64(`${color}:${mode}:${Math.round(brightness)}`),
      );
    } catch (e) {
      console.warn('Configuration LED non envoyée :', e);
      return false;
    }
  }
  connectedDevices.set(targetId, { ...target, ledColor: color, ledMode: mode, ledBrightness: brightness });
  return true;
}

// ─── Nettoyage ───
export function destroyBLE(): void {
  dataSubscriptions.forEach(sub => sub?.remove?.());
  dataSubscriptions.clear();
  disconnectSubscriptions.forEach(sub => sub?.remove?.());
  disconnectSubscriptions.clear();
  connectedDevices.clear();

  if (BleManager) {
    try { BleManager.destroy(); } catch {}
  }
}
