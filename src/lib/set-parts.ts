import { normalizeArticle } from "@/lib/product-article"

export type SetBakery = "Heidbüchel" | "Moss" | "Kockartz"

type Piece = {
  name: string
  quantity: number
  article: string
}

type Recipe = {
  names: string[]
  articles: string[]
  bakery: SetBakery
  pieces: Piece[]
}

const RECIPES: Recipe[] = [
  {
    names: ["Korn Set"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [
      { name: "Weltmeisterbrötchen", quantity: 2, article: "H5" },
      { name: "Vitalstängchen", quantity: 2, article: "H6" },
      { name: "Biobrötchen", quantity: 2, article: "H4" },
    ],
  },
  {
    names: ["Käse Set"],
    articles: ["K68S"],
    bakery: "Kockartz",
    pieces: [
      { name: "Brötchen", quantity: 1, article: "K55" },
      { name: "Sesambrötchen", quantity: 1, article: "K56" },
      { name: "Käsebrötchen mit Speck", quantity: 1, article: "K71" },
      { name: "Käsebrötchen", quantity: 1, article: "K108" },
      { name: "Laugenecke", quantity: 1, article: "K1297" },
    ],
  },
  {
    names: ["Süß Set"],
    articles: ["K144S"],
    bakery: "Kockartz",
    pieces: [
      { name: "Streuselbrötchen", quantity: 1, article: "K100" },
      { name: "Schoko-Streuselbrötchen", quantity: 1, article: "K1066" },
      { name: "Choco-Nuss Brötchen", quantity: 1, article: "K102" },
      { name: "Rosinenbrötchen", quantity: 1, article: "K99" },
      { name: "Hefehörnchen", quantity: 1, article: "K101" },
      { name: "Croissant Bretagne", quantity: 1, article: "K105" },
    ],
  },
  {
    names: ["Mischung Set"],
    articles: ["K95S"],
    bakery: "Kockartz",
    pieces: [
      { name: "Ciabatta", quantity: 1, article: "K112" },
      { name: "Streuselbrötchen", quantity: 1, article: "K100" },
      { name: "Kürbisknacker", quantity: 1, article: "K60" },
      { name: "Winzerbrötchen", quantity: 1, article: "K64" },
      { name: "Mohnbrötchen", quantity: 1, article: "K57" },
      { name: "Croissant Bretagne", quantity: 1, article: "K105" },
    ],
  },
  {
    names: ["Brötchen Set 6er", "Brötchenset 6er"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [{ name: "Brötchen", quantity: 6, article: "H1" }],
  },
  {
    names: ["Brötchen 6er"],
    articles: ["K21S"],
    bakery: "Kockartz",
    pieces: [{ name: "Brötchen", quantity: 6, article: "H1" }],
  },
  {
    names: ["Laugen Set"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [
      { name: "Bretzel", quantity: 1, article: "H620" },
      { name: "Laugenstängchen", quantity: 1, article: "H32" },
      { name: "Laugenecke", quantity: 1, article: "H34" },
      { name: "Laugenbrötchen", quantity: 1, article: "H9" },
    ],
  },
  {
    names: ["Bunt Set"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [
      { name: "Brötchen", quantity: 1, article: "H1" },
      { name: "Krusti", quantity: 1, article: "H10" },
      { name: "Biobrötchen", quantity: 1, article: "H4" },
      { name: "Streuselbrötchen", quantity: 1, article: "H25" },
      { name: "Croissant", quantity: 1, article: "H17" },
      { name: "Bergsteiger-Brötchen", quantity: 1, article: "H5" },
    ],
  },
  {
    names: ["Doppellaugen Set"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [
      { name: "Bretzel", quantity: 2, article: "H620" },
      { name: "Laugenstängchen", quantity: 2, article: "H32" },
      { name: "Laugenecke", quantity: 2, article: "H34" },
      { name: "Laugenbrötchen", quantity: 2, article: "H9" },
    ],
  },
  {
    names: ["Croissant 3er"],
    articles: ["K36S"],
    bakery: "Kockartz",
    pieces: [{ name: "Croissant Bretagne", quantity: 3, article: "K105" }],
  },
  {
    names: ["Croissant 6er"],
    articles: ["K37S"],
    bakery: "Kockartz",
    pieces: [{ name: "Croissant Bretagne", quantity: 6, article: "K105" }],
  },
  {
    names: ["Brötchen Set 10er", "Brötchenset 10er"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [{ name: "Brötchen", quantity: 10, article: "H1" }],
  },
  {
    names: ["Croissant Set"],
    articles: ["K39S"],
    bakery: "Kockartz",
    pieces: [
      { name: "Croissant Bretagne", quantity: 1, article: "K105" },
      { name: "Vollkorncroissant", quantity: 1, article: "" },
      { name: "Chococroissant", quantity: 1, article: "" },
      { name: "Käseschinkencroissant", quantity: 1, article: "" },
    ],
  },
  {
    names: ["Ecke Set"],
    articles: [],
    bakery: "Heidbüchel",
    pieces: [
      { name: "Laugenstängchen", quantity: 2, article: "" },
      { name: "Laugenecke", quantity: 2, article: "" },
      { name: "Käsebrötchen gebacken", quantity: 1, article: "" },
    ],
  },
]

const NAME_ALIASES: Record<string, string> = {
  "brotchenset 10er": "brotchen set 10er",
  "brotchenset 6er": "brotchen set 6er",
  laugenecken: "laugenecke",
  "kaeseroetchen gebacken": "kaesebroetchen gebacken",
}

const BAKERY_BY_LETTER: Record<string, SetBakery> = {
  H: "Heidbüchel",
  M: "Moss",
  K: "Kockartz",
}

const byName = new Map<string, Recipe>()
const byArticle = new Map<string, Recipe>()
for (const recipe of RECIPES) {
  for (const name of recipe.names) byName.set(productKey(name), recipe)
  for (const article of recipe.articles) byArticle.set(article.toUpperCase(), recipe)
}

export type BakeryLine = {
  name: string
  article: string
  quantity: number
  bakery: SetBakery | ""
}

type CatalogMatch = {
  nameForArticle: (article: string, bakery: string) => string
  articleForName: (name: string, bakery: string) => string
}

export function expandForBakery(line: BakeryLine, catalog: CatalogMatch): BakeryLine[] | null {
  const recipe =
    byArticle.get(line.article.trim().toUpperCase()) ?? byName.get(productKey(line.name))
  if (!recipe || line.quantity <= 0) return null
  return recipe.pieces.map((piece) => {
    const resolved = resolvePiece(piece, recipe.bakery, catalog)
    return {
      name: resolved.name,
      article: resolved.article,
      bakery: resolved.bakery,
      quantity: piece.quantity * line.quantity,
    }
  })
}

function resolvePiece(piece: Piece, setBakery: SetBakery, catalog: CatalogMatch) {
  const article = normalizeArticle(piece.article).replaceAll("_", "").toUpperCase()
  const letterBakery = bakeryOfArticle(article)
  const bakeries = uniqueBakeries(letterBakery ? [letterBakery, setBakery] : [setBakery])

  for (const bakery of bakeries) {
    const catalogName = article ? catalog.nameForArticle(article, bakery) : ""
    if (catalogName && productKey(catalogName) === productKey(piece.name)) {
      return { name: catalogName, article, bakery }
    }
  }

  for (const bakery of uniqueBakeries([setBakery, letterBakery])) {
    const found = catalog.articleForName(piece.name, bakery)
    if (!found) continue
    return {
      name: catalog.nameForArticle(found, bakery) || piece.name,
      article: found,
      bakery,
    }
  }

  if (letterBakery && /^[HMK]\d+$/.test(article)) {
    return { name: piece.name, article, bakery: letterBakery }
  }
  return { name: piece.name, article: "", bakery: setBakery }
}

function bakeryOfArticle(article: string): SetBakery | "" {
  return BAKERY_BY_LETTER[article.charAt(0)] ?? ""
}

function uniqueBakeries(bakeries: Array<SetBakery | "">) {
  return [...new Set(bakeries.filter((bakery): bakery is SetBakery => bakery !== ""))]
}

function productKey(name: string) {
  const normalized = name
    .trim()
    .toLocaleLowerCase("de-DE")
    .replaceAll("ß", "ss")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return NAME_ALIASES[normalized] ?? normalized
}
