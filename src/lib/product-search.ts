export function productSearchKey(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "")
}
