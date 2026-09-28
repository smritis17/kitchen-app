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
beaten x as needed garnish serving shredded crumbled toasted roasted deseeded seeded trimmed pitted
mashed soaked julienned quartered torn sifted loosely lightly firmly generous good quality homemade`.split(/\s+/));

function singular(w) {
  if (w.length <= 3) return w;
  if (/(ea|oa|al)ves$/.test(w)) return w.slice(0, -3) + "f"; // leaves → leaf, halves → half
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes") || w.endsWith("ches") || w.endsWith("shes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const baseText = (text) => (text || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "") // jalapeño → jalapeno
  .replace(/\(.*?\)/g, " ")
  .replace(/'/g, "")
  .replace(/[^a-z\s]/g, " ");

// Key words of a food name, used for display and simple comparisons.
export function coreTokens(text) {
  return baseText(text).split(/\s+/).filter((w) => w && !STOP.has(w)).map(singular);
}

// ---------- Same food, different names ----------

// Multi-word names → one shared name. Plurals of each variant are matched too.
const PHRASES = [
  [["coriander leaves", "coriander leaf", "fresh coriander", "chinese parsley", "dhania leaves", "dhaniya leaves", "dhania", "dhaniya", "cilantro leaves"], "cilantro"],
  [["coriander powder", "ground coriander", "dhania powder", "coriander seed powder"], "ground coriander"],
  [["spring onion", "green onion", "scallion", "salad onion"], "scallion"],
  [["garbanzo bean", "garbanzo", "kabuli chana", "chole", "chick pea"], "chickpea"],
  [["chana dal", "bengal gram", "split chickpea"], "chanadal"],
  [["besan", "gram flour", "chickpea flour", "garbanzo flour"], "chickpea flour"],
  [["capsicum", "sweet pepper", "bell pepper"], "bell pepper"],
  [["heavy whipping cream", "whipping cream", "double cream", "thickened cream", "heavy cream"], "heavy cream"],
  [["half and half", "single cream", "light cream"], "light cream"],
  [["cream cheese"], "creamcheese"],
  [["ground beef", "minced beef", "beef mince", "hamburger meat"], "ground beef"],
  [["minced meat", "mince meat", "keema", "kheema"], "ground meat"],
  [["all purpose flour", "plain flour", "maida", "ap flour", "white flour"], "flour"],
  [["whole wheat flour", "wholemeal flour", "whole meal flour", "atta", "chapati flour", "chapatti flour"], "wheat flour"],
  [["cornflour", "corn starch", "cornstarch", "maize starch"], "cornstarch"],
  [["icing sugar", "powdered sugar", "confectioners sugar", "confectioner sugar"], "powderedsugar"],
  [["caster sugar", "castor sugar", "superfine sugar", "granulated sugar", "white sugar"], "sugar"],
  [["baking soda", "bicarbonate of soda", "bicarb soda", "bicarb", "sodium bicarbonate"], "bakingsoda"],
  [["red pepper flake", "chili flake", "chilli flake", "crushed red pepper", "red chili flake", "red chilli flake", "crushed chili"], "chiliflake"],
  [["red chili powder", "red chilli powder", "lal mirch powder", "kashmiri chili powder", "kashmiri chilli powder", "kashmiri mirch"], "chili powder"],
  [["green chilli", "green chili", "hari mirch", "thai chili", "bird eye chili", "birds eye chili"], "green chili"],
  [["cumin powder", "ground cumin", "jeera powder"], "ground cumin"],
  [["cumin seed", "jeera"], "cumin"],
  [["turmeric powder", "haldi powder", "haldi", "ground turmeric"], "turmeric"],
  [["cinnamon powder", "ground cinnamon"], "ground cinnamon"],
  [["cardamom powder", "ground cardamom", "elaichi powder"], "ground cardamom"],
  [["ground ginger", "dry ginger", "ginger powder", "sonth"], "ginger powder"],
  [["ginger garlic paste", "ginger and garlic paste"], "ginger garlic"],
  [["garlic paste"], "garlic"],
  [["ginger paste"], "ginger"],
  [["lemon juice"], "lemon"],
  [["lime juice"], "lime"],
  [["cocoa powder", "cacao powder", "unsweetened cocoa"], "cocoa"],
  [["vanilla extract", "vanilla essence", "pure vanilla"], "vanilla"],
  [["kidney bean", "rajma", "red kidney bean"], "kidney bean"],
  [["toor dal", "toovar dal", "tuvar dal", "arhar dal", "pigeon pea"], "toor dal"],
  [["masoor dal", "red lentil", "split red lentil"], "masoor dal"],
  [["moong dal", "mung dal", "split mung", "yellow moong dal"], "moong dal"],
  [["mung bean", "green gram", "whole moong", "sabut moong"], "mung bean"],
  [["urad dal", "black gram", "split urad"], "urad dal"],
  [["string bean", "french bean", "snap bean", "runner bean"], "green bean"],
  [["snow pea", "mangetout", "sugar snap pea", "snap pea"], "snow pea"],
  [["soya sauce", "shoyu", "light soy sauce"], "soy sauce"],
  [["clarified butter", "desi ghee"], "ghee"],
  [["passata", "tomato puree", "strained tomato"], "tomato puree"],
  [["bread crumb", "breadcrumb", "panko"], "breadcrumb"],
  [["extra virgin olive oil", "evoo", "virgin olive oil"], "olive oil"],
  [["vegetable oil", "canola oil", "sunflower oil", "cooking oil", "neutral oil", "rapeseed oil", "corn oil", "refined oil"], "vegetable oil"],
  [["black peppercorn", "peppercorn", "ground black pepper", "kali mirch"], "black pepper"],
  [["parmigiano reggiano", "parmigiano", "parmesan cheese"], "parmesan"],
  [["monterey jack", "pepper jack"], "jack cheese"],
  [["rocket leaves", "rocket"], "arugula"],
  [["tomato ketchup", "catsup"], "ketchup"],
  [["mayo"], "mayonnaise"],
  [["bean curd", "tofu"], "tofu"],
  [["curd", "dahi", "yoghurt", "plain yogurt"], "yogurt"],
  [["brinjal", "aubergine", "baingan"], "eggplant"],
  [["courgette"], "zucchini"],
  [["beetroot"], "beet"],
  [["prawn"], "shrimp"],
  [["broth", "bouillon"], "stock"],
  [["methi leaves", "fenugreek leaves", "kasuri methi"], "fenugreek leaf"],
  [["methi seed", "fenugreek seed", "methi"], "fenugreek"],
  [["curry leaf", "curry leaves", "kadi patta", "kari patta"], "curry leaf"],
  [["elaichi"], "cardamom"],
  [["dalchini"], "cinnamon"],
  [["jaggery", "gur", "panela"], "jaggery"],
];
const PHRASE_RES = PHRASES
  .flatMap(([variants, canon]) => variants.map((v) => [v, canon]))
  .sort((a, b) => b[0].length - a[0].length) // longest first, so "chana dal" wins over "chana"
  .map(([v, canon]) => [new RegExp(`\\b${v.replace(/ /g, "\\s+")}(?:e?s)?\\b`, "g"), ` ${canon} `]);

// Single-word spellings → one name (applied after plurals are removed).
const WORD_SYN = {
  chilli: "chili", chile: "chili", chily: "chili", chilly: "chili", chille: "chili", mirch: "chili",
  leave: "leaf", chana: "chickpea", yoghurt: "yogurt",
};

// Specific kinds that also count as the general food ("cheddar" covers a recipe asking for "cheese").
const IMPLIES = {
  cheese: ["cheddar", "mozzarella", "parmesan", "feta", "gouda", "provolone", "brie", "gruyere", "halloumi", "manchego", "pecorino", "colby", "emmental", "swiss", "asiago", "jack"],
  pasta: ["spaghetti", "penne", "fusilli", "linguine", "fettuccine", "macaroni", "rigatoni", "farfalle", "rotini", "orzo", "tagliatelle", "pappardelle", "bucatini"],
  rice: ["basmati", "jasmine", "arborio"],
};
const IMPLIED_BY = Object.fromEntries(Object.entries(IMPLIES).flatMap(([general, kinds]) => kinds.map((k) => [k, general])));

// Words that turn a food into a different product: "tomato paste" isn't "tomatoes", "coconut milk" isn't "coconut".
const DISTINCT_FORMS = new Set(["paste", "puree", "juice", "milk", "butter", "cream", "water", "powder", "flour", "extract", "syrup", "jam", "sauce", "starch", "chip", "seed"]);
// Same, but the plain word alone still means "any kind": a recipe asking for "oil" is happy with olive oil.
const GENERIC_FORMS = new Set(["oil", "vinegar", "stock"]);
// Words that describe a dairy product rather than make a new one ("unsalted butter" is still butter).
const MODIFIERS = new Set(["whole", "skim", "skimmed", "low", "fat", "lowfat", "nonfat", "reduced", "full", "unsalted", "salted", "sweet", "cultured", "heavy", "light", "whipping", "double", "single", "thickened", "organic", "plain", "pure", "virgin", "dairy", "raw", "unsweetened", "sweetened", "ground", "black", "white", "red", "green", "yellow"]);

// Normalized key words for matching: shared names, product forms and general kinds applied.
export function matchTokens(text) {
  let s = ` ${baseText(text).replace(/\s+/g, " ")} `;
  for (const [re, canon] of PHRASE_RES) s = s.replace(re, canon);
  const words = s.split(/\s+/).filter((w) => w && !STOP.has(w)).map(singular).map((w) => WORD_SYN[w] || w);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = out[out.length - 1];
    if ((DISTINCT_FORMS.has(w) || GENERIC_FORMS.has(w)) && prev && !MODIFIERS.has(prev) && !prev.includes("-")) {
      out[out.length - 1] = `${prev}-${w}`; // "coconut milk" → one token "coconut-milk"
      if (GENERIC_FORMS.has(w)) out.push(w);
      continue;
    }
    out.push(w);
  }
  for (const w of [...out]) if (IMPLIED_BY[w] && !out.includes(IMPLIED_BY[w])) out.push(IMPLIED_BY[w]);
  return out;
}

// True when two names are the same food ("Scallions" and "green onion").
export const sameFood = (a, b) => {
  const x = matchTokens(a).sort().join(" "), y = matchTokens(b).sort().join(" ");
  return x !== "" && x === y;
};

// Plain water (hot, cold, boiling…) and ice are always on hand. "Coconut water" etc. still count.
const WATER_WORDS = new Set(["water", "ice", "cube", "hot", "warm", "cold", "boiling", "lukewarm", "tap", "filtered", "iced", "chilled"]);
const isPlainWater = (t) => t.some((w) => w === "water" || w === "ice") && t.every((w) => WATER_WORDS.has(w));

// True when any pantry item covers the ingredient (either side's key words contain the other's).
export function makeMatcher(pantryNames) {
  const pantry = pantryNames.map(matchTokens).filter((t) => t.length);
  const matches = (text) => {
    if (isPlainWater(coreTokens(text))) return true;
    const t = matchTokens(text);
    if (!t.length) return true;
    return pantry.some((p) => p.every((w) => t.includes(w)) || t.every((w) => p.includes(w)));
  };
  // "Butter or ghee", "water or broth": having any one of the options is enough.
  return (ingredientText) => (ingredientText || "").split(/\s+or\s+/i).some(matches);
}

export const isOptional = (text) => /\boptional\b/i.test(text || "");
