import { useMessContext } from '@/context/MessContext';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';

const MemberPanel = () => {
  const { members, incrementEgg, decrementEgg, pricePerEgg, eggs, currentUserId } = useMessContext();
  const totalConsumed = eggs.filter(e => e.consumed).length;
  const trayEmpty = totalConsumed >= 30;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-display font-bold text-foreground">👥 Members</h2>

      <div className="flex flex-col gap-2.5">
        {members.map((member) => {
          const cost = (member.eggsEaten * pricePerEgg).toFixed(1);
          // In shared living, anyone can modify anyone's egg count
          const canModify = true;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 shadow-sm border border-border"
            >
              {/* Color dot */}
              <div
                className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: member.color }}
              />

              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm truncate" style={{ color: member.color }}>
                    {member.name}
                  </span>
                  {member.id === currentUserId && (
                    <span className="text-[10px] font-medium bg-green-500/15 text-green-600 px-1.5 py-0.5 rounded-full">
                      (You)
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">₹{cost}</span>
              </div>

              {/* Counter */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => decrementEgg(member.id)}
                  disabled={!canModify || member.eggsEaten === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <span className="w-6 text-center font-bold text-sm tabular-nums">
                  {member.eggsEaten}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => incrementEgg(member.id)}
                  disabled={!canModify || trayEmpty}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MemberPanel;
