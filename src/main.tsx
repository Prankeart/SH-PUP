import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error('App render error recovered:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#07364B] text-slate-100 p-6 text-center gap-4">
          <div className="text-lg font-bold text-amber-300">Görüntü Yenileniyor</div>
          <p className="text-sm text-slate-300 max-w-sm">
            Geçici bir tarayıcı bellek veya çizim hatası oluştu. Kaldığın yerden devam etmek için dokun.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg cursor-pointer"
          >
            Oyuna Devam Et
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
