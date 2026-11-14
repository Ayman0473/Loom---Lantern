import { useEffect, useState } from 'react';
import { CreateStoryModal } from './components/CreateStoryModal';
import { StoryBuddyChat } from './components/StoryBuddyChat';
import { StorybookSpread } from './components/StorybookSpread';
import { StoryLibrary } from './components/StoryLibrary';
import { TopBar, type ActiveSection } from './components/TopBar';
import { STARTER_STORIES } from './data/starterStories';
import type {
  ChatMessage,
  ChatModelId,
  ImageSize,
  StoryBook,
  VoiceName,
} from './types';

const STORAGE_KEY = 'loom-lantern-stories-v1';

export default function App() {
  const [stories, setStories] = useState<StoryBook[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as StoryBook[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to starter stories
    }
    return STARTER_STORIES;
  });

  const [activeStoryId, setActiveStoryId] = useState<string>(stories[0].id);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [activeSection, setActiveSection] = useState<ActiveSection>('reader');

  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [selectedArtStyle, setSelectedArtStyle] = useState<string>(stories[0].artStyle);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Multi-turn Story Buddy chat state
  const [chatModel, setChatModel] = useState<ChatModelId>('gemini-4-hydrogen');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const activeStory =
    stories.find((s) => s.id === activeStoryId) ?? stories[0];
  const activePage =
    activeStory.pages[currentPageIndex] ?? activeStory.pages[0];

  // Safe localStorage persistence (respects browser storage quota)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch {
      // Ignore quota exceeded errors when storing multiple high-res base64 images
    }
  }, [stories]);

  const handleNavigate = (section: ActiveSection) => {
    setActiveSection(section);
    const idMap: Record<ActiveSection, string> = {
      reader: 'reader-section',
      library: 'library-section',
      buddy: 'buddy-section',
    };
    const el = document.getElementById(idMap[section]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectStory = (storyId: string) => {
    const found = stories.find((s) => s.id === storyId);
    if (!found) return;
    setActiveStoryId(storyId);
    setCurrentPageIndex(0);
    setSelectedArtStyle(found.artStyle);
    handleNavigate('reader');
  };

  const handlePageIllustrated = (
    storyId: string,
    pageId: string,
    imageUrl: string,
    size: ImageSize,
    style: string
  ) => {
    setStories((prev) =>
      prev.map((story) => {
        if (story.id !== storyId) return story;
        return {
          ...story,
          pages: story.pages.map((pg) => {
            if (pg.id !== pageId) return pg;
            const prevHistory = pg.imageHistory ?? [];
            return {
              ...pg,
              imageUrl,
              imageHistory: [
                ...prevHistory,
                { url: imageUrl, size, style, createdAt: Date.now() },
              ].slice(-6),
            };
          }),
        };
      })
    );
  };

  const handleSelectSavedIllustration = (
    storyId: string,
    pageId: string,
    imageUrl: string
  ) => {
    setStories((prev) =>
      prev.map((story) => {
        if (story.id !== storyId) return story;
        return {
          ...story,
          pages: story.pages.map((pg) =>
            pg.id === pageId ? { ...pg, imageUrl } : pg
          ),
        };
      })
    );
  };

  const handleStoryCreated = (newStory: StoryBook) => {
    setStories((prev) => [newStory, ...prev]);
    setActiveStoryId(newStory.id);
    setCurrentPageIndex(0);
    setSelectedArtStyle(newStory.artStyle);
    handleNavigate('reader');
  };

  const handleSendChat = async (text: string, modelOverride?: ChatModelId) => {
    const modelToUse = modelOverride ?? chatModel;
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    const historySnapshot = chatMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setChatMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          message: text,
          history: historySnapshot,
          storyContext: {
            title: activeStory.title,
            pageNumber: activePage.pageNumber,
            totalPages: activeStory.pages.length,
            pageHeading: activePage.heading,
            pageText: activePage.text,
          },
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        model?: ChatModelId;
        roleLabel?: string;
        error?: string;
      };

      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Story Buddy could not respond right now.');
      }

      const buddyMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.reply,
        model: data.model || modelToUse,
        roleLabel: data.roleLabel || 'Story Buddy',
        timestamp: Date.now(),
      };

      setChatMessages((prev) => [...prev, buddyMsg]);
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Unable to reach Story Buddy right now.'
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleAskBuddyFromPage = (question: string) => {
    handleNavigate('buddy');
    void handleSendChat(question, chatModel);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F2] text-[#1F1B18]">
      <TopBar
        activeSection={activeSection}
        onNavigate={handleNavigate}
        onOpenCreateStory={() => setIsCreateOpen(true)}
      />

      <main>
        <StorybookSpread
          story={activeStory}
          currentPageIndex={currentPageIndex}
          onPageChange={setCurrentPageIndex}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
          selectedArtStyle={selectedArtStyle}
          onArtStyleChange={setSelectedArtStyle}
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          onPageIllustrated={handlePageIllustrated}
          onSelectSavedIllustration={handleSelectSavedIllustration}
          onAskBuddy={handleAskBuddyFromPage}
        />

        <StoryBuddyChat
          story={activeStory}
          currentPage={activePage}
          selectedVoice={selectedVoice}
          messages={chatMessages}
          activeModel={chatModel}
          onModelChange={setChatModel}
          onSendMessage={handleSendChat}
          onClearHistory={() => {
            setChatMessages([]);
            setChatError(null);
          }}
          isSending={isSendingChat}
          chatError={chatError}
        />

        <StoryLibrary
          stories={stories}
          activeStoryId={activeStory.id}
          onSelectStory={handleSelectStory}
          onOpenCreateStory={() => setIsCreateOpen(true)}
        />
      </main>

      <footer className="border-t border-[#E5DCCD] bg-[#F6F1E7] py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 text-xs text-[#6B6257]">
          <p className="font-display text-sm font-medium text-[#1F1B18]">
            Loom &amp; Lantern
          </p>
          <p>
            Read-aloud picture books with page-by-page illustration studio and reading companion.
          </p>
        </div>
      </footer>

      <CreateStoryModal
        isOpen={isCreateOpen}
        defaultImageSize={imageSize}
        defaultArtStyle={selectedArtStyle}
        onClose={() => setIsCreateOpen(false)}
        onStoryCreated={handleStoryCreated}
      />
    </div>
  );
}
