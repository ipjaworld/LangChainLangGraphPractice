import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { LOW_CONFIDENCE_THRESHOLD } from "./mock";
import { getLatestHumanText } from "./messages";
import type {
  ClassificationResult,
  Constraints,
  Intent,
  SpecialistNodeName,
  UserLevel,
} from "./types";

const ClassificationSchema = z.object({
  intent: z.enum([
    "recipe_recommend",
    "beginner_guide",
    "substitute",
    "quick_answer",
  ]),
  userLevel: z.enum(["beginner", "intermediate", "advanced"]),
  constraints: z
    .object({
      timeMinutes: z.number().nullable().optional(),
      ingredients: z.array(z.string()).optional(),
      diet: z.string().nullable().optional(),
    })
    .default({}),
  confidence: z.number().min(0).max(1),
});

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  intent: Annotation<Intent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  userLevel: Annotation<UserLevel | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  constraints: Annotation<Constraints>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),
  confidence: Annotation<number | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  routedNode: Annotation<SpecialistNodeName | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  modelUsed: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  usedFastPath: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),
});

export type GraphStateType = typeof GraphState.State;

const classifierModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const guideModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.5,
});

const recommendModel = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.7,
});

const substituteModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.3,
});

const quickAnswerModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.4,
});

const fastDefaultModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.6,
});

const structuredClassifier = classifierModel.withStructuredOutput(
  ClassificationSchema,
  { name: "conversation_classification" }
);

const CLASSIFY_SYSTEM_PROMPT = `당신은 레시피/요리 사이트의 대화 분류기입니다.
최근 대화 맥락과 마지막 사용자 메시지를 보고 JSON으로 반환하세요.

intent 분류 기준:
- recipe_recommend: 뭘 만들지 모르겠다, 메뉴/레시피 추천 요청
- beginner_guide: 처음 요리, 기초 설명, 단계별 안내가 필요한 경우
- substitute: 재료가 없거나 대체재, 없는 재료로 가능한지 질문
- quick_answer: 조리 시간, 불 세기, 간단한 팁 등 짧은 답변으로 충분한 질문

애매한 인사/짧은 메시지("안녕", "뭐 먹지")는 recipe_recommend로 분류하고 confidence를 낮게 주세요.

userLevel:
- beginner: 요리 경험이 거의 없거나 기본 용어 설명이 필요함
- intermediate: 기본 조리는 가능
- advanced: 전문적/세밀한 조리 질문

constraints: 대화에서 추출 가능한 timeMinutes, ingredients, diet만 채우세요.`;

function normalizeConstraints(
  raw: z.infer<typeof ClassificationSchema>["constraints"] | undefined
): Constraints {
  const constraints: Constraints = {};

  if (!raw) {
    return constraints;
  }

  if (raw.timeMinutes != null) {
    constraints.timeMinutes = raw.timeMinutes;
  }
  if (raw.ingredients?.length) {
    constraints.ingredients = raw.ingredients;
  }
  if (raw.diet) {
    constraints.diet = raw.diet;
  }

  return constraints;
}

async function classifyNode(
  state: GraphStateType
): Promise<Partial<GraphStateType>> {
  const userMessage = getLatestHumanText(state.messages);
  console.log("🔍 classifyNode 실행:", userMessage);

  const result = await structuredClassifier.invoke([
    new SystemMessage(CLASSIFY_SYSTEM_PROMPT),
    ...state.messages,
  ]);

  const classification: ClassificationResult = {
    intent: result.intent,
    userLevel: result.userLevel,
    constraints: normalizeConstraints(result.constraints),
    confidence: result.confidence,
  };

  console.log("📋 분류 결과:", classification);

  return {
    intent: classification.intent,
    userLevel: classification.userLevel,
    constraints: classification.constraints,
    confidence: classification.confidence,
  };
}

function buildContextHint(state: GraphStateType): string {
  const parts: string[] = [];

  if (state.userLevel) {
    parts.push(`사용자 수준: ${state.userLevel}`);
  }
  if (state.constraints.timeMinutes) {
    parts.push(`시간 제약: ${state.constraints.timeMinutes}분 이내`);
  }
  if (state.constraints.ingredients?.length) {
    parts.push(`보유 재료: ${state.constraints.ingredients.join(", ")}`);
  }
  if (state.constraints.diet) {
    parts.push(`식단/제약: ${state.constraints.diet}`);
  }

  return parts.length ? `\n\n[파악된 상황]\n${parts.join("\n")}` : "";
}

