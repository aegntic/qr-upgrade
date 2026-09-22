export async function openWorkspaceUrl(url: string): Promise<void> {
  const tab = window.open("about:blank", "_blank");
  if (!tab)
    throw new Error(
      "Your browser blocked the new tab. Allow pop-ups for this preview and try again.",
    );
  tab.opener = null;
  tab.location.replace(url);
}
