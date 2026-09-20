import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DraftProvider } from "../src/draft";
import { useTheme } from "../src/ui";
import { PrivacyCover } from "../src/privacy-cover";
export default function Layout() {
  const t = useTheme();
  return (
    <DraftProvider>
      <PrivacyCover>
        <StatusBar style={t.dark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.bg },
            headerTintColor: t.ink,
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: t.bg },
            headerBackButtonDisplayMode: "minimal",
          }}
        >
          <Stack.Screen name="index" options={{ title: "QR upgrade ↗" }} />
          <Stack.Screen name="library" options={{ title: "Library" }} />
          <Stack.Screen
            name="workspace"
            options={{ title: "Account & cloud workspace" }}
          />
          <Stack.Screen name="test" options={{ title: "Scan Lab" }} />
          <Stack.Screen name="export" options={{ title: "Export" }} />
          <Stack.Screen
            name="camera"
            options={{ title: "Check a printed QR", presentation: "modal" }}
          />
        </Stack>
      </PrivacyCover>
    </DraftProvider>
  );
}