function createSpecialistNode(
  nodeName: SpecialistNodeName,
  model: ChatOpenAI,
  systemPrompt: string,
  usedFastPath = false
) {
  return async (state: GraphStateType): Promise<Partial<GraphStateType>> => {
    console.log(`🍳 ${nodeName} 실행 (model: ${model.model})`);

    const response = await model.invoke([
      new SystemMessage(`${systemPrompt}${buildContextHint(state)}`),
      ...state.messages,
    ]);

    console.log(`🟢 ${nodeName} 응답 완료`);

    return {
      messages: [response],
      routedNode: nodeName,
      modelUsed: model.model,
      usedFastPath,
    };
  };
}

const fastDefaultNode = createSpecialistNode(
  "fastDefault",
  fastDefaultModel,
  `당신은 "생각하기 싫어하는" 사용자를 위한 빠른 요리 추천 도우미입니다.
- 추가 질문을 먼저 하지 마세요.
- 정보가 부족해도 합리적으로 가정하고 **메뉴 1개를 바로 추천**하세요.
- 추천 이유는 2~3문장으로 짧게.
- 아주 간단한 조리 순서 3~4단계만 제시하세요.
- 마지막에 "다른 조건이면 한 줄만 더 알려주세요" 정도로만 부드럽게 마무리하세요.`,
  true
);

const beginnerGuideNode = createSpecialistNode(
  "beginnerGuide",
  guideModel,
  `당신은 친절한 요리 입문 코치입니다.
- 단계별로 번호를 매겨 설명하세요.
- 요리 용어는 쉬운 말로 풀어서 설명하세요.
- 흔한 실수와 안전 주의사항을 짧게 포함하세요.
- 한 번에 너무 많은 정보를 주지 말고, 바로 시작할 수 있게 안내하세요.`
);

const recipeRecommendNode = createSpecialistNode(
  "recipeRecommend",
  recommendModel,
  `당신은 레시피 사이트의 메뉴 추천 전문가입니다.
- 사용자 상황에 맞는 메뉴 2~3개를 제안하세요.
- 각 추천마다 "왜 이 메뉴인지" 한 줄 이유를 덧붙이세요.
- 재료/시간 제약이 있으면 반드시 반영하세요.
- 마지막에 "1번으로 진행할까요?"처럼 선택을 유도하세요.`
);

const substituteNode = createSpecialistNode(
  "substitute",
  substituteModel,
  `당신은 재료 대체 및 응급 요리 전문가입니다.
- 대체재를 우선순위와 함께 제시하세요.
- 맛/식감/성공률에 미치는 영향을 간단히 설명하세요.
- 알레르기나 식단 제약이 언급되면 안전을 우선하세요.
- 불확실하면 "가능하지만 결과가 달라질 수 있다"고 명시하세요.`
);

const quickAnswerNode = createSpecialistNode(
  "quickAnswer",
  quickAnswerModel,
  `당신은 요리 Q&A 도우미입니다.
- 질문에 맞는 핵심 답만 3~5문장 이내로 간결하게 답하세요.
- 불필요한 레시피 전체 설명은 피하세요.
- 추가로 알아두면 좋은 팁이 있으면 한 줄만 덧붙이세요.`
);

function routeByIntent(state: GraphStateType): SpecialistNodeName {
  if ((state.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD) {
    console.log("⚡ fastDefault 경로 (confidence 낮음)");
    return "fastDefault";
  }

  switch (state.intent) {
    case "beginner_guide":
      return "beginnerGuide";
    case "recipe_recommend":
      return "recipeRecommend";
    case "substitute":
      return "substitute";
    case "quick_answer":
    default:
      return "quickAnswer";
  }
}

function buildGraph() {
  return new StateGraph(GraphState)
    .addNode("classify", classifyNode)
    .addNode("fastDefault", fastDefaultNode)
    .addNode("beginnerGuide", beginnerGuideNode)
    .addNode("recipeRecommend", recipeRecommendNode)
    .addNode("substitute", substituteNode)
    .addNode("quickAnswer", quickAnswerNode)
    .addEdge(START, "classify")
    .addConditionalEdges("classify", routeByIntent, {
      fastDefault: "fastDefault",
      beginnerGuide: "beginnerGuide",
      recipeRecommend: "recipeRecommend",
      substitute: "substitute",
      quickAnswer: "quickAnswer",
    })
    .addEdge("fastDefault", END)
    .addEdge("beginnerGuide", END)
    .addEdge("recipeRecommend", END)
    .addEdge("substitute", END)
    .addEdge("quickAnswer", END)
    .compile();
}

export const compiledGraph = buildGraph();
