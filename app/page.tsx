"use client";

import { useState } from "react";
import type { ClientChatMessage, RoutingInfo } from "./api/chat/types";

const QUICK_STARTS = [
  {
    label: "⚡ 30분 한 끼",
    message: "30분 안에 만들 수 있는 간단한 한 끼 추천해줘",
  },
  {
    label: "🥚 남은 재료",
    message: "냉장고에 계란이랑 대파만 있는데 뭐 만들까?",
  },
  {
    label: "👶 처음 요리",
    message: "처음 요리하는데 실패 안 하는 간단한 요리 알려줘",
  },
  {
    label: "🔄 재료 대체",
    message: "버터 없는데 대체재로 뭐 쓸 수 있어?",
  },
];

const INTENT_LABELS: Record<RoutingInfo["intent"], string> = {
  recipe_recommend: "레시피 추천",
  beginner_guide: "초보자 가이드",
  substitute: "재료 대체",
  quick_answer: "간단 Q&A",
};

const NODE_LABELS: Record<RoutingInfo["node"], string> = {
  beginnerGuide: "초보자 코치",
  recipeRecommend: "메뉴 추천",
  substitute: "재료 대체",
  quickAnswer: "빠른 답변",
  fastDefault: "즉시 추천",
};

const LEVEL_LABELS: Record<RoutingInfo["userLevel"], string> = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "상급",
};

export default function Home() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ClientChatMessage[]>([]);
  const [routing, setRouting] = useState<RoutingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const nextHistory: ClientChatMessage[] = [
      ...history,
      { role: "user", content: trimmed },
    ];

    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    setRouting(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });

      const data = await res.json();

      if (data.error) {
        setHistory([
          ...nextHistory,
          { role: "assistant", content: `❌ 에러: ${data.error}` },
        ]);
      } else {
        setHistory([
          ...nextHistory,
          { role: "assistant", content: data.response },
        ]);
        setRouting(data.routing ?? null);
        setIsMock(Boolean(data.mock));
      }
    } catch {
      setHistory([
        ...nextHistory,
        { role: "assistant", content: "❌ 네트워크 오류가 발생했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickStart(message: string) {
    sendMessage(message);
  }

  function handleReset() {
    setHistory([]);
    setRouting(null);
    setInput("");
    setIsMock(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <main className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            Mealwig — 요리 대화 라우터
          </h1>
          <p className="text-slate-400 text-sm">
            빠른 답을 원하는 사용자를 위해 애매하면 바로 추천합니다
          </p>
          {isMock && (
            <p className="mt-2 text-xs text-amber-400">
              MOCK 모드 — API 키 없이 UI·라우팅 테스트 중
            </p>
          )}
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-2">빠른 시작</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_STARTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleQuickStart(item.message)}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-600 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 disabled:opacity-50 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[240px] max-h-[360px] overflow-y-auto mb-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl space-y-3">
            {history.length === 0 ? (
              <p className="text-slate-500 italic text-sm">
                버튼을 누르거나 메시지를 입력하세요. &quot;안녕&quot;처럼 애매한
                입력은 즉시 추천(fastDefault) 경로로 처리됩니다.
              </p>
            ) : (
              history.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                      item.role === "user"
                        ? "bg-cyan-500/20 text-cyan-100"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <p className="text-slate-500 italic text-sm">분류 → 라우팅 → 응답 생성 중...</p>
            )}
          </div>

          {routing && (
            <div className="mb-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
                라우팅 결과
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                  {INTENT_LABELS[routing.intent]}
                </span>
                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                  {NODE_LABELS[routing.node]}
                </span>
                {routing.usedFastPath && (
                  <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-300">
                    즉시 추천 경로
                  </span>
                )}
                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                  {LEVEL_LABELS[routing.userLevel]}
                </span>
                <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
                  {routing.model}
                </span>
                <span className="px-2 py-1 rounded bg-slate-700 text-slate-300">
                  신뢰도 {(routing.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mb-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="예: 1번으로 할게 / 더 간단한 걸로"
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
              >
                전송
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            대화 초기화
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          API 키 없이 테스트: .env.local 에 MOCK_LLM=true 설정
        </p>
      </main>
    </div>
  );
}
