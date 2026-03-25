import { useState } from 'react';
import { useMessContext } from '@/context/MessContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, IndianRupee } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const TrayControls = () => {
  const { group, createNewTray, members, pricePerEgg } = useMessContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleStartNewTray = async () => {
    const p = parseFloat(newPrice);
    if (!isNaN(p) && p > 0) {
      setIsCreating(true);
      await createNewTray(p);
      setIsCreating(false);
      setIsDialogOpen(false);
      setNewPrice('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Group header */}
      <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-display font-bold text-foreground mb-1">{group.name}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center">
            <IndianRupee className="h-3.5 w-3.5" />
            <span>{group.trayPrice || '0'} / tray</span>
          </div>
          <span className="mx-1">·</span>
          <div className="flex items-center">
            <IndianRupee className="h-3.5 w-3.5" />
            <span>{pricePerEgg.toFixed(1)} / egg</span>
          </div>
          <span className="mx-1">·</span>
          <span>{members.length} members</span>
        </div>
      </div>

      {/* New Tray Button */}
      <Button variant="outline" onClick={() => setIsDialogOpen(true)} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        New Tray
      </Button>

      {/* New Tray Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Tray</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tray Price (₹)</label>
              <Input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                type="number"
                placeholder="Enter tray price"
                autoFocus
                disabled={isCreating}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Once you create this tray, the price will be immutable until the next tray. This will reset all currently eaten eggs.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isCreating} onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button disabled={isCreating} onClick={handleStartNewTray}>
              {isCreating ? 'Creating...' : 'Create Tray'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrayControls;
