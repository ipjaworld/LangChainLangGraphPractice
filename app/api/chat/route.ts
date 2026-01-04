/**
 * ============================================================
 * 이 파일의 역할: LangGraph + LangChain 통합 API Route
 * ============================================================
 * 
 * 이 파일은 LangChain의 ChatOpenAI 모델과 LangGraph의 StateGraph를
 * 연결하여 AI 응답을 생성하는 API 엔드포인트입니다.
 * 
 * 핵심 개념:
 * - LangChain: AI 모델(ChatOpenAI)과의 통신을 담당
 * - LangGraph: 워크플로우(그래프) 구조를 정의하고 실행
 * 
 * 이 예제에서는 가장 단순한 형태로:
 * - 노드 1개 (chatNode)
 * - State는 messages 배열 하나
 * - 분기나 조건 없이 직선 흐름
 */

import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * ============================================================
 * Step 1: State 정의 (LangGraph의 핵심 개념)
 * ============================================================
 * 
 * LangGraph에서 State는 그래프를 통해 흐르는 데이터입니다.
 * Annotation.Root를 사용해 State의 구조를 정의합니다.
 * 
 * 여기서는 messages 배열 하나만 사용합니다.
 * reducer 함수는 새 메시지가 올 때 기존 배열에 추가하는 방식입니다.
 */
const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    // reducer: 새로운 메시지를 기존 배열에 추가
    // 이렇게 하면 노드에서 반환한 메시지가 자동으로 누적됩니다
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

// State 타입 추출 (TypeScript 타입 안전성을 위해)
type GraphStateType = typeof GraphState.State;

/**
 * ============================================================
 * Step 2: LangChain 모델 생성
 * ============================================================
 * 
 * ChatOpenAI는 LangChain에서 제공하는 OpenAI Chat 모델 래퍼입니다.
 * 이 객체가 실제로 OpenAI API와 통신합니다.
 */
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini", // 빠르고 저렴한 모델 사용
  temperature: 0.7,
  // OPENAI_API_KEY 환경 변수를 자동으로 읽습니다
});

/**
 * ============================================================
 * Step 3: 노드 함수 정의 (★ LangChain과 LangGraph가 만나는 지점 ★)
 * ============================================================
 * 
 * 이 함수가 핵심입니다!
 * 
 * LangGraph의 노드 = 함수
 * - 입력: State (여기서는 messages 배열을 포함)
 * - 출력: State의 일부 (여기서는 새로운 messages)
 * 
 * 이 노드 안에서:
 * 1. State에서 메시지들을 가져와서
 * 2. LangChain 모델(ChatOpenAI)에 전달하고
 * 3. AI 응답을 받아서 State에 추가
 * 
 * 즉, LangGraph는 "언제, 어떤 순서로" 실행할지를 결정하고,
 * LangChain은 "실제 AI 호출"을 담당합니다.
 */
async function chatNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
  console.log("🔵 chatNode 실행: 메시지 수 =", state.messages.length);
  
  // LangChain 모델 호출 - 여기서 실제 OpenAI API 호출이 발생합니다
  const response = await model.invoke(state.messages);
  
  console.log("🟢 AI 응답 받음:", response.content);
  
  // 응답을 messages 배열로 반환
  // reducer가 이 배열을 기존 messages에 추가합니다
  return {
    messages: [response],
  };
}

/**
 * ============================================================
 * Step 4: 그래프 구성 (LangGraph의 핵심)
 * ============================================================
 * 
 * StateGraph: 상태 기반 워크플로우 그래프
 * 
 * 구조:
 * START → chatNode → END
 * 
 * 가장 단순한 형태의 그래프입니다.
 * 복잡한 에이전트는 여러 노드와 조건부 엣지를 추가합니다.
 */
function buildGraph() {
  // 1. 그래프 생성 (State 스키마 전달)
  const graph = new StateGraph(GraphState)
    // 2. 노드 추가: "chat"이라는 이름으로 chatNode 함수 등록
    .addNode("chat", chatNode)
    // 3. 엣지 추가: START에서 "chat" 노드로
    .addEdge(START, "chat")
    // 4. 엣지 추가: "chat" 노드에서 END로
    .addEdge("chat", END);
  
  // 5. 그래프 컴파일: 실행 가능한 형태로 변환
  // compile()을 호출해야 실제로 실행할 수 있습니다
  return graph.compile();
}

// 그래프는 한 번만 빌드 (재사용)
const compiledGraph = buildGraph();

/**
 * ============================================================
 * Step 5: API Route Handler
 * ============================================================
 * 
 * Next.js App Router의 API Route입니다.
 * POST 요청을 받아서 그래프를 실행하고 결과를 반환합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    console.log("📨 사용자 입력:", message);
    
    // 사용자 메시지를 HumanMessage로 변환
    // LangChain에서는 메시지 타입을 명시합니다 (Human, AI, System 등)
    const humanMessage = new HumanMessage(message);
    
    /**
     * ============================================================
     * ★ 그래프 실행 (LangGraph의 invoke) ★
     * ============================================================
     * 
     * invoke()는 그래프를 처음부터 끝까지 실행합니다.
     * 
     * 실행 흐름:
     * 1. 초기 State: { messages: [HumanMessage] }
     * 2. START → chatNode 실행 (AI 응답 생성)
     * 3. chatNode → END
     * 4. 최종 State: { messages: [HumanMessage, AIMessage] }
     */
    const result = await compiledGraph.invoke({
      messages: [humanMessage],
    });
    
    // 마지막 메시지가 AI 응답
    const lastMessage = result.messages[result.messages.length - 1];
    const aiResponse = lastMessage.content as string;
    
    console.log("✅ 최종 응답:", aiResponse);
    
    return NextResponse.json({ 
      response: aiResponse,
      // 디버깅용: 전체 메시지 히스토리
      messageCount: result.messages.length,
    });
    
  } catch (error) {
    console.error("❌ 에러:", error);
    return NextResponse.json(
      { error: "AI 응답 생성 실패" },
      { status: 500 }
    );
  }
}

