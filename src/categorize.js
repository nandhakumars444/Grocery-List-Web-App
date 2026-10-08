// Auto-category guesser for custom items typed via "Not on the list?".
// Works for Tamil script, English, and Tanglish (Tamil typed in English
// letters, e.g. "milagai thool", "thakkali", "vengayam").
//
// How it picks a category:
//  1. The name is cleaned: quantities/units ("2 kg", "500 gm", "கிலோ") are dropped.
//  2. Every keyword below that appears in the name is a candidate.
//  3. Score = keyword length, +50 if it matches the LAST word of the name.
//     The last word is the "head noun" in both English and Tamil, so
//     "mustard oil" -> oil, "கடலை மாவு" -> flour, "chilli sauce" -> sauce.
//  4. Longer / more specific keyword wins; ties go to the earlier category.
//
// Keyword prefixes:
//   '='  whole word only (for short words that would match inside others)
//   '~'  weak hint - only used if nothing stronger matches
//
// Tanglish spelling is folded before comparing (zh=l, th=t, dh=d, aa=a,
// ee=i, oo=u, doubled letters collapse), so "paruppu"/"parupu" and
// "dal"/"dhal" all match the same keyword.

const RAW = {
  pooja: [
    'சாம்பிராணி', 'சாம்பிரானி', 'சந்தனம்', 'குங்குமம்', 'ஊதுபத்தி', 'பத்தி', 'கற்பூரம்', 'சூடம்',
    'விபூதி', 'திருநீறு', 'விளக்கு திரி', '=திரி', 'பூஜை', 'பூசை', 'தீபம்',
    'sambrani', 'sambirani', 'loban', 'dhoop', 'dhoopam', 'sandalwood', 'sandal', 'chandan',
    'chandanam', 'kumkum', 'kungumam', 'agarbatti', 'agarbathi', 'incense', 'camphor',
    'karpooram', 'soodam', 'vibhuti', 'vibuthi', 'thiruneeru', 'pooja', 'puja', 'deepam',
    'lamp wick', 'wick', '=thiri', 'vilakku',
  ],
  masala: [
    'மிளகாய் தூள்', 'மிளகாய்த்தூள்', 'கொத்தமல்லி தூள்', 'மல்லி தூள்', 'மஞ்சள் தூள்', 'சாம்பார் பொடி',
    'ரசம் பொடி', 'மிளகாய் வற்றல்', 'மிளகாய்', 'வத்தல்', 'வற்றல்', 'மசாலா', 'மசால்', 'மிளகு', 'சீரகம்',
    'சோம்பு', 'பெருஞ்சீரகம்', 'பட்டை', 'லவங்கம்', 'லவுங்கம்', 'கிராம்பு', 'ஏலக்காய்', 'ஜாதிக்காய்',
    'ஜாதிபத்திரி', 'கடுகு', 'வெந்தயம்', 'புளி', 'மஞ்சள்', 'பெருங்காயம்', 'கசகசா', 'தனியா', '=மல்லி',
    'அன்னாசிப்பூ', 'எள்ளு', 'மராட்டி மொக்கு', 'மொக்கு', 'பிரிஞ்சி இலை', 'பிரியாணி இலை', 'ஊறுகாய்', 'சாஸ்', 'கெட்சப்', '=எள்', '~தூள்', '~பொடி',
    'chilli', 'chili', 'chilly', 'milagai', 'mulagai', 'milagu', 'pepper', 'cumin', 'jeera', 'jeeragam',
    'seeragam', 'fennel', 'sombu', 'saunf', 'cinnamon', 'pattai', 'cloves', 'clove', 'lavangam',
    'kirambu', 'cardamom', 'elaichi', 'yelakkai', 'elakkai', 'mustard', 'kadugu', 'fenugreek',
    'vendhayam', 'venthayam', 'methi seeds', 'tamarind', 'puli', 'turmeric', 'manjal', 'asafoetida',
    'hing', 'perungayam', 'coriander seeds', 'dhania', 'thaniya', 'masala', 'garam masala',
    'sambar powder', 'rasam powder', 'podi', 'thool', 'poppy', 'kasakasa', 'star anise', 'bay leaf',
    'nutmeg', 'jathikai', 'sesame', 'ellu', 'marathi moggu', 'moggu', 'pickle', 'oorugai', 'curry powder', 'spice', 'spices', 'sauce', 'ketchup',
    'mayonnaise', '~powder',
  ],
  dal: [
    'பருப்பு', 'பயறு', 'பயிறு', 'பயிர்', 'கடலை', 'கொண்டைக்கடலை', 'வேர்க்கடலை', 'நிலக்கடலை', 'உளுந்து',
    'உளுத்தம்', 'துவரை', 'கொள்ளு', 'காராமணி', 'தட்டைப்பயறு', 'மொச்சை', 'சோயா', 'ராஜ்மா', 'பட்டாணி',
    'பாசிப்பயறு', 'பச்சைப்பயறு',
    'dal', 'dhal', 'paruppu', 'lentil', 'lentils', 'pulses', 'chana', 'channa', 'kadalai', 'chickpea',
    'chickpeas', 'peanut', 'peanuts', 'groundnut', 'verkadalai', 'nilakadalai', 'moong', 'mung', 'toor',
    'tuvar', 'thuvar', 'urad', 'ulundhu', 'ulutham', 'masoor', 'rajma', 'kidney beans', 'green gram',
    'black gram', 'horse gram', 'bengal gram', 'kollu', 'payaru', 'payiru', 'payir', 'karamani', 'cowpea',
    'soya', 'soybean', 'mochai', 'dried peas', 'pattani', 'white peas',
  ],
  rice: [
    'அரிசி', 'பச்சரிசி', 'புழுங்கல்', '=அவல்', 'சிறுதானியம்', 'தானியம்', 'தானியங்கள்', 'கம்பு', 'கேழ்வரகு',
    'ராகி', 'சோளம்', 'திணை', 'வரகு', 'சாமை', 'குதிரைவாலி', 'பொன்னி', 'பாஸ்மதி', 'ஜவ்வரிசி', 'ஓட்ஸ்', 'சாதம்',
    'rice', 'arisi', 'pacharisi', 'ponni', 'basmati', 'sona masoori', 'poha', '=aval', 'millet', 'millets',
    'ragi', 'kambu', 'kelvaragu', 'cholam', 'jowar', 'bajra', 'thinai', 'varagu', 'samai', 'oats', 'sago',
    'javvarisi', 'jawarisi', 'grain', 'grains',
  ],
  flour: [
    'மாவு', 'ரவை', 'சேமியா', 'மைதா', 'ஆட்டா', 'கோதுமை', 'உப்புமா', 'கடலை மாவு', 'இடியாப்பம்', 'புட்டு',
    'flour', 'maida', 'atta', 'besan', 'rava', 'ravai', 'sooji', 'suji', 'semolina', 'semiya', 'vermicelli',
    'mavu', 'wheat', 'corn flour', 'cornflour', 'upma', 'idiyappam', 'puttu',
  ],
  salt_sugar: [
    'உப்பு', 'கல் உப்பு', 'சர்க்கரை', 'சீனி', 'வெல்லம்', 'கருப்பட்டி', 'கற்கண்டு', 'பனங்கற்கண்டு', '=தேன்',
    'salt', 'uppu', 'kalluppu', 'sugar', 'sakkarai', 'sarkarai', 'seeni', 'jaggery', 'vellam', 'karupatti',
    'kalkandu', 'candy sugar', 'honey', 'palm sugar', 'sweetener',
  ],
  oil: [
    'எண்ணெ', 'எண்ணை', 'ண்ணெய்', 'ண்ணை',
    'oil', 'ennai', 'ennei', 'nallennai', 'gingelly', 'sunflower', 'vanaspati', 'dalda',
  ],
  dairy: [
    'நெய்', '=பால்', 'தயிர்', '=மோர்', 'வெண்ணெய்', 'பனீர்', 'சீஸ்', 'பால் பவுடர்', 'பால்பவுடர்',
    'milk', 'paal', 'curd', 'thayir', 'yogurt', 'yoghurt', 'buttermilk', '=mor', 'butter', 'venna', 'ghee',
    'nei', 'paneer', 'cheese', 'cream', 'milk powder', 'condensed milk', 'amul', 'aavin', 'nandini',
  ],
  meat: [
    'இறைச்சி', 'கோழி', 'சிக்கன்', 'மட்டன்', 'ஆட்டிறைச்சி', 'ஆட்டுக்கறி', 'மாட்டிறைச்சி', 'பன்றி', 'மீன்',
    'முட்டை', 'இறால்', 'நண்டு', 'கருவாடு', '=கறி', '=ஆடு', 'நாட்டுக்கோழி', 'பிராய்லர்',
    'chicken', 'mutton', 'fish', 'egg', 'eggs', 'prawn', 'prawns', 'shrimp', 'crab', 'meat', 'beef', 'pork',
    'lamb', 'keema', 'kheema', 'dry fish', 'karuvadu', 'meen', 'muttai', 'kozhi', 'irachi', '=kari',
    'sardine', 'seer fish', 'tuna', 'squid', 'turkey', 'bacon', 'sausage',
  ],
  beverages: [
    'தேநீர்', '=டீ', 'டீதூள்', 'டீ தூள்', 'தேயிலை', 'காபி', 'காப்பி', 'பானம்', 'குளிர்பானம்', 'ஜூஸ்', 'சோடா',
    'பூஸ்ட்', 'ஹார்லிக்ஸ்', 'போர்ன்விட்டா', 'நன்னாரி', 'சர்பத்',
    'tea', 'chai', 'coffee', 'kaapi', 'nescafe', 'bru', 'horlicks', 'boost', 'bournvita', 'complan', 'milo',
    'juice', 'cola', 'pepsi', 'coke', 'soda', 'squash', 'sharbat', 'sarbath', 'nannari', 'drink', 'drinks',
    'drinking water',
  ],
  snacks: [
    'பிஸ்கட்', 'பிஸ்கெட்', 'மேகி', 'அப்பளம்', 'வடாம்', 'முறுக்கு', 'மிக்சர்', 'சிப்ஸ்', 'சாக்லேட்', 'சாக்லெட்',
    'மிட்டாய்', 'ஜாம்', 'நூடுல்ஸ்', 'பாஸ்தா', 'பிரட்', 'பிரெட்', '=பன்', 'ரஸ்க்', 'கேக்', 'பாப்கார்ன்', 'பொரி',
    'தட்டை', 'சீடை', 'லட்டு', 'அல்வா', 'இனிப்பு', 'தின்பண்டம்', 'ஐஸ் கிரீம்',
    'biscuit', 'biscuits', 'cookies', 'cookie', 'maggi', 'noodles', 'pasta', 'chips', 'chocolate', 'choco',
    'candy', 'candies', 'sweet', 'sweets', 'mixture', 'murukku', 'namkeen', 'papad', 'appalam', 'vadam',
    'bread', '=bun', 'rusk', 'cake', 'cracker', 'crackers', 'popcorn', 'jam', 'ice cream', 'peanut butter',
    'cornflakes', 'kurkure', 'lays', 'parle', 'britannia', 'oreo', 'snack', 'snacks', 'wafers', 'toffee',
    'chikki', 'halwa', 'laddu', 'sev', 'bhujia',
  ],
  produce: [
    'பழம்', 'கிழங்கு', 'காய்கறி', 'காய்கறிகள்', '~காய்', 'வெங்காயம்', 'தக்காளி', 'உருளை', 'கத்தரி', 'கத்திரி',
    'வெண்டை', 'முருங்கை', 'கேரட்', 'பீட்ரூட்', 'பீன்ஸ்', 'முட்டைகோஸ்', '=கோஸ்', 'காலிஃபிளவர்', 'காலிபிளவர்',
    'கொத்தமல்லி', 'கறிவேப்பிலை', 'கருவேப்பிலை', 'புதினா', 'பச்சை மிளகாய்', 'இஞ்சி', 'பூண்டு', 'எலுமிச்சை',
    'எலுமிச்சம்', 'தேங்காய்', 'தேங்காய் பால்', 'வாழை', 'ஆப்பிள்', 'ஆரஞ்சு', 'திராட்சை', 'பப்பாளி', 'கொய்யா',
    'மாதுளை', 'தர்பூசணி', 'அன்னாசி', 'அவரை', 'கொத்தவரங்காய்', 'பாகற்காய்', 'புடலங்காய்', 'சுரைக்காய்',
    'பூசணி', 'பரங்கி', 'முள்ளங்கி', 'குடைமிளகாய்', 'கீரை', 'வெள்ளரி', 'முந்திரி', 'பாதாம்', 'பிஸ்தா',
    'உலர் திராட்சை', 'பேரிச்சை', 'பேரிச்சம்', 'பேரீச்சை', 'பச்சை பட்டாணி', 'காளான்', 'இஞ்சி பூண்டு பேஸ்ட்',
    'fruit', 'fruits', 'vegetable', 'vegetables', '=veg', 'potato', 'onion', 'tomato', 'garlic', 'ginger',
    'lemon', 'lime', 'coconut', 'coconut milk', 'banana', 'plantain', 'apple', 'orange', 'grapes', 'mango',
    'papaya', 'guava', 'pomegranate', 'watermelon', 'melon', 'pineapple', 'carrot', 'beetroot', 'beans',
    'cabbage', 'cauliflower', 'brinjal', 'eggplant', 'okra', 'ladies finger', 'drumstick', 'cucumber',
    'pumpkin', 'gourd', 'radish', 'capsicum', 'bell pepper', 'spinach', 'keerai', 'greens', 'coriander',
    'curry leaves', 'karuveppilai', '=mint', 'pudina', 'green chilli', 'green chili', 'corn', 'sweet corn',
    'mushroom', 'sweet potato', '=yam', 'raw banana', 'cashew', 'almond', 'raisins', 'dates', 'walnut',
    'pistachio', 'dry fruits', 'nuts', 'green peas', 'peas', 'thakkali', 'vengayam', 'urulai', 'kizhangu',
    'poondu', 'inji', 'elumichai', 'thengai', 'vazhai', 'vazhaipazham', 'pazham', 'murungai', 'kathirikai',
    'vendakkai', 'avarakkai', 'kothamalli', 'mullangi', 'poosani', 'pavakkai', 'pudalangai', 'suraikkai',
    'garlic paste', 'ginger paste', 'ginger garlic paste',
  ],
  household: [
    'பேஸ்ட்', 'பிரஷ்', 'சோப்பு', 'சோப்', 'ஷாம்பு', 'ஷாம்பூ', 'சலவை', 'டிடர்ஜென்ட்', 'பாத்திரம்', '=விம்',
    'துடைப்பம்', 'ஹார்பிக்', 'பினாயில்', 'கொசு', 'தீப்பெட்டி', 'மெழுகுவர்த்தி', 'பேட்டரி', 'பல்பு', 'டிஷ்யூ',
    'நாப்கின்', 'டயபர்', 'அமிர்தான்சன்', '=பாம்', 'முகப்பூச்சு', 'ஃபேஸ் கிரீம்', 'டால்கம்', 'குப்பை',
    'தலை எண்ணெய்', 'முடி எண்ணெய்', 'முகம்', 'முகத்', 'ஃபேஸ் பவுடர்', 'பேஸ் பவுடர்', '~பவுடர்',
    'toothpaste', 'tooth paste', 'toothbrush', 'soap', 'shampoo', 'conditioner', 'detergent',
    'washing powder', 'washing soap', 'dish wash', 'dishwash', '=vim', 'harpic', 'phenyl', 'floor cleaner',
    'cleaner', 'hand wash', 'handwash', 'sanitizer', 'tissue', 'napkin', 'napkins', 'diaper', 'broom', 'mop',
    'bucket', 'matchbox', 'match box', 'candle', 'battery', 'bulb', 'garbage bag', 'foil', 'balm',
    'face wash', 'face cream', 'face powder', 'turmeric cream', 'talcum', 'deodorant', 'perfume', 'razor', 'blade', '=comb',
    'mosquito', 'coil', 'colgate', 'pepsodent', 'closeup', 'lifebuoy', '=lux', 'dettol', 'savlon',
    'amrutanjan', 'vicks', '=surf', 'surf excel', '=rin', 'ariel', 'tide', 'hair oil', 'sunsilk',
    'clinic plus', 'vatika',
  ],
}

