// Done criterion 2: pressing Start plays the alarm and the smoke layer starts dropping from the ceiling.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FLOOR_Y, SmokelineLeafHand, near, say, state} from "./SmokelineLeafHand"

@component
export class SmokelineC2DrillScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const alarm = findSceneObjectByName("Alarm").getComponent("Component.AudioComponent") as AudioComponent
    const smoke = findSceneObjectByName("SmokeLayer")

    await hand.markTwoExits()
    expect(state().alarmPlaying).toBe(false)
    expect(alarm.isPlaying()).toBe(false)
    expect(smoke.enabled).toBe(false)

    await hand.pressStart()
    const s1 = state().smokeY
    const t1 = state().t
    expect(state().phase).toBe("drill")
    expect(state().drillStarted).toBe(true)
    expect(state().alarmPlaying).toBe(true)
    expect(alarm.isPlaying()).toBe(true)
    expect(smoke.enabled).toBe(true)
    expect(findSceneObjectByName("StartButton").enabled).toBe(false) // hidden during the drill
    // pressStart() returns ~1-2 s after onStart fired, so check the start height at t=0 from (smokeY, t).
    expect(t1).toBeLessThan(3)
    expect(s1).toBeLessThan(FLOOR_Y + 250 + 0.01)
    near(s1 + 2.67 * t1, FLOOR_Y + 250, 0.5, "smokeY extrapolated to t=0 (ceiling, +100)")
    near(smoke.getTransform().getWorldPosition().y, s1, 0.5, "SmokeLayer world Y vs state.smokeY")
    say(`C2 after Start: phase=drill alarmPlaying=true AudioComponent.isPlaying()=${alarm.isPlaying()} smokeY=${s1.toFixed(2)} t=${t1.toFixed(2)}`)

    await sleep(1500)
    const s2 = state().smokeY
    const t2 = state().t
    const plane2 = smoke.getTransform().getWorldPosition().y
    say(`C2 +${(t2 - t1).toFixed(2)} s: smokeY=${s2.toFixed(2)} (dropped ${(s1 - s2).toFixed(2)} cm) planeY=${plane2.toFixed(2)} alarm.isPlaying()=${alarm.isPlaying()}`)
    expect(t2 - t1).toBeGreaterThan(1)
    expect(s1 - s2).toBeGreaterThan(2) // 2.67 cm/s * >1 s
    near(s1 - s2, 2.67 * (t2 - t1), 0.5, "drop matches 2.67 cm/s")
    near(plane2, s2, 0.5, "SmokeLayer world Y follows smokeY")
    expect(alarm.isPlaying()).toBe(true)
    say("C2 PASS")
  }
}
