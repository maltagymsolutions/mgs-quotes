export const OWNERS = ["Luke", "Karl", "Robert"] as const;

export type Owner = (typeof OWNERS)[number];

export const DEFAULT_OWNER: Owner = "Luke";

export function resolveOwner(value: string | null | undefined): Owner {
  return OWNERS.includes(value as Owner) ? (value as Owner) : DEFAULT_OWNER;
}

export function resolveOwnerSplit(value: unknown, fallbackOwner: Owner = DEFAULT_OWNER): Owner[] {
  if (!Array.isArray(value)) {
    return [fallbackOwner];
  }

  const owners = value.filter((owner): owner is Owner => OWNERS.includes(owner as Owner));
  return owners.length > 0 ? owners : [fallbackOwner];
}
