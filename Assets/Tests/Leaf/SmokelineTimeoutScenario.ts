// The 2:00 end from the brief: standing still (head above the smoke line), the drill runs out at 2:00, cues
// stop, and the debrief shows "Time's up, try again" with the stats and the next-drill button. Then the
// next drill keeps exits + meeting point, resets smoke/time and swaps the blocked exit, so the second
// drill's hot door is Window B and the voice + arrows go to Door A. Takes ~2.5 minutes.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  FLOOR_Y, SmokelineLeafHand, cameraPos, checkArrows, checkDebrief, frameColor, near, nearColor, say, state, v, waitFor
} from "./SmokelineLeafHand"

@component
export class SmokelineTimeoutScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const alarm = findSceneObjectByName("Alarm").getComponent("Component.AudioComponent") as AudioComponent
    const getLow = findSceneObjectByName("GetLowCue").getComponent("Component.AudioComponent") as AudioComponent
    const cue = findSceneObjectByName("SecondWayOutCue").getComponent("Component.AudioComponent") as AudioComponent

    await hand.markTwoExits()
    const cam = cameraPos()
    await hand.pinchToward(cam, cam.add(new vec3(0, FLOOR_Y - cam.y, -200)))
    const meeting = JSON.stringify(state().meetingPoint)
    expect(state().meetingPoint === null).toBe(false)
    await hand.pressStart()

    await waitFor(() => state().phase === "ended", 135000, "drill to end at 2:00")
    const s = state()
    say(`TIMEOUT ended: reason=${s.endReason} t=${s.t.toFixed(2)} secondsInSmoke=${s.secondsInSmoke.toFixed(2)} cameraY=${s.cameraY.toFixed(1)}`)
    expect(s.endReason).toBe("timeout")
    expect(s.t >= 120 && s.t < 121).toBe(true)
    // Head at y=0 is in smoke once the line passes it: t > (100 - 0) / 2.67 = 37.5 s, so ~82.5 s.
    near(s.secondsInSmoke, 120 - 100 / 2.67, 2, "seconds above the smoke line")
    expect(alarm.isPlaying()).toBe(false)
    expect(getLow.isPlaying()).toBe(false)
    expect(cue.isPlaying()).toBe(false)
    expect(s.alarmPlaying).toBe(false)
    expect(s.getLowPlaying).toBe(false)
    checkDebrief("Time's up, try again", "no exit reached", "TIMEOUT")

    await hand.pressNextDrill()
    expect(state().phase).toBe("drill")
    expect(state().drillCount).toBe(2)
    expect(JSON.stringify(state().meetingPoint)).toBe(meeting)
    expect(findSceneObjectByName("MeetingPoint").enabled).toBe(true)
    expect(state().exits.length).toBe(2)
    expect(state().exits[0].isBlocked).toBe(false)
    expect(state().exits[1].isBlocked).toBe(true)
    expect(state().t).toBeLessThan(3)
    expect(state().secondsInSmoke).toBe(0)
    near(state().smokeY + 2.67 * state().t, FLOOR_Y + 250, 0.5, "smoke restarted at the ceiling")
    expect(alarm.isPlaying()).toBe(true)
    expect(findSceneObjectByName("Debrief").enabled).toBe(false)

    // Second drill: Window B is the hot one now.
    const [doorA, windowB] = state().exits
    const pinch = hand.pinchFrame("ExitFrame_WindowB")
    await waitFor(() => cue.isPlaying(), 5000, '"second way out" playing (drill 2)') // ~0.9 s clip
    const cuePos = cue.getSceneObject().getTransform().getWorldPosition()
    await pinch
    nearColor(frameColor("ExitFrame_WindowB"), new vec4(1, 0.45, 0.1, 1), "Window B heat glow (drill 2)")
    nearColor(frameColor("ExitFrame_DoorA"), new vec4(0.6, 0.95, 1, 1), "Door A cool (drill 2)")
    near(cuePos.distance(new vec3(doorA.position.x, doorA.position.y, doorA.position.z)), 0, 0.5, "drill 2 cue at Door A")
    expect(state().arrowTarget).toBe("Door A")
    checkArrows(doorA.position, "TIMEOUT drill 2 reroute")
    say(`TIMEOUT PASS (drill 2 cue at ${v(cuePos)}, Window B ${v(windowB.position)} hot)`)
  }
}
