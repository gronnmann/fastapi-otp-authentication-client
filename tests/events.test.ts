import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthEventEmitter } from '../src/events';
import type { AuthEventListener } from '../src/types';

describe('AuthEventEmitter', () => {
  let emitter: AuthEventEmitter;

  beforeEach(() => {
    emitter = new AuthEventEmitter();
  });

  describe('Event Registration', () => {
    it('should register event listener', () => {
      const listener = vi.fn();
      emitter.on('login', listener);
      expect(emitter.listenerCount('login')).toBe(1);
    });

    it('should register multiple listeners for same event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.on('login', listener1);
      emitter.on('login', listener2);
      expect(emitter.listenerCount('login')).toBe(2);
    });

    it('should register listeners for different events', () => {
      const loginListener = vi.fn();
      const logoutListener = vi.fn();
      emitter.on('login', loginListener);
      emitter.on('logout', logoutListener);
      expect(emitter.listenerCount('login')).toBe(1);
      expect(emitter.listenerCount('logout')).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = emitter.on('login', listener);
      expect(emitter.listenerCount('login')).toBe(1);
      unsubscribe();
      expect(emitter.listenerCount('login')).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit login event with payload', () => {
      const listener = vi.fn();
      emitter.on('login', listener);
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token-123' });
      expect(listener).toHaveBeenCalledWith({
        email: 'test@example.com',
        accessToken: 'token-123',
      });
    });

    it('should emit logout event', () => {
      const listener = vi.fn();
      emitter.on('logout', listener);
      emitter.emit('logout', { reason: 'user_action' });
      expect(listener).toHaveBeenCalledWith({ reason: 'user_action' });
    });

    it('should emit tokenRefreshed event', () => {
      const listener = vi.fn();
      emitter.on('tokenRefreshed', listener);
      emitter.emit('tokenRefreshed', { accessToken: 'new-token' });
      expect(listener).toHaveBeenCalledWith({ accessToken: 'new-token' });
    });

    it('should emit authError event', () => {
      const listener = vi.fn();
      emitter.on('authError', listener);
      emitter.emit('authError', { error: { detail: 'Auth failed', status: 401 } });
      expect(listener).toHaveBeenCalledWith({
        error: { detail: 'Auth failed', status: 401 },
      });
    });

    it('should call all registered listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      emitter.on('login', listener1);
      emitter.on('login', listener2);
      emitter.on('login', listener3);
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    it('should not throw if no listeners registered', () => {
      expect(() => {
        emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      }).not.toThrow();
    });

    it('should handle errors in listeners gracefully', () => {
      const goodListener = vi.fn();
      const badListener: AuthEventListener<'login'> = () => {
        throw new Error('Listener error');
      };
      emitter.on('login', badListener);
      emitter.on('login', goodListener);

      expect(() => {
        emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      }).not.toThrow();

      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('Event Deregistration', () => {
    it('should remove specific listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.on('login', listener1);
      emitter.on('login', listener2);
      emitter.off('login', listener1);
      expect(emitter.listenerCount('login')).toBe(1);
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should remove all listeners for event', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      emitter.on('login', listener1);
      emitter.on('login', listener2);
      emitter.removeAllListeners('login');
      expect(emitter.listenerCount('login')).toBe(0);
    });

    it('should remove all listeners for all events', () => {
      emitter.on('login', vi.fn());
      emitter.on('logout', vi.fn());
      emitter.on('tokenRefreshed', vi.fn());
      emitter.removeAllListeners();
      expect(emitter.listenerCount('login')).toBe(0);
      expect(emitter.listenerCount('logout')).toBe(0);
      expect(emitter.listenerCount('tokenRefreshed')).toBe(0);
    });
  });

  describe('Once Listener', () => {
    it('should call listener only once', () => {
      const listener = vi.fn();
      emitter.once('login', listener);
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should auto-unsubscribe after first call', () => {
      const listener = vi.fn();
      emitter.once('login', listener);
      expect(emitter.listenerCount('login')).toBe(1);
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      expect(emitter.listenerCount('login')).toBe(0);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = emitter.once('login', listener);
      unsubscribe();
      emitter.emit('login', { email: 'test@example.com', accessToken: 'token' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Listener Count', () => {
    it('should return 0 for no listeners', () => {
      expect(emitter.listenerCount('login')).toBe(0);
    });

    it('should return correct count', () => {
      emitter.on('login', vi.fn());
      emitter.on('login', vi.fn());
      emitter.on('login', vi.fn());
      expect(emitter.listenerCount('login')).toBe(3);
    });

    it('should check if has listeners', () => {
      expect(emitter.hasListeners('login')).toBe(false);
      emitter.on('login', vi.fn());
      expect(emitter.hasListeners('login')).toBe(true);
    });
  });
});
