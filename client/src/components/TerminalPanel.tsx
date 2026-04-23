import { useRef, useState, useCallback, useEffect } from 'react';
import { formatPathsForPty } from '../utils/pathFormat.js';
import type { SessionInfo } from '@remote-orchestrator/shared';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@remote-orchestrator/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Maximize2, Minimize2, Minus, GitCompare, FolderOpen, X, Move, RotateCcw, Plus, Pencil } from 'lucide-react';
import { api } from '../services/api.js';
import { getSessionColor } from '../utils/sessionColor.js';
import { useTerminal } from '../hooks/useTerminal.js';
import { StatusPill } from './primitives/index.js';
import { Badge } from './primitives/index.js';
import { Tooltip } from './primitives/index.js';
// Status visual handling is now CSS-driven via data-status attribute and StatusPill

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TerminalPanelProps {
  session: SessionInfo;
  socket: TypedSocket;
  theme: 'dark' | 'light';
  onDelete: (id: string) => void;
  onRestart?: (id: string) => void;
  onFocus?: (id: string) => void;
  onUnfocus?: () => void;
  onCollapse?: (id: string) => void;
  onToggleDiff?: (id: string) => void;
  isDiffOpen?: boolean;
  onToggleExplorer?: (id: string) => void;
  isExplorerOpen?: boolean;
  onCloneSession?: (folderPath: string, agentType?: string) => void;
}

const QUICK_ACTIONS = [
  { label: '↑', data: '\x1b[A', title: 'Arrow up' },
  { label: '↓', data: '\x1b[B', title: 'Arrow down' },
  { label: '↵', data: '\r', title: 'Enter' },
  { label: 'y', data: 'y\r', title: 'Yes' },
  { label: 'n', data: 'n\r', title: 'No' },
  { label: '^C', data: '\x03', title: 'Ctrl+C (interrupt)' },
  { label: '1', data: '1\r', title: 'Option 1' },
  { label: '2', data: '2\r', title: 'Option 2' },
  { label: '3', data: '3\r', title: 'Option 3' },
  { label: '4', data: '4\r', title: 'Option 4' },
  { label: '5', data: '5\r', title: 'Option 5' },
  { label: 'Esc', data: '\x1b', title: 'Escape' },
  { label: 'Tab', data: '\t', title: 'Tab' },
];

