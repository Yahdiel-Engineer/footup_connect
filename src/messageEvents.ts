// src/messageEvents.ts
// Petit canal d'événements : une notification reçue ou un message envoyé
// demande aux écrans de messages (liste, conversation, pastille) de se rafraîchir.
import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import api from './api';

type Listener = () => void;
const listeners = new Set<Listener>();

export function emitMessagesChanged() {
  listeners.forEach(l => l());
}

export function onMessagesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Appelle `refresh` tout de suite, puis toutes les `intervalMs` tant que l'écran
 * est monté et l'app au premier plan, et à chaque notification de message.
 */
export function useLiveRefresh(refresh: () => void, intervalMs: number, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    refresh();
    let timer: ReturnType<typeof setInterval> | null = setInterval(refresh, intervalMs);
    const unsub = onMessagesChanged(refresh);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
        if (!timer) timer = setInterval(refresh, intervalMs);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      unsub();
      appState.remove();
    };
  }, [refresh, intervalMs, enabled]);
}

/** Nombre total de messages non lus (conversations + groupes), mis à jour en continu. */
export function useUnreadCount(intervalMs = 15000): number {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    api.get('/messages/unread-count')
      .then(r => setCount(r.data?.count ?? 0))
      .catch(() => {});
  }, []);
  useLiveRefresh(refresh, intervalMs);
  return count;
}
