import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  durationMinutes,
  extractRecipe,
  fetchRecipePage,
  RecipePageError,
} from "./recipePage";

function page(name: string): string {
  return readFileSync(`tests/fixtures/recipe-pages/${name}.html`, "utf8");
}

describe("extractRecipe", () => {
  it("reads a recipe from a WordPress @graph", () => {
    const url = "https://blog.example.com/one-pot-chicken-chili-pasta/";
    const recipe = extractRecipe(page("wordpress-graph"), url);

    expect(recipe).toMatchObject({
      url,
      title: "One Pot Chicken Chili Pasta",
      photoUrl: "https://blog.example.com/wp-content/uploads/chili-pasta.jpg",
      servings: 6,
      cuisine: "American",
      prepMinutes: 10,
      cookMinutes: 25,
      totalMinutes: 35,
      activeMinutes: 35,
    });
    expect(recipe?.ingredients).toHaveLength(11);
    expect(recipe?.ingredients[4]).toBe(
      "1 (15 oz.) can black beans, drained and rinsed",
    );
    expect(recipe?.steps).toHaveLength(4);
    expect(recipe?.steps[1]).toBe(
      "Add the onion and garlic and cook for 3–4 minutes, until soft.",
    );
  });

  it("reads a two-type recipe in a top-level array", () => {
    const recipe = extractRecipe(
      page("publisher-array"),
      "https://www.example-recipes.com/recipe/123/garlic-butter-salmon/",
    );

    expect(recipe).toMatchObject({
      title: "Garlic Butter Salmon",
      photoUrl: "https://images.example-recipes.com/salmon/4x3.jpg",
      servings: 4,
      cuisine: "Seafood",
      prepMinutes: 15,
      cookMinutes: 65,
      totalMinutes: 80,
      activeMinutes: 80,
    });
    expect(recipe?.ingredients).toEqual([
      "4 (6 ounce) salmon fillets",
      "3 tablespoons butter, melted",
      "4 cloves garlic, minced",
      "1 ½ tablespoons lemon juice",
      "¼ teaspoon salt",
      "2 tablespoons chopped fresh parsley",
    ]);
    expect(recipe?.steps[0]).toBe("Preheat the oven to 400°F (200°C).");
  });

  it("finds the recipe block, resolves a relative photo and flattens step sections", () => {
    const recipe = extractRecipe(
      page("sections-and-text"),
      "https://kitchen.example.org/recipes/overnight-oats",
    );

    expect(recipe).toMatchObject({
      title: "Overnight Oats with Greek Yogurt & Berries",
      photoUrl: "https://kitchen.example.org/images/overnight-oats.jpg",
      servings: 2,
      cuisine: null,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: 10,
      activeMinutes: 10,
    });
    // Tags are stripped and the empty line is dropped.
    expect(recipe?.ingredients).toEqual([
      "1 cup old-fashioned rolled oats",
      "1 cup milk",
      "1/2 cup plain Greek yogurt",
      "1 tablespoon honey",
      "1 cup mixed berries",
    ]);
    expect(recipe?.steps).toEqual([
      "Stir the oats, milk, yogurt and honey together.",
      "Divide between two jars and refrigerate overnight.",
      "Top with the berries and eat cold.",
    ]);
  });

  it("returns null for a page with no recipe data", () => {
    expect(
      extractRecipe(page("no-recipe"), "https://blog.example.com/tips/"),
    ).toBeNull();
    expect(
      extractRecipe("<html><body>Hi</body></html>", "https://x.test/"),
    ).toBeNull();
  });

  it("returns null for a recipe with no ingredients", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Toast","recipeIngredient":[]}</script>`;
    expect(extractRecipe(html, "https://x.test/")).toBeNull();
  });

  it("reads steps given as one block of text", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Rice","recipeIngredient":["1 cup rice"],"recipeInstructions":"Rinse the rice.\\nSimmer for 18 minutes.","recipeYield":"4 servings"}</script>`;
    expect(extractRecipe(html, "https://x.test/")).toMatchObject({
      steps: ["Rinse the rice.", "Simmer for 18 minutes."],
      servings: 4,
      photoUrl: null,
      activeMinutes: null,
    });
  });
});

