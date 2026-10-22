import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {SmokelineC1MarkingScenario} from "./SmokelineC1MarkingScenario"
import {SmokelineC2DrillScenario} from "./SmokelineC2DrillScenario"
import {SmokelineC3GetLowScenario} from "./SmokelineC3GetLowScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "smokeline-c1-marking", typename: SmokelineC1MarkingScenario.getTypeName()},
    {id: "smokeline-c2-drill", typename: SmokelineC2DrillScenario.getTypeName()},
    {
      id: "smokeline-c3-getlow",
      typename: SmokelineC3GetLowScenario.getTypeName(),
      parameters: {stop_after: "A", wait_secs: "60"},
    },
  ]
}