export function TerminalPanel({ session, socket, theme, onDelete, onRestart, onFocus, onUnfocus, onCollapse, onToggleDiff, isDiffOpen, onToggleExplorer, isExplorerOpen, onCloneSession }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, { sessionId: session.id, socket, theme });

  const [mobileInput, setMobileInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Inline session-name rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(session.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isRenaming) {
      setRenameDraft(session.name);
      // Focus + select-all in the next frame so the input is mounted
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [isRenaming, session.name]);
  const commitRename = useCallback(() => {
    const trimmed = renameDraft.trim();
    setIsRenaming(false);
    if (!trimmed || trimmed === session.name) return;
    api.renameSession(session.id, trimmed).catch((err) => {
      console.error('Failed to rename session:', err);
    });
  }, [renameDraft, session.id, session.name]);
  const cancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameDraft(session.name);
  }, [session.name]);

  // Deterministic color identity for this session (palette of 15).
  const sessionColor = getSessionColor(session.id);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const types = Array.from(e.dataTransfer.types);
    if (types.includes('application/x-argus-path') || types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const paths: string[] = [];

    const argusPath = e.dataTransfer.getData('application/x-argus-path');
    if (argusPath) {
      paths.push(argusPath);
    } else if (e.dataTransfer.files.length > 0) {
      for (const file of Array.from(e.dataTransfer.files)) {
        paths.push(file.name);
      }
    } else {
      const text = e.dataTransfer.getData('text/plain');
      if (text) paths.push(text);
    }

    const data = formatPathsForPty(paths);
    if (data) {
      socket.emit('session:input', { sessionId: session.id, data });
    }
  }, [socket, session.id]);

  const handleMobileSend = () => {
    const text = mobileInput.trim();
    if (!text) return;
    socket.emit('session:input', { sessionId: session.id, data: text + '\r' });
    setMobileInput('');
    // Refocus the input so the keyboard stays open for the next command.
    // iOS honors .focus() from inside a click handler (user gesture context).
    mobileInputRef.current?.focus();
  };

  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `session::${session.id}` });

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: `background var(--transition-fast), color var(--transition-fast)`,
  };

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className="terminal-panel terminal-card"
      data-status={session.status}
      style={{
        ...sortableStyle,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        flex: 1,
        background: 'var(--color-bg-card)',
      }}
    >
      <div
        className="terminal-header"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'var(--color-bg-elevated)',
          flexShrink: 0,
          gap: 'var(--space-2)',
        }}
      >
        {/* Left: drag + status pill + git indicator + agent badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {/* Drag handle — hidden in focus mode (reordering only applies to the grid view) */}
          {!onUnfocus && (
            <Tooltip content="Drag to reorder" position="bottom">
              <span
                {...dragAttributes}
                {...dragListeners}
                style={{
                  cursor: 'grab',
                  color: 'var(--color-text-muted)',
                  flexShrink: 0,
                  userSelect: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <Move size={14} strokeWidth={1.75} />
              </span>
            </Tooltip>
          )}

          <StatusPill status={session.status} />

          {session.hasGitChanges && (
            <Tooltip content="Uncommitted changes" position="bottom">
              <button
                type="button"
                onClick={() => onToggleDiff?.(session.id)}
                aria-label="Uncommitted changes — open Git Diff"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-status-waiting)',
                  cursor: onToggleDiff ? 'pointer' : 'default',
                  flexShrink: 0,
                }}
              >
                <GitCompare size={13} color="var(--color-status-waiting)" strokeWidth={2} />
              </button>
            </Tooltip>
          )}

          <Badge label={session.agentType} />
        </div>

        {/* Center: session-identity tab — hangs from the top with rounded bottom corners */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translateX(-50%)',
            maxWidth: 'min(50%, 400px)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 14px 4px',
            background: sessionColor.bg,
            color: sessionColor.fg,
            borderRadius: '0 0 18px 18px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
            zIndex: 2,
            minWidth: 0,
          }}
        >
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
              }}
              aria-label="Session name"
              style={{
                fontWeight: 600,
                fontSize: 'var(--text-base)',
                color: sessionColor.fg,
                background: 'rgba(255,255,255,0.15)',
                border: `1px solid ${sessionColor.fg === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '1px 6px',
                outline: 'none',
                minWidth: 0,
                maxWidth: '260px',
                font: 'inherit',
              }}
            />
          ) : (
            <>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 'var(--text-base)',
                  color: sessionColor.fg,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {session.name}
              </span>
              <Tooltip content="Rename session" position="bottom">
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  aria-label="Rename session"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: sessionColor.fg,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    opacity: 0.85,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                >
                  <Pencil size={12} strokeWidth={2} />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>

          {onCloneSession && (
            <Tooltip content="New session in this folder" position="bottom">
              <button
                onClick={() => onCloneSession(session.folderPath, session.agentType)}
                className="hover-bg-surface"
                style={{ ...iconBtnStyle, color: 'var(--color-success)' }}
                aria-label="New session in this folder"
              >
                <Plus size={14} strokeWidth={2.25} />
              </button>
            </Tooltip>
          )}

          {onToggleDiff && (
            <Tooltip content="Toggle diff view" position="bottom">
              <button
                onClick={() => onToggleDiff(session.id)}
                className={isDiffOpen ? '' : 'hover-bg-surface'}
                style={{
                  ...iconBtnStyle,
                  color: isDiffOpen ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  background: isDiffOpen ? 'var(--color-accent-subtle)' : 'transparent',
                }}
                aria-label="Toggle diff view"
              >
                <GitCompare size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          {onToggleExplorer && (
            <Tooltip content="Toggle explorer view" position="bottom">
              <button
                onClick={() => onToggleExplorer(session.id)}
                className={isExplorerOpen ? '' : 'hover-bg-surface'}
                style={{
                  ...iconBtnStyle,
                  color: isExplorerOpen ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  background: isExplorerOpen ? 'var(--color-accent-subtle)' : 'transparent',
                }}
                aria-label="Toggle explorer view"
              >
                <FolderOpen size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          {onFocus && (
            <Tooltip content="Focus session" position="bottom">
              <button
                onClick={() => onFocus(session.id)}
                className="hover-bg-surface"
                style={iconBtnStyle}
                aria-label="Focus session"
              >
                <Maximize2 size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          {onCollapse && (
            <Tooltip content="Minimize to chip" position="bottom">
              <button
                onClick={() => onCollapse(session.id)}
                className="hover-bg-surface"
                style={iconBtnStyle}
                aria-label="Minimize session"
              >
                <Minus size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          {onUnfocus && (
            <Tooltip content="Close focus" position="bottom">
              <button
                onClick={onUnfocus}
                className="hover-bg-surface"
                style={iconBtnStyle}
                aria-label="Close focus"
              >
                <Minimize2 size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          {onRestart && (
            <Tooltip content={session.status === 'exited' ? 'Restart session' : 'Restart session (kills current)'} position="bottom">
              <button
                onClick={() => onRestart(session.id)}
                className="hover-success"
                style={iconBtnStyle}
                aria-label="Restart session"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Close session" position="bottom">
            <button
              onClick={() => onDelete(session.id)}
              className="hover-error"
              style={iconBtnStyle}
              aria-label="Close session"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          padding: '4px',
          background: 'var(--color-bg-deepest)',
        }}
      >
        {isDragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
            border: '2px dashed var(--color-accent)',
            borderRadius: 'var(--radius-md)',
            zIndex: 10,
            pointerEvents: 'none',
          }}>
            <span style={{
              color: 'var(--color-accent)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}>
              Drop to paste path
            </span>
          </div>
        )}
      </div>

      {/* Mobile input toolbar — hidden on desktop via CSS */}
      <div className="mobile-terminal-input">
        <div className="mobile-terminal-quickkeys">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              className="mobile-quickkey-btn"
              title={action.title}
              aria-label={action.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => socket.emit('session:input', { sessionId: session.id, data: action.data })}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div className="mobile-terminal-textrow">
          <input
            ref={mobileInputRef}
            className="mobile-terminal-text-input"
            type="text"
            enterKeyHint="send"
            aria-label="Type command"
            placeholder="Type command..."
            value={mobileInput}
            onChange={(e) => setMobileInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleMobileSend();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            className="mobile-terminal-send-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleMobileSend}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
