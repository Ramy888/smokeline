// SmokelineController — owns all drill state (single source of truth) for done criteria 1–3:
// pinch-to-mark exits + meeting point, Start unlock at 2 exits, alarm + dropping smoke, get-low cue.
// Inputs: Start UI, authored exit frames / meeting point / smoke layer, two AudioComponents, camera.
// Must not author UI (SmokelineStartUI owns the button) and must not make network calls.
// Criteria 4/5 are hooks only: isBlocked flags, checkExit() (log only), reachedExit() (unwired).
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import {Interactor, InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SmokelineStartUI} from "./SmokelineStartUI"

const FLOOR_Y = -150 // cm, preview floor; camera starts at origin at ~150 cm eye height
const EXIT_RAY_DISTANCE = 200 // cm along the pinch ray (brief stand-in for a wall hit)
const EXIT_CENTER_ABOVE_FLOOR = 100 // cm, frame centre height (brief)
const EXIT_SIZE = new vec3(100, 200, 10) // cm, frame width x height x collider depth (brief)
const MEETING_MAX_HORIZONTAL = 400 // cm, max floor distance for the meeting point (brief)
const SMOKE_START_HEIGHT = 250 // cm above floor (ceiling)
const SMOKE_MIN_HEIGHT = 90 // cm above floor, hold height
const SMOKE_DROP_RATE = 2.67 // cm per second
const DRILL_DURATION = 120 // s, drill ends at 2:00
const TRIGGER_DEBOUNCE = 0.15 // s, ignore a second interactor firing for the same pinch

type Phase = "marking" | "drill" | "ended"

interface ExitRecord {
  name: string
  isBlocked: boolean // criterion 4 hook: first marked (Door A) is the blocked one
  obj: SceneObject
  position: vec3
}

