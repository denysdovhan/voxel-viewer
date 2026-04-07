import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';
import { i18n } from './i18n';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter basename={basename}>
        <AppRouter />
      </BrowserRouter>
    </I18nextProvider>
  );
}
