import "server-only";

/**
 * Official MasterVLSI placement WhatsApp group invite link, from the PLACEMENT_WHATSAPP_GROUP_URL secret
 * (kept out of the code because the repository is public). Handed out only by the "Join Placement Group"
 * button, after a student accepts the placement terms. Null when it hasn't been set up.
 */
export function placementGroupUrl(): string | null {
  const url = process.env.PLACEMENT_WHATSAPP_GROUP_URL?.trim();
  return url && url.startsWith("https://chat.whatsapp.com/") ? url : null;
}
