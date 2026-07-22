import { Link } from 'react-router-dom';
import Header from '../components/Header';
import heroBg from '../assets/hero-bg.jpg';

export default function Home() {
  return (
    <div className="thp-page">
      <Header />

      <section
        className="thp-hero"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(26,26,26,0.15) 0%, rgba(26,26,26,0.55) 100%), url(${heroBg})` }}
      >
        <div className="thp-hero-content">
          <h1>Encuentra tu próximo hogar posible</h1>
          <p>Productos inmobiliarios seleccionados, en colaboración con las principales carteras del mercado.</p>
          <a href="#thp-productos" className="thp-btn thp-hero-cta">
            Buscar productos
          </a>
        </div>
      </section>

      <section id="thp-productos" className="thp-cta-section">
        <Link to="/productos-bancarios" className="thp-btn thp-cta-card">
          Productos Bancarios
        </Link>
        <Link to="/productos-fuera-de-cartera" className="thp-btn thp-cta-card">
          Productos Fuera de Cartera
        </Link>
      </section>
    </div>
  );
}
