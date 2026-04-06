import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AppRouter />
    </BrowserRouter>
  );
}
