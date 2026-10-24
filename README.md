# Smokeline

A home fire drill Lens for Spectacles. Your own rooms become the drill: you mark a door, a window and a family
meeting point, press Start, and the alarm sounds while a grey smoke layer drops from the ceiling. You stay under
it, check the door (it's hot), follow floor arrows to the second way out, and read a debrief on the floor.

- Demo video (2:36: how it was planned, built and tested, then the drill recorded in Lens Studio's Interactive Preview): https://youtu.be/3exd3X9JMP0
- Design brief, done criteria and judging notes: [`devpost/design-brief.md`](devpost/design-brief.md)

## Open it

1. Lens Studio **5.23.2**, then open `smokeline.esproj`.
2. In the Preview panel choose **Interactive** with the **Colorful Home** room.
3. Play it: aim and click to pinch (click = pinch). Move and look around with the preview's camera controls.
   - Pinch a wall spot for Door A, another for Window B, then the floor for the meeting point.
   - Pinch **Start drill**. Walk toward the door; when the smoke reaches eye height a voice says "Get low", so move the camera down below the smoke.
   - Pinch Door A: it glows hot, a voice from the window says "Second way out" and the arrows reroute.
   - Walk within 1 m of Window B: the debrief appears on the floor (time against 2:00, seconds above the smoke line, route).

## How it works

All drill logic is plain TypeScript in `Assets/Scripts/`:

| File | Role |
|---|---|
| `SmokelineController.ts` | marking, smoke drop (250 cm to 90 cm in 60 s), get-low check, hot door, reroute arrows, reach check, 2:00 limit, debrief |
| `SmokelineStartUI.ts` | the Start button and hint (UI Kit) |
| `SmokelineDebriefUI.ts` | the 90 × 60 cm debrief lying on the floor |

Built with Spectacles Interaction Kit and Spectacles UI Kit. In the preview, exits are placed 200 cm along the pinch
ray, because the preview room has no wall geometry for scripts to hit; on glasses they would snap to the wall found
by World Query. The alarm is a generated 3-beep pattern; the two voice lines are the author's own voice.

Privacy: the Lens reads only the camera's position and height, on the device. It records nothing and sends nothing.

## Tests

Seven LEAF scenarios in `Assets/Tests/Leaf/`, one per done criterion plus two regressions; all pass in the preview.
Run them from the LEAF panel.

| Scenario | Checks |
|---|---|
| C1 Marking | two exits along the pinch ray, meeting point on the floor, Start unlocks at 2 exits |
| C2 Drill | Start plays the alarm and the smoke starts dropping |
| C3 Get low | the cue plays above the smoke line and stops below it |
| C4 Hot door | heat glow, "second way out", arrows reroute to the open exit |
| C5 Reach | within 100 cm of the open exit the debrief shows on the floor |
| Timeout | at 2:00 the drill ends with "Time's up" (takes about 2 minutes) |
| Pinch through frame | before Start, a pinch through Door A's frame reaches the floor behind it, and a second exit on top of Door A is ignored |

C5 waits for the preview camera to be moved next to Window B (it logs `C5 READY_FOR_MOVE`); walk there in
Interactive Preview, or move the camera with the Lens Studio MCP `MovePreviewCamera` tool.

## Not proven yet

Only real glasses can tell: wall placement, crouching while wearing them, hand tracking, and whether the
"second way out" voice is heard from the window's direction.

## License

MIT for the Smokeline code, brief and assets in this repo (see [`LICENSE`](LICENSE)). The Snap packages in
`Packages/` (Spectacles Interaction Kit, Spectacles UI Kit, LEAF) keep their own terms from Snap.
