/**
 * Generate Maria Santos intake-call TTS audio via ElevenLabs.
 *
 * Two voices:
 *   - Jess  (CM, paralegal): Rachel  — calm, professional American female
 *   - Maria (client):        Bella   — softer, younger American female
 *
 * Each line becomes one MP3, then we concat with 400ms silence spacers via
 * ffmpeg. Per-line MP3s are cached in demo/audio/lines/ so re-runs are cheap.
 *
 * Run:  node demo/generate-audio.mjs
 * Out:  demo/audio/maria_intake.mp3
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const exec = promisify(execCb)

// ---------- env ----------
const envPath = '/Users/daustmac/Documents/bjb-intake/.env'
const env = readFileSync(envPath, 'utf8')
const EL_KEY = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim()
if (!EL_KEY || EL_KEY === 'PASTE_KEY_HERE') {
  console.error('ELEVENLABS_API_KEY missing from .env')
  process.exit(1)
}

// ---------- voice IDs (ElevenLabs premade, available on free tier) ----------
const VOICE_MAP = {
  jess:  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },   // mature, reassuring, confident
  maria: { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella' },   // professional, bright, warm
}

// ---------- dialogue ----------
const dialogue = [
  { speaker: 'jess', text: "Hi Maria, this is Jess from Brandon J. Broderick's office. I'm a case manager here. I just wanted to touch base after your call with Mark yesterday. Is now still a good time?" },
  { speaker: 'maria', text: "Oh yeah, hi. Um, yeah, it's a good time. Sorry, I'm just moving some things around. Go ahead." },
  { speaker: 'jess', text: "No worries. So I have the basics from Mark, but I want to walk through it with you myself and make sure I have everything right. Can you tell me about the accident, just in your own words?" },
  { speaker: 'maria', text: "Um, okay. So it was, I think last Tuesday? Yeah, Tuesday. I was driving home on the Turnpike, near exit eleven I think. I was just sitting in traffic, not moving, and this guy, I don't even know what he was doing, he just slammed into the back of me. Really hard." },
  { speaker: 'jess', text: "Did the police come to the scene?" },
  { speaker: 'maria', text: "Yeah, State Police came. I have the report number somewhere. Hold on. Okay, it's N J S P twenty twenty six zero four eight two A." },
  { speaker: 'jess', text: "Perfect, I'm writing that down. Was anyone else in the car with you?" },
  { speaker: 'maria', text: "No, just me. Thank God. My daughter was at school." },
  { speaker: 'jess', text: "Okay. Were you taken to the hospital from the scene?" },
  { speaker: 'maria', text: "Yeah, the paramedics, I was shaking really bad and my neck was already hurting, so they took me to Robert Wood Johnson. I was there for like five hours. They did x-rays, C T scan, gave me some muscle relaxers, and sent me home." },
  { speaker: 'jess', text: "Got it. So the C T scan, did they mention anything about the results, or was it all cleared?" },
  { speaker: 'maria', text: "They said no fracture. But my neck and my lower back are killing me. Like, I can barely turn my head, and the lower back, it shoots down my right leg." },
  { speaker: 'jess', text: "That shooting pain down the leg is something we'll definitely want to look at. Has anyone, a doctor or your primary, followed up with you since the ER?" },
  { speaker: 'maria', text: "I saw my regular doctor Thursday. She said I should do physical therapy and maybe get an MRI if it doesn't get better in a couple weeks." },
  { speaker: 'jess', text: "Okay. Has the physical therapy been scheduled yet?" },
  { speaker: 'maria', text: "Uh, no. She gave me a referral but I haven't called them yet. I've just been kind of, you know, trying to get through the day." },
  { speaker: 'jess', text: "That's completely understandable. So here's what I'd like to do. First, I want to get that P T scheduled for you as quickly as possible. The sooner you're in active treatment, the better for your case and for your recovery. We work with a network of providers. Would it be easier if our office coordinated that appointment for you?" },
  { speaker: 'maria', text: "Oh, yeah, actually that would be great. I didn't know you guys did that." },
  { speaker: 'jess', text: "We do. Second thing. I want to flag the MRI. Given the shooting pain down your leg, that's a classic sign of something going on at the L four or L five level, and we shouldn't wait a couple of weeks. I'm going to ask you to call your primary back and ask her to order the MRI now, not in two weeks. Can you do that today or tomorrow?" },
  { speaker: 'maria', text: "Yeah, I can call her office in the morning." },
  { speaker: 'jess', text: "Perfect. Now, quick question on insurance. Do you know if you have P I P coverage on your auto policy?" },
  { speaker: 'maria', text: "I think so? I have GEICO. I have like, the basic New Jersey package, whatever that's called." },
  { speaker: 'jess', text: "Okay, that's what I needed. Do you know the policy number? You don't have to tell me right now. You can just text it or email it to me later. Same with any photos of the damage to your car, and the police report if you have a copy." },
  { speaker: 'maria', text: "Yeah, I can do that tonight." },
  { speaker: 'jess', text: "Great. Last thing, just so we're on the same page: you understand that our office is representing you for this accident, correct? You haven't spoken with any other law firm?" },
  { speaker: 'maria', text: "Right. No, you guys are it." },
  { speaker: 'jess', text: "Perfect. You'll be getting calls from the adjuster. Do not speak to them. Direct them to me. Here's what I'm going to do today: I'll get P T scheduled for you and send you confirmation. Tomorrow you'll call your doctor about the MRI. End of the week we'll talk again. Sound good?" },
  { speaker: 'maria', text: "Yeah, that's, yeah, thank you, Jess. I feel a lot better." },
  { speaker: 'jess', text: "We've got you. Talk to you Friday." },
]

// ---------- paths ----------
const outDir = '/Users/daustmac/Documents/bjb-intake/demo/audio'
const linesDir = path.join(outDir, 'lines')
mkdirSync(linesDir, { recursive: true })
const finalPath = path.join(outDir, 'maria_intake.mp3')
const silencePath = path.join(linesDir, '_silence.mp3')

// ---------- helpers ----------
async function tts(text, voiceId, voiceName, outPath, retries = 2) {
  if (existsSync(outPath) && statSync(outPath).size > 1000) return // cache hit
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.55,         // middle-of-road; a bit of variance for realism
      similarity_boost: 0.75,
      style: 0.15,             // light touch of expressiveness
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
  await exec(
    `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t 0.45 -q:a 4 -acodec libmp3lame "${silencePath}" 2>&1 | tail -3`
  )
}

async function concatAll(lineFiles) {
  // Re-encode so frame headers stay consistent between the 128kbps lines
  // and the mono silence. Much more robust than -c copy.
  const listItems = []
  for (let i = 0; i < lineFiles.length; i++) {
    listItems.push(`file '${lineFiles[i]}'`)
    if (i < lineFiles.length - 1) listItems.push(`file '${silencePath}'`)
  }
  const listPath = path.join(linesDir, '_concat.txt')
  writeFileSync(listPath, listItems.join('\n') + '\n')
  await exec(
    `ffmpeg -y -f concat -safe 0 -i "${listPath}" -acodec libmp3lame -b:a 128k "${finalPath}" 2>&1 | tail -3`
  )
}

// ---------- main ----------
console.log(`Generating ${dialogue.length} TTS lines via ElevenLabs...`)
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

const sizeKB = Math.round(statSync(finalPath).size / 1024)
// rough duration: MP3 at ~128 kbps = ~16 KB/sec
const approxDurSec = Math.round(sizeKB / 16)
console.log(`\nDone: ${finalPath}`)
console.log(`Size: ${sizeKB} KB  (~${Math.floor(approxDurSec / 60)}:${String(approxDurSec % 60).padStart(2, '0')} @ 128kbps)`)
