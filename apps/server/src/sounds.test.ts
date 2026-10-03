import { describe, expect, it } from 'vitest'
import { validSoundChoices } from './sounds.ts'

describe('sons escolhidos no mapeador', () => {
  it('aceita arquivos de som e prefixos de voz', () => {
    const input = {
      events: { pangya: ['data/sound/팡야.wav'], shot: [] },
      voices: { 'data/avatar/h_kaz/h_def': 'kaz' },
    }
    expect(validSoundChoices(input)).toEqual(input)
  })

  it('recusa caminhos para fora da pasta ou que não são som', () => {
    expect(validSoundChoices({ events: { a: ['../segredo.wav'] }, voices: {} })).toBeUndefined()
    expect(validSoundChoices({ events: { a: ['data/x.exe'] }, voices: {} })).toBeUndefined()
    expect(validSoundChoices({ events: { a: 'data/x.wav' }, voices: {} })).toBeUndefined()
    expect(validSoundChoices({ events: {}, voices: { a: 3 } })).toBeUndefined()
    expect(validSoundChoices(null)).toBeUndefined()
  })
})
