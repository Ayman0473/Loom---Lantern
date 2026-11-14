import React from 'react';

export type ActiveSection = 'library' | 'reader' | 'buddy';

interface TopBarProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  onOpenCreateStory: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  onOpenCreateStory,
}) => {
  const navItems: Array<{ id: ActiveSection; label: string }> = [
    { id: 'reader', label: 'Read Book' },
    { id: 'library', label: 'Library' },
    { id: 'buddy', label: 'Story Buddy' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5DCCD] bg-[#FBF8F2]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-line wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('reader')}
          className="font-display text-xl font-semibold tracking-tight text-[#1F1B18] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] rounded"
        >
          Loom &amp; Lantern
        </button>

        {/* Zone 2: Clean single-line nav links */}
        <nav
          aria-label="Primary"
          className="hidden sm:flex items-center gap-7 text-sm font-medium text-[#5C5349]"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer border-b-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] ${
                  isActive
                    ? 'border-[#1D4ED8] text-[#1F1B18] font-semibold'
                    : 'border-transparent hover:text-[#1F1B18] hover:border-[#D5C9B6]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenCreateStory}
            className="rounded-lg bg-[#1D4ED8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E40AF] active:translate-y-px whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
          >
            New Story
          </button>
        </div>
      </div>

      {/* Mobile secondary nav row only on <sm viewports */}
      <nav
        aria-label="Mobile Navigation"
        className="flex sm:hidden items-center justify-center gap-6 border-t border-[#ECE4D7] px-4 py-2 text-xs font-medium text-[#5C5349]"
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors cursor-pointer ${
                isActive ? 'text-[#1D4ED8] font-semibold' : 'text-[#5C5349]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
