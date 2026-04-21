import { useState } from 'react'
import Navbar from '../components/layout/Navbar'
import QuoteWidget from '../components/market/QuoteWidget'
import OrderForm from '../components/trading/OrderForm'
import HoldingsWidget from '../components/trading/HoldingsWidget'

export default function TradePage() {
  const [symbol, setSymbol] = useState('005930')
  const [refreshKey, setRefreshKey] = useState(0)

  const handleOrderDone = () => setRefreshKey(k => k + 1)

  return (
    <div className="app-layout">
      <Navbar />
      <div className="trade-grid">
        <div className="col-quote">
          <QuoteWidget onSymbolChange={setSymbol} />
        </div>
        <div className="col-order">
          <OrderForm defaultSymbol={symbol} onOrderDone={handleOrderDone} />
        </div>
        <div className="col-holdings">
          <HoldingsWidget refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  )
}
