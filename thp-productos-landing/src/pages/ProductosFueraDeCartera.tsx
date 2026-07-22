import Header from '../components/Header';
import IframePanel from '../components/IframePanel';
import Disclaimer from '../components/Disclaimer';

export default function ProductosFueraDeCartera() {
  return (
    <div className="thp-page thp-page-fixed">
      <Header />

      <div className="thp-subheader">
        <h1>Productos Fuera de Cartera</h1>
      </div>

      <main className="thp-iframe-main">
        <IframePanel src="https://www.idealista.com/" title="Idealista" />
      </main>

      <Disclaimer />
    </div>
  );
}
