import React, { Suspense, lazy } from 'react';

/**
 * Like React.lazy, but a failed chunk download is not cached forever:
 * the next render after a failure retries the import.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function retryableLazy<T extends React.ComponentType<any>>(
  load: () => Promise<{ default: T }>
): T {
  const create = () =>
    lazy(() =>
      load().catch((err) => {
        current = create();
        throw err;
      })
    );
  let current = create();
  function RetryableLazy(props: React.ComponentProps<T>) {
    const Current = current;
    return <Current {...props} />;
  }
  return RetryableLazy as unknown as T;
}

interface Props {
  onError: () => void;
  children: React.ReactNode;
}

/** Closes the modal instead of crashing the game when its chunk fails to load. */
export class LazyModalBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error('Modal failed to load:', err);
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
