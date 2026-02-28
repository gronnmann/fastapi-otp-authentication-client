import type { AuthEventType, AuthEventListener, AuthEventPayloads } from './types';

/**
 * Type-safe event emitter for authentication events
 * Supports: login, logout, tokenRefreshed, authError
 */
export class AuthEventEmitter {
  private listeners: Map<AuthEventType, Set<AuthEventListener<AuthEventType>>> = new Map();

  /**
   * Register an event listener
   * @param event - Event type to listen for
   * @param listener - Callback function to execute when event is emitted
   * @returns Unsubscribe function
   */
  on<T extends AuthEventType>(event: T, listener: AuthEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listeners = this.listeners.get(event)!;
    listeners.add(listener as AuthEventListener<AuthEventType>);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Remove an event listener
   * @param event - Event type
   * @param listener - Callback function to remove
   */
  off<T extends AuthEventType>(event: T, listener: AuthEventListener<T>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as AuthEventListener<AuthEventType>);
    }
  }

  /**
   * Register a one-time event listener that auto-unsubscribes after first call
   * @param event - Event type to listen for
   * @param listener - Callback function to execute once
   * @returns Unsubscribe function
   */
  once<T extends AuthEventType>(event: T, listener: AuthEventListener<T>): () => void {
    const onceWrapper: AuthEventListener<T> = (payload) => {
      this.off(event, onceWrapper);
      listener(payload);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * Emit an event to all registered listeners
   * @param event - Event type to emit
   * @param payload - Event payload data
   */
  emit<T extends AuthEventType>(event: T, payload: AuthEventPayloads[T]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          (listener as AuthEventListener<T>)(payload);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event or all events
   * @param event - Optional event type to clear. If not provided, clears all events
   */
  removeAllListeners(event?: AuthEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event
   * @param event - Event type
   * @returns Number of registered listeners
   */
  listenerCount(event: AuthEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Check if there are any listeners for a specific event
   * @param event - Event type
   * @returns true if there are listeners registered
   */
  hasListeners(event: AuthEventType): boolean {
    return this.listenerCount(event) > 0;
  }
}
