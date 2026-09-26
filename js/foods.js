// Food knowledge: categories, emoji, sensible defaults, and ingredient matching.

export const CATEGORIES = [
  { id: "produce", label: "Produce", emoji: "🥬" },
  { id: "dairy", label: "Dairy & Eggs", emoji: "🧀" },
  { id: "meat", label: "Meat & Seafood", emoji: "🍗" },
  { id: "bakery", label: "Bread & Grains", emoji: "🍞" },
  { id: "pantry", label: "Pantry Staples", emoji: "🥫" },
  { id: "spices", label: "Spices & Seasonings", emoji: "🧂" },
  { id: "sauces", label: "Sauces & Condiments", emoji: "🫙" },
  { id: "frozen", label: "Frozen", emoji: "🧊" },
  { id: "snacks", label: "Snacks", emoji: "🍿" },
  { id: "drinks", label: "Drinks", emoji: "🧃" },
  { id: "other", label: "Other", emoji: "🛍️" },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES.at(-1);

export const LOCATIONS = [
  { id: "fridge", label: "Fridge", emoji: "🧊" },
  { id: "freezer", label: "Freezer", emoji: "❄️" },
  { id: "pantry", label: "Pantry", emoji: "🗄️" },
];

export const CUISINES = [
  "Indian", "Italian", "Mexican", "Chinese", "Japanese", "Thai", "Korean", "Vietnamese",
  "Mediterranean", "Middle Eastern", "American", "French", "Breakfast", "Dessert", "Other",
];
const CUISINE_EMOJI = {
  indian: "🍛", italian: "🍝", mexican: "🌮", chinese: "🥡", japanese: "🍣", thai: "🍜",
  korean: "🍲", vietnamese: "🍜", mediterranean: "🫒", "middle eastern": "🧆", american: "🍔",
  french: "🥐", breakfast: "🥞", dessert: "🍰",
};
export const cuisineEmoji = (c) => CUISINE_EMOJI[(c || "").toLowerCase()] || "🍽️";

// [keywords, emoji, category, mode] — first keyword match wins, so specific names go first.
// mode "level" = shown as a fill gauge (milk, rice, oil); "count" = shown as a number (tomatoes, eggs).
const FOODS = [
  [["ice cream"], "🍨", "frozen", "level"],
  [["eggplant", "aubergine", "brinjal"], "🍆", "produce", "count"],
  [["sweet potato"], "🍠", "produce", "count"],
  [["chili powder", "chilli powder", "chili flakes", "red pepper flakes", "cayenne"], "🌶️", "spices", "level"],
  [["lentil", "dal", "chickpea", "chana", "beans", "rajma"], "🫘", "pantry", "level"],
  [["almond milk", "oat milk", "soy milk", "coconut milk"], "🥛", "dairy", "level"],
  [["milk"], "🥛", "dairy", "level"],
  [["egg"], "🥚", "dairy", "count"],
  [["butter"], "🧈", "dairy", "level"],
  [["cheese", "paneer", "mozzarella", "parmesan", "cheddar", "feta"], "🧀", "dairy", "count"],
  [["yogurt", "yoghurt", "curd", "dahi"], "🥣", "dairy", "level"],
  [["cream"], "🥛", "dairy", "level"],
  [["cherry tomato", "tomato"], "🍅", "produce", "count"],
  [["potato"], "🥔", "produce", "count"],
  [["green onion", "scallion", "spring onion"], "🧅", "produce", "count"],
  [["onion", "shallot"], "🧅", "produce", "count"],
  [["garlic"], "🧄", "produce", "count"],
  [["ginger"], "🫚", "produce", "count"],
  [["carrot"], "🥕", "produce", "count"],
  [["broccoli", "cauliflower"], "🥦", "produce", "count"],
  [["bell pepper", "capsicum"], "🫑", "produce", "count"],
  [["chili", "chilli", "jalapeno", "jalapeño"], "🌶️", "produce", "count"],
  [["cucumber"], "🥒", "produce", "count"],
  [["corn"], "🌽", "produce", "count"],
  [["mushroom"], "🍄", "produce", "count"],
  [["avocado"], "🥑", "produce", "count"],
  [["lettuce", "spinach", "kale", "cabbage", "greens", "arugula", "bok choy"], "🥬", "produce", "count"],
  [["cilantro", "coriander leaves", "basil", "mint", "parsley", "dill", "curry leaves"], "🌿", "produce", "count"],
  [["lemon", "lime"], "🍋", "produce", "count"],
  [["banana"], "🍌", "produce", "count"],
  [["apple"], "🍎", "produce", "count"],
  [["orange", "clementine", "mandarin"], "🍊", "produce", "count"],
  [["grape"], "🍇", "produce", "level"],
  [["strawberr", "berries", "blueberr", "raspberr"], "🍓", "produce", "level"],
  [["mango"], "🥭", "produce", "count"],
  [["pineapple"], "🍍", "produce", "count"],
  [["peach", "nectarine"], "🍑", "produce", "count"],
  [["watermelon", "melon"], "🍉", "produce", "count"],
  [["peas", "green bean", "snap pea"], "🫛", "produce", "level"],
  [["chicken"], "🍗", "meat", "count"],
  [["bacon"], "🥓", "meat", "count"],
  [["beef", "steak", "ground meat", "mince", "lamb", "pork", "sausage"], "🥩", "meat", "count"],
  [["shrimp", "prawn"], "🍤", "meat", "count"],
  [["fish", "salmon", "tuna", "cod", "tilapia"], "🐟", "meat", "count"],
  [["tofu", "tempeh"], "🧈", "meat", "count"],
  [["bread", "bun", "bagel"], "🍞", "bakery", "count"],
  [["tortilla", "wrap", "naan", "roti", "pita"], "🫓", "bakery", "count"],
  [["rice"], "🍚", "pantry", "level"],
  [["pasta", "spaghetti", "penne", "noodle", "macaroni", "ramen"], "🍝", "pantry", "count"],
  [["flour", "atta", "besan"], "🌾", "pantry", "level"],
  [["oat", "cereal", "granola"], "🥣", "pantry", "level"],
  [["sugar"], "🍬", "pantry", "level"],
  [["honey"], "🍯", "pantry", "level"],
  [["oil", "ghee"], "🫒", "pantry", "level"],
  [["nut", "almond", "cashew", "peanut", "walnut"], "🥜", "snacks", "level"],
  [["salt"], "🧂", "spices", "level"],
  [["pepper", "cumin", "turmeric", "masala", "paprika", "cinnamon", "oregano", "chili powder", "spice", "seasoning", "cardamom", "clove"], "🧂", "spices", "level"],
  [["ketchup", "mustard", "mayo", "soy sauce", "sauce", "salsa", "vinegar", "dressing", "paste", "pesto", "chutney", "pickle"], "🫙", "sauces", "level"],
  [["frozen"], "🧊", "frozen", "count"],
  [["chip", "cracker", "cookie", "chocolate", "popcorn"], "🍪", "snacks", "count"],
  [["coffee"], "☕", "drinks", "level"],
  [["tea"], "🍵", "drinks", "level"],
  [["juice"], "🧃", "drinks", "level"],
  [["soda", "water", "sparkling", "beer", "wine", "kombucha"], "🥤", "drinks", "count"],
];

function lookup(name) {
  const n = (name || "").toLowerCase();
  return FOODS.find(([keys]) => keys.some((k) => n.includes(k)));
}
export const guessEmoji = (name) => lookup(name)?.[1] || "🍽️";
export const guessCategory = (name) => lookup(name)?.[2] || "other";
export const guessMode = (name) => lookup(name)?.[3] || "count";
export const guessLocation = (name, category) => {
  const n = (name || "").toLowerCase();
  if (category === "frozen" || n.includes("frozen") || n.includes("ice cream")) return "freezer";
  if (["pantry", "spices", "snacks", "bakery"].includes(category)) return "pantry";
  if (["onion", "potato", "garlic", "banana"].some((k) => n.includes(k))) return "pantry";
  return "fridge";
};

// ---------- Ingredient matching ----------

const STOP = new Set(`a an the of and or to for into with without plus about more extra
cup cups c tbsp tbs tablespoon tablespoons tsp teaspoon teaspoons g gram grams kg ml l liter litre
oz ounce ounces lb lbs pound pounds pinch dash can cans jar jars package packages packet pack
bunch bunches handful slice slices piece pieces stick sticks sprig sprigs clove cloves head heads
inch large small medium big fresh freshly chopped diced minced sliced grated crushed peeled
cooked uncooked boneless skinless whole halved cubed finely roughly thinly coarsely taste
optional divided packed heaping level cut room temperature washed drained rinsed softened melted
beaten x as needed garnish serving`.split(/\s+/));

function singular(w) {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes") || w.endsWith("ches") || w.endsWith("shes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function coreTokens(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(singular);
}

// True when any pantry item covers the ingredient (either side's key words contain the other's).
export function makeMatcher(pantryNames) {
  const pantry = pantryNames.map(coreTokens).filter((t) => t.length);
  return (ingredientText) => {
    const t = coreTokens(ingredientText);
    if (!t.length) return true;
    return pantry.some((p) => p.every((w) => t.includes(w)) || t.every((w) => p.includes(w)));
  };
}

export const isOptional = (text) => /\boptional\b/i.test(text || "");
