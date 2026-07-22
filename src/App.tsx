import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProductosBancarios from './pages/ProductosBancarios';
import ProductosFueraDeCartera from './pages/ProductosFueraDeCartera';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/productos-bancarios" element={<ProductosBancarios />} />
        <Route path="/productos-fuera-de-cartera" element={<ProductosFueraDeCartera />} />
      </Routes>
    </BrowserRouter>
  );
}
