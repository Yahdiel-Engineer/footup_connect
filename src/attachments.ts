// src/attachments.ts — choix et envoi de photos / fichiers pour les messages
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Alert } from 'react-native';
import api from './api';

export type Attachment = {
  kind: 'image' | 'file';
  url: string;
  name?: string | null;
  mime?: string | null;
  size?: number | null;
};

/** Champs de pièce jointe renvoyés par l'API avec chaque message. */
export type MessageExtras = {
  kind?: 'text' | 'image' | 'file' | 'session';
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  session_data?: Record<string, any> | null;
};

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_SIDE = 1600; // px : une photo de téléphone passe de ~5-15 Mo à quelques centaines de Ko

export type Picked = { uri: string; name: string; mime: string; size?: number | null };

/** Choisit une photo (galerie ou appareil), réduite à 1600 px et convertie en JPEG. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<Picked | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Autorisation refusée', source === 'camera'
      ? "Autorise l'appareil photo dans les réglages du téléphone."
      : 'Autorise l\'accès aux photos dans les réglages du téléphone.');
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  // Réduction + conversion en JPEG (les photos HEIC d'iPhone deviennent lisibles partout)
  const longest = Math.max(a.width || 0, a.height || 0);
  const resize = longest > MAX_PHOTO_SIDE
    ? [{ resize: (a.width || 0) >= (a.height || 0) ? { width: MAX_PHOTO_SIDE } : { height: MAX_PHOTO_SIDE } }]
    : [];
  const out = await manipulateAsync(a.uri, resize, { compress: 0.7, format: SaveFormat.JPEG });
  const base = (a.fileName || 'photo').replace(/\.[^.]+$/, '');
  return { uri: out.uri, name: `${base}.jpg`, mime: 'image/jpeg', size: null };
}

async function pickDocument(): Promise<Picked | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mime: a.mimeType || 'application/octet-stream', size: a.size };
}

export async function upload(file: Picked): Promise<Attachment> {
  if (file.size && file.size > MAX_BYTES) throw new Error('Fichier trop lourd (10 Mo maximum).');
  const fd = new FormData();
  fd.append('file', { uri: file.uri, name: file.name, type: file.mime } as any);
  const { data } = await api.post('/attachments', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: d => d,
    timeout: 60000,
  });
  return data;
}

/** Ouvre le sélecteur demandé, sans rien envoyer (pour afficher un aperçu d'abord). */
export async function pickFile(source: 'camera' | 'library' | 'document'): Promise<Picked | null> {
  return source === 'document' ? pickDocument() : pickPhoto(source);
}

/** Ouvre le sélecteur demandé puis envoie le fichier ; null si l'utilisateur annule. */
export async function pickAndUpload(source: 'camera' | 'library' | 'document'): Promise<Attachment | null> {
  const picked = source === 'document' ? await pickDocument() : await pickPhoto(source);
  return picked ? upload(picked) : null;
}

export function formatSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