const log = (msg: string) => print("[smokeline] " + msg)
const fmt = (v: vec3) => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`

@component
export class SmokelineController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SmokelineController – fire drill flow (criteria 1–3)</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Start drill button UI module")
  startUi: SmokelineStartUI

  @input
  @hint("Authored exit frame placed by the first pinch (Door A, blocked)")
  exitFrameA: SceneObject

  @input
  @hint("Authored exit frame placed by the second pinch (Window B, open)")
  exitFrameB: SceneObject

  @input
  @hint("Authored floor marker for the meeting point")
  meetingPoint: SceneObject

  @input
  @hint("Horizontal smoke plane; its Y is driven every frame during the drill")
  smokeLayer: SceneObject

  @input
  @hint("Non-spatial alarm (temporal-3 pattern), loops during the drill")
  alarm: AudioComponent

  @input
  @hint("Non-spatial 'Get low' voice cue, loops while the head is above the smoke line")
  getLowCue: AudioComponent

  @input
  @hint("Camera whose world Y is the user's head height")
  cameraObject: SceneObject
  @ui.group_end

  private phase: Phase = "marking"
  private exits: ExitRecord[] = []
  private meeting: vec3 | null = null
  private startTime = 0
  private secondsInSmoke = 0
  private alarmOn = false
  private getLowOn = false
  private lastTriggerTime = -1
  private state: any

  onAwake() {
    if (!this.startUi || !this.exitFrameA || !this.exitFrameB || !this.meetingPoint || !this.smokeLayer ||
        !this.alarm || !this.getLowCue || !this.cameraObject) {
      log("ERROR: a required @input is not wired on SmokelineController")
      return
    }
    // One global state object, mutated in place every frame (never reassigned) for the LEAF tester.
    this.state = (global as any).smokeline = {
      phase: "marking", exits: [], meetingPoint: null, startEnabled: false, drillStarted: false,
      t: 0, smokeY: FLOOR_Y + SMOKE_START_HEIGHT, cameraY: 0,
      alarmPlaying: false, getLowPlaying: false, secondsInSmoke: 0
    }
    this.exitFrameA.enabled = false
    this.exitFrameB.enabled = false
    this.meetingPoint.enabled = false
    this.smokeLayer.enabled = false

    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart() {
    this.alarm.playbackMode = Audio.PlaybackMode.LowPower
    this.getLowCue.playbackMode = Audio.PlaybackMode.LowLatency // must stop/resume promptly on crouch
    this.startUi.setStartEnabled(false)
    this.startUi.onStart.add(() => this.startDrill())
    const interactors = InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)
    interactors.forEach((it) => it.onTriggerStart.add((target) => this.onPinch(it, target)))
    log(`ready, phase=marking, listening to ${interactors.length} interactors`)
  }

  // Pinch anywhere. A pinch that lands on an Interactable (exit frame, Start) is handled by that
  // target, so it never also places anything here.
  private onPinch(interactor: Interactor, target: Interactable | null) {
    if (target !== null || this.phase !== "marking") return
    const now = getTime()
    if (now - this.lastTriggerTime < TRIGGER_DEBOUNCE) return
    this.lastTriggerTime = now

    // SIK's mouse provider returns vec3.zero() (not null) when it has no ray, so check length too.
    const camT = this.cameraObject.getTransform()
    const rayOk = !!interactor.direction && interactor.direction.length > 1e-4 && !!interactor.startPoint
    const origin = rayOk ? interactor.startPoint : camT.getWorldPosition()
    const dir = (rayOk ? interactor.direction : camT.forward.uniformScale(-1)).normalize()
    log(`pinch ray origin=${fmt(origin)} dir=${fmt(dir)} (${rayOk ? "interactor" : "camera fallback"})`)

    // Floor hit within reach → meeting point; otherwise → exit frame along the ray.
    if (dir.y < 0) {
      const hit = origin.add(dir.uniformScale((FLOOR_Y - origin.y) / dir.y))
      const horiz = Math.hypot(hit.x - origin.x, hit.z - origin.z)
      if (horiz <= MEETING_MAX_HORIZONTAL) {
        this.placeMeetingPoint(hit)
        return
      }
    }
    if (this.exits.length < 2) this.placeExit(origin, dir)
  }

  private placeMeetingPoint(hit: vec3) {
    this.meeting = new vec3(hit.x, FLOOR_Y, hit.z)
    this.faceCamera(this.meetingPoint.getTransform(), this.meeting)
    this.meetingPoint.enabled = true
    this.state.meetingPoint = {x: this.meeting.x, y: this.meeting.y, z: this.meeting.z}
    log(`meeting point placed at ${fmt(this.meeting)}`)
  }

  private placeExit(origin: vec3, dir: vec3) {
    // shortcut: preview places 200 cm along the ray; on device use WorldQueryModule hit
    const p = origin.add(dir.uniformScale(EXIT_RAY_DISTANCE))
    const pos = new vec3(p.x, FLOOR_Y + EXIT_CENTER_ABOVE_FLOOR, p.z) // stands upright on the floor
    const isFirst = this.exits.length === 0
    const obj = isFirst ? this.exitFrameA : this.exitFrameB
    const exit: ExitRecord = {name: isFirst ? "Door A" : "Window B", isBlocked: isFirst, obj, position: pos}

    this.faceCamera(obj.getTransform(), pos)
    obj.enabled = true
    this.makePinchable(exit)

    this.exits.push(exit)
    this.state.exits.push({name: exit.name, isBlocked: exit.isBlocked, position: {x: pos.x, y: pos.y, z: pos.z}})
    log(`exit placed: ${exit.name} at ${fmt(pos)} blocked=${exit.isBlocked}`)

    if (this.exits.length === 2) {
      this.startUi.setStartEnabled(true)
      this.state.startEnabled = true
      log("start enabled (2 exits)")
    }
  }

  private faceCamera(t: Transform, pos: vec3) {
    t.setWorldPosition(pos)
    const cam = this.cameraObject.getTransform().getWorldPosition()
    t.setWorldRotation(quat.angleAxis(Math.atan2(cam.x - pos.x, cam.z - pos.z), vec3.up())) // yaw only, +Z faces camera
  }

  // Frames stay pinchable during the drill (criterion 4 hook). Created after enabling so the
  // Interactable registers with SIK when it actually initializes.
  private makePinchable(exit: ExitRecord) {
    const collider = exit.obj.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = EXIT_SIZE
    collider.shape = shape
    const interactable = exit.obj.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onTriggerStart.add(() => {
      if (this.phase === "drill") this.checkExit(exit)
    })
  }

  private startDrill() {
    if (this.phase !== "marking" || this.exits.length < 2) return
    this.phase = "drill"
    this.startTime = getTime()
    this.secondsInSmoke = 0
    this.startUi.hide()
    this.smokeLayer.enabled = true
    this.alarm.play(-1)
    this.alarmOn = true
    this.state.drillStarted = true
    log("drill started")
    log("alarm playing")
  }

  private onUpdate() {
    if (!this.state) return
    const camY = this.cameraObject.getTransform().getWorldPosition().y
    this.state.cameraY = camY
    if (this.phase === "drill") {
      const t = getTime() - this.startTime
      const smokeY = FLOOR_Y + Math.max(SMOKE_MIN_HEIGHT, SMOKE_START_HEIGHT - SMOKE_DROP_RATE * t)
      const st = this.smokeLayer.getTransform()
      const sp = st.getWorldPosition()
      st.setWorldPosition(new vec3(sp.x, smokeY, sp.z))

      const headInSmoke = camY > smokeY
      if (headInSmoke) this.secondsInSmoke += getDeltaTime()
      this.setGetLow(headInSmoke)
      this.state.t = t
      this.state.smokeY = smokeY
      this.state.secondsInSmoke = this.secondsInSmoke
      if (t >= DRILL_DURATION) this.endDrill()
    }
    this.state.phase = this.phase
    this.state.alarmPlaying = this.alarmOn
    this.state.getLowPlaying = this.getLowOn
  }

  private setGetLow(on: boolean) {
    if (on === this.getLowOn) return
    this.getLowOn = on
    if (on) this.getLowCue.play(-1)
    else this.getLowCue.stop(false)
    log(`get-low ${on ? "on" : "off"}`)
  }

  private endDrill() {
    this.phase = "ended"
    this.setGetLow(false)
    this.alarm.stop(false)
    this.alarmOn = false
    log(`time's up (secondsInSmoke=${this.secondsInSmoke.toFixed(1)}) — debrief is criterion 5, not built`)
  }

  /** Criterion 4 hook: pinching an exit frame during the drill. Log only for now. */
  checkExit(exit: ExitRecord): void {
    log(`checkExit ${exit.name} blocked=${exit.isBlocked} (hook only: no heat glow / reroute yet)`)
  }

  /** Criterion 5 hook: true when the camera is within 100 cm (horizontal) of the open exit. Not wired. */
  reachedExit(): boolean {
    const open = this.exits.find((e) => !e.isBlocked)
    if (!open) return false
    const c = this.cameraObject.getTransform().getWorldPosition()
    return Math.hypot(c.x - open.position.x, c.z - open.position.z) <= 100
  }
}
