import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Header() {
  return (
    <header className="thp-header">
      <Link to="/" aria-label="Tu Hogar Posible - Inicio">
        <img src={logo} alt="Tu Hogar Posible" />
      </Link>
    </header>
  );
}
