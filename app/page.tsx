/**
 * ============================================================
 * 이 파일의 역할: LangGraph 테스트용 프론트엔드 UI
 * ============================================================
 * 
 * 간단한 채팅 인터페이스로, 사용자가:
 * 1. 메시지를 입력하고
 * 2. API Route를 호출하여
 * 3. LangGraph를 거쳐 생성된 AI 응답을 확인
 * 
 * 개념 학습 목적이므로 UI는 최소한으로 구성했습니다.
 */

"use client";

import { useState } from "react";

export default function Home() {
  // 상태 관리
  const [input, setInput] = useState("");        // 사용자 입력
  const [response, setResponse] = useState("");  // AI 응답
  const [loading, setLoading] = useState(false); // 로딩 상태

  /**
   * API 호출 함수
   * POST /api/chat 으로 메시지를 보내고 응답을 받습니다
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    setLoading(true);
    setResponse("");
    
    try {
      // API Route 호출 → LangGraph 실행 → AI 응답
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setResponse(`❌ 에러: ${data.error}`);
      } else {
        setResponse(data.response);
      }
    } catch {
      setResponse("❌ 네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <main className="w-full max-w-2xl">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
            LangGraph + LangChain
          </h1>
          <p className="text-slate-400 text-sm">
            최소 예제 — 단일 노드, messages State만 사용
          </p>
        </div>

        {/* 메인 카드 */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6 shadow-2xl">
          {/* 흐름 시각화 */}
          <div className="flex items-center justify-center gap-2 mb-6 py-3 px-4 bg-slate-900/50 rounded-xl text-xs font-mono text-slate-400">
            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">입력</span>
            <span>→</span>
            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">API Route</span>
            <span>→</span>
            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">LangGraph</span>
            <span>→</span>
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">응답</span>
          </div>

          {/* 입력 폼 */}
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/25"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    처리중
                  </span>
                ) : (
                  "전송"
                )}
              </button>
            </div>
          </form>

          {/* 응답 영역 */}
          <div className="min-h-[200px] p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">AI 응답</span>
            </div>
            
            {response ? (
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{response}</p>
            ) : (
              <p className="text-slate-500 italic">
                {loading ? "LangGraph 처리 중..." : "응답이 여기에 표시됩니다"}
              </p>
            )}
          </div>

          {/* 구조 설명 */}
          <div className="mt-6 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50">
            <p className="text-xs text-slate-500 font-mono leading-relaxed">
              <span className="text-cyan-400">// 실행 흐름</span><br/>
              1. 사용자 입력 → HumanMessage 변환<br/>
              2. StateGraph.invoke() 호출<br/>
              3. START → chatNode (LangChain 모델 호출) → END<br/>
              4. AIMessage 응답 반환
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <p className="text-center text-slate-600 text-xs mt-6">
          콘솔(터미널)에서 로그를 확인하세요
        </p>
      </main>
    </div>
  );
}
