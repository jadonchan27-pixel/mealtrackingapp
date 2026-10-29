-- US-31, US-32, TR-25 to TR-27: price limits, in cents. Null means none.
alter table profile
  add column max_cost_cents_per_meal int
    check (max_cost_cents_per_meal between 100 and 100000),
  add column weekly_budget_cents int
    check (weekly_budget_cents between 100 and 100000);