describe("extractRecipe on messy real-world JSON-LD", () => {
  const ld = (json: string) =>
    `<script type="application/ld+json">${json}</script>`;

  it("reads JSON-LD with raw line breaks inside strings", () => {
    const html = ld(
      '{"@type":"Recipe","name":"Soup","recipeYield":"4","recipeIngredient":["1 cup lentils"],"recipeInstructions":"Rinse.\t Simmer for 25\nminutes."}',
    );
    expect(html).toContain("Simmer for 25\nminutes");
    expect(extractRecipe(html, "https://x.test/")).toMatchObject({
      title: "Soup",
      steps: ["Rinse. Simmer for 25 minutes."],
    });
  });

  it("follows a photo given as an @id reference", () => {
    const html = ld(
      JSON.stringify({
        "@graph": [
          {
            "@type": "ImageObject",
            "@id": "https://x.test/#primaryimage",
            url: "https://x.test/soup.jpg",
          },
          {
            "@type": "Recipe",
            name: "Soup",
            image: { "@id": "https://x.test/#primaryimage" },
            recipeIngredient: ["1 cup lentils"],
          },
        ],
      }),
    );
    expect(extractRecipe(html, "https://x.test/")?.photoUrl).toBe(
      "https://x.test/soup.jpg",
    );
  });

  it("picks the largest photo over thumbnails", () => {
    const html = ld(
      JSON.stringify({
        "@type": "Recipe",
        name: "Soup",
        image: [
          "https://x.test/soup-225x225.jpg",
          "https://x.test/soup-720x540.jpg",
          "https://x.test/cookies.jpg?fit=225%2C225",
        ],
        recipeIngredient: ["1 cup lentils"],
      }),
    );
    expect(extractRecipe(html, "https://x.test/")?.photoUrl).toBe(
      "https://x.test/soup-720x540.jpg",
    );
  });

  it("treats zero times as not given", () => {
    const html = ld(
      JSON.stringify({
        "@type": "Recipe",
        name: "Soup",
        recipeIngredient: ["1 cup lentils"],
        prepTime: "PT0M",
        cookTime: "PT0M",
        totalTime: "PT0M",
      }),
    );
    expect(extractRecipe(html, "https://x.test/")).toMatchObject({
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      activeMinutes: null,
    });
  });

  it("splits steps given as one HTML list", () => {
    const html = ld(
      JSON.stringify({
        "@type": "Recipe",
        name: "Soup",
        recipeIngredient: ["1 cup lentils"],
        recipeInstructions: "<ol><li>Rinse.</li><li>Simmer.</li></ol>",
      }),
    );
    expect(extractRecipe(html, "https://x.test/")?.steps).toEqual([
      "Rinse.",
      "Simmer.",
    ]);
  });
});

describe("durationMinutes", () => {
  it.each([
    ["PT20M", 20],
    ["PT1H30M", 90],
    ["P0DT0H20M", 20],
    ["PT90M", 90],
    ["P1D", 1440],
    ["PT45S", 1],
    ["pt10m", 10],
  ])("%s is %i minutes", (iso, minutes) => {
    expect(durationMinutes(iso)).toBe(minutes);
  });

  it.each([undefined, "", "PT", "20 minutes", 20])("%s is null", (v) => {
    expect(durationMinutes(v)).toBeNull();
  });
});

describe("fetchRecipePage", () => {
  it("fetches the page and reads its recipe", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(page("publisher-array"), {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const url = "https://www.example-recipes.com/recipe/123/";

    const recipe = await fetchRecipePage(url, { fetch });

    expect(recipe?.title).toBe("Garlic Butter Salmon");
    expect(fetch.mock.calls[0][0]).toBe(url);
    expect(fetch.mock.calls[0][1].headers["user-agent"]).toMatch(/Mozilla/);
  });

  it("skips pages that aren't HTML", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response("%PDF", {
        headers: { "content-type": "application/pdf" },
      }),
    );
    expect(await fetchRecipePage("https://x.test/a.pdf", { fetch })).toBeNull();
  });

  it("throws a clear error when the page can't be fetched", async () => {
    const notFound = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 404, statusText: "Not Found" }),
      );
    await expect(
      fetchRecipePage("https://x.test/gone", { fetch: notFound }),
    ).rejects.toThrow(
      new RecipePageError("Couldn't fetch https://x.test/gone: 404 Not Found"),
    );

    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      fetchRecipePage("https://x.test/", { fetch: offline }),
    ).rejects.toThrow(RecipePageError);
  });
});
