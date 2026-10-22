import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const client = useQueryClient();
  async function run<T>(action: () => Promise<T>, message?: string): Promise<T | undefined> {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      await client.invalidateQueries();
      if (message) setSuccess(message);
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The operation failed.');
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return {
    pending,
    error,
    success,
    run,
    clear: () => {
      setError(null);
      setSuccess(null);
    },
  };
}