// Order here decides ties, and matches the CATEGORIES order in items.js.
const CATEGORY_ORDER = [
  'pooja', 'masala', 'dal', 'rice', 'flour', 'salt_sugar', 'oil', 'dairy', 'meat',
  'beverages', 'snacks', 'produce', 'household',
]

const TAMIL_RE = /[\u0B80-\u0BFF]/

// Units / filler that should not influence the category.
const IGNORE_TOKENS = new Set([
  'kg', 'kgs', 'g', 'gm', 'gms', 'gram', 'grams', 'ml', 'l', 'ltr', 'ltrs', 'litre', 'litres', 'liter',
  'liters', 'pcs', 'pc', 'packet', 'packets', 'pkt', 'nos', 'no', 'dozen', 'doz', 'pack', 'bottle',
  'கிலோ', 'கிராம்', 'லிட்டர்', 'பாக்கெட்', 'பாட்டில்', 'எண்',
])

function foldTamil(s) {
  // NFC + treat long/short ூ/ு and ீ/ி as the same (common typing slips).
  return s.normalize('NFC').replace(/\u0BC2/g, '\u0BC1').replace(/\u0BC0/g, '\u0BBF')
}

function foldLatin(s) {
  return s
    .toLowerCase()
    .replace(/zh/g, 'l')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/sh/g, 's')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/ii/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/uu/g, 'u')
    .replace(/([b-df-hj-np-tv-z])\1+/g, '$1')
}

