import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="chat/[friendId]" />
      <Stack.Screen name="chat/new-group" />
      <Stack.Screen name="chat/group/[groupId]" />
      <Stack.Screen name="chat/group-info" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="friend-requests" />
      <Stack.Screen name="search-users" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="session-detail" />
      <Stack.Screen name="share-session" />
    </Stack>
  );
}