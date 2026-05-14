import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div className="app-layout">
      <Navbar />

      <main className="home-page">
        <section className="home-board">
          <div className="home-board-text">
            <p className="home-welcome">
              {user?.email} 님 환영합니다!
            </p>

            <h1>개인 맞춤형 투자 학습 가이드</h1>

            <p className="home-description">
              주식 초보자들을 위한 기본기부터 마켓 분석, 모의 매매,<br />
              AI 챗봇, 계좌 연결까지 한 곳에서 확인할 수 있습니다.
            </p>
          </div>

          <div className="home-board-image">
            <img src="/judy_main.png" alt="Ju-Dy 메인 이미지" />
          </div>
        </section>

        <section className="home-section-grid">
          <Link to="/education" className="home-section-card">
            <h2>교육센터</h2>
            <p>
              주식 기본 개념과 학습 경로를<br />
              단계별로 확인할 수 있습니다.
            </p>
          </Link>

          <Link to="/market" className="home-section-card">
            <h2>마켓분석</h2>
            <p>
              관심 종목의 재무 안정성과<br />
              위험도를 분석합니다.
            </p>
          </Link>

          <Link to="/trade" className="home-section-card">
            <h2>주식매매</h2>
            <p>
              모의투자를 통해 주문과<br />
              매매 흐름을 연습합니다.
            </p>
          </Link>
          
          <Link to="/mypage" className="home-section-card">
            <h2>계좌 연결</h2>
            <p>
              KIS 계좌 연결과 투자 환경을<br />
              확인할 수 있습니다.
            </p>
          </Link>

          <Link to="/ai-chat" className="home-section-card">
            <h2>AI 챗봇</h2>
            <p>
              주식 관련 내용을 AI에게<br />
              쉽게 질문할 수 있습니다.
            </p>
          </Link>
        </section>


        <section className="home-bottom-row">
          <Link to="/study-log" className="home-wide-card">
            <h2>Study Log</h2>
            <p>주식 공부 기록과 투자 학습 일기를 자유롭게 남깁니다.</p>
          </Link>

          <Link to="/notice" className="home-wide-card">
            <h2>공지사항</h2>
            <p>서비스 업데이트 및 공지사항을 확인합니다.</p>
          </Link>

          <Link to="/faq" className="home-wide-card">
            <h2>FAQ</h2>
            <p>자주 묻는 질문과 답변을 확인합니다.</p>
          </Link>
        </section>
      </main>
      <footer className="home-footer">
        <div className="footer-links">
          <span>유주석 · 강승호 · 이은미 · 민덕기 · 오지수 · 이미지</span>
        </div>

        <div className="footer-info">
          <p>Ju-Dy는 AI 기반으로 설계된 개인 맞춤형 투자 교육 서비스입니다.</p>
          <p>Dong-A [ AI Agent Final Project ]</p>
        </div>

        <div className="footer-copy">
          <p>Copyright © 2026 Ju-Dy. All Rights Reserved.</p>
          <p>Learn. Practice. Invest with Ju-Dy.</p>
        </div>
      </footer>
    </div>
  )
}