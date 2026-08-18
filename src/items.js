// This is the common items list used for the tap-to-select grid.
// Each item has:
//   ta       - the Tamil name (this is what gets added to the list)
//   en       - English/Tanglish search words (kept for reference / future search)
//   category - groups items together in the UI
//   icon     - an emoji shown on the tile (stands in for a photo - see note below)
//
// Add or remove items any time - the app picks up changes automatically.
//
// Note: a few of these (kallai, kallakottai, kondai kallai) are best-guess
// English labels - if they're wrong, just correct the "en" value below.
//
// Note on images: real per-item photos would mean linking to external
// image URLs that can break or disappear over time, and reusing someone
// else's photos raises copyright questions. Emoji icons avoid both problems
// and still make the grid easy to scan visually.

export const CATEGORIES = [
  { id: 'pooja', label: 'பூஜை பொருட்கள்', icon: '🪔' },
  { id: 'masala', label: 'மசாலா & வத்தல்', icon: '🌶️' },
  { id: 'dal', label: 'பருப்பு வகைகள்', icon: '🫘' },
  { id: 'rice', label: 'அரிசி & தானியங்கள்', icon: '🍚' },
  { id: 'flour', label: 'மாவு & ரவை', icon: '🌾' },
  { id: 'salt_sugar', label: 'உப்பு & சர்க்கரை', icon: '🧂' },
  { id: 'oil', label: 'எண்ணெய்', icon: '🛢️' },
  { id: 'dairy', label: 'பால் பொருட்கள்', icon: '🧈' },
  { id: 'beverages', label: 'பானங்கள்', icon: '☕' },
  { id: 'snacks', label: 'சிற்றுண்டி', icon: '🍪' },
  { id: 'produce', label: 'பழம் & காய்கறி', icon: '🥔' },
  { id: 'household', label: 'இல்லப் பொருட்கள்', icon: '🧴' },
]

