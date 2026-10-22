// SmokelineController — owns all drill state (single source of truth) for done criteria 1–5:
// pinch-to-mark exits + meeting point, Start unlock at 2 exits, alarm + dropping smoke, get-low cue,
// hot-door check + spatial "second way out" + floor-arrow reroute, reach/timeout debrief, next drill.
// Inputs: Start + Debrief UI modules, authored exit frames / meeting point / smoke layer, three
// AudioComponents, camera. Must not author UI (the UI modules own buttons and text) and must not
// make network calls.
import {InteractionManager} from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import {Interactor, InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {SmokelineStartUI} from "./SmokelineStartUI"
import {SmokelineDebriefUI} from "./SmokelineDebriefUI"

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
const REACH_DISTANCE = 100 // cm horizontal to the open exit ends the drill (criterion 5)
const ARROW_SIZE = new vec3(50, 80, 1) // cm, floor arrow width x length (brief)
const ARROW_DISTANCES = [110, 190] // cm ahead of the user, arrow centres (brief: 100–200)
const FLOOR_LIFT = 2 // cm above the floor so flat content isn't hidden by the preview room's floor
const DEBRIEF_DISTANCE = 110 // cm ahead to the debrief centre; 60 cm deep -> spans 80–140 (brief: 60–160)
const EDGE_ARROW_SIZE = new vec3(15, 15, 1) // cm (brief)
const EDGE_ARROW_AHEAD = 80 // cm in front of the eyes
const EDGE_ARROW_OFFSET = 20 // cm towards the screen edge (~14° off centre, inside the Specs view)
const OUT_OF_VIEW_DEG = 20 // target further than this from the look direction counts as out of view
const HEAT_COLOR = new vec4(1, 0.45, 0.1, 1) // orange heat glow
const HIGHLIGHT_COLOR = new vec4(1, 1, 1, 1) // brightest on an additive display

type Phase = "marking" | "drill" | "ended"

interface ExitRecord {
  name: string
  isBlocked: boolean // first marked (Door A) is blocked on the first drill; swaps every next drill
  obj: SceneObject
  position: vec3
  material: Material // per-frame clone so tints don't leak to the other frame
  baseColor: vec4
}

const log = (msg: string) => print("[smokeline] " + msg)
const fmt = (v: vec3) => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

// Flat content lying on the floor: local +Y points along `dir` (horizontal), local +Z points up.
const floorRotation = (dir: vec3) =>
  quat.angleAxis(Math.atan2(-dir.x, -dir.z), vec3.up()).multiply(quat.angleAxis(-Math.PI / 2, vec3.right()))

@component
export class SmokelineController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SmokelineController – fire drill flow (criteria 1–5)</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Start drill button UI module")
  startUi: SmokelineStartUI

  @input
  @hint("Floor debrief panel UI module (stats + next-drill button)")
  debriefUi: SmokelineDebriefUI

  @input
  @hint("Authored exit frame placed by the first pinch (Door A, blocked on the first drill)")
  exitFrameA: SceneObject

  @input
  @hint("Authored exit frame placed by the second pinch (Window B, open on the first drill)")
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
  @hint("Spatial 'Second way out' voice cue; moved to the open exit before it plays")
  secondWayOut: AudioComponent

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
  private checkedBlocked = false
  private arrowTarget: ExitRecord | null = null
  private arrows: SceneObject[] = []
  private edgeArrow: SceneObject
  private edgeVisible = false
  private state: any

  onAwake() {
    if (!this.startUi || !this.debriefUi || !this.exitFrameA || !this.exitFrameB || !this.meetingPoint ||
        !this.smokeLayer || !this.alarm || !this.getLowCue || !this.secondWayOut || !this.cameraObject) {
      log("ERROR: a required @input is not wired on SmokelineController")
      return
    }
    // One global state object, mutated in place every frame (never reassigned) for the LEAF tester.
    this.state = (global as any).smokeline = {
      phase: "marking", exits: [], meetingPoint: null, startEnabled: false, drillStarted: false, drillCount: 0,
      t: 0, smokeY: FLOOR_Y + SMOKE_START_HEIGHT, cameraY: 0,
      alarmPlaying: false, getLowPlaying: false, secondsInSmoke: 0,
      checkedBlocked: false, highlighted: null, arrowTarget: null, edgeArrowVisible: false,
      endReason: null, route: null
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
    this.secondWayOut.spatialAudio.enabled = true
    this.secondWayOut.spatialAudio.positionEffect.enabled = true
    this.startUi.setStartEnabled(false)
    this.startUi.onStart.add(() => this.startDrill())
    this.debriefUi.onNextDrill.add(() => this.nextDrill())

    const arrowMesh = this.buildArrowMesh()
    const arrowMat = this.barMaterial(this.exitFrameA).clone()
    arrowMat.mainPass.twoSided = true
    this.arrows = ARROW_DISTANCES.map((_, i) => this.makeArrow(`FloorArrow_${i}`, arrowMesh, arrowMat, ARROW_SIZE))
    this.edgeArrow = this.makeArrow("EdgeArrow", arrowMesh, arrowMat, EDGE_ARROW_SIZE)

    const interactors = InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)
    interactors.forEach((it) => it.onTriggerStart.add((target) => this.onPinch(it, target)))
    log(`ready, phase=marking, listening to ${interactors.length} interactors`)
  }

  // Pinch anywhere. A pinch that lands on an Interactable (Start, debrief button) is handled by that
  // target, so it never also places anything here. Exception: before Start an exit frame's solid
  // collider must not block marking behind it, so a frame hit is classified by the ray as usual.
  private onPinch(interactor: Interactor, target: Interactable | null) {
    if (this.phase !== "marking") return
    if (target !== null && !this.isExitFrame(target)) return
    const now = getTime()
    if (now - this.lastTriggerTime < TRIGGER_DEBOUNCE) return
    this.lastTriggerTime = now

    // SIK's mouse provider returns vec3.zero() (not null) when it has no ray, so check length too.
    const camT = this.cameraObject.getTransform()
    const rayOk = !!interactor.direction && interactor.direction.length > 1e-4 && !!interactor.startPoint
    const origin = rayOk ? interactor.startPoint : camT.getWorldPosition()
    const dir = (rayOk ? interactor.direction : camT.forward.uniformScale(-1)).normalize()
    log(`pinch ray origin=${fmt(origin)} dir=${fmt(dir)} (${rayOk ? "interactor" : "camera fallback"})${target ? " through " + target.sceneObject.name : ""}`)

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

  private isExitFrame(target: Interactable): boolean {
    const so = target.sceneObject
    return so === this.exitFrameA || so === this.exitFrameB
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
    if (!isFirst && Math.hypot(pos.x - this.exits[0].position.x, pos.z - this.exits[0].position.z) < EXIT_SIZE.x) {
      log(`exit ignored: ${fmt(pos)} overlaps Door A`) // a second exit needs its own spot
      return
    }
    const obj = isFirst ? this.exitFrameA : this.exitFrameB
    const material = this.barMaterial(obj).clone()
    const exit: ExitRecord = {
      name: isFirst ? "Door A" : "Window B", isBlocked: isFirst, obj, position: pos,
      material, baseColor: material.mainPass.baseColor
    }
    obj.children.forEach((c) => {
      const rmv = c.getComponent("Component.RenderMeshVisual")
      if (rmv) rmv.mainMaterial = material
    })

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

  private barMaterial(frame: SceneObject): Material {
    return (frame.getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial
  }

  private faceCamera(t: Transform, pos: vec3) {
    t.setWorldPosition(pos)
    const cam = this.cameraObject.getTransform().getWorldPosition()
    t.setWorldRotation(quat.angleAxis(Math.atan2(cam.x - pos.x, cam.z - pos.z), vec3.up())) // yaw only, +Z faces camera
  }

  // Frames stay pinchable during the drill. Created after enabling so the Interactable registers
  // with SIK when it actually initializes.
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

  // A flat arrow in local XY pointing +Y, unit size (scaled per use), facing +Z.
  private buildArrowMesh(): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3},
      {name: "texture0", components: 2}
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = MeshIndexType.UInt16
    const pts = [[-0.2, -0.5], [0.2, -0.5], [0.2, 0.05], [-0.2, 0.05], [-0.5, 0.05], [0.5, 0.05], [0, 0.5]]
    mb.appendVerticesInterleaved(pts.flatMap(([x, y]) => [x, y, 0, 0, 0, 1, x + 0.5, y + 0.5]))
    mb.appendIndices([0, 1, 2, 0, 2, 3, 4, 5, 6])
    mb.updateMesh()
    return mb.getMesh()
  }

  private makeArrow(name: string, mesh: RenderMesh, mat: Material, size: vec3): SceneObject {
    const obj = global.scene.createSceneObject(name)
    obj.setParent(this.sceneObject)
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    rmv.mainMaterial = mat
    obj.getTransform().setWorldScale(size)
    obj.enabled = false
    return obj
  }

  private startDrill() {
    if (this.phase === "drill" || this.exits.length < 2) return
    this.phase = "drill"
    this.startTime = getTime()
    this.secondsInSmoke = 0
    this.checkedBlocked = false
    this.exits.forEach((e) => {
      e.material.mainPass.baseColor = e.baseColor
      e.obj.enabled = true
    })
    this.arrowTarget = this.exits.find((e) => e.isBlocked) // route starts at the (unknowingly hot) door
    this.arrows.forEach((a) => (a.enabled = true))
    this.startUi.hide()
    this.debriefUi.hide()
    this.smokeLayer.enabled = true
    this.alarm.play(-1)
    this.alarmOn = true
    Object.assign(this.state, {
      drillStarted: true, drillCount: this.state.drillCount + 1, checkedBlocked: false, highlighted: null,
      arrowTarget: this.arrowTarget.name, endReason: null, route: null
    })
    log(`drill ${this.state.drillCount} started, blocked=${this.arrowTarget.name}`)
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
      this.updateArrows()
      if (this.reachedExit()) this.endDrill("reached")
      else if (t >= DRILL_DURATION) this.endDrill("timeout")
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

  // Floor arrows lead from the user towards the current route target; the edge arrow (and, after the
  // reroute, the spatial voice) point to it when it is out of view.
  private updateArrows() {
    const camT = this.cameraObject.getTransform()
    const cam = camT.getWorldPosition()
    const tgt = this.arrowTarget.position
    const flat = new vec3(tgt.x - cam.x, 0, tgt.z - cam.z)
    if (flat.length < 1e-3) return
    const dir = flat.normalize()
    const rot = floorRotation(dir)
    // shortcut: arrows keep a fixed 110/190 cm lead even when the target is closer; clamp if it looks odd on glasses
    this.arrows.forEach((a, i) => {
      const t = a.getTransform()
      t.setWorldPosition(new vec3(cam.x + dir.x * ARROW_DISTANCES[i], FLOOR_Y + FLOOR_LIFT, cam.z + dir.z * ARROW_DISTANCES[i]))
      t.setWorldRotation(rot)
    })

    const look = camT.forward.uniformScale(-1)
    const toTgt = tgt.sub(cam).normalize()
    const outOfView = look.angleTo(toTgt) > (OUT_OF_VIEW_DEG * Math.PI) / 180
    if (outOfView) {
      let side = toTgt.sub(look.uniformScale(toTgt.dot(look)))
      if (side.length < 1e-3) side = camT.right
      side = side.normalize()
      const et = this.edgeArrow.getTransform()
      et.setWorldPosition(cam.add(look.uniformScale(EDGE_ARROW_AHEAD)).add(side.uniformScale(EDGE_ARROW_OFFSET)))
      et.setWorldRotation(quat.lookAt(look.uniformScale(-1), side)) // faces the eyes, points to the target
      if (!this.edgeVisible && this.checkedBlocked && !this.secondWayOut.isPlaying()) this.playSecondWayOut()
    }
    if (outOfView !== this.edgeVisible) {
      this.edgeVisible = outOfView
      this.edgeArrow.enabled = outOfView
      this.state.edgeArrowVisible = outOfView
      log(`edge arrow ${outOfView ? "on" : "off"} -> ${this.arrowTarget.name}`)
    }
  }

  private playSecondWayOut() {
    const open = this.exits.find((e) => !e.isBlocked)
    this.secondWayOut.getSceneObject().getTransform().setWorldPosition(open.position)
    this.secondWayOut.play(1)
    log(`"second way out" from ${open.name} at ${fmt(open.position)}`)
  }

  /** Criterion 4: pinching an exit frame during the drill. */
  checkExit(exit: ExitRecord): void {
    if (!exit.isBlocked) {
      // Open exit: only highlights it, never ends the drill or reroutes (brief).
      exit.material.mainPass.baseColor = HIGHLIGHT_COLOR
      this.state.highlighted = exit.name
      log(`checkExit ${exit.name}: open, highlighted`)
      return
    }
    if (this.checkedBlocked) return
    this.checkedBlocked = true
    exit.material.mainPass.baseColor = HEAT_COLOR
    this.arrowTarget = this.exits.find((e) => !e.isBlocked)
    this.playSecondWayOut()
    this.state.checkedBlocked = true
    this.state.arrowTarget = this.arrowTarget.name
    log(`checkExit ${exit.name}: HOT, rerouting to ${this.arrowTarget.name}`)
  }

  /** Criterion 5: true when the camera is within 100 cm (horizontal) of the open exit. */
  reachedExit(): boolean {
    const open = this.exits.find((e) => !e.isBlocked)
    if (!open) return false
    const c = this.cameraObject.getTransform().getWorldPosition()
    return Math.hypot(c.x - open.position.x, c.z - open.position.z) <= REACH_DISTANCE
  }

  private endDrill(reason: "reached" | "timeout") {
    this.phase = "ended"
    this.setGetLow(false)
    this.alarm.stop(false)
    this.alarmOn = false
    this.secondWayOut.stop(false)
    this.arrows.forEach((a) => (a.enabled = false))
    this.edgeArrow.enabled = this.edgeVisible = false
    this.smokeLayer.enabled = false // brief: smoke shows during the drill only
    this.exits.forEach((e) => (e.obj.enabled = false)) // frames would cut through the floor debrief

    const blocked = this.exits.find((e) => e.isBlocked)
    const open = this.exits.find((e) => !e.isBlocked)
    const legs = (this.checkedBlocked ? [`${blocked.name} hot`] : []).concat(reason === "reached" ? [open.name] : [])
    const route = legs.length ? legs.join(" -> ") : "no exit reached"
    const t = Math.min(this.state.t, DRILL_DURATION)
    const title = reason === "reached" ? "Drill complete" : "Time's up, try again"
    const lines = [
      `Time ${fmtTime(t)} / 2:00`,
      `Above the smoke line: ${Math.round(this.secondsInSmoke)} s`,
      `Route: ${route}`
    ]

    const camT = this.cameraObject.getTransform()
    const cam = camT.getWorldPosition()
    let fwd = camT.forward.uniformScale(-1)
    fwd = new vec3(fwd.x, 0, fwd.z)
    fwd = fwd.length > 1e-3 ? fwd.normalize() : new vec3(0, 0, -1)
    const dt = this.debriefUi.getSceneObject().getTransform()
    dt.setWorldPosition(new vec3(cam.x + fwd.x * DEBRIEF_DISTANCE, FLOOR_Y + FLOOR_LIFT, cam.z + fwd.z * DEBRIEF_DISTANCE))
    dt.setWorldRotation(floorRotation(fwd)) // text top faces away from the user, readable looking down
    this.debriefUi.show(title, lines)

    Object.assign(this.state, {endReason: reason, route, edgeArrowVisible: false, alarmPlaying: false, getLowPlaying: false})
    log(`drill ended (${reason}): ${title} | ${lines.join(" | ")}`)
  }

  // Keeps both exits and the meeting point, swaps which exit is blocked, and restarts smoke and time.
  private nextDrill() {
    if (this.phase !== "ended") return
    this.exits.forEach((e, i) => {
      e.isBlocked = !e.isBlocked
      this.state.exits[i].isBlocked = e.isBlocked
    })
    log("next drill: blocked exit swapped")
    this.startDrill()
  }
}
