// Done criterion 5: coming within 100 cm (horizontal) of the open exit stops the timer and shows the floor
// debrief (time against 2:00, seconds above the smoke line, route); the next-drill button keeps both exits,
// resets smoke and time, and swaps which exit is blocked.
// LEAF cannot move the head (preview tracking rewrites Camera Object before the controller's Update; probed),
// so after the hot-door check this scenario logs "C5 READY_FOR_MOVE" and waits up to wait_secs for the camera
// to be walked to Window B from outside (MovePreviewCamera), then asserts everything in LEAF.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  SmokelineLeafHand, cameraPos, checkArrows, checkDebrief, frameColor, near, nearColor, say, state, v, waitFor
} from "./SmokelineLeafHand"

@component
export class SmokelineC5ReachScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const waitMs = (config?.getNumber("wait_secs") ?? 90) * 1000
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const alarm = findSceneObjectByName("Alarm").getComponent("Component.AudioComponent") as AudioComponent

    await hand.markTwoExits()
    await hand.pressStart()
    await hand.pinchFrame("ExitFrame_WindowB") // highlight only (C4); here so next drill must clear it
    expect(state().highlighted).toBe("Window B")
    await hand.pinchFrame("ExitFrame_DoorA")
    expect(state().checkedBlocked).toBe(true)
    const windowB = state().exits[1].position
    const reachAt = new vec3(windowB.x, 0, windowB.z + 80) // 80 cm in front of Window B, eye height
    say(`C5 READY_FOR_MOVE x=${reachAt.x.toFixed(1)} y=${reachAt.y.toFixed(1)} z=${reachAt.z.toFixed(1)} (Window B at ${v(windowB)})`)

    await waitFor(() => state().phase === "ended", waitMs, "camera within 100 cm of Window B (drill ended)")
    const cam = cameraPos()
    const d = Math.hypot(cam.x - windowB.x, cam.z - windowB.z)
    const tEnd = state().t
    say(`C5 ended: reason=${state().endReason} camera=${v(cam)} horiz to Window B=${d.toFixed(1)} t=${tEnd.toFixed(2)}`)
    expect(state().endReason).toBe("reached")
    expect(d).toBeLessThan(100.01)
    expect(alarm.isPlaying()).toBe(false)
    expect(state().getLowPlaying).toBe(false)
    expect(findSceneObjectByName("FloorArrow_0").enabled).toBe(false)
    expect(findSceneObjectByName("SmokeLayer").enabled).toBe(false)
    checkDebrief("Drill complete", "Door A hot -> Window B", "C5")
    await sleep(1000)
    near(state().t, tEnd, 0.001, "timer stopped")

    // Next drill: exits and meeting point kept, smoke and time reset, blocked exit swapped.
    const before = JSON.stringify(state().exits.map((e: any) => e.position))
    await hand.pressNextDrill()
    expect(state().phase).toBe("drill")
    expect(state().drillCount).toBe(2)
    expect(JSON.stringify(state().exits.map((e: any) => e.position))).toBe(before)
    expect(state().exits[0].isBlocked).toBe(false)
    expect(state().exits[1].isBlocked).toBe(true)
    expect(state().t).toBeLessThan(3)
    near(state().smokeY + 2.67 * state().t, -150 + 250, 0.5, "smoke restarted at the ceiling")
    expect(findSceneObjectByName("Debrief").enabled).toBe(false)
    expect(state().arrowTarget).toBe("Window B") // the newly blocked exit
    expect(state().checkedBlocked).toBe(false)
    nearColor(frameColor("ExitFrame_DoorA"), new vec4(0.6, 0.95, 1, 1), "Door A heat glow cleared")
    nearColor(frameColor("ExitFrame_WindowB"), new vec4(0.6, 0.95, 1, 1), "Window B highlight cleared")
    checkArrows(windowB, "C5 next drill")
    say(`C5 PASS (next drill: Door A open, Window B blocked, t=${state().t.toFixed(2)})`)
  }
}
