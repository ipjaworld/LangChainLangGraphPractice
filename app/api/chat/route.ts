import { NextRequest, NextResponse } from "next/server";
import { compiledGraph } from "./graph";
import { parseClientMessages } from "./messages";
import { buildRoutingInfo, isMockMode, mockInvoke } from "./mock";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages = parseClientMessages(body);

    if (!messages.length) {
      return NextResponse.json(
        { error: "메시지를 입력해 주세요." },
        { status: 400 }
      );
    }

    const latestMessage = messages[messages.length - 1];
    if (latestMessage._getType() !== "human") {
      return NextResponse.json(
        { error: "마지막 메시지는 사용자 메시지여야 합니다." },
        { status: 400 }
      );
    }

    console.log("📨 대화 턴 수:", messages.length);

    if (isMockMode()) {
      console.log("🧪 MOCK_LLM 모드로 실행");
      const mockResult = mockInvoke(messages);

      return NextResponse.json({
        response: mockResult.response,
        routing: buildRoutingInfo(mockResult),
        messageCount: mockResult.messages.length,
        mock: true,
      });
    }

    const result = await compiledGraph.invoke({ messages });
    const lastMessage = result.messages[result.messages.length - 1];
    const aiResponse = lastMessage.content as string;

    const routing = buildRoutingInfo({
      intent: result.intent!,
      userLevel: result.userLevel!,
      constraints: result.constraints,
      confidence: result.confidence ?? 0,
      routedNode: result.routedNode!,
      modelUsed: result.modelUsed!,
      usedFastPath: result.usedFastPath,
    });

    console.log("✅ 라우팅:", routing);

    return NextResponse.json({
      response: aiResponse,
      routing,
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
