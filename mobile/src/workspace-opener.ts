import * as Linking from "expo-linking";

export async function openWorkspaceUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
