import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
