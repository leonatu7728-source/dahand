// Static data: modes, meals, credit prices.
window.DAHAND_DATA = {
  modes: {
    office:     { accent: "#2F5BEA", icon: "briefcase" },
    home:       { accent: "#C2410C", icon: "home" },
    freelancer: { accent: "#0F766E", icon: "pen" },
    artist:     { accent: "#BE185D", icon: "mic" }
  },
  modeOrder: ["office", "home", "freelancer", "artist"],

  // Credit price per AI action (see business doc).
  cost: { standard: 4, smart: 8 },

  // Price test (no real payment yet). Edit freely. Store prices later come from RevenueCat.
  // packs: credits sold + bonus credits; prices per currency are in the same order.
  pricing: {
    plusCredits: 300, freeCredits: 20,
    packs: [{ n: 100, bonus: 0 }, { n: 300, bonus: 50 }, { n: 800, bonus: 200 }],
    USD: { plus_m: 7.99, plus_y: 59.99, packs: [2.99, 8.99, 19.99] },
    GBP: { plus_m: 6.99, plus_y: 54.99, packs: [2.49, 7.49, 16.99] },
    EUR: { plus_m: 7.99, plus_y: 59.99, packs: [2.99, 8.99, 19.99] },
    VND: { plus_m: 49000, plus_y: 399000, packs: [29000, 89000, 199000] }
  },

  // Approximate calories per serving (estimates for demo purposes).
  meals: [
    { id: "oats",     kcal: 350, type: "breakfast", en: "Oatmeal with banana and peanut butter", vi: "Yến mạch chuối bơ đậu phộng", ing: ["oats", "banana", "peanut_butter", "milk"] },
    { id: "omelette", kcal: 320, type: "breakfast", en: "Veggie omelette with toast",            vi: "Trứng ốp rau củ với bánh mì nướng", ing: ["eggs", "spinach", "tomato", "bread"] },
    { id: "yogurt",   kcal: 230, type: "breakfast", en: "Greek yogurt with berries",              vi: "Sữa chua Hy Lạp với quả mọng", ing: ["yogurt", "berries", "honey"] },
    { id: "smoothie", kcal: 260, type: "snack",     en: "Banana spinach smoothie",                vi: "Sinh tố chuối rau bina", ing: ["banana", "spinach", "milk"] },
    { id: "salad",    kcal: 420, type: "lunch",     en: "Grilled chicken salad",                  vi: "Salad gà nướng", ing: ["chicken", "lettuce", "tomato", "olive_oil"] },
    { id: "pho",      kcal: 450, type: "lunch",     en: "Beef pho",                               vi: "Phở bò", ing: ["rice_noodles", "beef", "herbs", "onion"] },
    { id: "banhmi",   kcal: 500, type: "lunch",     en: "Chicken banh mi",                        vi: "Bánh mì gà", ing: ["bread", "chicken", "pickled_veg", "herbs"] },
    { id: "wrap",     kcal: 450, type: "lunch",     en: "Turkey and hummus wrap",                 vi: "Cuốn gà tây sốt hummus", ing: ["tortilla", "turkey", "hummus", "lettuce"] },
    { id: "lentil",   kcal: 330, type: "lunch",     en: "Lentil and vegetable soup",              vi: "Súp đậu lăng rau củ", ing: ["lentils", "carrot", "onion", "tomato"] },
    { id: "salmon",   kcal: 600, type: "dinner",    en: "Salmon, rice and greens",                vi: "Cá hồi, cơm và rau xanh", ing: ["salmon", "rice", "broccoli"] },
    { id: "tofu",     kcal: 480, type: "dinner",    en: "Tofu vegetable stir-fry with rice",      vi: "Đậu phụ xào rau với cơm", ing: ["tofu", "rice", "broccoli", "carrot"] },
    { id: "pasta",    kcal: 650, type: "dinner",    en: "Spaghetti bolognese",                    vi: "Mì Ý sốt bò bằm", ing: ["pasta", "beef", "tomato", "onion"] },
    { id: "curry",    kcal: 680, type: "dinner",    en: "Chicken curry with rice",                vi: "Cà ri gà với cơm", ing: ["chicken", "rice", "coconut_milk", "onion"] },
    { id: "potato",   kcal: 450, type: "dinner",    en: "Baked potato with beans and cheese",     vi: "Khoai tây nướng với đậu và phô mai", ing: ["potato", "beans", "cheese"] },
    { id: "fishsoup", kcal: 380, type: "dinner",    en: "Fish and vegetable soup with rice",      vi: "Canh cá rau với cơm", ing: ["fish", "rice", "tomato", "herbs"] },
    { id: "fruit",    kcal: 150, type: "snack",     en: "Apple with a handful of almonds",        vi: "Táo và một nắm hạnh nhân", ing: ["apple", "almonds"] }
  ],

  ingredients: {
    oats: ["Oats", "Yến mạch"], banana: ["Bananas", "Chuối"], peanut_butter: ["Peanut butter", "Bơ đậu phộng"],
    milk: ["Milk", "Sữa"], eggs: ["Eggs", "Trứng"], spinach: ["Spinach", "Rau bina"], tomato: ["Tomatoes", "Cà chua"],
    bread: ["Bread", "Bánh mì"], yogurt: ["Greek yogurt", "Sữa chua Hy Lạp"], berries: ["Berries", "Quả mọng"],
    honey: ["Honey", "Mật ong"], chicken: ["Chicken", "Thịt gà"], lettuce: ["Lettuce", "Xà lách"],
    olive_oil: ["Olive oil", "Dầu ô liu"], rice_noodles: ["Rice noodles", "Bánh phở"], beef: ["Beef", "Thịt bò"],
    herbs: ["Fresh herbs", "Rau thơm"], onion: ["Onions", "Hành"], pickled_veg: ["Pickled vegetables", "Đồ chua"],
    tortilla: ["Tortillas", "Bánh tortilla"], turkey: ["Turkey slices", "Thịt gà tây"], hummus: ["Hummus", "Sốt hummus"],
    lentils: ["Lentils", "Đậu lăng"], carrot: ["Carrots", "Cà rốt"], salmon: ["Salmon", "Cá hồi"], rice: ["Rice", "Gạo"],
    broccoli: ["Broccoli", "Bông cải xanh"], tofu: ["Tofu", "Đậu phụ"], pasta: ["Spaghetti", "Mì Ý"],
    coconut_milk: ["Coconut milk", "Nước cốt dừa"], potato: ["Potatoes", "Khoai tây"], beans: ["Baked beans", "Đậu sốt"],
    cheese: ["Cheese", "Phô mai"], fish: ["Fish fillet", "Cá phi lê"], apple: ["Apples", "Táo"], almonds: ["Almonds", "Hạnh nhân"]
  }
};
