import { lazy } from 'react';

/**
 * lazyWithRetry — wraps React.lazy with automatic retry on chunk load failure.
 *
 * Catches network hiccups, outdated Vite optimizer chunks (504s in dev),
 * or new deployment chunk hashes, automatically retrying the dynamic import
 * once before reloading the page if necessary.
 */
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const retryKey = 'chunk_retry_' + componentImport.toString().slice(0, 40);
    const isAlreadyRetried = typeof window !== 'undefined' && sessionStorage.getItem(retryKey);

    try {
      const component = await componentImport();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(retryKey);
      }
      return component;
    } catch (error) {
      const isFetchError = error?.message?.includes('fetch')
        || error?.message?.includes('dynamically imported module')
        || error?.message?.includes('Loading chunk')
        || error?.message?.includes('Importing a module script failed');

      if (!isAlreadyRetried && isFetchError && typeof window !== 'undefined') {
        sessionStorage.setItem(retryKey, 'true');
        window.location.reload();
        return new Promise(() => {}); // Hold suspense fallback while page reloads
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
