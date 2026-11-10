"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * 🛡️ ErrorBoundary
 * Catches errors in the component tree and displays a fallback UI
 * instead of the white screen of death.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#111214] text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 ring-4 ring-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Eyvah! Bir şeyler ters gitti.</h2>
          <p className="text-[#949ba4] max-w-md mb-8">
            Netrex beklenmeyen bir hatayla karşılaştı. Endişelenmeyin, bu genellikle geçici bir durumdur.
          </p>

          <div className="bg-[#1e1f22] p-4 rounded-lg border border-red-500/20 mb-8 max-w-2xl w-full text-left overflow-auto max-h-48 scrollbar-thin scrollbar-thumb-[#2b2d31]">
            <p className="font-mono text-xs text-red-400">
              {this.state.error && this.state.error.toString()}
            </p>
            {this.state.errorInfo && (
              <pre className="mt-2 font-mono text-[10px] text-[#949ba4]">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 active:transform active:scale-95 transition-all text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20"
            >
              <RefreshCw size={18} />
              Yeniden Başlat
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-6 py-3 bg-[#2b2d31] hover:bg-[#313338] text-[#dbdee1] font-medium rounded-xl transition-all"
            >
              <Home size={18} />
              Ana Sayfa
            </button>
          </div>
          
          <div className="mt-12 text-xs text-[#5c5e66]">
            Netrex Release v{process.env.NEXT_PUBLIC_APP_VERSION || "8.0.0"}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
