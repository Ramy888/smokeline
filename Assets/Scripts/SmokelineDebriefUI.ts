// SmokelineDebriefUI — owns the 90 x 60 cm debrief panel and its "Next drill" UIKit button (passive view).
// Inputs: border mesh/material + size tunables. The controller positions this object flat on the floor,
// then calls show()/hide() and subscribes to onNextDrill. Holds no drill state, makes no drill decisions.
// Content lies in local XY facing +Z; local +Y is the far edge (the controller lays it flat).
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const PANEL = new vec2(90, 60) // cm (brief); ~27° wide from standing, inside the Specs view
const BORDER = 2 // cm, light outline (additive display: no dark fill, it would be invisible)
const TEXT_COLOR = new vec4(0.92, 0.97, 1, 1)
const TITLE_SIZE = 230 // ~4 cm caps: read from standing height, ~1.9 m from the eyes
const LINE_SIZE = 160
const TITLE_Y = 20
const LINE_YS = [10, 1.5, -7] // time, seconds in smoke, route
const BUTTON_Y = -19.5
const BUTTON_TEXT_SIZE = 130
const LIFT = 0.5 // cm, everything sits on top of the panel plane

@component
export class SmokelineDebriefUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SmokelineDebriefUI – floor debrief + Next drill</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Unit box mesh for the panel outline (SmokelineBox)")
  borderMesh: RenderMesh

  @input
  @hint("Unlit glow material for the panel outline (ExitFrameGlow)")
  borderMaterial: Material

  @input
  @hint("Next drill button width in cm")
  @widget(new SliderWidget(15, 60, 0.5))
  buttonWidthCm: number = 40

  @input
  @hint("Next drill button height in cm")
  @widget(new SliderWidget(5, 20, 0.5))
  buttonHeightCm: number = 11
  @ui.group_end

  private titleText: Text
  private lineTexts: Text[] = []
  private _onNextDrill = new Event<void>()

  get onNextDrill(): PublicApi<void> {
    return this._onNextDrill.publicApi()
  }

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    const w = PANEL.x / 2
    const h = PANEL.y / 2
    this.bar("DebriefBorder_Top", new vec3(0, h, 0), new vec3(PANEL.x, BORDER, 0.5))
    this.bar("DebriefBorder_Bottom", new vec3(0, -h, 0), new vec3(PANEL.x, BORDER, 0.5))
    this.bar("DebriefBorder_Left", new vec3(-w, 0, 0), new vec3(BORDER, PANEL.y, 0.5))
    this.bar("DebriefBorder_Right", new vec3(w, 0, 0), new vec3(BORDER, PANEL.y, 0.5))

    this.titleText = this.text("DebriefTitle", this.sceneObject, TITLE_Y, TITLE_SIZE)
    this.lineTexts = LINE_YS.map((y, i) => this.text(`DebriefLine${i}`, this.sceneObject, y, LINE_SIZE))

    const btnObj = global.scene.createSceneObject("NextDrillButton")
    btnObj.setParent(this.sceneObject)
    btnObj.getTransform().setLocalPosition(new vec3(0, BUTTON_Y, LIFT + 0.5))
    const button = btnObj.createComponent(Button.getTypeName()) as Button
    button.onInitialized.add(() => (button.size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)))
    button.onTriggerUp.add(() => this._onNextDrill.invoke())
    const label = this.text("NextDrillLabel", btnObj, 0, BUTTON_TEXT_SIZE)
    label.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0.6))
    label.text = "Next drill"

    this.sceneObject.enabled = false
  }

  /** Main → UI: fill the panel and show it (the controller has already placed it on the floor). */
  show(title: string, lines: string[]): void {
    this.titleText.text = title
    this.lineTexts.forEach((t, i) => (t.text = lines[i] ?? ""))
    this.sceneObject.enabled = true
  }

  /** Main → UI: hide the panel (during the drill nothing but the drill shows). */
  hide(): void {
    this.sceneObject.enabled = false
  }

  private bar(name: string, pos: vec3, scale: vec3): void {
    const obj = global.scene.createSceneObject(name)
    obj.setParent(this.sceneObject)
    const t = obj.getTransform()
    t.setLocalPosition(new vec3(pos.x, pos.y, LIFT))
    t.setLocalScale(scale)
    const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = this.borderMesh
    rmv.mainMaterial = this.borderMaterial
  }

  private text(name: string, parent: SceneObject, y: number, size: number): Text {
    const obj = global.scene.createSceneObject(name)
    obj.setParent(parent)
    obj.getTransform().setLocalPosition(new vec3(0, y, LIFT + 0.3))
    const t = obj.createComponent("Component.Text") as Text
    t.size = size
    t.depthTest = true
    t.textFill.color = TEXT_COLOR
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-PANEL.x / 2 + 3, PANEL.x / 2 - 3, -4, 4)
    return t
  }
}
