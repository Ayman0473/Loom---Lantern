import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  MessageCircleQuestion,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ART_STYLES,
  VOICE_OPTIONS,
  type ImageSize,
  type StoryBook,
  type StoryPage,
  type VoiceName,
} from '../types';

interface StorybookSpreadProps {
  story: StoryBook;
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  imageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  selectedArtStyle: string;
  onArtStyleChange: (style: string) => void;
  selectedVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  onPageIllustrated: (
    storyId: string,
    pageId: string,
    imageUrl: string,
    size: ImageSize,
    style: string
  ) => void;
  onSelectSavedIllustration: (storyId: string, pageId: string, imageUrl: string) => void;
  onAskBuddy: (question: string) => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const whole = Math.floor(sec);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const StorybookSpread: React.FC<StorybookSpreadProps> = ({
  story,
  currentPageIndex,
  onPageChange,
  imageSize,
  onImageSizeChange,
  selectedArtStyle,
  onArtStyleChange,
  selectedVoice,
  onVoiceChange,
  onPageIllustrated,
  onSelectSavedIllustration,
  onAskBuddy,
}) => {
  const page: StoryPage = story.pages[currentPageIndex] ?? story.pages[0];

  // Illustration generation state
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomDirection, setShowCustomDirection] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Audio narration state
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;

  // Cleanup audio when page or story changes
  useEffect(() => {
    setImageError(null);
    setAudioError(null);
    setCustomPrompt('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, [story.id, page.id]);

  // Apply playback rate changes smoothly
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Revoke object URLs on unmount
  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const playAudioUrl = (objectUrl: string, onEndedCallback?: () => void) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const el = audioRef.current;
    el.pause();
    el.src = objectUrl;
    el.playbackRate = playbackSpeedRef.current;

    el.onloadedmetadata = () => {
      setAudioDuration(el.duration || 0);
    };
    el.ontimeupdate = () => {
      setAudioCurrentTime(el.currentTime || 0);
      if (el.duration) setAudioDuration(el.duration);
    };
    el.onended = () => {
      setIsPlaying(false);
      setAudioCurrentTime(0);
      if (onEndedCallback) {
        onEndedCallback();
      }
    };
    el.onerror = () => {
      setIsPlaying(false);
      setAudioError('Could not play audio narration in this browser.');
    };

    void el.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const handleReadPageAloud = async (targetPage: StoryPage = page) => {
    setAudioError(null);

    // If already playing this page, toggle pause
    if (audioRef.current && audioRef.current.src && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If paused mid-way on this same page & voice, resume
    const cacheKey = `${targetPage.id}:${selectedVoice}`;
    const cachedUrl = audioCacheRef.current.get(cacheKey);
    if (
      cachedUrl &&
      audioRef.current &&
      audioRef.current.src === cachedUrl &&
      audioRef.current.currentTime > 0 &&
      audioRef.current.currentTime < (audioRef.current.duration || Infinity)
    ) {
      audioRef.current.playbackRate = playbackSpeedRef.current;
      void audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    const handleNextAfterAudio = () => {
      if (autoAdvanceRef.current && currentPageIndex < story.pages.length - 1) {
        const nextIdx = currentPageIndex + 1;
        onPageChange(nextIdx);
        // Trigger read on next page smoothly after page flip
        setTimeout(() => {
          void triggerReadForPage(story.pages[nextIdx], nextIdx);
        }, 450);
      }
    };

    if (cachedUrl) {
      playAudioUrl(cachedUrl, handleNextAfterAudio);
      return;
    }

    await triggerReadForPage(targetPage, currentPageIndex);
  };

  const triggerReadForPage = async (targetPage: StoryPage, pageIdx: number) => {
    const cacheKey = `${targetPage.id}:${selectedVoice}`;
    const cached = audioCacheRef.current.get(cacheKey);
    const onDone = () => {
      if (autoAdvanceRef.current && pageIdx < story.pages.length - 1) {
        const nextIdx = pageIdx + 1;
        onPageChange(nextIdx);
        setTimeout(() => {
          void triggerReadForPage(story.pages[nextIdx], nextIdx);
        }, 450);
      }
    };

    if (cached) {
      playAudioUrl(cached, onDone);
      return;
    }

    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const voicePreset = VOICE_OPTIONS.find((v) => v.id === selectedVoice) ?? VOICE_OPTIONS[0];
      const textToRead = `${targetPage.heading}. ${targetPage.text}`;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToRead,
          voiceName: selectedVoice,
          readingStyle: voicePreset.stylePrompt,
        }),
      });

      const data = (await res.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Failed to generate narration audio.');
      }

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(cacheKey, url);

      playAudioUrl(url, onDone);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Unable to read page aloud right now.');
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleRestartAudio = () => {
    if (!audioRef.current || !audioRef.current.src) {
      void handleReadPageAloud();
      return;
    }
    audioRef.current.currentTime = 0;
    setAudioCurrentTime(0);
    void audioRef.current.play();
    setIsPlaying(true);
  };

  const handleGenerateIllustration = async (targetPage: StoryPage = page, promptOverride?: string) => {
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const res = await fetch('/api/illustrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyTitle: story.title,
          pageText: `${targetPage.illustrationPrompt}. Story narrative: ${targetPage.text}`,
          artStyle: selectedArtStyle,
          customPrompt: promptOverride ?? customPrompt,
          imageSize,
          aspectRatio: '4:3',
        }),
      });

