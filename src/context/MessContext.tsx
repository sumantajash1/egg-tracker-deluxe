import React, { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export interface Member {
  id: string;
  name: string;
  color: string;
  pattern: 'striped' | 'dotted';
  eggsEaten: number;
  role: 'admin' | 'member';
}

export interface Egg {
  index: number;
  consumed: boolean;
  ownerId: string | null;
  isPending?: boolean;
}

export interface Group {
  id: string;
  name: string;
  trayPrice: number;
}

export interface EatEvent {
  memberId: string;
  eggIndex: number;
  timestamp: number;
}

interface MessContextType {
  group: Group;
  members: Member[];
  eggs: Egg[];
  currentUserId: string;
  setTrayPrice: (price: number) => void;
  removeMember: (id: string) => void;
  incrementEgg: (memberId: string) => void;
  decrementEgg: (memberId: string) => void;
  confirmEgg: (eggIndex: number) => void;
  resetTray: () => void;
  pricePerEgg: number;
  lastEatEvent: EatEvent | null;
  createNewTray: (price: number) => Promise<void>;
}

const MEMBER_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#f97316', // orange
  '#ef4444', // red
  '#000000', // black
  '#8b4513', // brown
  '#6b7280', // gray
  '#ec4899'  // pink
];

const createInitialEggs = (): Egg[] =>
  Array.from({ length: 30 }, (_, i) => ({ index: i, consumed: false, ownerId: null }));

const MessContext = createContext<MessContextType | null>(null);

export const useMessContext = () => {
  const ctx = useContext(MessContext);
  if (!ctx) throw new Error('useMessContext must be used within MessProvider');
  return ctx;
};

