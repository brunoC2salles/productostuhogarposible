import logo from '../assets/logo.png';
import IframePanel from '../components/IframePanel';
import Disclaimer from '../components/Disclaimer';

export default function ProductosFueraDeCartera() {
  return (
    <div className="thp-page thp-page-fixed">
      <div className="thp-subheader">
        <div className="thp-subheader-title">
          <img src={logo} alt="Tu Hogar Posible" className="thp-subheader-logo" />
          <h1>Productos Fuera de Cartera</h1>
        </div>
      </div>

      <main className="thp-iframe-main">
        <IframePanel src="https://www.idealista.com/" title="Idealista" />
      </main>

      <Disclaimer />
    </div>
  );
}
