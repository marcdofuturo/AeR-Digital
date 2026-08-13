function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function isTenantSwitchCommand(input: string) {
  const value = normalizeText(input);
  return value === "trocar selo"
    || value === "trocar o selo"
    || value === "mudar selo"
    || value === "mudar o selo"
    || value === "alterar selo"
    || value.includes("mudar de gravadora")
    || value.includes("trocar de gravadora");
}
