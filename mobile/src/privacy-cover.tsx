import { useEffect, useState } from "react";
import { AppState, View, Text, StyleSheet } from "react-native";
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
              backgroundColor: "#193c2f",
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <Text style={{ color: "#f6f5ef", fontSize: 22, fontWeight: "700" }}>
            QR Upgrade
          </Text>
          <Text style={{ color: "#dce2d8", marginTop: 10 }}>
            Your draft is hidden while the app is inactive.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
