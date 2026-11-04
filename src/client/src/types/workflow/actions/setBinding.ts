export type SetBindingTargetType = "unityCatalogTable" | "chartData";

export interface SetBindingSourceRef {
  sourceActionType: "RunSql";
  nodeId: string;
  outputKey: "rows";
}

export interface SetBindingTargetRef {
  componentCodeName: string;
  bindingType: SetBindingTargetType;
}

export interface SetBindingParams {
  source: SetBindingSourceRef;
  target: SetBindingTargetRef;
}

export interface SetBindingResult {
  applied: boolean;
}
