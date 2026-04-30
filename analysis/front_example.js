import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, ShieldCheck, FileText, Send } from 'lucide-react';

const MarketAnalysisPage = () => {
  // 샘플 데이터 (DB의 stocks, prices, financials, warnings 연동)
  const stockData = {
    name: "삼성전자",
    ticker: "005930",
    market: "KOSPI",
    price: 224750,
    change: -1250,
    changeRate: -0.55,
    industry: "반도체 및 전자부품",
    summary: "세계적인 IT 기업으로 반도체, 스마트폰, TV 등 가전제품을 생산합니다.",
    financials: { roe: 12.5, debtRatio: 25.3, per: 34.24, pbr: 3.51, dividend: 0.74 },
    warnings: [{ id: 1, type: "CAUTION", reason: "단기 과열 주의" }]
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 1. 상단 헤더: 종목 요약 (네이버 증권 스타일) */}
      <header className="bg-white border-b p-6 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-gray-800">{stockData.name}</h1>
            <span className="text-gray-500 font-mono text-lg">{stockData.ticker}</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm font-semibold">{stockData.market}</span>
          </div>
          <p className="text-gray-500">{stockData.industry}</p>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold ${stockData.changeRate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {stockData.price.toLocaleString()}
          </div>
          <div className={`text-sm ${stockData.changeRate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
            {stockData.change > 0 ? '▲' : '▼'} {Math.abs(stockData.change).toLocaleString()} ({stockData.changeRate}%)
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* 2. 좌측 영역: 데이터 분석 (70%) */}
        <section className="w-2/3 p-6 overflow-y-auto space-y-6">
          
          {/* 핵심 체크포인트 카드 (초보자용) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp size={20} /> <span className="font-bold">수익성 (ROE)</span>
              </div>
              <div className="text-2xl font-bold">{stockData.financials.roe}%</div>
              <p className="text-xs text-gray-400">자본 대비 이익을 잘 내는가</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <ShieldCheck size={20} /> <span className="font-bold">안전성 (부채)</span>
              </div>
              <div className="text-2xl font-bold">{stockData.financials.debtRatio}%</div>
              <p className="text-xs text-gray-400">부채비율이 낮아 안전한가</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <AlertCircle size={20} /> <span className="font-bold">위험 신호</span>
              </div>
              <div className="text-lg font-bold text-orange-500">{stockData.warnings[0].reason}</div>
              <p className="text-xs text-gray-400">현재 유효한 경고 사항</p>
            </div>
          </div>

          {/* DART 연동 섹션 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20} /> 공식 공시 정보 (DART)
              </h3>
              <button 
                onClick={() => window.open(`https://dart.fss.or.kr/dsbd001/main.do?textCrpNm=${stockData.ticker}`)}
                className="text-sm text-blue-600 hover:underline"
              >
                DART 원문 전체보기 &gt;
              </button>
            </div>
            <ul className="space-y-3">
              <li className="flex justify-between p-2 hover:bg-gray-50 rounded cursor-pointer border-b text-sm">
                <span>[분기보고서] 2026년 1분기 보고서</span>
                <span className="text-gray-400 font-mono">2026.04.15</span>
              </li>
              <li className="flex justify-between p-2 hover:bg-gray-50 rounded cursor-pointer border-b text-sm">
                <span>주요사항보고서(현금배당결정)</span>
                <span className="text-gray-400 font-mono">2026.03.30</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 3. 우측 영역: AI 상담소 (30%) - 네이버의 우측 투자정보 위치 */}
        <aside className="w-1/3 bg-white border-l flex flex-col shadow-lg">
          <div className="p-4 border-b bg-indigo-600 text-white flex justify-between items-center">
            <h3 className="font-bold">AI 투자 에이전트</h3>
            <span className="text-xs bg-indigo-500 px-2 py-1 rounded">JS님 전담 상담</span>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
            <div className="bg-white p-3 rounded-lg shadow-sm text-sm border">
              안녕하세요 JS님! {stockData.name}에 대해 궁금한 점이 있으신가요? 
              <br/><br/>
              현재 <b>ROE가 {stockData.financials.roe}%</b>로 양호하지만, <b>투자주의</b> 신호가 있습니다. 이 부분에 대해 설명해 드릴까요?
            </div>
            {/* 사용자 질문 예시 */}
            <div className="flex justify-end">
              <div className="bg-indigo-100 p-3 rounded-lg shadow-sm text-sm max-w-[80%]">
                이 회사의 배당 가능성이 어때?
              </div>
            </div>
          </div>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="질문을 입력하세요..." 
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button className="bg-indigo-600 text-white p-2 rounded-lg">
                <Send size={18} />
              </button>
            </div>
            <div className="flex gap-1 mt-3 overflow-x-auto">
              {['PER 설명해줘', '위험 사유 뭐야?', '최근 공시 요약'].map(tag => (
                <button key={tag} className="text-[10px] bg-gray-100 border px-2 py-1 rounded-full whitespace-nowrap text-gray-600">
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default MarketAnalysisPage;