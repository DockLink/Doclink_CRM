export const REQUIRED_CLIENT_FIELDS = ["clientName", "companyName", "billingAddress", "city", "phone"] as const;

export function isRequiredClientField(field: string): field is typeof REQUIRED_CLIENT_FIELDS[number] {
  return REQUIRED_CLIENT_FIELDS.includes(field as typeof REQUIRED_CLIENT_FIELDS[number]);
}

export function isValidClientPhone(value: string) {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  return /^(?:0\d{9}|\+94\d{9}|\+\d{8,15})$/.test(normalized);
}