export const COMMON_ITEMS = [
  { ta: 'சாம்பிராணி', en: 'sambrani', category: 'pooja', icon: '🪔' },
  { ta: 'சந்தனம்', en: 'sandalwood chandanam', category: 'pooja', icon: '🪵' },
  { ta: 'குங்குமம்', en: 'kumkum kungumam', category: 'pooja', icon: '🔴' },
  { ta: 'ஊதுபத்தி சைக்கிள் பிராண்டு', en: 'agarbatti incense sticks cycle brand', category: 'pooja', icon: '🕯️' },

  { ta: 'மிளகாய் தூள்', en: 'chilli powder milagai thool', category: 'masala', icon: '🌶️' },
  { ta: 'கறிமசால் தூள்', en: 'curry masala powder kari masala thool', category: 'masala', icon: '🌶️' },
  { ta: 'மிளகு', en: 'pepper milagu', category: 'masala', icon: '⚫' },
  { ta: 'சீரகம்', en: 'cumin seeragam jeera', category: 'masala', icon: '🌿' },
  { ta: 'சோம்பு', en: 'fennel sombu saunf', category: 'masala', icon: '🌿' },
  { ta: 'பட்டை', en: 'cinnamon pattai', category: 'masala', icon: '🌿' },
  { ta: 'லவுங்கம்', en: 'cloves lavangam', category: 'masala', icon: '🌿' },

  { ta: 'துவரம் பருப்பு', en: 'toor dal tuvaram paruppu', category: 'dal', icon: '🫘' },
  { ta: 'உளுத்தம் பருப்பு', en: 'urad dal ulundhu paruppu', category: 'dal', icon: '🫘' },
  { ta: 'பாசி பருப்பு', en: 'moong dal pasi paruppu', category: 'dal', icon: '🫘' },
  { ta: 'பச்ச பயிர்', en: 'green gram pacha payiru', category: 'dal', icon: '🫘' },
  { ta: 'பட்டாணி பருப்பு', en: 'dried peas pattani paruppu', category: 'dal', icon: '🫛' },
  { ta: 'கல்லை', en: 'kallai', category: 'dal', icon: '🫘' },
  { ta: 'கல்லகொட்டை', en: 'kallakottai', category: 'dal', icon: '🫘' },
  { ta: 'கொண்டை கல்லை', en: 'chickpea kondai kallai kondai kadalai', category: 'dal', icon: '🫘' },

  { ta: 'இட்லி அரிசி', en: 'idli rice', category: 'rice', icon: '🍚' },
  { ta: 'சூர்யா அரிசி', en: 'surya rice brand', category: 'rice', icon: '🍚' },
  { ta: 'பச்சை அரிசி', en: 'raw rice pacharisi', category: 'rice', icon: '🍚' },

  { ta: 'பெரிய ரவை', en: 'big rava periya ravai', category: 'flour', icon: '🌾' },
  { ta: 'சிறிய ரவை', en: 'small rava siriya ravai', category: 'flour', icon: '🌾' },
  { ta: 'கோதுமை மாவு', en: 'wheat flour gothumai mavu', category: 'flour', icon: '🌾' },
  { ta: 'மைதா மாவு', en: 'maida flour', category: 'flour', icon: '🌾' },
  { ta: 'பாயாசம் சேமியா', en: 'payasam semiya vermicelli', category: 'flour', icon: '🍜' },
  { ta: 'இட்லி பொடி', en: 'idli podi', category: 'flour', icon: '🌾' },

  { ta: 'உப்பு', en: 'salt', category: 'salt_sugar', icon: '🧂' },
  { ta: 'கல் உப்பு', en: 'rock salt kal uppu', category: 'salt_sugar', icon: '🧂' },
  { ta: 'சர்க்கரை', en: 'sugar', category: 'salt_sugar', icon: '🧂' },

  { ta: 'சுப தீபம் எண்ணெய்', en: 'shubh deepam oil suba deepam ennai', category: 'oil', icon: '🛢️' },
  { ta: 'சன்ரிச்', en: 'sunrich', category: 'oil', icon: '🛢️' },

  { ta: 'நெய்', en: 'ghee nei', category: 'dairy', icon: '🧈' },

  { ta: 'டீதூள்', en: 'tea powder', category: 'beverages', icon: '☕' },
  { ta: 'ப்ளாக் ரோஸ்', en: 'black rose tea', category: 'beverages', icon: '☕' },

  { ta: 'பிஸ்கட்', en: 'biscuit', category: 'snacks', icon: '🍪' },
  { ta: 'மேகி', en: 'maggi', category: 'snacks', icon: '🍜' },
  { ta: 'அப்பளம்', en: 'appalam papad', category: 'snacks', icon: '🫓' },

  { ta: 'பேரிச்சம் பழம்', en: 'dates pericham pazham', category: 'produce', icon: '🌴' },
  { ta: 'உருளை கிழங்கு', en: 'potato urulai kizhangu', category: 'produce', icon: '🥔' },
  { ta: 'சின்ன வெங்காயம்', en: 'small onion shallots', category: 'produce', icon: '🧅' },
  { ta: 'பெரிய வெங்காயம்', en: 'big onion', category: 'produce', icon: '🧅' },
  { ta: 'பூண்டு', en: 'garlic poondu', category: 'produce', icon: '🧄' },

  { ta: 'கோல்கெட் பேஸ்ட்', en: 'colgate toothpaste', category: 'household', icon: '🧴' },
  { ta: 'அமிர்தான்சன்', en: 'amrutanjan balm', category: 'household', icon: '💊' },
  { ta: 'சர்ப் எக்ஸல் லிக்யூட்', en: 'surf excel liquid detergent', category: 'household', icon: '🧴' },
  { ta: 'மைசூர் சேண்டல் சோப்', en: 'mysore sandal soap', category: 'household', icon: '🧼' },
  { ta: 'ஷாம்பு', en: 'shampoo', category: 'household', icon: '🧴' },
]
