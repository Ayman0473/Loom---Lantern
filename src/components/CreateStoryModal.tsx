import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { ART_STYLES, type ImageSize, type StoryBook } from '../types';

interface CreateStoryModalProps {
  isOpen: boolean;
  defaultImageSize: ImageSize;
  defaultArtStyle: string;
  onClose: () => void;
  onStoryCreated: (story: StoryBook) => void;
}

const QUICK_IDEAS = [
  'A sleepy badger building a cozy snow-lantern train for winter mice',
  'Two twin sea otters searching a coral tidepool for a singing pearl',
  'A shy little cloud learning how to paint rainbows after summer rain',
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  defaultImageSize,
  defaultArtStyle,
  onClose,
  onStoryCreated,
}) => {
  const [topic, setTopic] = useState('');
  const [ageBand, setAgeBand] = useState('Ages 5–8');
  const [pageCount, setPageCount] = useState(4);
  const [artStyle, setArtStyle] = useState(defaultArtStyle);
  const [imageSize, setImageSize] = useState<ImageSize>(defaultImageSize);
  const [autoIllustrateAll, setAutoIllustrateAll] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setArtStyle(defaultArtStyle);
    setImageSize(defaultImageSize);
  }, [defaultArtStyle, defaultImageSize, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isCreating, onClose]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);
    setStatusMessage('Writing your storybook pages...');

    try {
      const res = await fetch('/api/story/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          ageBand,
          artStyle,
          pageCount,
        }),
      });

      const data = (await res.json()) as {
        title?: string;
        subtitle?: string;
        ageBand?: string;
        artStyle?: string;
        pages?: Array<{
          pageNumber: number;
          heading: string;
          text: string;
          illustrationPrompt: string;
          wonderQuestion: string;
        }>;
        error?: string;
      };

      if (!res.ok || !data.pages || !data.title) {
        throw new Error(data.error || 'Could not create your story.');
      }

      const storyId = `custom-${Date.now()}`;
      const builtPages = data.pages.map((p, index) => ({
        id: `${storyId}-p${index + 1}`,
        pageNumber: p.pageNumber || index + 1,
        heading: p.heading,
        text: p.text,
        illustrationPrompt: p.illustrationPrompt,
        wonderQuestion: p.wonderQuestion,
      }));

      const newStory: StoryBook = {
        id: storyId,
        title: data.title,
        subtitle: data.subtitle || 'An original illustrated storybook',
        ageBand: data.ageBand || ageBand,
        artStyle: data.artStyle || artStyle,
        readingMinutes: Math.max(2, Math.round(builtPages.length * 0.8)),
        createdAt: Date.now(),
        isCustom: true,
        pages: builtPages,
      };

      if (autoIllustrateAll) {
        for (let i = 0; i < newStory.pages.length; i++) {
          const target = newStory.pages[i];
          setStatusMessage(
            `Illustrating page ${i + 1} of ${newStory.pages.length} (${imageSize})...`
          );
          try {
            const imgRes = await fetch('/api/illustrate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                storyTitle: newStory.title,
                pageText: `${target.illustrationPrompt}. Story text: ${target.text}`,
                artStyle,
                imageSize,
                aspectRatio: '4:3',
              }),
            });
            const imgData = (await imgRes.json()) as { imageUrl?: string };
            if (imgRes.ok && imgData.imageUrl) {
              target.imageUrl = imgData.imageUrl;
              target.imageHistory = [
                {
                  url: imgData.imageUrl,
                  size: imageSize,
                  style: artStyle,
                  createdAt: Date.now(),
                },
              ];
            }
          } catch {
            // Keep story creation resilient even if an individual page illustration fails; user can generate it inside the reader
          }
        }
      }

      onStoryCreated(newStory);
      setTopic('');
      setStatusMessage(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create story right now.');
    } finally {
      setIsCreating(false);
      setStatusMessage(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1B18]/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-story-title"
    >
      <div className="w-full max-w-xl rounded-3xl border border-[#DFD5C5] bg-[#FBF8F2] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E5DCCD] pb-4">
          <div>
            <p className="text-xs font-medium text-[#6B6257]">Storybook Studio</p>
            <h2
              id="create-story-title"
              className="font-display mt-0.5 text-2xl font-semibold text-[#1F1B18]"
            >
              Write &amp; Illustrate a New Book
            </h2>
          </div>
          <button
            type="button"
            disabled={isCreating}
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#6B6257] hover:bg-[#EFE7D8] hover:text-[#1F1B18] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={(e) => void handleCreate(e)} className="mt-5 space-y-5">
          <div>
            <label htmlFor="story-topic" className="block text-sm font-semibold text-[#1F1B18]">
              What should this story be about?
            </label>
            <textarea
              id="story-topic"
              rows={3}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., A curious origami crane who travels across a teacup ocean to find her paper fold-maker..."
              className="mt-2 w-full rounded-xl border border-[#D8CEBE] bg-white px-4 py-3 text-sm text-[#1F1B18] placeholder:text-[#8C8174] focus-visible:outline-2 focus-visible:outline-[#1D4ED8]"
            />

            <div className="mt-2.5 flex flex-wrap gap-2">
              {QUICK_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setTopic(idea)}
                  className="rounded-lg border border-[#E5DCCD] bg-white px-2.5 py-1.5 text-left text-xs text-[#5C5349] transition-colors hover:border-[#1D4ED8] hover:text-[#1F1B18] cursor-pointer"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="age-band" className="block text-xs font-semibold text-[#5C5349]">
                Age Group
              </label>
              <select
                id="age-band"
                value={ageBand}
                onChange={(e) => setAgeBand(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D8CEBE] bg-white px-3 py-2 text-sm text-[#1F1B18]"
              >
                <option value="Ages 3–5">Ages 3–5</option>
                <option value="Ages 5–8">Ages 5–8</option>
                <option value="Ages 8–10">Ages 8–10</option>
              </select>
            </div>

            <div>
              <label htmlFor="page-count" className="block text-xs font-semibold text-[#5C5349]">
                Pages
              </label>
              <select
                id="page-count"
                value={pageCount}
                onChange={(e) => setPageCount(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-[#D8CEBE] bg-white px-3 py-2 text-sm text-[#1F1B18]"
              >
                <option value={3}>3 Pages</option>
                <option value={4}>4 Pages</option>
                <option value={5}>5 Pages</option>
                <option value={6}>6 Pages</option>
              </select>
            </div>

            <div>
              <label htmlFor="create-art-style" className="block text-xs font-semibold text-[#5C5349]">
                Art Medium
              </label>
              <select
                id="create-art-style"
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D8CEBE] bg-white px-3 py-2 text-sm text-[#1F1B18]"
              >
                {ART_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5DCCD] bg-white px-4 py-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1F1B18] cursor-pointer">
              <input
                type="checkbox"
                checked={autoIllustrateAll}
                onChange={(e) => setAutoIllustrateAll(e.target.checked)}
                className="h-4 w-4 rounded accent-[#B45309]"
              />
              Generate artwork for every page automatically
            </label>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#6B6257]">Size</span>
              <div className="inline-flex rounded-lg bg-[#F3ECE0] p-0.5">
                {(['1K', '2K', '4K'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setImageSize(sz)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                      imageSize === sz
                        ? 'bg-white text-[#1F1B18] shadow-xs'
                        : 'text-[#6B6257] hover:text-[#1F1B18]'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#F5C2C0] bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isCreating}
              onClick={onClose}
              className="rounded-lg border border-[#D8CEBE] bg-white px-4 py-2 text-sm font-semibold text-[#5C5349] hover:bg-[#F3ECE0] disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !topic.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {statusMessage || 'Creating Book...'}
                </>
              ) : (
                'Create Storybook'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
