import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RecipeFacts, RecipePhoto } from "@/components/RecipeFacts";
import { isCustomSource } from "@/lib/customRecipe";
import { createClient } from "@/lib/db/server";
import { loadRecipe } from "@/lib/plans";

export default function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <Recipe params={params} />
    </Suspense>
  );
}

function amount(mg: number | null, unit: string): string {
  return mg === null ? "–" : `${Math.round(mg)} ${unit}`;
}

// US-9: the recipe's photo, time, nutrition per serving, ingredients with
// portions, and steps.
async function Recipe({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const recipe = await loadRecipe(await createClient(), id);
  if (!recipe) notFound();

  return (
    <article className="recipe-detail">
      <p>
        <Link href="/plan">← Plan</Link>
      </p>
      <h1>{recipe.title}</h1>
      <RecipePhoto
        url={recipe.photoUrl}
        title={recipe.title}
        className="recipe-photo"
      />
      <div className="card">
        <RecipeFacts recipe={recipe} />
        <p className="muted">
          Per serving · serves {recipe.servings}
          {recipe.cuisine && ` · ${recipe.cuisine}`} · fiber{" "}
          {amount(recipe.fiberG, "g")} · sugar {amount(recipe.sugarG, "g")} ·
          sodium {amount(recipe.sodiumMg, "mg")}
        </p>
      </div>
      <section>
        <h2>Ingredients</h2>
        <ul className="ingredient-list">
          {recipe.ingredients.map((line, i) => (
            <li key={i}>
              {line.text}
              {line.grams !== null && (
                <span className="muted"> ({Math.round(line.grams)} g)</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Steps</h2>
        {recipe.steps.length === 0 ? (
          <p className="muted">No steps listed.</p>
        ) : (
          <ol className="recipe-steps">
            {recipe.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </section>
      {isCustomSource(recipe.sourceUrl) ? (
        <p className="muted">Your own recipe.</p>
      ) : (
        <p>
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Original recipe ↗
          </a>
        </p>
      )}
    </article>
  );
}
