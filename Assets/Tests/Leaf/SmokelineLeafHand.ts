// Test-only LEAF interactor for Smokeline. Wraps the EXISTING SIK RightHandInteractor (the one
// SmokelineController subscribed to in onStart), so empty-space pinches go through SIK's real
// onTriggerStart(null) -> SmokelineController.onPinch path. The ray is test-set (startPoint/endPoint).
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"

export const FLOOR_Y = -150
export const say = (msg: string) => print("[leaf-smokeline] " + msg)
export const v = (p: {x: number; y: number; z: number}) =>
  `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`

export function state(): any {
  const s = (global as any).smokeline
  if (!s) throw new Error("global.smokeline missing — SmokelineController did not initialise")
  return s
}

export function cameraPos(): vec3 {
  return findSceneObjectByName("Camera Object").getTransform().getWorldPosition()
}

export async function waitFor(pred: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const end = getTime() * 1000 + timeoutMs
  while (!pred()) {
    if (getTime() * 1000 > end) throw new Error(`timeout after ${timeoutMs} ms waiting for: ${what}`)
    await nextFrame()
  }
}

export class SmokelineLeafHand extends LeafSingleHandInteractor {
  constructor() {
    super("right", true)
  }

  /** Pinch with a ray from `origin` towards `aimPoint`; `hit` is the Interactable the ray hits (null = empty space). */
  async pinchToward(origin: vec3, aimPoint: vec3, hit: Interactable | null = null): Promise<{origin: vec3; dir: vec3}> {
    const dir = aimPoint.sub(origin).normalize()
    // shortcut: LEAF's simulated hand never makes SIK report isPinching() in this preview, and LEAF's
    // startSelecting() override lands after SIK's processTriggerEvents, so neither reaches
    // Interactor.onTriggerStart listeners. We emit the RightHandInteractor's own onTriggerStart(hit)
    // (what SIK emits on a pinch); the ray comes from LEAF's startPoint/direction overrides.
    this.startPoint = origin
    this.endPoint = aimPoint
    let starts = 0
    const unsub = this.sikInteractor.onTriggerStart.add(() => starts++)
    try {
      await nextFrame()
      ;(this.sikInteractor as any).onTriggerStartEvent.invoke(hit)
      await nextFrame()
    } finally {
      unsub()
      this.resetStartEndPoint()
    }
    say(`pinch delivered via RightHandInteractor.onTriggerStart(${hit ? hit.sceneObject.name : "null"}) x${starts}, ray origin=${v(origin)} dir=${v(dir)}`)
    await sleep(300) // > 150 ms controller debounce between pinches
    return {origin, dir}
  }

  /** Real LEAF trigger on the UIKit Start button (Interactable on StartButtonVisual). */
  async pressStart(): Promise<void> {
    await this.pressHiding("StartButtonVisual", () => state().drillStarted, "drill to start")
  }

  /** Real LEAF trigger on the debrief's UIKit "Next drill" button. */
  async pressNextDrill(): Promise<void> {
    const n = state().drillCount
    await this.pressHiding("NextDrillButton", () => state().drillCount > n, "next drill to start")
  }

  /** Real LEAF trigger on an exit frame's Interactable (the drill's "check a door"). */
  async pinchFrame(objName: string): Promise<void> {
    const it = findInteractableByName(objName)
    if (!it) throw new Error(`Interactable "${objName}" not found`)
    await this.trigger(it)
    say(`LEAF trigger on ${objName} completed`)
    await sleep(300)
  }

  // A button that hides itself on a successful press can hang LEAF's trailing hover-exit wait, so
  // resolve on whichever comes first: trigger finished, or the expected effect happened.
  private async pressHiding(objName: string, effect: () => boolean, what: string): Promise<void> {
    // A UIKit button built while its panel was hidden registers its Interactable a few frames after show.
    await waitFor(() => !!findInteractableByName(objName), 3000, `Interactable "${objName}" to register`)
    const btn = findInteractableByName(objName)
    const t0 = getTime()
    let done = false
    let err: any = null
    this.trigger(btn).then(() => (done = true), (e) => (err = e))
    await waitFor(() => done || err !== null || effect(), 30000, `${objName} press to complete or ${what}`)
    if (err) throw err
    say(`${objName} press: ${done ? "trigger completed" : what + " (button hid itself)"} after ${(getTime() - t0).toFixed(2)} s`)
    await sleep(300)
  }

  /** Marks Door A (aim left) and Window B (aim right) at eye level; asserts both landed. */
  async markTwoExits(): Promise<void> {
    const cam = cameraPos()
    await this.pinchToward(cam, cam.add(new vec3(-120, 0, -160)))
    await this.pinchToward(cam, cam.add(new vec3(120, 0, -160)))
    expect(state().exits.length).toBe(2)
    expect(state().startEnabled).toBe(true)
  }
}