function foldWord(w) {
  return TAMIL_RE.test(w) ? foldTamil(w) : foldLatin(w)
}

function tokenize(name) {
  return (name || '')
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t))
    .filter((t) => !IGNORE_TOKENS.has(t.toLowerCase()))
    .map(foldWord)
}

// Compile the keyword table once.
const COMPILED = []
CATEGORY_ORDER.forEach((cat, catIndex) => {
  ;(RAW[cat] || []).forEach((rawKw) => {
    let kw = rawKw
    let exact = false
    let weak = false
    if (kw[0] === '=') {
      exact = true
      kw = kw.slice(1)
    } else if (kw[0] === '~') {
      weak = true
      kw = kw.slice(1)
    }
    const words = kw.split(/\s+/).map(foldWord)
    COMPILED.push({
      cat,
      catIndex,
      exact,
      weak,
      tamil: TAMIL_RE.test(kw),
      words,
      phrase: words.join(' '),
      len: words.join(' ').length,
    })
  })
})

function tokenMatches(kw, token) {
  const w = kw.words[0]
  if (kw.tamil) {
    return kw.exact ? token === w : token.includes(w)
  }
  if (kw.exact || w.length <= 3) return token === w || token === w + 's'
  if (w.length === 4) return token === w || token.startsWith(w)
  return token.includes(w)
}

