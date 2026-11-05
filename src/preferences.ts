// src/preferences.ts — réglages enregistrés sur le téléphone
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Preferences = {
  notifications: boolean;
  soundEffects: boolean;
  haptics: boolean;
  publicProfile: boolean;
};

const KEY = 'footup.preferences';
const DEFAULTS: Preferences = { notifications: true, soundEffects: true, haptics: true, publicProfile: true };

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  useEffect(() => { loadPreferences().then(setPrefs); }, []);
  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);
  return { prefs, update };
}