/** World-space material colour of an exit frame's bars (all bars share one per-frame clone). */
export function frameColor(objName: string): vec4 {
  const rmv = findSceneObjectByName(objName).getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return rmv.mainMaterial.mainPass.baseColor
}

export function nearColor(c: vec4, want: vec4, label: string): void {
  near(c.r, want.r, 0.02, `${label} r`)
  near(c.g, want.g, 0.02, `${label} g`)
  near(c.b, want.b, 0.02, `${label} b`)
}

/** Floor arrows: on the floor, centres 100–200 cm ahead of the camera, 50x80 cm, pointing at `target`. */
export function checkArrows(target: {x: number; z: number}, label: string): void {
  const cam = cameraPos()
  const want = new vec3(target.x - cam.x, 0, target.z - cam.z).normalize()
  for (let i = 0; i < 2; i++) {
    const obj = findSceneObjectByName(`FloorArrow_${i}`)
    const t = obj.getTransform()
    const p = t.getWorldPosition()
    const horiz = Math.hypot(p.x - cam.x, p.z - cam.z)
    const along = new vec3(p.x - cam.x, 0, p.z - cam.z).normalize().dot(want)
    const point = t.up.normalize().dot(want) // arrow tip is local +Y
    const flat = t.forward.normalize().dot(vec3.up()) // face is local +Z
    const s = t.getWorldScale()
    say(`${label} FloorArrow_${i} at ${v(p)} horiz=${horiz.toFixed(1)} along=${along.toFixed(4)} point=${point.toFixed(4)} flat=${flat.toFixed(4)} scale=${v(s)}`)
    expect(obj.enabled).toBe(true)
    near(p.y, FLOOR_Y + 2, 1.5, `${label} arrow ${i} on the floor`)
    expect(horiz >= 100 && horiz <= 200).toBe(true)
    expect(along).toBeGreaterThan(0.99) // placed ahead of the user towards the target
    expect(point).toBeGreaterThan(0.99) // points at the target
    expect(flat).toBeGreaterThan(0.99) // lies flat
    near(s.x, 50, 0.5, `${label} arrow ${i} width`)
    near(s.y, 80, 0.5, `${label} arrow ${i} length`)
  }
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
const textOf = (name: string) => (findSceneObjectByName(name).getComponent("Component.Text") as Text).text

/** Debrief: shown, 90x60 cm, lying flat on the floor 60–160 cm ahead, with the given title/route and live stats. */
export function checkDebrief(title: string, route: string, label: string): void {
  const s = state()
  const cam = cameraPos()
  const root = findSceneObjectByName("Debrief")
  const t = root.getTransform()
  const p = t.getWorldPosition()
  const horiz = Math.hypot(p.x - cam.x, p.z - cam.z)
  const wp = (n: string) => findSceneObjectByName(n).getTransform().getWorldPosition()
  const width = wp("DebriefBorder_Left").distance(wp("DebriefBorder_Right"))
  const depth = wp("DebriefBorder_Top").distance(wp("DebriefBorder_Bottom"))
  const nearEdge = Math.hypot(wp("DebriefBorder_Bottom").x - cam.x, wp("DebriefBorder_Bottom").z - cam.z)
  const farEdge = Math.hypot(wp("DebriefBorder_Top").x - cam.x, wp("DebriefBorder_Top").z - cam.z)
  const lines = [textOf("DebriefTitle"), textOf("DebriefLine0"), textOf("DebriefLine1"), textOf("DebriefLine2")]
  say(`${label} debrief enabled=${root.enabled} centre=${v(p)} horiz=${horiz.toFixed(1)} edges ${nearEdge.toFixed(1)}–${farEdge.toFixed(1)} cm size=${width.toFixed(1)}x${depth.toFixed(1)} flat=${t.forward.normalize().dot(vec3.up()).toFixed(4)} text=${JSON.stringify(lines)}`)
  expect(root.enabled).toBe(true)
  near(p.y, FLOOR_Y + 2, 1.5, `${label} debrief on the floor`)
  expect(t.forward.normalize().dot(vec3.up())).toBeGreaterThan(0.99)
  near(width, 90, 1, `${label} debrief width`)
  near(depth, 60, 1, `${label} debrief depth`)
  expect(nearEdge >= 60 && farEdge <= 160).toBe(true)
  expect(farEdge).toBeGreaterThan(nearEdge) // the far (top) edge of the text is away from the user
  expect(lines[0]).toBe(title)
  expect(lines[1]).toBe(`Time ${fmtTime(Math.min(s.t, 120))} / 2:00`)
  expect(lines[2]).toBe(`Above the smoke line: ${Math.round(s.secondsInSmoke)} s`)
  expect(lines[3]).toBe(`Route: ${route}`)
  expect(findSceneObjectByName("NextDrillButton").enabled).toBe(true)
}

/** Numeric assert with tolerance and a readable failure message. */
export function near(actual: number, expected: number, tol: number, label: string): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${label}: expected ${expected.toFixed(2)} ±${tol}, got ${actual.toFixed(2)}`)
  }
}
