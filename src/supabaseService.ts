// src/supabaseService.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://lfrqefxgfxochtqtmjgu.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_iLGZfxO-ZeL-58QvCmbL-Q_OORUAIyF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface SensorData {
  id?: number;
  session_id: string;
  source: string;
  x: number;
  y: number;
  z: number;
  total: number;
  is_impact: boolean;
  acceleration: number;
  force: number;
  vitesse: number;
  created_at?: string;
}

let activeChannelProd: any = null;
let activeChannelTest: any = null;

/**
 * Insère dans sensor_data (prod) ou sensor_data_test selon la source.
 * On ne peut pas insérer dans sensor_data_all car c'est une vue.
 */
export async function insertSensorData(data: Omit<SensorData, 'id' | 'created_at'>): Promise<void> {
  try {
    const table = data.source === 'esp32_wifi' || data.source === 'test'
      ? 'sensor_data_test'
      : 'sensor_data';
    await supabase.from(table).insert([data]);
  } catch (e) {
    console.warn('insertSensorData error:', e);
  }
}

/**
 * Écoute les impacts sur sensor_data ET sensor_data_test en même temps.
 * Supabase Realtime ne supporte pas les vues, donc on écoute les deux tables séparément.
 */
export function subscribeToSensorData(
  _sessionId: string,
  onData: (data: SensorData) => void,
  onError?: (error: any) => void
): () => void {
  try {
    // Nettoie les anciens channels
    if (activeChannelProd) { supabase.removeChannel(activeChannelProd); activeChannelProd = null; }
    if (activeChannelTest) { supabase.removeChannel(activeChannelTest); activeChannelTest = null; }

    const handlePayload = (payload: any) => {
      try {
        const row = payload.new as SensorData;
        if (row.is_impact) onData(row);
      } catch (e) {
        onError?.(e);
      }
    };

    // Channel 1 — table prod (Arduino USB / BLE)
    activeChannelProd = supabase
      .channel(`sensor_prod_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, handlePayload)
      .subscribe((status) => {
        console.log('Realtime prod:', status);
        if (status === 'CHANNEL_ERROR') onError?.('Prod channel error');
      });

    // Channel 2 — table test (Wokwi / ESP32 WiFi)
    activeChannelTest = supabase
      .channel(`sensor_test_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data_test' }, handlePayload)
      .subscribe((status) => {
        console.log('Realtime test:', status);
        if (status === 'CHANNEL_ERROR') onError?.('Test channel error');
      });

    return () => {
      if (activeChannelProd) { supabase.removeChannel(activeChannelProd); activeChannelProd = null; }
      if (activeChannelTest) { supabase.removeChannel(activeChannelTest); activeChannelTest = null; }
    };
  } catch (e) {
    onError?.(e);
    return () => {};
  }
}

export function unsubscribeFromSensorData() {
  if (activeChannelProd) { supabase.removeChannel(activeChannelProd); activeChannelProd = null; }
  if (activeChannelTest) { supabase.removeChannel(activeChannelTest); activeChannelTest = null; }
}