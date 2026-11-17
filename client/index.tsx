import { installDemoBoundary } from './demo/network';
import './styles.css';

installDemoBoundary();

// Import screens only after isolation, before any app module can start effects.
async function mountApplication(): Promise<void> {
  const [{ default: React }, { createRoot }, { default: App }] = await Promise.all([
    import('react'), import('react-dom/client'), import('./App'),
  ]);
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Could not find root element to mount to');
  createRoot(rootElement).render(React.createElement(App));
}

void mountApplication();
