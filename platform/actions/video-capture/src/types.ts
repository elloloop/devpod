/** Supported target platforms. */
export type Platform = "web" | "android" | "ios";

/** Video quality presets. */
export type VideoQuality = "low" | "medium" | "high";

/** Every action recognised inside a scenario YAML step. */
export type StepAction =
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "hover"
  | "select"
  | "screenshot"
  | "pause"
  | "wait-for"
  | "execute"
  | "assert-visible"
  | "assert-text";

/** A single step in a scenario file. */
export interface ScenarioStep {
  action: StepAction;
  /** URL for navigate action. */
  url?: string;
  /** CSS selector for click/type/hover/select/wait-for/assert-visible/assert-text. */
  selector?: string;
  /** Text to type, or expected text for assert-text. */
  text?: string;
  /** Scroll direction. */
  direction?: "up" | "down" | "left" | "right";
  /** Scroll amount in pixels. */
  amount?: number;
  /** Option value for select action. */
  value?: string;
  /** Milliseconds to wait after step, or duration for pause. */
  wait?: number;
  /** Duration in ms for pause action. */
  duration?: number;
  /** If set, a screenshot is taken and saved with this name. */
  screenshot?: string;
  /** JavaScript code to execute (execute action). */
  code?: string;
  /** Timeout in ms for wait-for action. */
  timeout?: number;
}

/** Parsed scenario file. */
export interface Scenario {
  name: string;
  description?: string;
  steps: ScenarioStep[];
}

/** Quality-dependent encoding settings. */
export interface QualityPreset {
  crf: number;
  maxBitrateKbps: number;
  audioBitrateKbps: number;
}

/** All inputs the action receives. */
export interface ActionInputs {
  platform: Platform;
  appUrl?: string;
  scenario: string;
  outputDir: string;
  videoQuality: VideoQuality;
  viewportWidth: number;
  viewportHeight: number;
  device?: string;
  headless: boolean;
}

/** Collected results handed to the output stage. */
export interface CaptureResult {
  videoPath: string | null;
  screenshotPaths: string[];
  thumbnailPath: string | null;
  durationSeconds: number;
}
