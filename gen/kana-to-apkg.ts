import { load } from 'jsr:@std/dotenv'
import { Template } from 'jsr:@flashcard/core'
import { fromJSON, toJSON, toAPKG as toAPKG } from 'jsr:@flashcard/adapters'
import { generateTranslations, generateTTS } from 'jsr:@flashcard/utils'

const env = await load()

const locale = 'ja-JP'
const voiceId = 'ja-JP-NanamiNeural'
const apiRegion = env['AZURE_REGION']
const translateApiKey = env['AZURE_TRANSLATE_KEY']
const ttsApiKey = env['AZURE_SPEECH_KEY']

const resp = Deno.readTextFileSync('./kana.json')
const deck = fromJSON(resp, { sortField: 'Kana' })
deck.addTemplate('kana-reading', '<h1>{{Kana}}</h1>', '<h1>{{Romaji}} {{Audio}}</h1>')

await generateTTS(deck, {
  apiKey: ttsApiKey,
  apiRegion,
  fromField: 'Kana',
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

await Deno.writeFile(`./apkg/${deck.id}.apkg`, await toAPKG(deck, { media, sortField: 'Kana' }))
