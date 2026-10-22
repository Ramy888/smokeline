import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {SmokelineC1MarkingScenario} from "./SmokelineC1MarkingScenario"
import {SmokelineFixPinchThroughFrameScenario} from "./SmokelineFixPinchThroughFrameScenario"
import {SmokelineC2DrillScenario} from "./SmokelineC2DrillScenario"
import {SmokelineC3GetLowScenario} from "./SmokelineC3GetLowScenario"
import {SmokelineC4HotDoorScenario} from "./SmokelineC4HotDoorScenario"
import {SmokelineC5ReachScenario} from "./SmokelineC5ReachScenario"
import {SmokelineTimeoutScenario} from "./SmokelineTimeoutScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "smokeline-c1-marking", typename: SmokelineC1MarkingScenario.getTypeName()},
    {id: "smokeline-fix-pinch-through-frame", typename: SmokelineFixPinchThroughFrameScenario.getTypeName()},
    {id: "smokeline-c2-drill", typename: SmokelineC2DrillScenario.getTypeName()},
    {
      id: "smokeline-c3-getlow",
      typename: SmokelineC3GetLowScenario.getTypeName(),
      parameters: {stop_after: "A", wait_secs: "60"},
    },
    {id: "smokeline-c4-hot-door", typename: SmokelineC4HotDoorScenario.getTypeName()},
    {id: "smokeline-c5-reach", typename: SmokelineC5ReachScenario.getTypeName(), parameters: {wait_secs: "90"}},
    {id: "smokeline-timeout", typename: SmokelineTimeoutScenario.getTypeName()},
  ]
}