      const data = (await res.json()) as { imageUrl?: string; error?: string };
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'Could not generate illustration for this page.');
      }

      onPageIllustrated(story.id, targetPage.id, data.imageUrl, imageSize, selectedArtStyle);
      if (!promptOverride) {
        setCustomPrompt('');
      }
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Unable to illustrate this page right now.'
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const missingPages = story.pages.filter((p) => !p.imageUrl);

  const handleIllustrateMissingPages = async () => {
    if (missingPages.length === 0 || isGeneratingImage || batchProgress) return;
    setImageError(null);
    setBatchProgress({ current: 0, total: missingPages.length });

    try {
      for (let i = 0; i < missingPages.length; i++) {
        const target = missingPages[i];
        setBatchProgress({ current: i + 1, total: missingPages.length });

        const res = await fetch('/api/illustrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyTitle: story.title,
            pageText: `${target.illustrationPrompt}. Story narrative: ${target.text}`,
            artStyle: selectedArtStyle,
            imageSize,
            aspectRatio: '4:3',
          }),
        });

        const data = (await res.json()) as { imageUrl?: string; error?: string };
        if (!res.ok || !data.imageUrl) {
          throw new Error(data.error || `Failed on page ${target.pageNumber}.`);
        }

        onPageIllustrated(story.id, target.id, data.imageUrl, imageSize, selectedArtStyle);
      }
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Stopped illustrating remaining pages due to an error.'
      );
    } finally {
      setBatchProgress(null);
    }
  };

  const progressPct =
    audioDuration > 0 ? Math.min(100, Math.round((audioCurrentTime / audioDuration) * 100)) : 0;

  return (
    <section id="reader-section" aria-label="Storybook Reader" className="mx-auto max-w-7xl px-6 pt-8 pb-10">
      {/* Compact Book Title & Page Summary Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6257] tabular-nums">
            <span>{story.ageBand}</span>
            <span aria-hidden="true">·</span>
            <span>
              Page {currentPageIndex + 1} of {story.pages.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{story.readingMinutes} min read</span>
          </div>
          <h1 className="font-display mt-1 text-3xl sm:text-4xl font-semibold tracking-tight text-[#1F1B18] [text-wrap:balance]">
            {story.title}
          </h1>
        </div>

        {/* Page Turner Mini-Summary */}
        <div className="flex items-center gap-2 shrink-0">
          {missingPages.length > 0 && (
            <button
              type="button"
              disabled={Boolean(batchProgress) || isGeneratingImage}
              onClick={handleIllustrateMissingPages}
              className="inline-flex items-center gap-2 rounded-lg border border-[#D8CEBE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1B18] transition-colors hover:bg-[#F5EFE4] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
            >
              {batchProgress ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B45309]" aria-hidden="true" />
                  Painting {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                <>
                  <ImagePlus className="h-3.5 w-3.5 text-[#B45309]" aria-hidden="true" />
                  Illustrate {missingPages.length} Unpainted {missingPages.length === 1 ? 'Page' : 'Pages'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Page Open Storybook Spread */}
      <div className="storybook-spread overflow-hidden rounded-3xl border border-[#DFD5C5] shadow-[0_14px_40px_-18px_rgba(31,27,24,0.16)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch">
          {/* LEFT PAGE: Picture Illustration & 1K/2K/4K Studio Controls */}
          <div className="flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#EAE1D3] p-6 sm:p-8">
            <div>
              {/* Picture Frame */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#E5DCCD] bg-[#F5EFE4]">
                <AnimatePresence mode="wait">
                  {page.imageUrl ? (
                    <motion.img
                      key={page.imageUrl}
                      src={page.imageUrl}
                      alt={`Illustration for page ${page.pageNumber}: ${page.heading}`}
                      referrerPolicy="no-referrer"
                      initial={{ opacity: 0.25, scale: 0.99 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0.25 }}
                      transition={{ duration: 0.2 }}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <motion.div
                      key={`empty-${page.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#FBF7EE] via-[#F4ECDC] to-[#EBE0CC] p-8 text-center"
                    >
                      <BookOpen className="h-10 w-10 text-[#9A7B56]" aria-hidden="true" />
                      <p className="font-display mt-3 text-xl font-semibold text-[#1F1B18]">
                        Page {page.pageNumber} Sketch Canvas
                      </p>
                      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#5C5349]">
                        {page.illustrationPrompt}
                      </p>
                      <button
                        type="button"
                        disabled={isGeneratingImage || Boolean(batchProgress)}
                        onClick={() => void handleGenerateIllustration()}
                        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
                      >
                        {isGeneratingImage ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Painting at {imageSize}...
                          </>
                        ) : (
                          <>
                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                            Illustrate This Page ({imageSize})
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generating Overlay when regenerating over existing art */}
                {isGeneratingImage && page.imageUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1F1B18]/55 backdrop-blur-[2px] text-white px-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold">
                      Painting a fresh {imageSize} illustration...
                    </p>
                  </div>
                )}
              </div>

              {/* Caption + Saved Versions Strip */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6257]">
                <span className="italic font-display">
                  Plate {String(page.pageNumber).padStart(2, '0')} — {page.heading}
                </span>
                {page.imageHistory && page.imageHistory.length > 1 && (
                  <div className="flex items-center gap-1.5" aria-label="Saved page illustrations">
                    <span className="mr-1">Versions:</span>
                    {page.imageHistory.map((item, idx) => {
                      const active = item.url === page.imageUrl;
                      return (
                        <button
                          key={`${item.createdAt}-${idx}`}
                          type="button"
                          onClick={() => onSelectSavedIllustration(story.id, page.id, item.url)}
                          className={`h-7 w-9 overflow-hidden rounded border transition-all cursor-pointer ${
                            active
                              ? 'border-[#1D4ED8] ring-2 ring-[#1D4ED8]/30'
                              : 'border-[#D8CEBE] opacity-75 hover:opacity-100'
                          }`}
                          title={`Version ${idx + 1} (${item.size})`}
                        >
                          <img
                            src={item.url}
                            alt={`Illustration version ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Illustration Controls Bar (1K / 2K / 4K + Art Style + Regenerate) */}
            <div className="mt-6 border-t border-[#ECE4D7] pt-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Resolution Selector: 1K, 2K, 4K */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#5C5349]">
                    Image Size
                  </span>
                  <div
                    role="group"
                    aria-label="Illustration resolution"
                    className="inline-flex items-center rounded-lg bg-[#F3ECE0] p-1"
                  >
                    {(['1K', '2K', '4K'] as const).map((size) => {
                      const active = imageSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => onImageSizeChange(size)}
                          aria-pressed={active}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1D4ED8] ${
                            active
                              ? 'bg-white text-[#1F1B18] shadow-xs'
                              : 'text-[#6B6257] hover:text-[#1F1B18]'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Art Medium Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="art-style-select" className="text-xs font-semibold text-[#5C5349]">
                    Medium
                  </label>
                  <select
                    id="art-style-select"
                    value={selectedArtStyle}
                    onChange={(e) => onArtStyleChange(e.target.value)}
                    className="rounded-lg border border-[#D8CEBE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1F1B18] focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                  >
                    {ART_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons & Optional Scene Tweak */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isGeneratingImage || Boolean(batchProgress)}
                  onClick={() => void handleGenerateIllustration()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Generating ({imageSize})...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      {page.imageUrl ? `New Illustration (${imageSize})` : `Illustrate Page (${imageSize})`}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCustomDirection((prev) => !prev)}
                  className="rounded-lg border border-[#D8CEBE] bg-white px-3.5 py-2 text-xs font-semibold text-[#5C5349] transition-colors hover:bg-[#F5EFE4] hover:text-[#1F1B18] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                >
                  {showCustomDirection ? 'Hide Scene Note' : 'Customize Scene'}
                </button>
              </div>

              {showCustomDirection && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Add a detail, e.g. 'a tiny bluebird sitting on the lantern'"
                    aria-label="Custom scene direction"
                    className="flex-1 rounded-lg border border-[#D8CEBE] bg-[#FBF8F2] px-3 py-2 text-sm text-[#1F1B18] placeholder:text-[#8C8174] focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                  />
                  <button
                    type="button"
                    disabled={isGeneratingImage || !customPrompt.trim()}
                    onClick={() => void handleGenerateIllustration()}
                    className="rounded-lg bg-[#1F1B18] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3A332D] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Paint With Detail
                  </button>
                </div>
              )}

              {imageError && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-xl border border-[#F5C2C0] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
                >
                  <span>{imageError}</span>
                  <button
                    type="button"
                    onClick={() => void handleGenerateIllustration()}
                    className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PAGE: Read-Aloud Story Text, Voice Narration & Wonder Prompt */}
          <div className="flex flex-col justify-between p-6 sm:p-10">
            <div>
              {/* Chapter Index & Page Metadata */}
              <div className="flex items-center justify-between border-b border-[#ECE4D7] pb-4 text-xs font-medium text-[#6B6257] tabular-nums">
                <span>
                  Chapter {String(page.pageNumber).padStart(2, '0')} — {page.heading}
                </span>
                <span>
                  {page.pageNumber} / {story.pages.length}
                </span>
              </div>

              {/* Story Prose */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={page.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="mt-7"
                >
                  <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#1F1B18] [text-wrap:balance]">
                    {page.heading}
                  </h2>

                  <p
                    className={`mt-5 max-w-[62ch] text-lg sm:text-[1.22rem] leading-[1.78] text-[#292420] ${
                      page.pageNumber === 1 ? 'story-dropcap' : ''
                    }`}
                  >
                    {page.text}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-8 space-y-5">
              {/* Read-Aloud Audio Studio */}
              <div className="rounded-2xl border border-[#E5DCCD] bg-[#FBF8F2] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isLoadingAudio}
                      onClick={() => void handleReadPageAloud()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                    >
                      {isLoadingAudio ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Preparing Voice...
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="h-4 w-4" aria-hidden="true" />
                          Pause Reading
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" aria-hidden="true" />
                          Read Page Aloud
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isLoadingAudio}
                      onClick={handleRestartAudio}
                      title="Replay page from beginning"
                      aria-label="Replay page narration"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#D8CEBE] bg-white text-[#5C5349] transition-colors hover:bg-[#F3ECE0] hover:text-[#1F1B18] disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Narrator Voice Selector */}
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-[#6B6257]" aria-hidden="true" />
                    <label htmlFor="narrator-voice" className="sr-only">
                      Narrator Voice
                    </label>
                    <select
                      id="narrator-voice"
                      value={selectedVoice}
                      onChange={(e) => onVoiceChange(e.target.value as VoiceName)}
                      className="rounded-lg border border-[#D8CEBE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1F1B18] focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                    >
                      {VOICE_OPTIONS.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.label} ({voice.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Progress & Speed Row */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-1 min-w-[160px] items-center gap-3">
                    <div
                      className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5DCCD]"
                      role="progressbar"
                      aria-valuenow={progressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-[#1D4ED8] transition-all duration-150"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#6B6257] tabular-nums whitespace-nowrap">
                      {formatSeconds(audioCurrentTime)} / {formatSeconds(audioDuration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center rounded-md bg-[#EFE7D8] p-0.5 text-xs">
                      {[0.85, 1, 1.15].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => setPlaybackSpeed(speed)}
                          className={`rounded px-2 py-0.5 font-medium transition-colors cursor-pointer ${
                            playbackSpeed === speed
                              ? 'bg-white text-[#1F1B18] shadow-xs'
                              : 'text-[#6B6257] hover:text-[#1F1B18]'
                          }`}
                        >
                          {speed}×
                        </button>
                      ))}
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5349] cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={(e) => setAutoAdvance(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[#D8CEBE] accent-[#1D4ED8]"
                      />
                      Auto-turn
                    </label>
                  </div>
                </div>

                {audioError && (
                  <div
                    role="alert"
                    className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-[#F5C2C0] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
                  >
                    <span>{audioError}</span>
                    <button
                      type="button"
                      onClick={() => void handleReadPageAloud()}
                      className="font-semibold underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Wonder Prompt / Discussion Hook */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E8DFD0] bg-white px-4 py-3.5">
                <div className="text-sm text-[#4A423A]">
                  <span className="font-semibold text-[#1F1B18]">Wonder Together: </span>
                  {page.wonderQuestion}
                </div>
                <button
                  type="button"
                  onClick={() => onAskBuddy(page.wonderQuestion)}
                  className="inline-flex items-center gap-1.5 self-start sm:self-center rounded-lg border border-[#D8CEBE] bg-[#FBF8F2] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF4FF] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
                >
                  <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
                  Ask Story Buddy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Book Page Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EAE1D3] bg-[#F9F5EC] px-6 py-4">
          <button
            type="button"
            disabled={currentPageIndex === 0}
            onClick={() => onPageChange(currentPageIndex - 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#D8CEBE] bg-white px-4 py-2 text-sm font-semibold text-[#1F1B18] transition-colors hover:bg-[#F3ECE0] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous Page
          </button>

          <div className="flex items-center gap-2" role="navigation" aria-label="Book pages">
            {story.pages.map((p, idx) => {
              const isCurrent = idx === currentPageIndex;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPageChange(idx)}
                  aria-label={`Go to page ${p.pageNumber}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8] ${
                    isCurrent
                      ? 'bg-[#1D4ED8] text-white'
                      : p.imageUrl
                        ? 'bg-white border border-[#D8CEBE] text-[#1F1B18] hover:bg-[#EFE7D8]'
                        : 'bg-[#EFE7D8] text-[#6B6257] hover:text-[#1F1B18]'
                  }`}
                >
                  {p.pageNumber}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={currentPageIndex >= story.pages.length - 1}
            onClick={() => onPageChange(currentPageIndex + 1)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F1B18] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3A332D] disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
          >
            Next Page
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};
