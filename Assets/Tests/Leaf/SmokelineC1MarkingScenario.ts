// Done criterion 1: two wall-aimed pinches place exit frames 200 cm along the look ray, a floor-aimed
// pinch places the meeting point, and Start unlocks only at 2 exits (a locked press does nothing).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {FLOOR_Y, SmokelineLeafHand, cameraPos, near, say, state, v} from "./SmokelineLeafHand"

@component
export class SmokelineC1MarkingScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const hand = new SmokelineLeafHand()
    const s = state()
    expect(s.phase).toBe("marking")
    expect(s.exits.length).toBe(0)
    expect(s.startEnabled).toBe(false)

    const checkExit = (i: number, origin: vec3, dir: vec3, name: string, blocked: boolean, objName: string) => {
      const e = state().exits[i]
      const horiz = Math.hypot(e.position.x - origin.x, e.position.z - origin.z)
      const want = 200 * Math.hypot(dir.x, dir.z)
      say(`C1 exit[${i}] ${e.name} blocked=${e.isBlocked} at ${v(e.position)} horiz=${horiz.toFixed(2)} expected=${want.toFixed(2)} ray origin=${v(origin)} dir=${v(dir)}`)
      expect(e.name).toBe(name)
      expect(e.isBlocked).toBe(blocked)
      near(e.position.x, origin.x + 200 * dir.x, 0.5, `${name} x`)
      near(e.position.z, origin.z + 200 * dir.z, 0.5, `${name} z`)
      near(horiz, want, 0.5, `${name} horizontal distance from ray origin`)
      near(e.position.y, FLOOR_Y + 100, 0.01, `${name} y (centre 100 cm above floor)`)
      const obj = findSceneObjectByName(objName)
      expect(obj.enabled).toBe(true)
      const wp = obj.getTransform().getWorldPosition()
      near(wp.distance(new vec3(e.position.x, e.position.y, e.position.z)), 0, 0.5, `${objName} world position vs state`)
    }

    // 1) Locked Start before any exit: must not start the drill and must not place an exit.
    await hand.pressStart()
    expect(state().drillStarted).toBe(false)
    expect(state().phase).toBe("marking")
    expect(state().exits.length).toBe(0)
    say("C1 locked Start press (0 exits): drillStarted=false, exits=0")

    // 2) Wall spot A: level ray to the front-left.
    const cam = cameraPos()
    const a = await hand.pinchToward(cam, cam.add(new vec3(-120, 0, -160)))
    expect(state().exits.length).toBe(1)
    checkExit(0, a.origin, a.dir, "Door A", true, "ExitFrame_DoorA")
    expect(state().startEnabled).toBe(false)

    // 3) Locked Start with 1 exit: still nothing.
    await hand.pressStart()
    expect(state().drillStarted).toBe(false)
    expect(state().phase).toBe("marking")
    expect(state().exits.length).toBe(1)
    say("C1 locked Start press (1 exit): drillStarted=false, exits=1")

    // 4) Floor: ray pitched down, floor hit 200 cm ahead -> meeting point.
    const f = await hand.pinchToward(cam, cam.add(new vec3(0, FLOOR_Y - cam.y, -200)))
    const mp = state().meetingPoint
    expect(mp === null).toBe(false)
    const t = (FLOOR_Y - f.origin.y) / f.dir.y
    const hit = f.origin.add(f.dir.uniformScale(t))
    say(`C1 meeting point at ${v(mp)} expected floor hit ${v(hit)}`)
    near(mp.x, hit.x, 0.5, "meeting x")
    near(mp.z, hit.z, 0.5, "meeting z")
    near(mp.y, FLOOR_Y, 0.01, "meeting y")
    expect(findSceneObjectByName("MeetingPoint").enabled).toBe(true)
    expect(state().exits.length).toBe(1) // floor pinch must not add an exit
    expect(state().startEnabled).toBe(false)

    // 5) Wall spot B: front-right, pitched 10 deg down (floor hit ~850 cm away > 400 cm) -> still an exit.
    const pitch = (10 * Math.PI) / 180
    const b = await hand.pinchToward(cam, cam.add(new vec3(120, -200 * Math.tan(pitch), -160)))
    expect(state().exits.length).toBe(2)
    checkExit(1, b.origin, b.dir, "Window B", false, "ExitFrame_WindowB")

    // 6) Start now unlocked.
    expect(state().startEnabled).toBe(true)
    expect(state().drillStarted).toBe(false)
    say(`C1 PASS: exits=2 startEnabled=${state().startEnabled} meetingPoint=${v(state().meetingPoint)}`)
  }
}
