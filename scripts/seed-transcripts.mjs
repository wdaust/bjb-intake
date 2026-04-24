/**
 * Seed ground-truth transcripts for the demo.
 *
 * Since the audio was generated from scripts (TTS), we have perfect
 * transcripts. We fabricate segment timings by estimating ~170 words
 * per minute — close enough for a synced live-transcript display.
 *
 * Writes to `call_transcripts` keyed by call_id.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = readFileSync('/Users/daustmac/Documents/bjb-intake/.env', 'utf8')
  .match(/^DATABASE_URL=(.+)$/m)[1].trim()

// --- Intake call (Mark + Maria) ---
const intakeDialog = [
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
  { speaker: 'maria', text: "Yeah, ambulance took me to Robert Wood Johnson. I was there for five hours. They did x-rays, a CT scan, and sent me home with muscle relaxers." },
  { speaker: 'mark',  text: "And how are you feeling now?" },
  { speaker: 'maria', text: "Bad. My neck is killing me, and my lower back — it's like shooting pain down my right leg. I saw my regular doctor Thursday and she's telling me to get physical therapy and maybe an MRI." },
  { speaker: 'mark',  text: "Okay. Have you started the PT yet, or gotten the MRI?" },
  { speaker: 'maria', text: "Not yet. She just gave me the referrals." },
  { speaker: 'mark',  text: "We can help with that. One more quick question: have you spoken with any other law firm about this accident? Signed anything with anyone?" },
  { speaker: 'maria', text: "No. You guys are the only ones I've called." },
  { speaker: 'mark',  text: "Perfect. And the other driver — you said it was a work truck. Do you know if they were at fault, did they admit anything?" },
  { speaker: 'maria', text: "The police said he was on his phone. He apologized at the scene, said he didn't see me." },
  { speaker: 'mark',  text: "That's extremely useful. Last thing: your own insurance — do you know if you have PIP on your policy?" },
  { speaker: 'maria', text: "I have GEICO. I'm pretty sure I have the basic New Jersey package." },
  { speaker: 'mark',  text: "That's all I need for now. Here's what happens next. In the next few minutes, I'm going to text you a link to our engagement agreement. It's mobile-friendly, takes about two minutes. Once you sign, I'll book a time for our case manager Jess to call you Monday. She'll coordinate your PT and MRI. Sound good?" },
  { speaker: 'maria', text: "Yeah, that sounds good. Thank you." },
  { speaker: 'mark',  text: "You're in the right hands, Maria. Talk soon." },
]

// --- CM call (Jess + Maria) ---
const cmDialog = [
  { speaker: 'jess', text: "Hi Maria, this is Jess from Brandon J. Broderick's office. I'm a case manager here. I just wanted to touch base after your call with Mark yesterday. Is now still a good time?" },
  { speaker: 'maria', text: "Oh yeah, hi. Um, yeah, it's a good time. Sorry, I'm just moving some things around. Go ahead." },
  { speaker: 'jess', text: "No worries. So I have the basics from Mark, but I want to walk through it with you myself and make sure I have everything right. Can you tell me about the accident, just in your own words?" },
  { speaker: 'maria', text: "Um, okay. So it was, I think last Tuesday? Yeah, Tuesday. I was driving home on the Turnpike, near exit eleven I think. I was just sitting in traffic, not moving, and this guy, I don't even know what he was doing, he just slammed into the back of me. Really hard." },
  { speaker: 'jess', text: "Did the police come to the scene?" },
  { speaker: 'maria', text: "Yeah, State Police came. I have the report number somewhere. Hold on. Okay, it's NJ-SP-2026-0482-A." },
  { speaker: 'jess', text: "Perfect, I'm writing that down. Was anyone else in the car with you?" },
  { speaker: 'maria', text: "No, just me. Thank God. My daughter was at school." },
  { speaker: 'jess', text: "Okay. Were you taken to the hospital from the scene?" },
  { speaker: 'maria', text: "Yeah, the paramedics, I was shaking really bad and my neck was already hurting, so they took me to Robert Wood Johnson. I was there for like five hours. They did x-rays, CT scan, gave me some muscle relaxers, and sent me home." },
  { speaker: 'jess', text: "Got it. So the CT scan, did they mention anything about the results, or was it all cleared?" },
  { speaker: 'maria', text: "They said no fracture. But my neck and my lower back are killing me. Like, I can barely turn my head, and the lower back, it shoots down my right leg." },
  { speaker: 'jess', text: "That shooting pain down the leg is something we'll definitely want to look at. Has anyone, a doctor or your primary, followed up with you since the ER?" },
  { speaker: 'maria', text: "I saw my regular doctor Thursday. She said I should do physical therapy and maybe get an MRI if it doesn't get better in a couple weeks." },
  { speaker: 'jess', text: "Okay. Has the physical therapy been scheduled yet?" },
  { speaker: 'maria', text: "Uh, no. She gave me a referral but I haven't called them yet. I've just been kind of, you know, trying to get through the day." },
  { speaker: 'jess', text: "That's completely understandable. So here's what I'd like to do. First, I want to get that PT scheduled for you as quickly as possible. The sooner you're in active treatment, the better for your case and for your recovery. We work with a network of providers. Would it be easier if our office coordinated that appointment for you?" },
  { speaker: 'maria', text: "Oh, yeah, actually that would be great. I didn't know you guys did that." },
  { speaker: 'jess', text: "We do. Second thing. I want to flag the MRI. Given the shooting pain down your leg, that's a classic sign of something going on at the L4 or L5 level, and we shouldn't wait a couple of weeks. I'm going to ask you to call your primary back and ask her to order the MRI now, not in two weeks. Can you do that today or tomorrow?" },
  { speaker: 'maria', text: "Yeah, I can call her office in the morning." },
  { speaker: 'jess', text: "Perfect. Now, quick question on insurance. Do you know if you have PIP coverage on your auto policy?" },
  { speaker: 'maria', text: "I think so? I have GEICO. I have like, the basic New Jersey package, whatever that's called." },
  { speaker: 'jess', text: "Okay, that's what I needed. Do you know the policy number? You don't have to tell me right now. You can just text it or email it to me later. Same with any photos of the damage to your car, and the police report if you have a copy." },
  { speaker: 'maria', text: "Yeah, I can do that tonight." },
  { speaker: 'jess', text: "Great. Last thing, just so we're on the same page: you understand that our office is representing you for this accident, correct? You haven't spoken with any other law firm?" },
  { speaker: 'maria', text: "Right. No, you guys are it." },
  { speaker: 'jess', text: "Perfect. You'll be getting calls from the adjuster. Do not speak to them. Direct them to me. Here's what I'm going to do today: I'll get PT scheduled for you and send you confirmation. Tomorrow you'll call your doctor about the MRI. End of the week we'll talk again. Sound good?" },
  { speaker: 'maria', text: "Yeah, that's, yeah, thank you, Jess. I feel a lot better." },
  { speaker: 'jess', text: "We've got you. Talk to you Friday." },
]

// ---------- Build segments with fabricated timings ----------
//
// Estimate ~170 words per minute speaking pace + 400ms gap between turns.
// Gives a close-enough timing for a live-transcript animation.
function buildSegments(dialog) {
  const WPS = 170 / 60         // words per second
  const GAP = 0.4              // gap between turns
  let t = 0
  return dialog.map((turn) => {
    const wc = turn.text.split(/\s+/).filter(Boolean).length
    const dur = Math.max(1.0, wc / WPS)
    const start = t
    const end = start + dur
    t = end + GAP
    return {
      speaker: turn.speaker.toUpperCase(),
      start: Math.round(start * 10) / 10,
      end:   Math.round(end   * 10) / 10,
      text:  turn.text,
    }
  })
}

const intakeSegments = buildSegments(intakeDialog)
const cmSegments     = buildSegments(cmDialog)

// ---------- Persist ----------
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})
await client.connect()

await client.query(`DELETE FROM call_transcripts WHERE call_id IN ('call-intake-maria', 'call-cm-maria')`)

await client.query(
  `INSERT INTO call_transcripts (id, call_id, provider, segments, full_text, language)
   VALUES ($1, $2, 'whisper-script', $3::jsonb, $4, 'en')`,
  [
    'transcript-intake-maria',
    'call-intake-maria',
    JSON.stringify(intakeSegments),
    intakeDialog.map((t) => t.text).join(' '),
  ]
)

await client.query(
  `INSERT INTO call_transcripts (id, call_id, provider, segments, full_text, language)
   VALUES ($1, $2, 'whisper-script', $3::jsonb, $4, 'en')`,
  [
    'transcript-cm-maria',
    'call-cm-maria',
    JSON.stringify(cmSegments),
    cmDialog.map((t) => t.text).join(' '),
  ]
)

const intakeDur = intakeSegments[intakeSegments.length - 1].end
const cmDur = cmSegments[cmSegments.length - 1].end
console.log(`Intake transcript: ${intakeSegments.length} segments, ~${Math.round(intakeDur)}s`)
console.log(`CM transcript:     ${cmSegments.length} segments, ~${Math.round(cmDur)}s`)

await client.end()
