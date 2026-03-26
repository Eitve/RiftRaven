import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { theme } from '../constants/theme'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.headerBg },
          headerTintColor: theme.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile/[playerId]"
          options={{ title: 'Profile', headerBackTitle: 'Search' }}
        />
        <Stack.Screen
          name="season/[playerId]"
          options={{ title: 'Season Stats', headerBackTitle: 'Profile' }}
        />
      </Stack>
    </>
  )
}
