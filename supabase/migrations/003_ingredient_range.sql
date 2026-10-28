-- US-28, TR-22: how many ingredients a dish may need, pantry staples left out.
-- Null means no limit.
alter table profile
  add column min_ingredients int check (min_ingredients between 1 and 30),
  add column max_ingredients int check (max_ingredients between 1 and 30),
  add constraint profile_ingredient_range
    check (min_ingredients is null or max_ingredients is null
           or min_ingredients <= max_ingredients);
