import { describe, expect, it } from "vitest";
import {
  estimateProduct,
  guessSection,
  HEB_CATALOG,
  matchCatalog,
  SECTION_DEFAULTS,
} from "./hebCatalog";

describe("HEB_CATALOG", () => {
  it("has about 150 ingredients with real package sizes and prices", () => {
    expect(HEB_CATALOG.length).toBeGreaterThanOrEqual(150);
    for (const item of HEB_CATALOG) {
      expect(item.packageGrams, item.match).toBeGreaterThan(0);
      if (item.match !== "water") {
        expect(item.priceCents, item.match).toBeGreaterThan(0);
      }
    }
  });

  it("lists each match once", () => {
    const matches = HEB_CATALOG.map((i) => i.match);
    expect(new Set(matches).size).toBe(matches.length);
  });
});

describe("matchCatalog", () => {
  it.each([
    ["boneless skinless chicken breasts", "chicken breast"],
    ["chicken", "chicken"],
    ["low sodium chicken broth", "chicken broth"],
    ["ground beef", "ground beef"],
    ["ground cumin", "cumin"],
    ["cloves garlic", "garlic"],
    ["roma tomatoes", "tomato"],
    ["canned diced tomatoes", "diced tomato"],
    ["tomato paste", "tomato paste"],
    ["black beans", "black bean"],
    ["black pepper", "black pepper"],
    ["red bell peppers", "red bell pepper"],
    ["extra virgin olive oil", "olive oil"],
    ["canola oil", "oil"],
    ["sliced black olives", "olive"],
    ["eggs", "egg"],
    ["eggplant", "eggplant"],
    ["corn tortillas", "corn tortilla"],
    ["full-fat coconut milk", "coconut milk"],
    ["plain greek yogurt", "greek yogurt"],
    ["rice vinegar", "rice vinegar"],
    ["jasmine rice", "jasmine rice"],
    ["blueberries", "blueberry"],
    ["bay leaves", "bay leaf"],
    ["jalapeño", "jalapeño"],
    ["crushed red pepper flakes", "red pepper flake"],
    ["shredded mozzarella cheese", "mozzarella"],
    ["grated parmesan cheese", "parmesan"],
    ["crumbled feta cheese", "feta"],
    ["cotija cheese", "cotija"],
    ["ricotta cheese", "ricotta"],
    ["pepper jack cheese", "pepper jack"],
    ["shredded cheese", "cheese"],
    ["egg noodles", "egg noodle"],
    ["avocado oil", "avocado oil"],
    ["peanut oil", "peanut oil"],
    ["almond butter", "almond butter"],
    ["beef stock", "beef stock"],
    ["vegetable stock", "vegetable stock"],
    ["corn starch", "corn starch"],
    ["frozen corn", "frozen corn"],
    ["cream of chicken soup", "cream of chicken"],
    ["chicken bouillon", "bouillon"],
    ["garlic salt", "garlic salt"],
    ["lime juice", "lime juice"],
    ["avocado", "avocado"],
    ["flour tortillas", "flour tortilla"],
    ["grape tomatoes", "grape tomato"],
    ["sugar snap peas", "snap pea"],
    ["bean sprouts", "bean sprout"],
  ])("%s → %s", (food, match) => {
    expect(matchCatalog(food)?.match).toBe(match);
  });

  it("prefers the longer match for garlic powder", () => {
    expect(matchCatalog("garlic powder")?.match).toBe("garlic powder");
  });

  it("is null for a food it doesn't know", () => {
    expect(matchCatalog("dragon fruit")).toBeNull();
    expect(matchCatalog("")).toBeNull();
  });
});

describe("guessSection", () => {
  it.each([
    ["frozen peas", "frozen"],
    ["ground lamb", "meat_seafood"],
    ["ground chuck", "meat_seafood"],
    ["ground bison", "meat_seafood"],
    ["ground venison", "meat_seafood"],
    ["goat cheese", "dairy_eggs"],
    ["dried dill", "spices_staples"],
    ["dinner rolls", "bakery"],
    ["fresh dill", "produce"],
    ["dragon fruit", "pantry"],
  ])("%s → %s", (food, section) => {
    expect(guessSection(food)).toBe(section);
  });
});

describe("estimateProduct", () => {
  it("prices the cheeses as themselves", () => {
    expect(estimateProduct("grated parmesan cheese")).toMatchObject({
      name: "Grated Parmesan, 6 oz",
      priceCents: 449,
    });
  });

  it("prices beef stock as stock, not as a roast", () => {
    expect(estimateProduct("beef stock")).toMatchObject({
      section: "pantry",
      priceCents: 249,
    });
  });

  it("prices ground chuck like meat, not a spice", () => {
    const { priceCents, packageGrams, section } =
      estimateProduct("ground chuck");
    expect(section).toBe("meat_seafood");
    expect(priceCents / packageGrams).toBeLessThan(2);
  });

  it("shelves frozen produce with the frozen food", () => {
    expect(estimateProduct("frozen spinach")).toMatchObject({
      name: "Baby spinach, 5 oz",
      section: "frozen",
    });
  });

  it("uses the catalog entry when the name matches", () => {
    expect(estimateProduct("chicken breasts")).toEqual({
      name: "Chicken breasts, boneless skinless, per lb",
      section: "meat_seafood",
      packageGrams: 454,
      priceCents: 399,
    });
  });

  it("estimates from the section's price per gram otherwise", () => {
    const { centsPerGram, packageGrams } = SECTION_DEFAULTS.meat_seafood;
    expect(estimateProduct("ground lamb")).toEqual({
      name: "ground lamb (estimated)",
      section: "meat_seafood",
      packageGrams,
      priceCents: Math.round(centsPerGram * packageGrams),
    });
  });
});