export const MessProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [group, setGroup] = useState<Group>({ id: '', name: 'My Mess', trayPrice: 0 });
  const [members, setMembers] = useState<Member[]>([]);
  const [eggs, setEggs] = useState<Egg[]>(createInitialEggs);
  const [lastEatEvent, setLastEatEvent] = useState<EatEvent | null>(null);

  const currentUserId = user?.id || '';

  const pricePerEgg = group.trayPrice > 0 ? group.trayPrice / 30 : 0;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Fetch profiles
        const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
        if (pError) throw pError;

        // 2. Fetch the latest tray
        const { data: tray, error: tError } = await supabase
          .from('egg_tray')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let consumptionMap: Record<string, number> = {};

        // 3. If a tray exists, load its consumption
        if (tray) {
          setGroup(g => ({ ...g, trayPrice: Number(tray.price), id: tray.id }));

          const { data: consumptions } = await supabase
            .from('tray_consumption')
            .select('*')
            .eq('tray_id', tray.id);

          if (consumptions) {
            consumptions.forEach((c: any) => {
              consumptionMap[c.user_id] = c.eggs_consumed;
            });
          }
        }

        // 4. Combine everything into state
        if (profiles) {
          const fetchedMembers: Member[] = profiles.map((p: any, i: number) => ({
            id: p.id,
            name: p.name || p.email.split('@')[0],
            color: MEMBER_COLORS[i % MEMBER_COLORS.length],
            pattern: 'striped',
            eggsEaten: consumptionMap[p.id] || 0,
            role: p.id === currentUserId ? 'admin' : 'member'
          }));
          setMembers(fetchedMembers);

          if (tray) {
            let initial = createInitialEggs();
            // Iterate members to randomly allocate visual eggs corresponding to their consumption count
            fetchedMembers.forEach(m => {
              for (let i = 0; i < m.eggsEaten; i++) {
                const availableEggs = initial.filter(e => !e.consumed);
                if (availableEggs.length === 0) break;

                const randomEgg = availableEggs[Math.floor(Math.random() * availableEggs.length)];
                randomEgg.consumed = true;
                randomEgg.ownerId = m.id;
              }
            });
            setEggs(initial);
          }
        }
      } catch (e) {
        console.error("Supabase app init failed", e);
      }
    };

    fetchInitialData();
  }, [currentUserId]);

  const setTrayPrice = useCallback((price: number) => {
    setGroup(g => ({ ...g, trayPrice: price }));
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers(m => m.filter(mb => mb.id !== id));
    setEggs(eggs => eggs.map(e => e.ownerId === id ? { ...e, consumed: false, ownerId: null } : e));
  }, []);

  const incrementEgg = useCallback(async (memberId: string) => {
    let newCount = 0;
    setEggs(prev => {
      const availableEggs = prev.filter(e => !e.consumed);
      if (availableEggs.length === 0) return prev;
      const randomEgg = availableEggs[Math.floor(Math.random() * availableEggs.length)];

      setLastEatEvent({ memberId, eggIndex: randomEgg.index, timestamp: Date.now() });

      return prev.map(e =>
        e.index === randomEgg.index ? { ...e, consumed: true, ownerId: memberId, isPending: true } : e
      );
    });
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        newCount = m.eggsEaten + 1;
        return { ...m, eggsEaten: newCount };
      }
      return m;
    }));

    // Sync to DB
    try {
      const { data: tray } = await supabase
        .from('egg_tray')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tray) {
        const { data: existingRecord } = await supabase
          .from('tray_consumption')
          .select('*')
          .eq('tray_id', tray.id)
          .eq('user_id', memberId)
          .maybeSingle();

        if (existingRecord) {
          await supabase
            .from('tray_consumption')
            .update({ eggs_consumed: newCount })
            .eq('tray_id', tray.id)
            .eq('user_id', memberId);
        } else {
          await supabase
            .from('tray_consumption')
            .insert({
              tray_id: tray.id,
              user_id: memberId,
              eggs_consumed: newCount
            });
        }
      }
    } catch (e) {
      console.error("Failed to commit increment to db:", e);
    }
  }, []);

  const decrementEgg = useCallback(async (memberId: string) => {
    let newCount = 0;
    setEggs(prev => {
      const memberEggs = prev.filter(e => e.ownerId === memberId);
      if (memberEggs.length === 0) return prev;
      const lastEgg = memberEggs[memberEggs.length - 1];
      return prev.map(e =>
        e.index === lastEgg.index ? { ...e, consumed: false, ownerId: null, isPending: false } : e
      );
    });
    setMembers(prev => prev.map(m => {
      if (m.id === memberId) {
        newCount = Math.max(0, m.eggsEaten - 1);
        return { ...m, eggsEaten: newCount };
      }
      return m;
    }));

    // Sync to DB
    try {
      const { data: tray } = await supabase
        .from('egg_tray')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (tray) {
        const { data: existingRecord } = await supabase
          .from('tray_consumption')
          .select('*')
          .eq('tray_id', tray.id)
          .eq('user_id', memberId)
          .maybeSingle();

        if (existingRecord) {
          await supabase
            .from('tray_consumption')
            .update({ eggs_consumed: newCount })
            .eq('tray_id', tray.id)
            .eq('user_id', memberId);
        } else {
          await supabase
            .from('tray_consumption')
            .insert({
              tray_id: tray.id,
              user_id: memberId,
              eggs_consumed: newCount
            });
        }
      }
    } catch (e) {
      console.error("Failed to commit decrement to db:", e);
    }
  }, []);

  const confirmEgg = useCallback((eggIndex: number) => {
    setEggs(prev => prev.map(e => e.index === eggIndex ? { ...e, isPending: false } : e));
  }, []);

  const resetTray = useCallback(() => {
    setEggs(createInitialEggs());
    setMembers(prev => prev.map(m => ({ ...m, eggsEaten: 0 })));
    setLastEatEvent(null);
  }, []);

  const createNewTray = useCallback(async (price: number) => {
    try {
      const { data: newTray, error: trayError } = await supabase
        .from('egg_tray')
        .insert({ price, eggs_remaining: 30 })
        .select()
        .single();

      if (trayError) {
        console.error("Failed to create tray:", trayError);
        return;
      }

      if (newTray && members.length > 0) {
        const consumptionData = members.map(member => ({
          tray_id: newTray.id,
          user_id: member.id,
          eggs_consumed: 0
        }));

        const { error: consumptionError } = await supabase
          .from('tray_consumption')
          .insert(consumptionData);

        if (consumptionError) {
          console.error("Failed to create consumption records:", consumptionError);
        }
      }

      setGroup(g => ({ ...g, trayPrice: price }));
      resetTray();
    } catch (error) {
      console.error("Error creating new tray:", error);
    }
  }, [members, resetTray]);

  return (
    <MessContext.Provider value={{
      group, members, eggs, currentUserId,
      setTrayPrice, removeMember,
      incrementEgg, decrementEgg, confirmEgg, resetTray, pricePerEgg,
      lastEatEvent, createNewTray,
    }}>
      {children}
    </MessContext.Provider>
  );
};
