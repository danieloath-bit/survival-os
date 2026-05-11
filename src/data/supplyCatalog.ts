import type { SupplyCatalogItem } from '../types'

export const supplyCatalog = [
  {
    "id": "drinking-water-potable",
    "canonicalName": "Drinking water (potable)",
    "category": "water",
    "subcategory": "Water",
    "aliases": [
      "water",
      "drinking water",
      "potable water",
      "clean water",
      "fresh water",
      "safe water",
      "bottled water",
      "stored water",
      "stored potable water",
      "h2o"
    ],
    "tags": [
      "water",
      "hydration",
      "essential"
    ],
    "defaultUnit": "L",
    "valueType": "potable_water",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "water-purification-tablets",
    "canonicalName": "Water purification tablets",
    "category": "water",
    "subcategory": "Purification",
    "aliases": [
      "purification tablets",
      "water tablets",
      "water purifying tablets",
      "aqua tabs",
      "aquatabs",
      "chlorine tablets",
      "iodine tablets",
      "water disinfect tablets",
      "water cleaning tablets",
      "puri tabs"
    ],
    "tags": [
      "water",
      "purification",
      "filtering"
    ],
    "defaultUnit": "tablet",
    "valueType": "water_treatment",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "portable-water-filter",
    "canonicalName": "Water filter (portable)",
    "category": "water",
    "subcategory": "Filtration",
    "aliases": [
      "water filter",
      "portable water filter",
      "survival water filter",
      "lifestraw",
      "straw filter",
      "personal filter",
      "handheld filter",
      "drink filter"
    ],
    "tags": [
      "water",
      "filter",
      "portable"
    ],
    "defaultUnit": "unit",
    "valueType": "water_filter",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "gravity-water-filter",
    "canonicalName": "Water filter (gravity)",
    "category": "water",
    "subcategory": "Filtration",
    "aliases": [
      "gravity filter",
      "gravity water filter",
      "drip filter",
      "hanging water filter",
      "bucket filter",
      "family water filter"
    ],
    "tags": [
      "water",
      "filter",
      "base camp"
    ],
    "defaultUnit": "unit",
    "valueType": "water_filter",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "rigid-water-container",
    "canonicalName": "Water storage container (rigid)",
    "category": "water",
    "subcategory": "Storage",
    "aliases": [
      "water container",
      "water jerry can",
      "water jerry",
      "water drum",
      "water storage tank",
      "hard water container",
      "water canister"
    ],
    "tags": [
      "water",
      "storage"
    ],
    "defaultUnit": "L",
    "valueType": "unknown",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "collapsible-water-container",
    "canonicalName": "Water storage container (collapsible)",
    "category": "water",
    "subcategory": "Storage",
    "aliases": [
      "collapsible water container",
      "foldable water container",
      "soft water container",
      "camping water bag",
      "water bladder",
      "water cube"
    ],
    "tags": [
      "water",
      "storage",
      "portable"
    ],
    "defaultUnit": "L",
    "valueType": "unknown",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "canned-food-general",
    "canonicalName": "Canned food (general)",
    "category": "food",
    "subcategory": "Canned food",
    "aliases": [
      "canned food",
      "tinned food",
      "tins",
      "canned goods",
      "food cans",
      "non perishables",
      "long life food"
    ],
    "tags": [
      "food",
      "shelf stable"
    ],
    "defaultUnit": "can",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "canned-meat",
    "canonicalName": "Canned meat",
    "category": "food",
    "subcategory": "Canned food",
    "aliases": [
      "tinned meat",
      "meat tins",
      "spam",
      "corned beef",
      "canned chicken",
      "canned tuna",
      "canned salmon"
    ],
    "tags": [
      "food",
      "protein",
      "shelf stable"
    ],
    "defaultUnit": "can",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "rice",
    "canonicalName": "Dry grains (rice)",
    "category": "food",
    "subcategory": "Dry goods",
    "aliases": [
      "rice",
      "white rice",
      "brown rice",
      "long grain rice",
      "dry rice",
      "bag of rice"
    ],
    "tags": [
      "food",
      "carbs",
      "dry goods"
    ],
    "defaultUnit": "kg",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "pasta",
    "canonicalName": "Dry grains (pasta)",
    "category": "food",
    "subcategory": "Dry goods",
    "aliases": [
      "pasta",
      "dry pasta",
      "spaghetti",
      "macaroni",
      "penne",
      "noodles"
    ],
    "tags": [
      "food",
      "carbs",
      "dry goods"
    ],
    "defaultUnit": "kg",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "beans-dry",
    "canonicalName": "Beans (dry)",
    "category": "food",
    "subcategory": "Dry goods",
    "aliases": [
      "dry beans",
      "dried beans",
      "kidney beans",
      "black beans",
      "lentils",
      "split peas",
      "chickpeas"
    ],
    "tags": [
      "food",
      "protein",
      "dry goods"
    ],
    "defaultUnit": "kg",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "freeze-dried-meals",
    "canonicalName": "Freeze-dried meals",
    "category": "food",
    "subcategory": "Ready meals",
    "aliases": [
      "freeze dried food",
      "freeze dried meals",
      "survival meals",
      "camping meals",
      "hiking meals",
      "long life meals",
      "mountain house meals"
    ],
    "tags": [
      "food",
      "ready meal",
      "lightweight"
    ],
    "defaultUnit": "pack",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "mre",
    "canonicalName": "MRE (meal ready to eat)",
    "category": "food",
    "subcategory": "Ready meals",
    "aliases": [
      "mre",
      "mres",
      "meal ready to eat",
      "military meals",
      "ration pack",
      "ration packs",
      "army rations"
    ],
    "tags": [
      "food",
      "ready meal",
      "ration"
    ],
    "defaultUnit": "pack",
    "valueType": "calories",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "portable-stove",
    "canonicalName": "Portable stove",
    "category": "fuel",
    "subcategory": "Cooking",
    "aliases": [
      "camp stove",
      "camping stove",
      "portable cooker",
      "hiking stove",
      "gas stove",
      "survival stove"
    ],
    "tags": [
      "cooking",
      "camping"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "butane-fuel-canister",
    "canonicalName": "Butane fuel canister",
    "category": "fuel",
    "subcategory": "Fuel",
    "aliases": [
      "butane",
      "butane gas",
      "butane can",
      "butane bottle",
      "stove gas",
      "gas canister"
    ],
    "tags": [
      "fuel",
      "cooking"
    ],
    "defaultUnit": "can",
    "valueType": "fuel_canister",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "manual-can-opener",
    "canonicalName": "Manual can opener",
    "category": "fuel",
    "subcategory": "Tools",
    "aliases": [
      "can opener",
      "tin opener",
      "manual tin opener",
      "manual can opener"
    ],
    "tags": [
      "cooking",
      "tool"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "basic-first-aid-kit",
    "canonicalName": "First aid kit (basic)",
    "category": "medical",
    "subcategory": "Kits",
    "aliases": [
      "first aid kit",
      "basic first aid kit",
      "med kit",
      "medical kit",
      "emergency kit",
      "bandaid kit"
    ],
    "tags": [
      "medical",
      "first aid"
    ],
    "defaultUnit": "unit",
    "valueType": "medical",
    "isConsumable": false,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "adhesive-bandages",
    "canonicalName": "Bandages (adhesive)",
    "category": "medical",
    "subcategory": "Wound care",
    "aliases": [
      "bandaids",
      "band aids",
      "plasters",
      "adhesive strips",
      "sticky bandages",
      "wound strips"
    ],
    "tags": [
      "medical",
      "wound care"
    ],
    "defaultUnit": "unit",
    "valueType": "medical",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "pain-relief-medication",
    "canonicalName": "Pain relief medication",
    "category": "medical",
    "subcategory": "Medication",
    "aliases": [
      "painkillers",
      "pain killers",
      "pain meds",
      "paracetamol",
      "panadol",
      "ibuprofen",
      "nurofen",
      "aspirin"
    ],
    "tags": [
      "medical",
      "medication"
    ],
    "defaultUnit": "tablet",
    "valueType": "medical",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "n95-p2-face-masks",
    "canonicalName": "Face masks (P2/N95)",
    "category": "medical",
    "subcategory": "PPE",
    "aliases": [
      "n95 mask",
      "n95 masks",
      "p2 mask",
      "p2 masks",
      "respirator mask",
      "dust mask",
      "face mask",
      "medical mask"
    ],
    "tags": [
      "medical",
      "ppe",
      "respiratory"
    ],
    "defaultUnit": "unit",
    "valueType": "medical",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "tent",
    "canonicalName": "Tent",
    "category": "shelter",
    "subcategory": "Shelter",
    "aliases": [
      "tent",
      "camping tent",
      "survival tent",
      "shelter tent",
      "two person tent",
      "four person tent"
    ],
    "tags": [
      "shelter",
      "camping"
    ],
    "defaultUnit": "unit",
    "valueType": "shelter",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "tarp",
    "canonicalName": "Tarp shelter",
    "category": "shelter",
    "subcategory": "Shelter",
    "aliases": [
      "tarp",
      "tarpaulin",
      "shelter tarp",
      "rain tarp",
      "ground tarp",
      "shade tarp"
    ],
    "tags": [
      "shelter",
      "rain cover"
    ],
    "defaultUnit": "unit",
    "valueType": "shelter",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "sleeping-bag",
    "canonicalName": "Sleeping bag",
    "category": "shelter",
    "subcategory": "Sleep",
    "aliases": [
      "sleeping bag",
      "sleep bag",
      "camping sleeping bag",
      "cold weather bag",
      "winter sleeping bag"
    ],
    "tags": [
      "sleep",
      "warmth"
    ],
    "defaultUnit": "unit",
    "valueType": "shelter",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "multi-tool",
    "canonicalName": "Multi-tool",
    "category": "fuel",
    "subcategory": "Hand tools",
    "aliases": [
      "multitool",
      "multi tool",
      "leatherman",
      "swiss army knife",
      "all in one tool",
      "pocket tool"
    ],
    "tags": [
      "tool",
      "repair"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "duct-tape",
    "canonicalName": "Duct tape",
    "category": "tools",
    "subcategory": "Repair",
    "aliases": [
      "duct tape",
      "duck tape",
      "gaffer tape",
      "repair tape",
      "strong tape"
    ],
    "tags": [
      "repair",
      "tape"
    ],
    "defaultUnit": "roll",
    "valueType": "tool",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "disposable-lighter",
    "canonicalName": "Lighter (disposable)",
    "category": "tools",
    "subcategory": "Fire",
    "aliases": [
      "lighter",
      "bic lighter",
      "cheap lighter",
      "plastic lighter",
      "disposable lighter"
    ],
    "tags": [
      "fire",
      "ignition"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "ferro-rod",
    "canonicalName": "Ferro rod (fire starter)",
    "category": "tools",
    "subcategory": "Fire",
    "aliases": [
      "ferro rod",
      "fire steel",
      "firesteel",
      "spark rod",
      "striker",
      "magnesium rod",
      "flint striker"
    ],
    "tags": [
      "fire",
      "ignition"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "flashlight",
    "canonicalName": "Flashlight",
    "category": "tools",
    "subcategory": "Lighting",
    "aliases": [
      "flashlight",
      "torch",
      "led torch",
      "hand torch",
      "battery torch"
    ],
    "tags": [
      "light",
      "electric"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "headlamp",
    "canonicalName": "Headlamp",
    "category": "tools",
    "subcategory": "Lighting",
    "aliases": [
      "headlamp",
      "head lamp",
      "head torch",
      "head light",
      "wearable light"
    ],
    "tags": [
      "light",
      "hands free"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "aa-batteries",
    "canonicalName": "Batteries (AA)",
    "category": "tools",
    "subcategory": "Batteries",
    "aliases": [
      "aa batteries",
      "double a batteries",
      "aa cells",
      "aa battery"
    ],
    "tags": [
      "battery",
      "power"
    ],
    "defaultUnit": "cell",
    "valueType": "tool",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "two-way-radio",
    "canonicalName": "Two-way radio",
    "category": "communications",
    "subcategory": "Communication",
    "aliases": [
      "two way radio",
      "walkie talkie",
      "walkie-talkie",
      "handheld radio",
      "uhf radio",
      "cb radio"
    ],
    "tags": [
      "communication",
      "radio"
    ],
    "defaultUnit": "unit",
    "valueType": "communications",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "emergency-radio",
    "canonicalName": "Emergency radio (hand crank)",
    "category": "communications",
    "subcategory": "Communication",
    "aliases": [
      "emergency radio",
      "crank radio",
      "hand crank radio",
      "survival radio",
      "weather radio"
    ],
    "tags": [
      "communication",
      "radio",
      "emergency"
    ],
    "defaultUnit": "unit",
    "valueType": "communications",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "compass",
    "canonicalName": "Compass",
    "category": "communications",
    "subcategory": "Navigation",
    "aliases": [
      "compass",
      "navigation compass",
      "hiking compass",
      "map compass"
    ],
    "tags": [
      "navigation"
    ],
    "defaultUnit": "unit",
    "valueType": "navigation",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "toilet-paper",
    "canonicalName": "Toilet paper",
    "category": "hygiene",
    "subcategory": "Hygiene",
    "aliases": [
      "toilet paper",
      "tp",
      "loo roll",
      "toilet roll",
      "dunny paper"
    ],
    "tags": [
      "hygiene",
      "sanitation"
    ],
    "defaultUnit": "roll",
    "valueType": "hygiene",
    "isConsumable": true,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "wet-wipes",
    "canonicalName": "Wet wipes",
    "category": "hygiene",
    "subcategory": "Hygiene",
    "aliases": [
      "wet wipes",
      "wipes",
      "baby wipes",
      "cleaning wipes",
      "wet tissues"
    ],
    "tags": [
      "hygiene",
      "cleaning"
    ],
    "defaultUnit": "pack",
    "valueType": "hygiene",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "hand-sanitiser",
    "canonicalName": "Hand sanitiser",
    "category": "hygiene",
    "subcategory": "Hygiene",
    "aliases": [
      "hand sanitiser",
      "hand sanitizer",
      "sanitiser",
      "sanitizer",
      "hand gel",
      "alcohol gel"
    ],
    "tags": [
      "hygiene",
      "disinfectant"
    ],
    "defaultUnit": "mL",
    "valueType": "hygiene",
    "isConsumable": true,
    "isPerishable": true,
    "allowCustomAliases": true
  },
  {
    "id": "power-bank",
    "canonicalName": "Power bank",
    "category": "energy",
    "subcategory": "Battery",
    "aliases": [
      "power bank",
      "powerbank",
      "battery pack",
      "portable charger",
      "usb battery",
      "phone charger"
    ],
    "tags": [
      "power",
      "charging"
    ],
    "defaultUnit": "unit",
    "valueType": "power",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "portable-solar-panel",
    "canonicalName": "Solar panel (portable)",
    "category": "energy",
    "subcategory": "Solar",
    "aliases": [
      "solar panel",
      "portable solar panel",
      "folding solar panel",
      "solar charger",
      "solar usb"
    ],
    "tags": [
      "power",
      "solar"
    ],
    "defaultUnit": "unit",
    "valueType": "power",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "portable-generator",
    "canonicalName": "Generator (portable)",
    "category": "energy",
    "subcategory": "Generator",
    "aliases": [
      "generator",
      "portable generator",
      "genset",
      "backup generator",
      "petrol generator"
    ],
    "tags": [
      "power",
      "backup"
    ],
    "defaultUnit": "unit",
    "valueType": "power",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "bug-out-bag",
    "canonicalName": "Backpack (bug-out bag)",
    "category": "tools",
    "subcategory": "Carry",
    "aliases": [
      "backpack",
      "bug out bag",
      "bug-out bag",
      "bob",
      "go bag",
      "survival pack",
      "emergency bag"
    ],
    "tags": [
      "carry",
      "evacuation"
    ],
    "defaultUnit": "unit",
    "valueType": "tool",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "fuel-jerry-can",
    "canonicalName": "Jerry can (fuel)",
    "category": "tools",
    "subcategory": "Fuel storage",
    "aliases": [
      "jerry can",
      "fuel can",
      "petrol can",
      "gas can",
      "diesel can",
      "fuel container"
    ],
    "tags": [
      "fuel",
      "storage"
    ],
    "defaultUnit": "L",
    "valueType": "fuel_litres",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "cash-small-bills",
    "canonicalName": "Cash (small bills)",
    "category": "other",
    "subcategory": "Money",
    "aliases": [
      "cash",
      "money",
      "small notes",
      "emergency cash",
      "spare cash",
      "paper money"
    ],
    "tags": [
      "money",
      "documents"
    ],
    "defaultUnit": "unit",
    "valueType": "document",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  },
  {
    "id": "id-document-copies",
    "canonicalName": "ID documents (copies)",
    "category": "other",
    "subcategory": "Documents",
    "aliases": [
      "id copies",
      "identification copies",
      "passport copies",
      "licence copy",
      "license copy",
      "document copies",
      "important documents"
    ],
    "tags": [
      "documents",
      "identity"
    ],
    "defaultUnit": "unit",
    "valueType": "document",
    "isConsumable": false,
    "isPerishable": false,
    "allowCustomAliases": true
  }
] satisfies SupplyCatalogItem[]
