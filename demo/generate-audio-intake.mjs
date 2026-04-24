/**
 * Generate Mark+Maria INTAKE call TTS audio via ElevenLabs.
 *
 * Scenario: Maria calls in cold. Mark is the intake specialist. He
 * runs a v8-rubric-shaped qualification: liability facts, damages facts,
 * conflict check, no fee discussion.
 *
 * Voices:
 *   - Mark  (intake specialist): George — warm, captivating (male)
 *   - Maria (client):            Bella  — same voice as the CM call for continuity
 *
 * Out: demo/audio/maria_intake_call1.mp3
 *      (the existing demo/audio/maria_intake.mp3 is the Jess+Maria CM call;
 *       we rename things below for clarity)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync } from 'node:fs'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const exec = promisify(execCb)

const envPath = '/Users/daustmac/Documents/bjb-intake/.env'
const env = readFileSync(envPath, 'utf8')
const EL_KEY = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim()
if (!EL_KEY || EL_KEY === 'PASTE_KEY_HERE') {
  console.error('ELEVENLABS_API_KEY missing from .env')
  process.exit(1)
}

// ---------- voice IDs ----------
const VOICE_MAP = {
  mark:  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' }, // male, warm, captivating
  maria: { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella'  }, // continuity with CM call
}

// ---------- dialogue (Mark intake call, ~2 min) ----------
const dialogue = [
  { speaker: 'mark',  text: "Hi, this is Mark at Brandon J. Broderick. Am I speaking with Maria?" },
  { speaker: 'maria', text: "Yes, this is Maria." },
  { speaker: 'mark',  text: "Maria, thank you for calling us. Before we go further, I do want to let you know this call is recorded for quality and case-handling purposes. Is that okay with you?" },
  { speaker: 'maria', text: "Yeah, that's fine." },
  { speaker: 'mark',  text: "Great. So I understand you were in an accident. Can you walk me through what happened, in your own words?" },
  { speaker: 'maria', text: "Um, yeah. So it was last Tuesday. I was driving home on the New Jersey Turnpike, near exit eleven, and I was just sitting in traffic, not moving, and this guy in a work truck slammed into the back of me. Really hard." },
  { speaker: 'mark',  text: "Sorry to hear that. A work truck, you said? Any lettering on it, company name?" },
  { speaker: 'maria', text: "Yeah, it said something like, um, Fortis Contracting? Something Fortis. And it had a ladder rack on the back." },
  { speaker: 'mark',  text: "Got it. Did police come to the scene?" },
  { speaker: 'maria', text: "Yeah, State Police. I have the report number if you need it." },
  { speaker: 'mark',  text: "I'll get it from you in a minute. Were there any witnesses?" },
  { speaker: 'maria', text: "The lady in the car in front of me stopped and stayed until the police came. I have her name and number." },
  { speaker: 'mark',  text: "That's really helpful. Were you taken to the hospital from the scene?" },
  { speaker: 'maria', text: "Yeah, ambulance took me to Robert Wood Johnson. I was there for five hours. They did x-rays, a C T scan, and sent me home with muscle relaxers." },
  { speaker: 'mark',  text: "And how are you feeling now?" },
  { speaker: 'maria', text: "Bad. My neck is killing me, and my lower back — it's like shooting pain down my right leg. I saw my regular doctor Thursday and she's telling me to get physical therapy and maybe an MRI." },
  { speaker: 'mark',  text: "Okay. Have you started the P T yet, or gotten the MRI?" },
  { speaker: 'maria', text: "Not yet. She just gave me the referrals." },
  { speaker: 'mark',  text: "We can help with that. One more quick question: have you spoken with any other law firm about this accident? Signed anything with anyone?" },
  { speaker: 'maria', text: "No. You guys are the only ones I've called." },
  { speaker: 'mark',  text: "Perfect. And the other driver — you said it was a work truck. Do you know if they were at fault, did they admit anything?" },
  { speaker: 'maria', text: "The police said he was on his phone. He apologized at the scene, said he didn't see me." },
  { speaker: 'mark',  text: "That's extremely useful. Last thing: your own insurance — do you know if you have P I P on your policy?" },
  { speaker: 'maria', text: "I have GEICO. I'm pretty sure I have the basic New Jersey package." },
  { speaker: 'mark',  text: "That's all I need for now. Here's what happens next. In the next few minutes, I'm going to text you a link to our engagement agreement — it's the paperwork that lets us officially represent you. It's mobile-friendly, takes about two minutes. Once you sign, I'll book a time for our case manager Jess to call you Monday. She'll coordinate your P T and MRI. Sound good?" },
  { speaker: 'maria', text: "Yeah, that sounds good. Thank you." },
  { speaker: 'mark',  text: "You're in the right hands, Maria. Talk soon." },
]

// ---------- paths ----------
const outDir = '/Users/daustmac/Documents/bjb-intake/demo/audio'
const linesDir = path.join(outDir, 'intake-lines')
mkdirSync(linesDir, { recursive: true })
const finalPath = path.join(outDir, 'maria_intake_call1.mp3')
const silencePath = path.join(linesDir, '_silence.mp3')

// ---------- helpers ----------
async function tts(text, voiceId, voiceName, outPath, retries = 2) {
  if (existsSync(outPath) && statSync(outPath).size > 1000) return
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.55,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
    },
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': EL_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify(body),
    })
    if (res.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 2000))
      return tts(text, voiceId, voiceName, outPath, retries - 1)
    }
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`ElevenLabs ${voiceName} failed (${res.status}): ${err.slice(0, 300)}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(outPath, buf)
  } catch (e) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1500))
      return tts(text, voiceId, voiceName, outPath, retries - 1)
    }
    throw e
  }
}

async function generateSilence() {
  if (existsSync(silencePath)) return
  await exec(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.45 -q:a 4 -acodec libmp3lame "${silencePath}" 2>&1 | tail -3`)
}

async function concatAll(lineFiles) {
  const listItems = []
  for (let i = 0; i < lineFiles.length; i++) {
    listItems.push(`file '${lineFiles[i]}'`)
    if (i < lineFiles.length - 1) listItems.push(`file '${silencePath}'`)
  }
  const listPath = path.join(linesDir, '_concat.txt')
  writeFileSync(listPath, listItems.join('\n') + '\n')
  await exec(`ffmpeg -y -f concat -safe 0 -i "${listPath}" -acodec libmp3lame -b:a 128k "${finalPath}" 2>&1 | tail -3`)
}

// ---------- main ----------
console.log(`Generating ${dialogue.length} intake-call TTS lines...`)
const lineFiles = []
for (let i = 0; i < dialogue.length; i++) {
  const { speaker, text } = dialogue[i]
  const { id, name } = VOICE_MAP[speaker]
  const filename = `${String(i).padStart(3, '0')}_${speaker}.mp3`
  const linePath = path.join(linesDir, filename)
  process.stdout.write(`  [${String(i + 1).padStart(2)}/${dialogue.length}] ${speaker.padEnd(5)} (${name.padEnd(6)}) ${text.slice(0, 60).replace(/\n/g, ' ')}... `)
  await tts(text, id, name, linePath)
  console.log('ok')
  lineFiles.push(linePath)
}

console.log('Generating silence spacer...')
await generateSilence()

console.log('Concatenating into final MP3...')
await concatAll(lineFiles)

// Also rename the existing CM-call file for clarity.
const cmCallOld = path.join(outDir, 'maria_intake.mp3')
const cmCallNew = path.join(outDir, 'maria_cm_call.mp3')
if (existsSync(cmCallOld) && !existsSync(cmCallNew)) {
  renameSync(cmCallOld, cmCallNew)
  console.log(`\nRenamed existing CM call: ${cmCallOld} → ${cmCallNew}`)
}

const sizeKB = Math.round(statSync(finalPath).size / 1024)
const approxDurSec = Math.round(sizeKB / 16)
console.log(`\nDone: ${finalPath}`)
console.log(`Size: ${sizeKB} KB  (~${Math.floor(approxDurSec / 60)}:${String(approxDurSec % 60).padStart(2, '0')} @ 128kbps)`)
