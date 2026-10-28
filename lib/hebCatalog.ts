// H-E-B price table (TR-16): estimated package sizes and prices for common
// ingredients at an Austin H-E-B, and the store section each is shelved in.
// These are rough 2026 estimates; prices Jadon enters from receipts replace
// them (step 17). A food is matched to the most specific entry whose words
// all appear in its name ("chicken breast" beats "chicken"). On a tie, a
// variety beats a generic word ("mozzarella cheese" is mozzarella, not
// cheese; "chicken bouillon" is bouillon, not chicken).

import type { StoreSection } from "@/lib/db/types";

export type CatalogItem = {
  // Words the food's name must contain, e.g. "garlic powder".
  match: string;
  // The product to buy.
  name: string;
  section: StoreSection;
  packageGrams: number;
  priceCents: number;
};

type Row = [string, string, StoreSection, number, number];

const LB = 454;
const OZ = 28.35;

// [match, product, section, package grams, price in cents]
const ROWS: Row[] = [
  // Produce
  ["onion", "Yellow onions, 3 lb bag", "produce", 3 * LB, 299],
  ["red onion", "Red onion, each", "produce", 280, 125],
  ["green onion", "Green onions, bunch", "produce", 110, 79],
  ["scallion", "Green onions, bunch", "produce", 110, 79],
  ["shallot", "Shallots, 8 oz", "produce", 8 * OZ, 249],
  ["garlic", "Garlic, 3 ct", "produce", 150, 199],
  ["ginger", "Fresh ginger root", "produce", 100, 99],
  ["tomato", "Roma tomatoes, per lb", "produce", LB, 129],
  ["cherry tomato", "Cherry tomatoes, 10 oz", "produce", 10 * OZ, 248],
  ["potato", "Russet potatoes, 5 lb bag", "produce", 5 * LB, 399],
  ["sweet potato", "Sweet potatoes, per lb", "produce", LB, 119],
  ["carrot", "Carrots, 2 lb bag", "produce", 2 * LB, 179],
  ["celery", "Celery, bunch", "produce", 900, 149],
  ["bell pepper", "Bell pepper, each", "produce", 170, 99],
  ["red bell pepper", "Red bell pepper, each", "produce", 170, 149],
  ["jalapeno", "Jalapeños, per lb", "produce", LB, 149],
  ["jalapeño", "Jalapeños, per lb", "produce", LB, 149],
  ["serrano", "Serrano peppers, per lb", "produce", LB, 199],
  ["poblano", "Poblano peppers, per lb", "produce", LB, 199],
  ["broccoli", "Broccoli crowns, per lb", "produce", LB, 179],
  ["cauliflower", "Cauliflower, each", "produce", 840, 299],
  ["spinach", "Baby spinach, 5 oz", "produce", 5 * OZ, 249],
  ["kale", "Kale, bunch", "produce", 280, 149],
  ["lettuce", "Romaine hearts, 3 ct", "produce", 570, 349],
  ["romaine", "Romaine hearts, 3 ct", "produce", 570, 349],
  ["cabbage", "Green cabbage, per lb", "produce", LB, 69],
  ["zucchini", "Zucchini, per lb", "produce", LB, 149],
  ["squash", "Yellow squash, per lb", "produce", LB, 149],
  ["cucumber", "Cucumber, each", "produce", 300, 69],
  ["mushroom", "White mushrooms, 8 oz", "produce", 8 * OZ, 199],
  ["avocado", "Hass avocado, each", "produce", 170, 99],
  ["corn", "Sweet corn, each", "produce", 250, 60],
  ["green bean", "Green beans, per lb", "produce", LB, 199],
  ["asparagus", "Asparagus, per lb", "produce", LB, 299],
  ["eggplant", "Eggplant, each", "produce", 450, 149],
  ["cilantro", "Cilantro, bunch", "produce", 60, 59],
  ["parsley", "Parsley, bunch", "produce", 60, 79],
  ["basil", "Fresh basil, 0.75 oz", "produce", 21, 199],
  ["mint", "Fresh mint, 0.75 oz", "produce", 21, 199],
  ["lime", "Limes, each", "produce", 67, 25],
  ["lemon", "Lemons, each", "produce", 100, 59],
  ["banana", "Bananas, per lb", "produce", LB, 55],
  ["apple", "Gala apples, 3 lb bag", "produce", 3 * LB, 449],
  ["orange", "Navel oranges, 4 lb bag", "produce", 4 * LB, 549],
  ["mango", "Mango, each", "produce", 336, 79],
  ["pineapple", "Pineapple, each", "produce", 900, 249],
  ["strawberry", "Strawberries, 1 lb", "produce", LB, 299],
  ["blueberry", "Blueberries, 1 pint", "produce", 340, 399],
  ["raspberry", "Raspberries, 6 oz", "produce", 6 * OZ, 349],
  ["berry", "Mixed berries, 12 oz frozen", "frozen", 12 * OZ, 399],
  ["grape", "Grapes, per lb", "produce", LB, 249],

  // Meat and seafood
  ["chicken", "Chicken thighs, boneless, per lb", "meat_seafood", LB, 349],
  [
    "chicken breast",
    "Chicken breasts, boneless skinless, per lb",
    "meat_seafood",
    LB,
    399,
  ],
  [
    "chicken thigh",
    "Chicken thighs, boneless skinless, per lb",
    "meat_seafood",
    LB,
    349,
  ],
  ["chicken drumstick", "Chicken drumsticks, per lb", "meat_seafood", LB, 179],
  ["chicken wing", "Chicken wings, per lb", "meat_seafood", LB, 399],
  ["ground chicken", "Ground chicken, 1 lb", "meat_seafood", LB, 499],
  ["ground turkey", "Ground turkey 93/7, 1 lb", "meat_seafood", LB, 549],
  ["turkey", "Sliced turkey breast, 8 oz", "meat_seafood", 8 * OZ, 449],
  ["ground beef", "Ground beef 80/20, per lb", "meat_seafood", LB, 549],
  ["beef", "Beef chuck roast, per lb", "meat_seafood", LB, 799],
  ["steak", "Sirloin steak, per lb", "meat_seafood", LB, 999],
  ["flank steak", "Flank steak, per lb", "meat_seafood", LB, 1099],
  ["skirt steak", "Skirt steak, per lb", "meat_seafood", LB, 1199],
  ["pork", "Pork shoulder, per lb", "meat_seafood", LB, 299],
  ["pork chop", "Pork chops, boneless, per lb", "meat_seafood", LB, 449],
  ["pork tenderloin", "Pork tenderloin, per lb", "meat_seafood", LB, 499],
  ["ground pork", "Ground pork, 1 lb", "meat_seafood", LB, 449],
  ["bacon", "Bacon, 12 oz", "meat_seafood", 12 * OZ, 599],
  ["sausage", "Smoked sausage, 14 oz", "meat_seafood", 14 * OZ, 449],
  ["chorizo", "Pork chorizo, 9 oz", "meat_seafood", 9 * OZ, 199],
  ["ham", "Sliced ham, 9 oz", "meat_seafood", 9 * OZ, 449],
  ["salmon", "Atlantic salmon fillet, per lb", "meat_seafood", LB, 999],
  ["tilapia", "Tilapia fillets, per lb", "meat_seafood", LB, 599],
  ["cod", "Cod fillets, per lb", "meat_seafood", LB, 999],
  ["shrimp", "Raw shrimp, 2 lb frozen", "frozen", 2 * LB, 1599],
  ["tuna", "Chunk light tuna, 5 oz can", "pantry", 142, 119],

  // Dairy and eggs
  ["egg", "Large eggs, 12 ct", "dairy_eggs", 600, 349],
  ["egg white", "Liquid egg whites, 32 oz", "dairy_eggs", 907, 549],
  ["milk", "Whole milk, 1 gallon", "dairy_eggs", 3785, 379],
  ["butter", "Unsalted butter, 1 lb", "dairy_eggs", LB, 499],
  ["cheese", "Shredded cheddar, 8 oz", "dairy_eggs", 8 * OZ, 299],
  ["cheddar", "Shredded cheddar, 8 oz", "dairy_eggs", 8 * OZ, 299],
  ["mozzarella", "Shredded mozzarella, 8 oz", "dairy_eggs", 8 * OZ, 299],
  ["monterey jack", "Shredded Monterey Jack, 8 oz", "dairy_eggs", 8 * OZ, 299],
  ["parmesan", "Grated Parmesan, 6 oz", "dairy_eggs", 6 * OZ, 449],
  ["feta", "Crumbled feta, 6 oz", "dairy_eggs", 6 * OZ, 399],
  ["cotija", "Cotija cheese, 10 oz", "dairy_eggs", 10 * OZ, 399],
  ["queso fresco", "Queso fresco, 10 oz", "dairy_eggs", 10 * OZ, 349],
  ["cream cheese", "Cream cheese, 8 oz", "dairy_eggs", 8 * OZ, 199],
  ["cottage cheese", "Cottage cheese, 16 oz", "dairy_eggs", LB, 349],
  ["ricotta", "Ricotta, 15 oz", "dairy_eggs", 15 * OZ, 349],
  ["sour cream", "Sour cream, 16 oz", "dairy_eggs", LB, 229],
  ["heavy cream", "Heavy whipping cream, 16 oz", "dairy_eggs", 473, 399],
  ["cream", "Heavy whipping cream, 16 oz", "dairy_eggs", 473, 399],
  ["half and half", "Half and half, 1 pint", "dairy_eggs", 473, 249],
  ["yogurt", "Plain yogurt, 32 oz", "dairy_eggs", 907, 349],
  ["greek yogurt", "Plain Greek yogurt, 32 oz", "dairy_eggs", 907, 549],
  ["tofu", "Firm tofu, 14 oz", "produce", 14 * OZ, 199],
  ["tortilla", "Flour tortillas, 10 ct", "bakery", 450, 249],
  ["corn tortilla", "Corn tortillas, 30 ct", "bakery", 30 * 26, 249],

  // Bakery
  ["bread", "Sandwich bread, 20 oz", "bakery", 20 * OZ, 249],
  ["whole wheat bread", "Whole wheat bread, 20 oz", "bakery", 20 * OZ, 279],
  ["bun", "Hamburger buns, 8 ct", "bakery", 400, 249],
  ["pita", "Pita bread, 6 ct", "bakery", 340, 279],
  ["naan", "Naan, 2 ct", "bakery", 255, 349],
  ["bagel", "Bagels, 6 ct", "bakery", 570, 299],
  ["baguette", "French baguette", "bakery", 280, 199],

  // Pantry
  ["rice", "Long grain white rice, 5 lb", "pantry", 5 * LB, 449],
  ["brown rice", "Brown rice, 2 lb", "pantry", 2 * LB, 249],
  ["jasmine rice", "Jasmine rice, 5 lb", "pantry", 5 * LB, 799],
  ["basmati rice", "Basmati rice, 2 lb", "pantry", 2 * LB, 549],
  ["instant rice", "Instant white rice, 28 oz", "pantry", 28 * OZ, 449],
  ["quinoa", "Quinoa, 16 oz", "pantry", LB, 449],
  ["pasta", "Spaghetti, 16 oz", "pantry", LB, 129],
  ["spaghetti", "Spaghetti, 16 oz", "pantry", LB, 129],
  ["penne", "Penne, 16 oz", "pantry", LB, 129],
  ["noodle", "Egg noodles, 12 oz", "pantry", 12 * OZ, 199],
  ["rice noodle", "Rice noodles, 14 oz", "pantry", 14 * OZ, 299],
  ["ramen", "Ramen noodles, 6 ct", "pantry", 6 * 85, 199],
  ["oat", "Old fashioned oats, 42 oz", "pantry", 42 * OZ, 499],
  ["flour", "All-purpose flour, 5 lb", "pantry", 5 * LB, 349],
  ["cornstarch", "Cornstarch, 16 oz", "pantry", LB, 199],
  ["sugar", "Granulated sugar, 4 lb", "pantry", 4 * LB, 399],
  ["brown sugar", "Light brown sugar, 2 lb", "pantry", 2 * LB, 299],
  ["honey", "Honey, 12 oz", "pantry", 12 * OZ, 499],
  ["maple syrup", "Maple syrup, 12 oz", "pantry", 12 * OZ, 799],
  ["peanut butter", "Creamy peanut butter, 16 oz", "pantry", LB, 249],
  ["black bean", "Black beans, 15 oz can", "pantry", 425, 99],
  ["pinto bean", "Pinto beans, 15 oz can", "pantry", 425, 99],
  ["kidney bean", "Kidney beans, 15 oz can", "pantry", 425, 99],
  ["refried bean", "Refried beans, 16 oz can", "pantry", LB, 129],
  ["bean", "Pinto beans, 15 oz can", "pantry", 425, 99],
  ["chickpea", "Chickpeas, 15 oz can", "pantry", 425, 99],
  ["garbanzo", "Chickpeas, 15 oz can", "pantry", 425, 99],
  ["lentil", "Dry lentils, 16 oz", "pantry", LB, 179],
  ["diced tomato", "Diced tomatoes, 14.5 oz can", "pantry", 411, 99],
  ["crushed tomato", "Crushed tomatoes, 28 oz can", "pantry", 28 * OZ, 229],
  ["tomato sauce", "Tomato sauce, 8 oz can", "pantry", 8 * OZ, 59],
  ["tomato paste", "Tomato paste, 6 oz can", "pantry", 6 * OZ, 79],
  ["marinara", "Marinara sauce, 24 oz", "pantry", 24 * OZ, 299],
  ["salsa", "Salsa, 16 oz", "pantry", LB, 299],
  ["enchilada sauce", "Red enchilada sauce, 10 oz can", "pantry", 10 * OZ, 179],
  ["green chile", "Diced green chiles, 4 oz can", "pantry", 4 * OZ, 129],
  ["chipotle", "Chipotle peppers in adobo, 7 oz can", "pantry", 7 * OZ, 179],
  ["coconut milk", "Coconut milk, 13.5 oz can", "pantry", 400, 199],
  ["chicken broth", "Chicken broth, 32 oz", "pantry", 946, 249],
  ["chicken stock", "Chicken stock, 32 oz", "pantry", 946, 249],
  ["beef broth", "Beef broth, 32 oz", "pantry", 946, 249],
  ["vegetable broth", "Vegetable broth, 32 oz", "pantry", 946, 249],
  ["broth", "Chicken broth, 32 oz", "pantry", 946, 249],
  ["almond milk", "Almond milk, half gallon", "dairy_eggs", 1890, 299],
  ["almond", "Whole almonds, 16 oz", "pantry", LB, 699],
  ["walnut", "Walnut halves, 8 oz", "pantry", 8 * OZ, 499],
  ["peanut", "Roasted peanuts, 16 oz", "pantry", LB, 349],
  ["cashew", "Cashews, 8 oz", "pantry", 8 * OZ, 549],
  ["chia seed", "Chia seeds, 12 oz", "pantry", 12 * OZ, 499],
  ["sesame seed", "Sesame seeds, 2 oz", "spices_staples", 2 * OZ, 249],
  ["granola", "Granola, 12 oz", "pantry", 12 * OZ, 399],
  ["raisin", "Raisins, 12 oz", "pantry", 12 * OZ, 299],
  [
    "chocolate chip",
    "Semi-sweet chocolate chips, 12 oz",
    "pantry",
    12 * OZ,
    349,
  ],
  ["protein powder", "Whey protein powder, 2 lb", "pantry", 2 * LB, 2999],
  ["water", "Tap water", "pantry", 1000, 0],

  // Oils, sauces and condiments
  ["olive oil", "Extra virgin olive oil, 16.9 oz", "spices_staples", 460, 699],
  ["oil", "Vegetable oil, 48 oz", "spices_staples", 1300, 399],
  ["sesame oil", "Toasted sesame oil, 5 oz", "spices_staples", 140, 349],
  ["coconut oil", "Coconut oil, 14 oz", "spices_staples", 14 * OZ, 549],
  ["cooking spray", "Cooking spray, 6 oz", "spices_staples", 6 * OZ, 299],
  ["soy sauce", "Soy sauce, 15 oz", "spices_staples", 15 * OZ, 299],
  ["fish sauce", "Fish sauce, 6.8 oz", "spices_staples", 200, 299],
  ["oyster sauce", "Oyster sauce, 9 oz", "spices_staples", 9 * OZ, 299],
  ["hoisin", "Hoisin sauce, 8.5 oz", "spices_staples", 240, 299],
  ["sriracha", "Sriracha, 17 oz", "spices_staples", 17 * OZ, 449],
  ["hot sauce", "Hot sauce, 12 oz", "spices_staples", 12 * OZ, 199],
  ["vinegar", "White vinegar, 32 oz", "spices_staples", 946, 179],
  ["rice vinegar", "Rice vinegar, 12 oz", "spices_staples", 355, 299],
  [
    "apple cider vinegar",
    "Apple cider vinegar, 32 oz",
    "spices_staples",
    946,
    299,
  ],
  ["balsamic", "Balsamic vinegar, 16.9 oz", "spices_staples", 500, 399],
  ["mustard", "Yellow mustard, 14 oz", "spices_staples", 14 * OZ, 129],
  ["dijon", "Dijon mustard, 12 oz", "spices_staples", 12 * OZ, 299],
  ["ketchup", "Ketchup, 32 oz", "spices_staples", 32 * OZ, 299],
  ["mayonnaise", "Mayonnaise, 30 oz", "spices_staples", 30 * OZ, 549],
  ["mayo", "Mayonnaise, 30 oz", "spices_staples", 30 * OZ, 549],
  [
    "worcestershire",
    "Worcestershire sauce, 10 oz",
    "spices_staples",
    10 * OZ,
    249,
  ],
  ["bbq sauce", "Barbecue sauce, 18 oz", "spices_staples", 18 * OZ, 249],
  ["barbecue sauce", "Barbecue sauce, 18 oz", "spices_staples", 18 * OZ, 249],
  ["curry paste", "Red curry paste, 4 oz", "spices_staples", 4 * OZ, 349],
  ["olive", "Sliced black olives, 2.25 oz can", "pantry", 64, 129],

  // Two-word names whose words would otherwise match another product
  ["egg noodle", "Egg noodles, 12 oz", "pantry", 12 * OZ, 199],
  ["grape tomato", "Grape tomatoes, 10 oz", "produce", 10 * OZ, 248],
  ["flour tortilla", "Flour tortillas, 10 ct", "bakery", 450, 249],
  ["bean sprout", "Bean sprouts, 12 oz", "produce", 12 * OZ, 199],
  ["snap pea", "Sugar snap peas, 8 oz", "produce", 8 * OZ, 299],
  ["ground chuck", "Ground chuck 80/20, per lb", "meat_seafood", LB, 549],
  ["avocado oil", "Avocado oil, 16.9 oz", "spices_staples", 460, 899],
  ["peanut oil", "Peanut oil, 24 oz", "spices_staples", 680, 549],
  ["almond butter", "Almond butter, 12 oz", "pantry", 12 * OZ, 699],
  ["beef stock", "Beef stock, 32 oz", "pantry", 946, 249],
  ["vegetable stock", "Vegetable stock, 32 oz", "pantry", 946, 249],
  ["stock", "Chicken stock, 32 oz", "pantry", 946, 249],
  ["corn starch", "Cornstarch, 16 oz", "pantry", LB, 199],
  ["frozen corn", "Frozen sweet corn, 12 oz", "frozen", 12 * OZ, 149],
  [
    "cream of chicken",
    "Cream of chicken soup, 10.5 oz can",
    "pantry",
    298,
    149,
  ],
  [
    "cream of mushroom",
    "Cream of mushroom soup, 10.5 oz can",
    "pantry",
    298,
    149,
  ],
  ["bouillon", "Chicken bouillon cubes, 25 ct", "spices_staples", 100, 249],
  ["pepper jack", "Pepper Jack cheese, 8 oz", "dairy_eggs", 8 * OZ, 299],
  ["garlic salt", "Garlic salt, 4.75 oz", "spices_staples", 135, 199],
  ["tortilla chip", "Tortilla chips, 13 oz", "pantry", 13 * OZ, 299],
  ["oat milk", "Oat milk, half gallon", "dairy_eggs", 1890, 399],
  ["buttermilk", "Buttermilk, 1 quart", "dairy_eggs", 946, 199],
  ["tomatillo", "Tomatillos, per lb", "produce", LB, 199],
  [
    "fire roasted tomato",
    "Fire roasted diced tomatoes, 14.5 oz can",
    "pantry",
    411,
    149,
  ],
  [
    "rotel",
    "Diced tomatoes and green chiles, 10 oz can",
    "pantry",
    10 * OZ,
    129,
  ],
  ["fresh thyme", "Fresh thyme, 0.75 oz", "produce", 21, 199],
  ["fresh rosemary", "Fresh rosemary, 0.75 oz", "produce", 21, 199],
  ["lime juice", "Lime juice, 15 oz", "pantry", 15 * OZ, 249],
  ["lemon juice", "Lemon juice, 15 oz", "pantry", 15 * OZ, 249],

  // Spices and staples
  ["salt", "Iodized salt, 26 oz", "spices_staples", 26 * OZ, 99],
  ["black pepper", "Ground black pepper, 3 oz", "spices_staples", 3 * OZ, 349],
  ["pepper", "Ground black pepper, 3 oz", "spices_staples", 3 * OZ, 349],
  ["garlic powder", "Garlic powder, 3 oz", "spices_staples", 3 * OZ, 199],
  ["onion powder", "Onion powder, 2.6 oz", "spices_staples", 74, 199],
  ["cumin", "Ground cumin, 2 oz", "spices_staples", 2 * OZ, 249],
  ["chili powder", "Chili powder, 2.5 oz", "spices_staples", 71, 199],
  ["paprika", "Paprika, 2.5 oz", "spices_staples", 71, 249],
  ["smoked paprika", "Smoked paprika, 2 oz", "spices_staples", 2 * OZ, 349],
  ["cayenne", "Ground cayenne, 2 oz", "spices_staples", 2 * OZ, 249],
  ["red pepper flake", "Crushed red pepper, 1.5 oz", "spices_staples", 43, 199],
  ["oregano", "Dried oregano, 0.75 oz", "spices_staples", 21, 199],
  ["thyme", "Dried thyme, 0.75 oz", "spices_staples", 21, 249],
  ["rosemary", "Dried rosemary, 1 oz", "spices_staples", OZ, 249],
  ["bay leaf", "Bay leaves, 0.12 oz", "spices_staples", 3.4, 249],
  ["cinnamon", "Ground cinnamon, 2.4 oz", "spices_staples", 68, 199],
  ["nutmeg", "Ground nutmeg, 1.1 oz", "spices_staples", 31, 349],
  ["turmeric", "Ground turmeric, 1.4 oz", "spices_staples", 40, 299],
  ["curry powder", "Curry powder, 1.75 oz", "spices_staples", 50, 299],
  ["garam masala", "Garam masala, 1.8 oz", "spices_staples", 51, 399],
  ["coriander", "Ground coriander, 1.25 oz", "spices_staples", 35, 299],
  [
    "italian seasoning",
    "Italian seasoning, 0.75 oz",
    "spices_staples",
    21,
    199,
  ],
  ["taco seasoning", "Taco seasoning, 1 oz packet", "spices_staples", OZ, 79],
  ["vanilla", "Vanilla extract, 2 oz", "spices_staples", 59, 599],
  ["baking powder", "Baking powder, 8.1 oz", "spices_staples", 230, 199],
  ["baking soda", "Baking soda, 16 oz", "spices_staples", LB, 129],
];

