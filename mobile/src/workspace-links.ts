export const workspaceLinks = Object.freeze({
  account: "https://qrupgrade.com/account",
  designs: "https://qrupgrade.com/cloud-designs",
  links: "https://qrupgrade.com/links",
  content: "https://qrupgrade.com/content",
} as const);

export type WorkspaceTarget = keyof typeof workspaceLinks;
export type WorkspaceOpener = (url: string) => void | Promise<unknown>;

/** The caller supplies only an allowlisted key; no draft or session data is accepted. */
export async function openWorkspaceTarget(
  target: WorkspaceTarget,
  opener: WorkspaceOpener,
): Promise<void> {
  await opener(workspaceLinks[target]);
}
