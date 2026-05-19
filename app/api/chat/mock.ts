import { AIMessage, BaseMessage } from "@langchain/core/messages";
import type {
  ClassificationResult,
  Constraints,
  Intent,
  RoutingInfo,
  SpecialistNodeName,
  UserLevel,
} from "./types";
import { getLatestHumanText } from "./messages";

export const LOW_CONFIDENCE_THRESHOLD = 0.65;

export function isMockMode(): boolean {
  return process.env.MOCK_LLM === "true";
}

function detectIntent(text: string): Intent {
  if (/대체|없는데|없어|대신|못\s*구/.test(text)) {
    return "substitute";
  }
  if (/처음|입문|어떻게\s*해|몰라|초보/.test(text)) {
    return "beginner_guide";
  }
  if (/몇\s*분|불\s*세기|얼마나|팁|간단히/.test(text)) {
    return "quick_answer";
  }
  if (/추천|뭐\s*만들|메뉴|끼니|저녁|점심|아침/.test(text)) {
    return "recipe_recommend";
  }
  return "recipe_recommend";
}

function detectUserLevel(text: string): UserLevel {
  if (/처음|입문|초보|몰라/.test(text)) {
    return "beginner";
  }
  if (/전문|세밀|온도|정확/.test(text)) {
    return "advanced";
  }
  return "intermediate";
}

function detectConstraints(text: string): Constraints {
  const constraints: Constraints = {};
  const timeMatch = text.match(/(\d+)\s*분/);

  if (timeMatch) {
    constraints.timeMinutes = Number(timeMatch[1]);
  }

  const ingredients: string[] = [];
  if (/계란/.test(text)) ingredients.push("계란");
  if (/닭가슴살|닭/.test(text)) ingredients.push("닭가슴살");
  if (/대파|파/.test(text)) ingredients.push("대파");
  if (/버터/.test(text)) ingredients.push("버터");

  if (ingredients.length) {
    constraints.ingredients = ingredients;
  }

  if (/채식|비건|글루텐/.test(text)) {
    constraints.diet = "식단 제약 언급";
  }

  return constraints;
}

function detectConfidence(text: string): number {
  const trimmed = text.trim();

  if (trimmed.length <= 4 || /^(안녕|hi|hello|ㅎㅇ)/i.test(trimmed)) {
    return 0.35;
  }
  if (/뭐\s*먹|뭐\s*할|추천|만들/.test(trimmed)) {
    return 0.82;
  }
  if (/대체|처음|분/.test(trimmed)) {
    return 0.78;
  }
  return 0.55;
}

export function mockClassify(messages: BaseMessage[]): ClassificationResult {
  const text = getLatestHumanText(messages);

  return {
    intent: detectIntent(text),
    userLevel: detectUserLevel(text),
    constraints: detectConstraints(text),
    confidence: detectConfidence(text),
  };
}

function resolveRoute(
  classification: ClassificationResult
): SpecialistNodeName {
  if (classification.confidence < LOW_CONFIDENCE_THRESHOLD) {
    return "fastDefault";
  }

  switch (classification.intent) {
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

const MOCK_RESPONSES: Record<SpecialistNodeName, string> = {
  fastDefault: `[MOCK · 빠른 추천]
지금 정보가 적어서 **닭가슴살 볶음밥**을 바로 추천드릴게요.
15분 안에 만들 수 있고, 재료도 흔합니다.

1. 닭가슴살을 익히고
2. 밥과 함께 볶아
3. 간장·참기 oil로 마무리

다른 재료나 시간 조건이 있으면 한 줄만 더 알려주세요.`,
  recipeRecommend: `[MOCK · 메뉴 추천]
1. **닭가슴살 야채 볶음** — 20분, 단백질 위주
2. **계란 덮밥** — 10분, 실패 확률 낮음
3. **된장찌개** — 25분, 집밥 느낌

1번으로 진행할까요?`,
  beginnerGuide: `[MOCK · 초보자 가이드]
계란 프라이 순서:
1. 팬을 중불로 달군다
2. 기름을 얇게 바른다
3. 계란을 깨서 넣는다
4. 흰자가 하얗게 익으면 불을 줄인다
5. 노른자 상태를 보고 끈다

처음엔 중불보다 약불이 더 안전합니다.`,
  substitute: `[MOCK · 재료 대체]
버터 대체재:
1. **식용유 + 소금** — 가장 무난
2. **올리브오일** — 향이 조금 달라짐
3. **마가린** — 비슷하지만 풍미는 약함

베이킹이라면 1번은 피하고 2~3번을 고려하세요.`,
  quickAnswer: `[MOCK · 빠른 답변]
밥은 보통 **중불에서 15~18분**이면 됩니다.
뚜껑을 닫고 중간에 뜸들이지 않는 편이 좋아요.`,
};

export function mockInvoke(messages: BaseMessage[]) {
  const classification = mockClassify(messages);
  const node = resolveRoute(classification);
  const usedFastPath = node === "fastDefault";
  const response = MOCK_RESPONSES[node];

  return {
    messages: [...messages, new AIMessage(response)],
    intent: classification.intent,
    userLevel: classification.userLevel,
    constraints: classification.constraints,
    confidence: classification.confidence,
    routedNode: node,
    modelUsed: `mock/${node}`,
    usedFastPath,
    response,
  };
}

export function buildRoutingInfo(result: {
  intent: Intent;
  userLevel: UserLevel;
  constraints: Constraints;
  confidence: number;
  routedNode: SpecialistNodeName;
  modelUsed: string;
  usedFastPath: boolean;
}): RoutingInfo {
  return {
    intent: result.intent,
    userLevel: result.userLevel,
    constraints: result.constraints,
    node: result.routedNode,
    model: result.modelUsed,
    confidence: result.confidence,
    usedFastPath: result.usedFastPath,
  };
}
