// Done criterion 3: while the camera is above the smoke line the "get low" cue plays; going below
// the line stops it; standing back up turns it on again.
// LEAF cannot move the head: DeviceTracking overwrites Camera Object every frame, so the camera must be
// moved from outside the Lens (MovePreviewCamera verified; injected Q/E strafe sideways in this preview).
// stop_after=A (default): assert the above-line state and return with the drill running; the crouch /
//   stand-up is then driven with MovePreviewCamera and checked via "[smokeline] get-low off/on" logs.
// stop_after="": also wait (wait_secs each) for an external crouch and stand-up during the run.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SmokelineLeafHand, say, state, waitFor} from "./SmokelineLeafHand"

@component
export class SmokelineC3GetLowScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const waitMs = (config?.getNumber("wait_secs") ?? 60) * 1000
    const stopAfter = config?.get("stop_after") ?? "A" // "A": return after step A, drill keeps running
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const cue = findSceneObjectByName("GetLowCue").getComponent("Component.AudioComponent") as AudioComponent
    const snap = () => {
      const s = state()
      return `t=${s.t.toFixed(2)} cameraY=${s.cameraY.toFixed(2)} smokeY=${s.smokeY.toFixed(2)} getLowPlaying=${s.getLowPlaying} cue.isPlaying()=${cue.isPlaying()} secondsInSmoke=${s.secondsInSmoke.toFixed(2)}`
    }

    await hand.markTwoExits()
    await hand.pressStart()
    expect(state().phase).toBe("drill")
    say(`C3 stop_after=${stopAfter} drill started: ${snap()}`)

    // A) Head above the smoke line -> cue on.
    say("C3 STEP_A waiting for cameraY > smokeY")
    await waitFor(() => state().cameraY > state().smokeY && state().getLowPlaying, waitMs, "head above smoke and getLowPlaying=true")
    await nextFrame()
    expect(state().getLowPlaying).toBe(true)
    expect(cue.isPlaying()).toBe(true)
    say(`C3 A above line: ${snap()}`)
    if (stopAfter === "A") {
      say("C3 stop_after=A: returning with the drill running; crouch/stand verified outside LEAF")
      return
    }

    // B) Crouch below the line -> cue off.
    say("C3 STEP_B waiting for cameraY < smokeY (crouch)")
    await waitFor(() => state().cameraY < state().smokeY, waitMs, "camera below smoke line")
    await nextFrame()
    await nextFrame()
    expect(state().getLowPlaying).toBe(false)
    expect(cue.isPlaying()).toBe(false)
    say(`C3 B below line: ${snap()}`)
    await sleep(1000)
    expect(state().getLowPlaying).toBe(false) // stays off while crouched
    say(`C3 B still below after 1 s: ${snap()}`)

    // C) Stand back up -> cue on again.
    say("C3 STEP_C waiting for cameraY > smokeY again (stand up)")
    await waitFor(() => state().cameraY > state().smokeY, waitMs, "camera back above smoke line")
    await nextFrame()
    await nextFrame()
    expect(state().getLowPlaying).toBe(true)
    expect(cue.isPlaying()).toBe(true)
    say(`C3 C above again: ${snap()}`)
    say("C3 PASS")
  }
}
