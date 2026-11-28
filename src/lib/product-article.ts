export type BakeryCode = "H" | "M" | "K"

const LETTERS: Record<string, BakeryCode> = {
  H: "H",
  Х: "H",
  M: "M",
  М: "M",
  K: "K",
  К: "K",
}

const BAKERIES: Record<BakeryCode, string> = {
  H: "Heidbüchel",
  M: "Moss",
  K: "Kockartz",
}

const ARTICLE = /^(.*?)(?:\s+|^)([A-Za-zА-Яа-я])(\d+)$/

export function isEggName(name: string) {
  return /\beier\b/i.test(name)
}

export function normalizeArticle(value: string) {
  const match = value.trim().match(/^([A-Za-zА-Яа-я])\s*(\d+)$/)
  if (!match?.[1] || !match[2]) return value.trim()
  const letter = LETTERS[match[1].toUpperCase()] ?? match[1].toUpperCase()
  return `${letter}${match[2]}`
}

export function splitProductArticle(name: string) {
  const trimmed = name.trim()
  const match = trimmed.match(ARTICLE)
  const letter = match?.[2] ? LETTERS[match[2].toUpperCase()] : undefined
  if (!match || !letter || !match[3]) return { name: trimmed, article: "" }
  return {
    name: match[1]?.trim() ?? "",
    article: `${letter}${match[3]}`,
  }
}

export function bakeryCodeForArticle(article: string): BakeryCode | "" {
  return LETTERS[article.trim().charAt(0).toUpperCase()] ?? ""
}

export function bakeryForArticle(article: string) {
  const letter = bakeryCodeForArticle(article)
  return letter ? BAKERIES[letter] : ""
}

export function describeProduct(product: { name: string; quantity: number; article?: string }) {
  const parsed = product.article?.trim()
    ? { name: product.name.trim(), article: normalizeArticle(product.article) }
    : splitProductArticle(product.name)
  const bakery = bakeryForArticle(parsed.article)
  return {
    name: parsed.name || product.name.trim(),
    article: parsed.article,
    bakery,
    quantity: product.quantity,
    line: [parsed.name || product.name.trim(), `× ${product.quantity}`, parsed.article, bakery]
      .filter(Boolean)
      .join(" "),
  }
}
