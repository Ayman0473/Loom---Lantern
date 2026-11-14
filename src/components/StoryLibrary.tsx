import React from 'react';
import { BookOpen, Plus } from 'lucide-react';
import type { StoryBook } from '../types';

interface StoryLibraryProps {
  stories: StoryBook[];
  activeStoryId: string;
  onSelectStory: (storyId: string) => void;
  onOpenCreateStory: () => void;
}

export const StoryLibrary: React.FC<StoryLibraryProps> = ({
  stories,
  activeStoryId,
  onSelectStory,
  onOpenCreateStory,
}) => {
  return (
    <section
      id="library-section"
      aria-labelledby="library-heading"
      className="mx-auto max-w-7xl px-6 py-12"
    >
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-[#E5DCCD] pb-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-[#6B6257]">
            Picture Book Shelf
          </p>
          <h2
            id="library-heading"
            className="font-display mt-1 text-2xl sm:text-3xl font-semibold text-[#1F1B18] [text-wrap:balance]"
          >
            Choose a story to read &amp; illustrate
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenCreateStory}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-[#D8CEBE] bg-white px-4 py-2 text-sm font-semibold text-[#1F1B18] transition-colors hover:bg-[#F5EFE4] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
        >
          <Plus className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
          Write a New Book
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stories.map((story) => {
          const isSelected = story.id === activeStoryId;
          const coverImage = story.pages.find((p) => p.imageUrl)?.imageUrl;
          const illustratedCount = story.pages.filter((p) => Boolean(p.imageUrl)).length;

          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onSelectStory(story.id)}
              className={`group text-left flex flex-col rounded-2xl border bg-white p-4 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                isSelected
                  ? 'border-[#1D4ED8] shadow-sm ring-1 ring-[#1D4ED8]/20'
                  : 'border-[#E5DCCD] hover:border-[#CBBFA9]'
              }`}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F3ECE0]">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt={`Cover illustration for ${story.title}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F7F1E5] to-[#EAE0CE] px-6 text-center">
                    <BookOpen className="h-8 w-8 text-[#9A7B56]" aria-hidden="true" />
                    <span className="font-display text-base font-medium text-[#5C5349]">
                      {story.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6257] tabular-nums">
                  <span>{story.ageBand}</span>
                  <span aria-hidden="true">·</span>
                  <span>{story.pages.length} pages</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {illustratedCount}/{story.pages.length} illustrated
                  </span>
                </div>

                <h3 className="font-display mt-2 text-xl font-semibold text-[#1F1B18] group-hover:text-[#1D4ED8] transition-colors [text-wrap:balance]">
                  {story.title}
                </h3>

                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#5C5349]">
                  {story.subtitle}
                </p>

                <div className="mt-4 pt-3 border-t border-[#F0E9DC] flex items-center justify-between text-xs font-semibold">
                  <span className="text-[#6B6257] font-normal truncate max-w-[60%]">
                    {story.artStyle}
                  </span>
                  <span className="text-[#1D4ED8] whitespace-nowrap shrink-0">
                    {isSelected ? 'Currently Open' : 'Open Book'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