// Single words that name a whole family of products. They're listed after
// everything else, so on a tie the variety wins (matching keeps the first).
const GENERIC = new Set([
  "chicken",
  "beef",
  "pork",
  "turkey",
  "cheese",
  "cream",
  "milk",
  "butter",
  "egg",
  "oil",
  "pepper",
  "salt",
  "bean",
  "rice",
  "corn",
  "tomato",
  "onion",
  "garlic",
  "avocado",
  "peanut",
  "almond",
  "olive",
  "broth",
  "stock",
  "noodle",
  "pasta",
  "tortilla",
  "bread",
  "lime",
  "lemon",
  "berry",
  "sugar",
  "vinegar",
]);

export const HEB_CATALOG: readonly CatalogItem[] = [
  ...ROWS.filter(([match]) => !GENERIC.has(match)),
  ...ROWS.filter(([match]) => GENERIC.has(match)),
].map(([match, name, section, packageGrams, priceCents]) => ({
  match,
  name,
  section,
  packageGrams: Math.round(packageGrams),
  priceCents,
}));

// Default price per gram and package size for a food the catalog doesn't
// know, by store section.
export const SECTION_DEFAULTS: Record<
  StoreSection,
  { centsPerGram: number; packageGrams: number }
> = {
  produce: { centsPerGram: 0.45, packageGrams: LB },
  meat_seafood: { centsPerGram: 1.3, packageGrams: LB },
  dairy_eggs: { centsPerGram: 0.9, packageGrams: LB },
  bakery: { centsPerGram: 0.6, packageGrams: LB },
  pantry: { centsPerGram: 0.6, packageGrams: LB },
  spices_staples: { centsPerGram: 4, packageGrams: 60 },
  frozen: { centsPerGram: 0.7, packageGrams: LB },
};

