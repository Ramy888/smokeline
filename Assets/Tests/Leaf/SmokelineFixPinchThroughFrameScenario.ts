// Fix check: before Start, a pinch whose ray passes through a placed exit frame's 100x200 cm collider is
// classified by the ray as if the frame were not there, so the meeting point lands on the floor behind Door A.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {FLOOR_Y, SmokelineLeafHand, cameraPos, near, say, state, v} from "./SmokelineLeafHand"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

@component
export class SmokelineFixPinchThroughFrameScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const cam = cameraPos()

    // Door A straight ahead: centre 200 cm along a level ray.
    await hand.pinchToward(cam, cam.add(new vec3(0, 0, -200)))
    expect(state().exits.length).toBe(1)
    const door = state().exits[0].position
    const doorIt = findInteractableByName("ExitFrame_DoorA")
    expect(!!doorIt).toBe(true)

    // Floor point 300 cm ahead, behind the door. Where the ray crosses the door plane it is inside the
    // 100x200 frame, so on SIK this pinch reports Door A's Interactable as the hit target.
    const aim = cam.add(new vec3(0, FLOOR_Y - cam.y, -300))
    const dir = aim.sub(cam).normalize()
    const k = (door.z - cam.z) / dir.z
    const atDoor = cam.add(dir.uniformScale(k))
    say(`FIX ray crosses the door plane at ${v(atDoor)}; door centre ${v(door)}`)
    expect(Math.abs(atDoor.x - door.x) <= 50).toBe(true)
    expect(Math.abs(atDoor.y - door.y) <= 100).toBe(true)

    await hand.pinchToward(cam, aim, doorIt)
    const mp = state().meetingPoint
    say(`FIX meeting point after pinch through Door A: ${mp ? v(mp) : "null"}`)
    expect(mp === null).toBe(false)
    near(mp.x, aim.x, 0.5, "meeting x")
    near(mp.z, aim.z, 0.5, "meeting z")
    near(mp.y, FLOOR_Y, 0.01, "meeting y")
    expect(state().exits.length).toBe(1) // the frame hit neither blocked it nor became an exit
    expect(state().phase).toBe("marking")
    say("FIX PASS")
  }
}
