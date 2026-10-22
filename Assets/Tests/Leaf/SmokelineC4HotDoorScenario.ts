// Done criterion 4: pinching the blocked exit (Door A on the first drill) shows the orange heat glow on its
// frame, plays "second way out" as spatial audio from the open exit, and the floor arrows reroute to the
// open exit. Pinching the open exit first only highlights it. Also checks the out-of-view edge arrow.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  SmokelineLeafHand, cameraPos, checkArrows, frameColor, near, nearColor, say, state, v, waitFor
} from "./SmokelineLeafHand"

const CYAN = new vec4(0.6, 0.95, 1, 1)
const HEAT = new vec4(1, 0.45, 0.1, 1)
const WHITE = new vec4(1, 1, 1, 1)

@component
export class SmokelineC4HotDoorScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const cue = findSceneObjectByName("SecondWayOutCue").getComponent("Component.AudioComponent") as AudioComponent

    await hand.markTwoExits()
    await hand.pressStart()
    const [doorA, windowB] = state().exits
    expect(doorA.isBlocked).toBe(true)
    expect(windowB.isBlocked).toBe(false)

    // Before any check: route leads to Door A, no glow, no voice.
    await sleep(200)
    expect(state().phase).toBe("drill")
    expect(state().arrowTarget).toBe("Door A")
    expect(state().checkedBlocked).toBe(false)
    expect(cue.isPlaying()).toBe(false)
    nearColor(frameColor("ExitFrame_DoorA"), CYAN, "Door A before check")
    checkArrows(doorA.position, "C4 pre-check")

    // 1) Open exit first: only highlights it.
    await hand.pinchFrame("ExitFrame_WindowB")
    expect(state().highlighted).toBe("Window B")
    expect(state().phase).toBe("drill")
    expect(state().checkedBlocked).toBe(false)
    expect(state().arrowTarget).toBe("Door A")
    expect(cue.isPlaying()).toBe(false)
    nearColor(frameColor("ExitFrame_WindowB"), WHITE, "Window B highlighted")
    nearColor(frameColor("ExitFrame_DoorA"), CYAN, "Door A still cool")
    checkArrows(doorA.position, "C4 after open-exit pinch")
    say("C4 open exit before check: highlighted only, no reroute, no cue")

    // 2) Blocked exit: heat glow, spatial voice from the open exit, arrows reroute.
    // The voice clip is ~0.9 s, so catch it playing while the pinch is still in flight.
    const pinch = hand.pinchFrame("ExitFrame_DoorA")
    await waitFor(() => cue.isPlaying(), 5000, '"second way out" playing')
    const cuePos = cue.getSceneObject().getTransform().getWorldPosition()
    say(`C4 cue playing=${cue.isPlaying()} at ${v(cuePos)}; Window B at ${v(windowB.position)}`)
    await pinch
    expect(state().checkedBlocked).toBe(true)
    expect(state().phase).toBe("drill")
    nearColor(frameColor("ExitFrame_DoorA"), HEAT, "Door A heat glow")
    expect(cue.spatialAudio.enabled).toBe(true)
    expect(cue.spatialAudio.positionEffect.enabled).toBe(true)
    near(cuePos.distance(new vec3(windowB.position.x, windowB.position.y, windowB.position.z)), 0, 0.5, "cue at the open exit")
    expect(state().arrowTarget).toBe("Window B")
    checkArrows(windowB.position, "C4 after reroute")

    // 3) Edge arrow: Window B is ~39° off the look direction here, so it is out of view.
    const cam = cameraPos()
    const look = findSceneObjectByName("Camera Object").getTransform().forward.uniformScale(-1)
    const toB = new vec3(windowB.position.x, windowB.position.y, windowB.position.z).sub(cam).normalize()
    const offDeg = (look.angleTo(toB) * 180) / Math.PI
    const edge = findSceneObjectByName("EdgeArrow")
    const et = edge.getTransform()
    const side = toB.sub(look.uniformScale(toB.dot(look))).normalize()
    const ep = et.getWorldPosition()
    say(`C4 edge arrow: target ${offDeg.toFixed(1)}° off view, enabled=${edge.enabled} at ${v(ep)} point=${et.up.normalize().dot(side).toFixed(4)} scale=${v(et.getWorldScale())}`)
    expect(offDeg).toBeGreaterThan(20)
    expect(state().edgeArrowVisible).toBe(true)
    expect(edge.enabled).toBe(true)
    expect(et.up.normalize().dot(side)).toBeGreaterThan(0.99) // points towards Window B
    near(ep.sub(cam).dot(look), 80, 1, "edge arrow 80 cm ahead")
    near(et.getWorldScale().x, 15, 0.1, "edge arrow width")
    near(et.getWorldScale().y, 15, 0.1, "edge arrow height")
    say("C4 PASS")
  }
}
