export type ToastPresetDuration = "short" | "long" | "infinite";

export type ToastDuration =
  | { kind: "preset"; value: ToastPresetDuration }
  | { kind: "seconds"; value: number };

export interface TriggerToastParams {
  body: string;
  icon?: string;
  duration: ToastDuration;
}

export interface TriggerToastResult {
  shown: boolean;
}
