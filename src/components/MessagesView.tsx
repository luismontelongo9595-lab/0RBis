import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  Plus,
  X,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { apiFetch, uploadMedia } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { ChatMessage, Conversation, User } from '../types';
import { Avatar, SafeImage, formatRelativeTime } from './OrbisUI';

export function MessagesView() {
  const {
    currentUser,
    setAuthModalOpen,
    activeConversationId,
    openConversation,
    subscribeWs,
    sendWs,
    onlineUserIds,
    refreshUnreadCounts,
  } = useApp();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participantsRead, setParticipantsRead] = useState<{ user_id: string; last_read_at: string }[]>([]);
  const [text, setText] = useState('');
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    if (!currentUser) return;
    const res = await apiFetch<{ conversations: Conversation[] }>('/api/conversations');
    setConversations(res.conversations || []);
    if (!activeConversationId && res.conversations?.length > 0) {
      openConversation(res.conversations[0].id);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeConversationId || !currentUser) {
      setMessages([]);
      return;
    }
    apiFetch<{ messages: ChatMessage[]; participants: any[] }>(
      `/api/conversations/${activeConversationId}/messages`
    ).then((res) => {
      setMessages(res.messages || []);
      setParticipantsRead(res.participants || []);
      apiFetch(`/api/conversations/${activeConversationId}/read`, { method: 'POST' })
        .then(() => {
          setConversations((prev) =>
            prev.map((c) => (c.id === activeConversationId ? { ...c, unreadCount: 0 } : c))
          );
          refreshUnreadCounts();
        })
        .catch(() => {});
    });
  }, [activeConversationId, currentUser, refreshUnreadCounts]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    return subscribeWs((event, payload) => {
      if (event === 'message:new') {
        const msg = payload as ChatMessage;
        if (msg.conversationId === activeConversationId) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          apiFetch(`/api/conversations/${activeConversationId}/read`, { method: 'POST' }).catch(() => {});
        }
        loadConversations();
      } else if (event === 'message:read_ack') {
        if (payload.conversationId === activeConversationId) {
          setParticipantsRead((prev) =>
            prev.map((p) =>
              p.user_id === payload.userId ? { ...p, last_read_at: payload.lastReadAt } : p
            )
          );
        }
      } else if (event === 'typing:start' && payload.conversationId === activeConversationId) {
        setTypingUserIds((prev) => new Set(prev).add(payload.userId));
      } else if (event === 'typing:stop' && payload.conversationId === activeConversationId) {
        setTypingUserIds((prev) => {
          const n = new Set(prev);
          n.delete(payload.userId);
          return n;
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, subscribeWs]);

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-display text-lg font-bold mb-2">Real-Time Messaging</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Sign in to send direct messages, group chats, media, and voice notes.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign in to Chat
        </button>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const getConversationTitle = (c: Conversation) => {
    if (c.title) return c.title;
    const others = c.participants.filter((p) => p.id !== currentUser.id);
    return others.map((o) => o.displayName).join(', ') || 'Direct Message';
  };

  const getOtherParticipant = (c: Conversation) => {
    return c.participants.find((p) => p.id !== currentUser.id) || c.participants[0];
  };

  const isParticipantOnline = (userId: string, fallbackOnline: boolean) => {
    return onlineUserIds.has(userId) || fallbackOnline;
  };

  async function sendMessage(payload: { content?: string; mediaUrl?: string; mediaType?: string }) {
    if (!activeConversationId) return;
    const res = await apiFetch<{ message: ChatMessage }>(
      `/api/conversations/${activeConversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    sendWs('typing:stop', { conversationId: activeConversationId });
    loadConversations();
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    await sendMessage({ content });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setUploadingMedia(true);
    try {
      const uploaded = await uploadMedia(file);
      await sendMessage({ mediaUrl: uploaded.url, mediaType: uploaded.mediaType });
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  }

  async function toggleVoiceRecording() {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setUploadingMedia(true);
        try {
          const uploaded = await uploadMedia(file);
          await sendMessage({ mediaUrl: uploaded.url, mediaType: 'AUDIO', content: 'Voice message' });
        } finally {
          setUploadingMedia(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }

  async function openNewChatModal() {
    setShowNewChat(true);
    const res = await apiFetch<{ users: User[] }>('/api/explore');
    setAvailableUsers(res.users || []);
  }

  async function createConversation(e: React.FormEvent) {
    e.preventDefault();
    if (selectedUserIds.length === 0) return;
    const res = await apiFetch<{ conversationId: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantIds: selectedUserIds,
        title: selectedUserIds.length > 1 ? groupTitle || 'Group Chat' : null,
      }),
    });
    setShowNewChat(false);
    setSelectedUserIds([]);
    setGroupTitle('');
    await loadConversations();
    openConversation(res.conversationId);
  }

  const isMessageReadByOthers = (msg: ChatMessage) => {
    if (msg.senderId !== currentUser.id) return false;
    return participantsRead.some(
      (p) => p.user_id !== currentUser.id && new Date(p.last_read_at) >= new Date(msg.createdAt)
    );
  };

  return (
    <div className="grid h-[calc(100vh-140px)] min-h-[540px] grid-cols-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/70 md:grid-cols-[260px_1fr]">
      {/* Conversations List */}
      <div
        className={`flex flex-col border-r border-zinc-200 dark:border-zinc-800 ${
          activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 p-3.5 dark:border-zinc-800">
          <h2 className="font-display text-sm font-bold">Messages</h2>
          <button
            type="button"
            onClick={openNewChatModal}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            title="New message or group chat"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-xs text-zinc-500">
              No conversations yet. Start a DM or group chat!
            </p>
          ) : (
            conversations.map((c) => {
              const other = getOtherParticipant(c);
              const online = !c.isGroup && other ? isParticipantOnline(other.id, other.isOnline) : false;
              const selected = c.id === activeConversationId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`flex w-full items-center gap-3 p-3.5 text-left transition ${
                    selected
                      ? 'bg-indigo-600/10'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <Avatar
                    src={other?.avatarUrl}
                    name={getConversationTitle(c)}
                    size="sm"
                    isOnline={online}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-semibold">{getConversationTitle(c)}</span>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      {c.lastMessage
                        ? c.lastMessage.mediaType
                          ? `[${c.lastMessage.mediaType}]`
                          : c.lastMessage.content
                        : 'No messages yet'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Thread */}
      <div className={`flex flex-col ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
        {!activeConv ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-zinc-500">
            <p>Select a conversation or start a new chat.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openConversation(null)}
                  className="text-xs font-semibold text-indigo-600 md:hidden"
                >
                  ← Back
                </button>
                <div>
                  <h3 className="text-sm font-bold">{getConversationTitle(activeConv)}</h3>
                  <p className="text-[11px] text-zinc-500">
                    {typingUserIds.size > 0
                      ? 'Typing...'
                      : activeConv.isGroup
                      ? `${activeConv.participants.length} participants`
                      : isParticipantOnline(
                          getOtherParticipant(activeConv)?.id || '',
                          Boolean(getOtherParticipant(activeConv)?.isOnline)
                        )
                      ? 'Online now'
                      : 'Offline'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const isMine = m.senderId === currentUser.id;
                const seen = isMessageReadByOthers(m);
                return (
                  <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && activeConv.isGroup && (
                      <span className="mb-1 text-[11px] font-medium text-zinc-500">
                        {m.sender.displayName}
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        isMine
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                      }`}
                    >
                      {m.mediaUrl && m.mediaType === 'IMAGE' && (
                        <SafeImage
                          src={m.mediaUrl}
                          alt="Attachment"
                          className="mb-2 max-h-60 rounded-xl object-cover"
                        />
                      )}
                      {m.mediaUrl && m.mediaType === 'VIDEO' && (
                        <video src={m.mediaUrl} controls className="mb-2 max-h-60 rounded-xl bg-black" />
                      )}
                      {m.mediaUrl && m.mediaType === 'AUDIO' && (
                        <audio src={m.mediaUrl} controls className="mb-1 max-w-[230px]" />
                      )}
                      {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                      <span>{formatRelativeTime(m.createdAt)}</span>
                      {isMine && (
                        <CheckCheck
                          className={`h-3.5 w-3.5 ${seen ? 'text-indigo-500' : 'text-zinc-400'}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={handleTextSubmit}
              className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/mp4,video/webm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() => fileRef.current?.click()}
                title="Share photo or video"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
              >
                {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={toggleVoiceRecording}
                title={recording ? 'Stop and send voice note' : 'Record voice message'}
                className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                  recording
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  sendWs(e.target.value ? 'typing:start' : 'typing:stop', {
                    conversationId: activeConversationId,
                  });
                }}
                placeholder={recording ? 'Recording voice message...' : 'Write a message...'}
                className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
              />

              <button
                type="submit"
                disabled={!text.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white disabled:opacity-50 shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* New DM / Group Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={createConversation}
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">New Conversation</h3>
              <button
                type="button"
                onClick={() => setShowNewChat(false)}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedUserIds.length > 1 && (
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Group chat name"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-800"
              />
            )}

            <div className="max-h-64 overflow-y-auto space-y-2">
              {availableUsers.map((u) => {
                const checked = selectedUserIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 p-2.5 hover:border-indigo-500 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                      <div>
                        <p className="text-xs font-semibold">{u.displayName}</p>
                        <p className="text-[11px] text-zinc-500">@{u.username}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedUserIds((prev) =>
                          checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className="h-4 w-4 accent-indigo-600"
                    />
                  </label>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={selectedUserIds.length === 0}
              className="min-h-[42px] w-full rounded-xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {selectedUserIds.length > 1 ? 'Start Group Chat' : 'Start Direct Message'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
