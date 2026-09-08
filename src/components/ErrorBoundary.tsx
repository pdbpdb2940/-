import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">表示中にエラーが発生しました</h2>
              <p className="text-sm text-slate-600 mt-1">
                画面の描画中に予期せぬエラーが発生しました。再読み込みをお試しください。
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-2.5 bg-slate-100 rounded text-xs font-mono text-slate-600 text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                画面を復帰
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>再読み込み</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
