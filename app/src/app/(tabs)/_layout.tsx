import type { ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Icon } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/lib/theme';

const tabIcon = (outline: string, filled: string) => {
  const TabIcon = ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Icon name={focused ? filled : outline} size={22} color={color as string} />
  );
  TabIcon.displayName = `TabIcon(${filled})`;
  return TabIcon;
};

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (!loading && !user) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Conversar', headerShown: false, tabBarIcon: tabIcon('chatbubbles-outline', 'chatbubbles') }} />
      <Tabs.Screen name="review" options={{ title: 'Revisar', tabBarIcon: tabIcon('bookmark-outline', 'bookmark') }} />
      <Tabs.Screen name="practice" options={{ title: 'Pronúncia', tabBarIcon: tabIcon('mic-outline', 'mic') }} />
      <Tabs.Screen name="path" options={{ title: 'Trilha', headerShown: false, tabBarIcon: tabIcon('map-outline', 'map') }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}
