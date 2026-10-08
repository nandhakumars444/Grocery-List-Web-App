import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { app } from './firebase'

// Category ids must match the ids in items.js (plus 'other').
const IDS = [
  'pooja', 'masala', 'dal', 'rice', 'flour', 'salt_sugar', 'oil', 'dairy', 'meat',
  'beverages', 'snacks', 'produce', 'household', 'other',
]

const ai = getAI(app, { backend: new GoogleAIBackend() })
const model = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash', // check the Firebase AI Logic docs for the current model list
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: Schema.object({
      properties: { category: Schema.enumString({ enum: IDS }) },
    }),
  },
})

export async function aiGuessCategory(name) {
  const res = await model.generateContent(
    `Indian grocery item, written in Tamil, English or Tanglish: "${name}". ` +
      `Return the best category id from: ${IDS.join(', ')}. ` +
      `Use "other" only if nothing fits.`
  )
  const { category } = JSON.parse(res.response.text())
  return IDS.includes(category) ? category : null
}
