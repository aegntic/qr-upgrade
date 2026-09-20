import { useEffect, useState } from "react";
import { AppState, View, Text, StyleSheet, Image } from "react-native";
export function useForeground() {
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  return active;
}
// Best-effort app-switcher cover. Native capture timing still requires device verification.
export function PrivacyCover({ children }: { children: React.ReactNode }) {
  const active = useForeground();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      >
        {children}
      </View>
      {!active ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#080b10",
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Image
            accessible={false}
            source={require("../assets/mark-v3.png")}
            style={{ width: 84, height: 84, marginBottom: 16 }}
          />
          <Text style={{ color: "#f4f7fa", fontSize: 22, fontWeight: "700" }}>
            QR Upgrade
          </Text>
          <Text style={{ color: "#9ba8b7", marginTop: 10 }}>
            Your draft is hidden while the app is inactive.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
