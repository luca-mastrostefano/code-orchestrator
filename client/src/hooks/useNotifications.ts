import { useEffect, useRef } from 'react';
import type { SessionInfo } from '@remote-orchestrator/shared';
import { playDoneChime } from '../utils/sound.js';

interface UseNotificationsOptions {
  sessions: SessionInfo[];
  /** Whether to show desktop notifications. */
  notificationsEnabled: boolean;
  /** Whether to play a chime when a session becomes idle. */
  soundEnabled: boolean;
  /** Currently-focused session id in the UI (not the OS window focus). */
  focusedSessionId: string | null;
  onFocusSession: (id: string) => void;
  onSwitchToSessionsTab: () => void;
}

export function useNotifications({
  sessions,
  notificationsEnabled,
  soundEnabled,
  focusedSessionId,
  onFocusSession,
  onSwitchToSessionsTab,
}: UseNotificationsOptions) {
  const activeNotifs = useRef<Map<string, Notification>>(new Map());
  const prevStatuses = useRef<Map<string, string>>(new Map());
  const onFocusRef = useRef(onFocusSession);
  const onSwitchRef = useRef(onSwitchToSessionsTab);

  useEffect(() => {
    onFocusRef.current = onFocusSession;
    onSwitchRef.current = onSwitchToSessionsTab;
  }, [onFocusSession, onSwitchToSessionsTab]);

  const fireNotification = (session: SessionInfo, title: string, body: string) => {
    if (activeNotifs.current.has(session.id)) return;

    const notif = new Notification(title, {
      body,
      tag: `session-${session.id}`,
    });

    notif.onclick = () => {
      window.focus();
      onSwitchRef.current();
      onFocusRef.current(session.id);
      notif.close();
      activeNotifs.current.delete(session.id);
    };

    activeNotifs.current.set(session.id, notif);
  };

  // Fire notifications / chime on status transitions. Sound and desktop
  // notifications are independent toggles — either, both, or neither may fire
  // depending on config and current focus state.
  useEffect(() => {
    const canNotify =
      notificationsEnabled && 'Notification' in window && Notification.permission === 'granted';

    for (const session of sessions) {
      const prev = prevStatuses.current.get(session.id);
      const curr = session.status;
      const folderName = session.folderPath.split('/').pop() || session.folderPath;

      // Transition TO waiting (needs input) — desktop notification only, tab unfocused.
      if (curr === 'waiting' && prev !== 'waiting' && prev !== undefined) {
        if (canNotify && !document.hasFocus()) {
          fireNotification(session, session.name, `Needs input — ${folderName}`);
        }
      }

      // Transition TO idle (done running):
      //  - chime: unless the user is already focused on this session in the UI;
      //  - notification: only when the whole tab is unfocused.
      if (curr === 'idle' && prev !== 'idle' && prev !== undefined && prev !== 'exited') {
        if (soundEnabled && focusedSessionId !== session.id) {
          playDoneChime();
        }
        if (canNotify && !document.hasFocus()) {
          fireNotification(session, session.name, `Idle — ${folderName}`);
        }
      }

      // Transition AWAY from waiting/idle — clean up any lingering notification
      if (curr !== 'waiting' && curr !== 'idle' && (prev === 'waiting' || prev === 'idle')) {
        const existing = activeNotifs.current.get(session.id);
        if (existing) {
          existing.close();
          activeNotifs.current.delete(session.id);
        }
      }

      prevStatuses.current.set(session.id, curr);
    }

    // Close notifications for deleted sessions
    const currentIds = new Set(sessions.map((s) => s.id));
    for (const [id, notif] of activeNotifs.current) {
      if (!currentIds.has(id)) {
        notif.close();
        activeNotifs.current.delete(id);
        prevStatuses.current.delete(id);
      }
    }
  }, [sessions, notificationsEnabled, soundEnabled, focusedSessionId]);

  // Cleanup on unmount
  useEffect(() => {
    const notifs = activeNotifs.current;
    return () => {
      notifs.forEach((n) => n.close());
      notifs.clear();
    };
  }, []);
}
