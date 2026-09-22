import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Text, View } from "react-native";
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
          <Stack.Screen
            name="index"
            options={{
              headerTitle: () => (
                <View
                  accessibilityRole="header"
                  style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                >
                  <Image
                    accessible={false}
                    source={require("../assets/mark-v3.png")}
                    style={{ width: 28, height: 28 }}
                  />
                  <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700" }}>
                    QR Upgrade
                  </Text>
                </View>
              ),
            }}
          />
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
