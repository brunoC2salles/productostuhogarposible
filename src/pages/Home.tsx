import { Link } from 'react-router-dom';
import heroBg from '../assets/hero-bg.jpg';
import logo from '../assets/logo.png';

export default function Home() {
  return (
    <div className="thp-page-single">
      <section
        className="thp-hero thp-hero-full"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(26,26,26,0.15) 0%, rgba(26,26,26,0.55) 100%), url(${heroBg})` }}
      >
        <img src={logo} alt="Tu Hogar Posible" className="thp-hero-logo" />

        <div className="thp-hero-content">
          <h1>Encuentra tu próximo hogar posible</h1>
          <p>Productos inmobiliarios seleccionados, en colaboración con las principales carteras del mercado.</p>

          <div className="thp-hero-ctas">
            <Link to="/productos-bancarios" className="thp-btn thp-hero-cta">
              Productos Bancarios
            </Link>
            <Link to="/productos-fuera-de-cartera" className="thp-btn thp-hero-cta thp-btn-outline-white">
              Productos Fuera de Cartera
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