// "Tomatoes," → "tomato"; "berries" → "berry". Rough on purpose: it only
// has to make a food's words line up with the catalog's.
function singular(word: string): string {
  if (word === "leaves") return "leaf";
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("oes")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss"))
    return word.slice(0, -1);
  return word;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zñé\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

// The most specific catalog entry whose words all appear in the food's
// name, or null.
export function matchCatalog(foodName: string): CatalogItem | null {
  const have = new Set(words(foodName));
  let best: CatalogItem | null = null;
  let bestWords = 0;
  for (const item of HEB_CATALOG) {
    const need = words(item.match);
    if (need.length > bestWords && need.every((w) => have.has(w))) {
      best = item;
      bestWords = need.length;
    }
  }
  return best;
}

// Words that place a food the catalog doesn't know in a section.
const SECTION_HINTS: [StoreSection, string[]][] = [
  ["frozen", ["frozen"]],
  [
    "meat_seafood",
    [
      "fish",
      "fillet",
      "lamb",
      "veal",
      "crab",
      "scallop",
      "meat",
      "chuck",
      "sirloin",
      "bison",
      "venison",
      "brisket",
    ],
  ],
  ["dairy_eggs", ["cheese", "milk", "cream", "yogurt"]],
  [
    "spices_staples",
    ["ground", "dried", "seasoning", "spice", "extract", "sauce"],
  ],
  ["bakery", ["roll", "loaf", "croissant", "muffin"]],
  ["produce", ["fresh", "leaf", "pepper", "green", "root", "sprout"]],
];

// The store section for a food the catalog doesn't know; pantry by default.
export function guessSection(foodName: string): StoreSection {
  const have = new Set(words(foodName));
  for (const [section, hints] of SECTION_HINTS) {
    if (hints.some((h) => have.has(h))) return section;
  }
  return "pantry";
}

export type EstimatedProduct = {
  name: string;
  section: StoreSection;
  packageGrams: number;
  priceCents: number;
};

// The H-E-B product to price a food with: its catalog entry, or an estimate
// from its section's default price per gram.
export function estimateProduct(foodName: string): EstimatedProduct {
  const item = matchCatalog(foodName);
  if (item) {
    // "frozen spinach" is priced like spinach but shelved with the frozen
    // food.
    const frozen =
      item.section === "produce" && words(foodName).includes("frozen");
    return {
      name: item.name,
      section: frozen ? "frozen" : item.section,
      packageGrams: item.packageGrams,
      priceCents: item.priceCents,
    };
  }
  const section = guessSection(foodName);
  const { centsPerGram, packageGrams } = SECTION_DEFAULTS[section];
  return {
    name: `${foodName} (estimated)`,
    section,
    packageGrams,
    priceCents: Math.round(centsPerGram * packageGrams),
  };
}
