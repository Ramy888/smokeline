---
status: draft
---

# Design brief: Smokeline

## The one spatial moment
I'm walking to the door with the alarm going. The grey smoke line is dropping toward my head, I press down to get low and the "get low" cue stops. I pinch the door and it glows hot. A voice from my left says "second way out", arrows swing to the window, and the timer stops at 0:52.

## Why it belongs on glasses
- Uses: shares your view, draws in the world, and leaves your body free (all three).
  - Shares your view: your own rooms, doors and windows become the drill. You mark them by pinching (the stand-in for recognition).
  - Draws in the world: the smoke line at real ceiling height, heat glow on the real door, arrows on the real floor, and a meeting point.
  - Leaves your body free: you crouch, walk and open doors. Guidance is spatial audio from the exit's direction, not panels to read.
- Why it's better than the phone or laptop version: a drill only works if your body does it. You get low, you feel the door, you walk out, with your hands free and your eyes up. A phone in your hand is the opposite of a drill.

## Product or overlay
- Type: overlay: it responds to my real home. The fire is never real; it's a drill.
- What the real version would sense: doors and windows.
- Stand-in for the preview: I aim at the wall and pinch; a virtual exit frame appears 200 cm along my look ray (Door A, then Window B). The preview room gives scripts no wall geometry to hit. On glasses, the frame snaps flush to the wall hit by World Query instead.

## Where things live
- Where the user is looking during the main task: the door and the floor ahead while walking the route; down at the floor for the debrief.
- Smoke layer: covers the whole room. It starts at the ceiling (about 250 cm above the floor) and drops at a fixed rate to 90 cm in 60 s (height = max(90, 250 − 2.67 × seconds since Start)), then holds at 90 cm until 2:00. A light grey haze, never dark.
- Exit markers: 100 × 200 cm glowing frames, upright, facing me, centred 100 cm above the floor. In the preview they sit 200 cm along my look ray; on glasses, on the wall I hit.
- Meeting point: a marker where my look ray meets the floor (the floor is 150 cm below my starting eye height in the preview), at most 400 cm away.
- Heat glow: orange, on the blocked exit's frame.
- Floor arrows: 50 × 80 cm each, on the floor, about 100 to 200 cm ahead of me, pointing to the open exit.
- Start button: about 100 cm in front of me, a little below eye level, at least 10 cm across.
- Debrief: a 120 × 80 cm panel lying flat on the floor in front of me at the end, within 60 to 160 cm (default).
- Audio: the "second way out" voice line is spatial sound from the open exit's direction. The alarm and the "get low" cue are not spatial (centred on me), so they never point anywhere. The alarm is the standard 3-beep pattern, generated, not a copyrighted sound.

## Hands and input
- Mark exits: aim at each wall spot and pinch to place Door A, then Window B. The first exit marked (Door A) is the blocked one.
- Mark the meeting point: aim at the floor and pinch.
- Start the drill: pinch the Start button.
- Check a door: pinch the door (on real glasses: the back of the hand).
- Get low: crouch below the smoke line (Q in the preview). No hand input; the Lens reads the camera's height.
- Next drill: pinch the next-drill button on the debrief. It keeps both exits and the meeting point, resets the smoke and the time, and swaps which exit is blocked.
- No two-hand gestures.
- Targets are big and highlight when aimed at.
- Voice (if any) and the button that does the same job: "start drill" (if voice works), with the Start button doing the same job.

## When things show
- Exit markers and Start: show before the drill, and only these.
- Smoke, floor arrows, door glow, both exit frames (still pinchable) and audio: show during the drill, and nothing else (no timer, no panels, no HUD). The falling smoke is the pace cue.
- "Get low" cue: plays only while my head is above the smoke line.
- Debrief: shows on the floor after I reach the open exit, then the next-drill button.
- If something needs attention out of view: a sound from its direction plus a small 15 × 15 cm edge arrow.
- Pinching the open exit before checking the blocked one only highlights it; it doesn't end the drill or reroute.
- If the smoke reaches 90 cm while I'm standing, the drill goes on, the "get low" cue keeps playing and the seconds in smoke count up. At 2:00 the drill ends: cues stop and the debrief shows "Time's up, try again" with the stats and the next-drill button.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Aiming at two wall spots and pinching places two exit frames 200 cm along the look ray, and aiming at the floor and pinching places the meeting point. Start unlocks only when 2 exits exist.
2. Pressing Start plays the alarm and the smoke layer starts dropping from the ceiling.
3. While the camera is above the smoke line a "get low" cue plays; pressing Q to go below the line stops it.
4. Pinching the blocked exit shows heat glow and the "second way out" cue, and the floor arrows reroute to the other exit.
5. Coming within 100 cm (horizontal distance) of the open exit stops the timer and shows the debrief on the floor: the time against 2:00, seconds in smoke, and the route.

## Out of scope
- AI running the drill. The drill itself is plain code: the alarm, the smoke drop, the "get low" check, the hot door, the reroute and the debrief.
- Recognizing real doors and windows. Pinch-to-mark is how exits are marked in this version. An optional vision Scout (a camera frame sent to a vision model through Snap's Remote Service Gateway, proposing exits that I confirm by pinching) is not part of this version and is not a done criterion.
- Surprise alarms. The drill starts only when I confirm the exits and press Start.
- Routes through more than one room: a short route inside one room to its door, and a window as exit B.
- Two-hand gestures.
- Earthquake mode.
- Recording, identifying or following anyone. The Lens uses the camera's position and height only on the device, for the "get low" and "reached the exit" checks, and sends no camera frames anywhere.

## Risks and open questions
- Crouching while wearing glasses: feel unproven.
- What the preview room contains: scripts can't hit its walls (tested), so exits are virtual frames placed along the pinch ray. Wall placement is feel unproven until tested on glasses.
- Safety tone: practice only, and never for a real fire.
- Voice may not work in the preview; the Start button does the same job.
- Criteria 3 and 5 depend on moving the camera. If LEAF can't move the camera, they are checked by hand in Interactive Preview, and the report says so.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
