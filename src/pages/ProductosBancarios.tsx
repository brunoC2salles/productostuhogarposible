import { useState } from 'react';
import logo from '../assets/logo.png';
import IframePanel from '../components/IframePanel';
import Disclaimer from '../components/Disclaimer';

type Tab = 'solvia' | 'hipoges';

export default function ProductosBancarios() {
  const [tab, setTab] = useState<Tab>('solvia');

  return (
    <div className="thp-page thp-page-fixed">
      <div className="thp-subheader">
        <div className="thp-subheader-title">
          <img src={logo} alt="Tu Hogar Posible" className="thp-subheader-logo" />
          <h1>Productos Bancarios</h1>
        </div>
        <div className="thp-tabs" role="tablist" aria-label="Colaboraciones bancarias">
          <button
            role="tab"
            aria-selected={tab === 'solvia'}
            className={`thp-btn thp-tab ${tab === 'solvia' ? 'thp-tab-active' : 'thp-btn-secondary'}`}
            onClick={() => setTab('solvia')}
          >
            Colaboración Solvia
          </button>
          <button
            role="tab"
            aria-selected={tab === 'hipoges'}
            className={`thp-btn thp-tab ${tab === 'hipoges' ? 'thp-tab-active' : 'thp-btn-secondary'}`}
            onClick={() => setTab('hipoges')}
          >
            Colaboración Hipoges
          </button>
        </div>
      </div>

      <main className="thp-iframe-main">
        {tab === 'solvia' ? (
          <IframePanel
            src="https://www.solvia.es/es/comprar-casa"
            proxySrc="/api/proxy-solvia/es/comprar-casa"
            title="Colaboración Solvia"
          />
        ) : (
          <IframePanel
            src="https://realestate.hipoges.com/es"
            proxySrc="/api/proxy-hipoges/es"
            title="Colaboración Hipoges"
          />
        )}
      </main>

      <Disclaimer />
    </div>
  );
}
