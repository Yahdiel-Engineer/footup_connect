// src/usePushNotifications.ts
// Notifications : enregistre le jeton Expo auprès de l'API, affiche les
// notifications reçues app ouverte et ouvre la bonne conversation au toucher.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import api from './api';
import { emitMessagesChanged } from './messageEvents';
import { loadPreferences } from './preferences';

// App au premier plan : bandeau + son, comme une app de messagerie
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Expo Go ne gère plus les notifications push sur Android (SDK 53+) : il faut l'app compilée
const IN_EXPO_GO =
  Constants.executionEnvironment === 'storeClient' || (Constants as any).appOwnership === 'expo';

export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return; // pas de push sur émulateur / web
  if (IN_EXPO_GO) {
    console.log("Notifications désactivées dans Expo Go — elles fonctionnent dans l'app compilée.");
    return;
  }

  if (Platform.OS === 'android') {
    // un canal refusé ne doit pas empêcher l'enregistrement du jeton
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    }).catch(e => console.log('Canal de notification non créé :', e?.message ?? e));
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/auth/push-token', { push_token: token });
}

/** Coupe les notifications de ce compte : l'API n'aura plus de jeton valide. */
export async function unregisterPushToken(): Promise<void> {
  await api.post('/auth/push-token', { push_token: '' });
}

function openFromNotification(data: Record<string, any> | undefined) {
  if (!data) return;
  if (data.type === 'group_message' && data.group_id) {
    router.push({ pathname: '/chat/group/[groupId]', params: { groupId: String(data.group_id) } });
  } else if ((data.type === 'message' || data.type === 'conversation_accepted') && data.from_user_id) {
    router.push({ pathname: '/chat/[friendId]', params: { friendId: String(data.from_user_id) } });
  } else if (data.type === 'friend_request' || data.type === 'friend_accepted') {
    router.push('/friend-requests');
  }
}

export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    loadPreferences()
      .then(p => (p.notifications ? registerPushToken() : undefined))
      .catch(e => console.log('Notifications indisponibles :', e?.message ?? e));

    // Reçue app ouverte : les écrans de messages se rafraîchissent aussitôt
    const received = Notifications.addNotificationReceivedListener(() => emitMessagesChanged());
    // Touchée (app ouverte, en arrière-plan ou fermée) : ouvrir la conversation
    const tapped = Notifications.addNotificationResponseReceivedListener(r =>
      openFromNotification(r.notification.request.content.data),
    );
    const last = Notifications.getLastNotificationResponse();
    if (last) openFromNotification(last.notification.request.content.data);

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [isAuthenticated]);
}
