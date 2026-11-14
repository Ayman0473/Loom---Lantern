import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2, Volume2 } from 'lucide-react';
import {
  BUDDY_ROLES,
  type ChatMessage,
  type ChatModelId,
  type StoryBook,
  type StoryPage,
  type VoiceName,
} from '../types';

interface StoryBuddyChatProps {
  story: StoryBook;
  currentPage: StoryPage;
  selectedVoice: VoiceName;
  messages: ChatMessage[];
  activeModel: ChatModelId;
  onModelChange: (model: ChatModelId) => void;
  onSendMessage: (text: string, modelOverride?: ChatModelId) => Promise<void>;
  onClearHistory: () => void;
  isSending: boolean;
  chatError: string | null;
}

export const StoryBuddyChat: React.FC<StoryBuddyChatProps> = ({
  story,
  currentPage,
  selectedVoice,
  messages,
  activeModel,
  onModelChange,
  onSendMessage,
  onClearHistory,
  isSending,
  chatError,
}) => {
  const [input, setInput] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const buddyAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeRole =
    BUDDY_ROLES.find((r) => r.model === activeModel) ?? BUDDY_ROLES[0];

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, isSending]);

  useEffect(() => {
    return () => {
      if (buddyAudioRef.current) {
        buddyAudioRef.current.pause();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const handleSpeakReply = async (msg: ChatMessage) => {
    setTtsError(null);
    if (speakingMessageId === msg.id && buddyAudioRef.current) {
      buddyAudioRef.current.pause();
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(msg.id);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.text,
          voiceName: selectedVoice,
          readingStyle: 'Warm, friendly children’s reading buddy explaining clearly with kindness',
        }),
      });
      const data = (await res.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Could not play voice reply.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);

      if (!buddyAudioRef.current) {
        buddyAudioRef.current = new Audio();
      }
      buddyAudioRef.current.pause();
      buddyAudioRef.current.src = url;
      buddyAudioRef.current.onended = () => {
        setSpeakingMessageId(null);
        URL.revokeObjectURL(url);
      };
      await buddyAudioRef.current.play();
    } catch (err) {
      setSpeakingMessageId(null);
      setTtsError(err instanceof Error ? err.message : 'Unable to speak reply.');
    }
  };

  return (
    <section
      id="buddy-section"
      aria-labelledby="buddy-heading"
      className="mx-auto max-w-7xl px-6 py-8"
    >
      <div className="overflow-hidden rounded-3xl border border-[#DFD5C5] bg-white shadow-[0_10px_30px_-18px_rgba(31,27,24,0.12)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Column: Role & Model Selector */}
          <div className="border-b lg:border-b-0 lg:border-r border-[#EAE1D3] bg-[#FBF8F2] p-6 sm:p-8 lg:col-span-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-[#6B6257]">
                Interactive Reading Companion
              </p>
              <h2
                id="buddy-heading"
                className="font-display mt-1 text-2xl font-semibold text-[#1F1B18] [text-wrap:balance]"
              >
                Ask Story Buddy
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5C5349]">
                Currently reading <span className="font-semibold text-[#1F1B18]">{story.title}</span>
                {' · '}Page {currentPage.pageNumber}: {currentPage.heading}
              </p>

              {/* 4 Role / Model Buttons */}
              <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Story Buddy Mode">
                {BUDDY_ROLES.map((role) => {
                  const selected = role.model === activeModel;
                  return (
                    <button
                      key={role.model}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onModelChange(role.model)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8] ${
                        selected
                          ? 'border-[#1D4ED8] bg-white shadow-xs'
                          : 'border-[#E5DCCD] bg-[#F6F1E7]/70 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            selected ? 'text-[#1D4ED8]' : 'text-[#1F1B18]'
                          }`}
                        >
                          {role.title}
                        </span>
                        <span className="text-[11px] font-medium text-[#6B6257]">
                          {role.model}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#5C5349]">
                        {role.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="mt-6 inline-flex items-center gap-2 self-start rounded-lg border border-[#D8CEBE] bg-white px-3.5 py-2 text-xs font-semibold text-[#5C5349] transition-colors hover:bg-[#F3ECE0] hover:text-[#1F1B18] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Start Fresh Conversation
              </button>
            )}
          </div>

          {/* Right Column: Scrollable Multi-Turn Conversation Thread */}
          <div className="flex flex-col lg:col-span-8 h-[520px] bg-white">
            {/* Active Mode Banner */}
            <div className="flex items-center justify-between gap-4 border-b border-[#EAE1D3] px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-[#1F1B18]">
                  {activeRole.title}
                </p>
                <p className="text-xs text-[#6B6257]">
                  {activeRole.subtitle}
                </p>
              </div>
              <span className="text-xs font-medium text-[#6B6257] tabular-nums whitespace-nowrap">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </span>
            </div>

            {/* Scrollable Thread */}
            <div
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
              aria-live="polite"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col justify-center">
                  <p className="font-display text-lg font-medium text-[#1F1B18]">
                    Curious about something on Page {currentPage.pageNumber}?
                  </p>
                  <p className="mt-1 text-sm text-[#5C5349]">
                    Try one of these prompts for <span className="font-semibold">{activeRole.title}</span>, or type your own question below.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeRole.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void onSendMessage(prompt)}
                        className="rounded-xl border border-[#DFD5C5] bg-[#FBF8F2] px-3.5 py-2 text-left text-xs font-medium text-[#1F1B18] transition-colors hover:border-[#1D4ED8] hover:bg-[#EFF4FF] cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-[#6B6257]">
                        <span className="font-semibold text-[#4A423A]">
                          {isUser ? 'Reader' : msg.roleLabel || 'Story Buddy'}
                        </span>
                        {!isUser && msg.model && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{msg.model}</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[#1D4ED8] text-white'
                            : 'border border-[#E5DCCD] bg-[#FBF8F2] text-[#1F1B18]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {!isUser && (
                          <div className="mt-2.5 flex items-center justify-end border-t border-[#EAE1D3] pt-2">
                            <button
                              type="button"
                              onClick={() => void handleSpeakReply(msg)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] cursor-pointer"
                            >
                              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                              {speakingMessageId === msg.id ? 'Stop Voice' : 'Read Reply Aloud'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isSending && (
                <div className="flex items-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E5DCCD] bg-[#FBF8F2] px-4 py-3 text-xs font-medium text-[#5C5349]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1D4ED8]" aria-hidden="true" />
                    {activeRole.title} is thinking...
                  </div>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>

            {/* Error Banners */}
            {(chatError || ttsError) && (
              <div
                role="alert"
                className="mx-6 mb-2 rounded-xl border border-[#F5C2C0] bg-[#FEF2F2] px-3.5 py-2 text-xs text-[#991B1B]"
              >
                {chatError || ttsError}
              </div>
            )}

            {/* Message Input Bar */}
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="border-t border-[#EAE1D3] bg-[#FBF8F2] p-4"
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask ${activeRole.title} about this page...`}
                  aria-label="Message Story Buddy"
                  className="flex-1 rounded-xl border border-[#D8CEBE] bg-white px-4 py-2.5 text-sm text-[#1F1B18] placeholder:text-[#8C8174] focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
