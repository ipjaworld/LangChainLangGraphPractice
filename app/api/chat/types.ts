export type Intent =
  | "recipe_recommend"
  | "beginner_guide"
  | "substitute"
  | "quick_answer";

export type UserLevel = "beginner" | "intermediate" | "advanced";

export type SpecialistNodeName =
  | "beginnerGuide"
  | "recipeRecommend"
  | "substitute"
  | "quickAnswer"
  | "fastDefault";

export interface Constraints {
  timeMinutes?: number;
  ingredients?: string[];
  diet?: string;
}

export interface ClassificationResult {
  intent: Intent;
  userLevel: UserLevel;
  constraints: Constraints;
  confidence: number;
}

export interface ClientChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RoutingInfo {
  intent: Intent;
  userLevel: UserLevel;
  constraints: Constraints;
  node: SpecialistNodeName;
  model: string;
  confidence: number;
  usedFastPath: boolean;
}

export interface ChatApiResponse {
  response: string;
  routing: RoutingInfo;
  messageCount: number;
  mock?: boolean;
}
