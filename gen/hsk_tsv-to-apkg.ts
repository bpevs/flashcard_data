import { load } from 'jsr:@std/dotenv'
import { fromTSV, toAPKG as toAPKG } from 'jsr:@flashcard/adapters'
import { generateTranslations, generateTTS } from 'jsr:@flashcard/utils'
// import * as OpenCC from 'npm:opencc-js';

const env = await load()

const locale = 'zh-TW'
const voiceId = 'zh-TW-YunJheNeural'
const apiRegion = env['AZURE_REGION']
const translateApiKey = env['AZURE_TRANSLATE_KEY']
const ttsApiKey = env['AZURE_SPEECH_KEY']

const resp = Deno.readTextFileSync('./hsk3.0-band-1.tsv')
const deck = fromTSV(resp, {
  sortField: 'No',
  meta: {
    watch: ['No', 'Simplified', 'Pinyin', 'English'],
    id: 'hsk3.0-band-1',
    name: 'HSK Band 1',
    desc: 'Chinese flashcards for the HSK test',
  },
})

deck.addTemplate('Reading', '<h1>{{Traditional}}</h1>', '<h1>{{English}} ({{Pinyin}})</h1><br/> {{Audio}}<h1> {{Traditional}}</h1>')
deck.addTemplate('Speaking', '<h1>{{English}}</h1>', '<h1>{{Traditional}} ({{Pinyin}})</h1><br/> {{Audio}}')
deck.addTemplate('Listening', '{{Audio}}', '<h1>{{Traditional}} ({{Pinyin}})</h1><br/><h1> {{English}}</h1>')

// Use if need to convert from Simplified to Trad
// const converter = OpenCC.Converter({ from: 'cn', to: 'hk' });
// Object.values(deck.notes).forEach(note => {
//   note.content.Traditional = converter(note.content.Simplified)
// })

// Use if API has too many texts to TTS
// Object.values(deck.notes).forEach((note, index) => {
//   if (note.content.No < 200) delete deck.notes[index]
// })

await generateTTS(deck, {
  apiKey: ttsApiKey,
  apiRegion,
  fromField: 'Simplified',
  locale,
  voiceId,
})

const media: Array<{ name: string; data: Blob }> = []
deck.fields.push('Audio')

await Promise.all(
  Object.values(deck.notes).map(async (note) => {
    const audioFilename = `${note.id}.mp3`
    const audioLocation = `./audio/${note.id}.mp3`
    note.content.Audio = `[sound:${audioFilename}]`

    try {
      const fileBytes = await Deno.readFile(audioLocation)
      const data = new Blob([fileBytes], { type: 'audio/mpeg' })
      media.push({ name: audioFilename, data })
    } catch {
      console.warn('Missing audio file: ', audioFilename)
    }
  }),
)

await Deno.writeFile(`./${deck.id}.apkg`, await toAPKG(deck, { media }))
