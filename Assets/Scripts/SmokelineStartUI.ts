// SmokelineStartUI — owns the "Start drill" UIKit button (passive view).
// Inputs: label + size/opacity tunables only. Main script calls setStartEnabled()/hide()
// and subscribes to onStart. Holds no drill state and makes no drill decisions.
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

const DISTANCE_CM = 100 // button sits ~100 cm from the starting camera (brief)
const BUTTON_LABEL_Z = 0.08 // lift label in front of the button face
const BUTTON_TEXT_SIZE = 48 * (DISTANCE_CM / 110) // "Headline2" role (48, Bold) scaled to distance — the only control on screen
const BUTTON_TEXT_WEIGHT = 700

@component
export class SmokelineStartUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SmokelineStartUI – Start drill button</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Text on the Start button")
  label: string = "Start drill"

  @input
  @hint("Button width in cm (brief: at least 10 cm across)")
  @widget(new SliderWidget(10, 40, 0.5))
  widthCm: number = 18

  @input
  @hint("Button height in cm")
  @widget(new SliderWidget(4, 12, 0.5))
  heightCm: number = 6

  @input
  @hint("Opacity of the button while it is locked (fewer than 2 exits marked)")
  @widget(new SliderWidget(0.1, 1, 0.05))
  lockedOpacity: number = 0.5
  @ui.group_end

  private button: Button
  private labelText: Text
  private enabledFlag = false
  private _onStart = new Event<void>()

  get onStart(): PublicApi<void> {
    return this._onStart.publicApi()
  }

  get isStartEnabled(): boolean {
    return this.enabledFlag
  }

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")

    const btnObj = global.scene.createSceneObject("StartButtonVisual")
    btnObj.setParent(this.sceneObject)
    this.button = btnObj.createComponent(Button.getTypeName()) as Button
    this.button.onInitialized.add(() => {
      this.button.size = new vec3(this.widthCm, this.heightCm, 1)
      this.applyLook()
    })
    // Collider stays live while locked so a pinch on the greyed button is absorbed
    // (never falls through to the empty-space exit placement). Locked = ignore the press.
    this.button.onTriggerUp.add(() => {
      if (this.enabledFlag) this._onStart.invoke()
    })

    const labelObj = global.scene.createSceneObject("StartButtonLabel")
    labelObj.setParent(btnObj)
    labelObj.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    this.labelText = labelObj.createComponent("Component.Text") as Text
    this.labelText.text = this.label
    this.labelText.depthTest = true
    this.labelText.size = BUTTON_TEXT_SIZE
    ;(this.labelText as Text & {weight?: number}).weight = BUTTON_TEXT_WEIGHT
    this.labelText.horizontalAlignment = HorizontalAlignment.Center
    this.labelText.verticalAlignment = VerticalAlignment.Center
    this.labelText.horizontalOverflow = HorizontalOverflow.Overflow
    this.labelText.verticalOverflow = VerticalOverflow.Overflow
    const w = this.widthCm - 0.5
    this.labelText.layoutRect = Rect.create(-w / 2, w / 2, -1.2, 1.2)
    this.applyLook()
  }

  /** Main → UI: unlock (true) or lock (false) the Start button. */
  setStartEnabled(on: boolean): void {
    this.enabledFlag = on
    this.applyLook()
  }

  /** Main → UI: hide the button for the drill (brief: no UI during the drill). */
  hide(): void {
    this.sceneObject.enabled = false
  }

  private applyLook(): void {
    const a = this.enabledFlag ? 1 : this.lockedOpacity
    if (this.button) this.button.opacity = a
    if (this.labelText) this.labelText.textFill.color = new vec4(1, 1, 1, a)
  }
}