function score(kw, tokens, joined) {
  if (kw.words.length === 1) {
    let matched = false
    let atEnd = false
    tokens.forEach((t, i) => {
      if (tokenMatches(kw, t)) {
        matched = true
        if (i === tokens.length - 1) atEnd = true
      }
    })
    if (!matched) return 0
    if (kw.weak) return 1
    return kw.len + (atEnd ? 50 : 0)
  }
  // Multi-word keyword: phrase must start at a word boundary.
  if (!(' ' + joined).includes(' ' + kw.phrase)) return 0
  if (kw.weak) return 1
  return kw.len + (joined.endsWith(kw.phrase) ? 50 : 0)
}

const cache = new Map()

// Returns a category id (e.g. 'dal', 'produce') or null if nothing matches.
export function guessCategory(name) {
  const key = name || ''
  if (cache.has(key)) return cache.get(key)

  const tokens = tokenize(key)
  const joined = tokens.join(' ')
  let best = null
  let bestScore = 0
  let bestCatIndex = Infinity

  for (const kw of COMPILED) {
    const s = score(kw, tokens, joined)
    if (s > bestScore || (s === bestScore && s > 0 && kw.catIndex < bestCatIndex)) {
      best = kw.cat
      bestScore = s
      bestCatIndex = kw.catIndex
    }
  }

  cache.set(key, best)
  return best
}
