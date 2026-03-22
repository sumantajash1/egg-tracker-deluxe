import { useRef } from 'react';
import { MessProvider } from '@/context/MessContext';
import EggTray from '@/components/EggTray';
import MemberPanel from '@/components/MemberPanel';
import TrayControls from '@/components/TrayControls';
import SnakeCanvas from '@/components/SnakeCanvas';
import { Egg } from 'lucide-react';

const Index = () => {
  const trayContainerRef = useRef<HTMLDivElement | null>(null);

  return (
    <MessProvider>
      <div className="h-screen flex flex-col bg-background overflow-hidden relative">
        {/* Full-screen snake layer */}
        <div className="absolute inset-0 z-30 pointer-events-none">
          <SnakeCanvas trayContainerRef={trayContainerRef} />
        </div>

        {/* Header – always visible */}
        <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm z-20">
          <div className="container max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <Egg className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground leading-tight">EggTracker</h1>
              <p className="text-xs text-muted-foreground">Mess egg consumption tracker</p>
            </div>
          </div>
        </header>

        {/* Egg Tray – always visible, never scrolls */}
        <div className="shrink-0 bg-background z-10">
          <div className="container max-w-6xl mx-auto px-4 py-4 flex items-start justify-center">
            <div className="relative w-full max-w-[500px] lg:max-w-[400px]">
              {/* Tray content flows naturally */}
              <div className="relative z-0 flex items-center justify-center py-4">
                <EggTray trayContainerRef={trayContainerRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable area – Members + Controls */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="container max-w-6xl mx-auto px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <MemberPanel />
              <TrayControls />
            </div>
          </div>
        </div>
      </div>
    </MessProvider>
  );
};

export default Index;
