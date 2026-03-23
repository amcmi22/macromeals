/**
 * presentation/app/routes/recipes/community.tsx
 *
 * Browse every other user's public recipes.
 * Authenticated users can save any recipe to their own library.
 * The copy preserves attribution ("Originally shared by X").
 */

import { data, redirect, useFetcher, useLoaderData } from "react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Fetch } from "~/lib/auth.server";
import { getSession } from "~/sessions.server";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardAction,
} from "~/components/ui/card";
import type { Route } from "./+types/community";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Macros = {
  total: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  perServing: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

type PublicRecipe = {
  id: number;
  name: string;
  description: string;
  servings: number;
  owner_name: string;
  macros: Macros;
  ingredients: {
    ingredient_name: string;
    quantity: number;
    unit: string;
  }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.data.access) return redirect("/auth/login");

  try {
    const res = await Fetch(
      new Request(`${process.env.SERVER_URL}/recipe/community/`, {
        headers: { "Content-Type": "application/json" },
      }),
      session,
    );

    if (!res.ok) {
      return data({ recipes: [] as PublicRecipe[], error: "Failed to load community recipes." });
    }

    const recipes = (await res.json()) as PublicRecipe[];
    return data({ recipes, error: undefined });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load community recipes.";
    return data({ recipes: [] as PublicRecipe[], error: message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Action — save a public recipe to the user's library
// ─────────────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.data.access) return redirect("/auth/login");

  const formData = await request.formData();
  const recipeId = formData.get("recipe_id");

  try {
    const res = await Fetch(
      new Request(`${process.env.SERVER_URL}/recipe/${recipeId}/save/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
      session,
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body?.detail ?? `HTTP ${res.status}`;
      return data({ success: false, error: true, message: String(message) });
    }

    return data({ success: true, error: false, message: "Recipe saved to your library!" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save recipe.";
    return data({ success: false, error: true, message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function CommunityRecipes() {
  const { recipes, error } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto w-full max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Browse recipes shared by other MacroMeals users. Save any recipe to
          your own library to edit and log it.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!error && recipes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No public recipes yet. Be the first to share one from your saved recipes!
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <CommunityRecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipe card
// ─────────────────────────────────────────────────────────────────────────────

function CommunityRecipeCard({ recipe }: { recipe: PublicRecipe }) {
  const fetcher = useFetcher();
  const isSaving = fetcher.state !== "idle";

  // Already saved check — backend returns 400 with a specific message
  const alreadySaved =
    fetcher.data?.message === "You have already saved this recipe.";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      toast.success(fetcher.data.message);
    } else {
      toast.error(fetcher.data.message);
    }
  }, [fetcher.data]);

  const total = recipe.macros?.total ?? {
    calories: 0, protein: 0, carbs: 0, fat: 0,
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">{recipe.name}</CardTitle>
        <CardDescription className="text-xs">
          Shared by <span className="font-medium">{recipe.owner_name}</span>
          {" · "}
          {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {recipe.description ? (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {recipe.description}
          </p>
        ) : null}

        {/* Macros summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="font-semibold">{total.calories} kcal</span>
          <span>P: {total.protein}g</span>
          <span>C: {total.carbs}g</span>
          <span>F: {total.fat}g</span>
        </div>

        {/* Ingredients preview — first 4 */}
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {recipe.ingredients.slice(0, 4).map((ing, i) => (
            <li key={i}>
              {ing.ingredient_name} — {ing.quantity}
              {ing.unit}
            </li>
          ))}
          {recipe.ingredients.length > 4 && (
            <li>+{recipe.ingredients.length - 4} more ingredients</li>
          )}
        </ul>
      </CardContent>

      <CardFooter>
        <CardAction>
          <fetcher.Form method="post">
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || alreadySaved}
              variant={alreadySaved ? "outline" : "default"}
            >
              {alreadySaved
                ? "Already saved"
                : isSaving
                ? "Saving…"
                : "Save to my library"}
            </Button>
          </fetcher.Form>
        </CardAction>
      </CardFooter>
    </Card>
  );
}
