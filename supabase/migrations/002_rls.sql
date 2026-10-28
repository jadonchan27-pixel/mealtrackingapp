-- Row-level security: each signed-in user sees and changes only their own rows.
-- The anon role gets no access because no policy applies to it.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'foods', 'heb_products', 'recipes', 'recipe_ingredients', 'week_plans',
    'plan_candidates', 'plan_items', 'shopping_list_items', 'log_entries', 'weight_entries'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;
