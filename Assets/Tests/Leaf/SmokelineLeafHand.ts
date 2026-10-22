// Test-only LEAF interactor for Smokeline. Wraps the EXISTING SIK RightHandInteractor (the one
// SmokelineController subscribed to in onStart), so empty-space pinches go through SIK's real
// onTriggerStart(null) -> SmokelineController.onPinch path. The ray is test-set (startPoint/endPoint).
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
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

  /** Pinch on empty space with a ray from `origin` towards `aimPoint`. Returns the ray used. */
  async pinchToward(origin: vec3, aimPoint: vec3): Promise<{origin: vec3; dir: vec3}> {
    const dir = aimPoint.sub(origin).normalize()
    // shortcut: LEAF's simulated hand never makes SIK report isPinching() in this preview, and LEAF's
    // startSelecting() override lands after SIK's processTriggerEvents, so neither reaches
    // Interactor.onTriggerStart listeners. We emit the RightHandInteractor's own onTriggerStart(null)
    // (what SIK emits on an empty-space pinch); the ray comes from LEAF's startPoint/direction overrides.
    this.startPoint = origin
    this.endPoint = aimPoint
    let starts = 0
    const unsub = this.sikInteractor.onTriggerStart.add(() => starts++)
    try {
      await nextFrame()
      ;(this.sikInteractor as any).onTriggerStartEvent.invoke(null)
      await nextFrame()
    } finally {
      unsub()
      this.resetStartEndPoint()
    }
    say(`pinch delivered via RightHandInteractor.onTriggerStart(null) x${starts}, ray origin=${v(origin)} dir=${v(dir)}`)
    await sleep(300) // > 150 ms controller debounce between pinches
    return {origin, dir}
  }

  /** Real LEAF trigger on the UIKit Start button (Interactable on StartButtonVisual). */
  async pressStart(): Promise<void> {
    const btn = findInteractableByName("StartButtonVisual")
    if (!btn) throw new Error('Interactable "StartButtonVisual" not found')
    // The button hides itself on a successful press, so LEAF's trailing hover-exit wait can hang;
    // resolve on whichever comes first: trigger finished, or the drill started.
    const t0 = getTime()
    let done = false
    let err: any = null
    this.trigger(btn).then(() => (done = true), (e) => (err = e))
    await waitFor(() => done || err !== null || state().drillStarted, 30000, "Start press to complete or drill to start")
    if (err) throw err
    say(`Start press: ${done ? "trigger completed" : "drill started (button hid itself)"} after ${(getTime() - t0).toFixed(2)} s`)
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

/** Numeric assert with tolerance and a readable failure message. */
export function near(actual: number, expected: number, tol: number, label: string): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${label}: expected ${expected.toFixed(2)} ±${tol}, got ${actual.toFixed(2)}`)
  }
}
