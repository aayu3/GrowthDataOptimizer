import { createContext, useContext, useRef, useEffect, ReactNode } from 'react';
import { Relic } from '../optimizer/types';
import { Formation, db } from '../db/database';

export interface EquippedStateValue {
    allRelics: Relic[];
    getEquipped(dollName: string): Relic[];
    getEquippedDoll(relicId: string): string | null | undefined;
    equip(relicId: string, dollName: string): Promise<void>;
    unequip(relicId: string): Promise<void>;
    setEquipped(relicId: string, value: string | null | undefined): Promise<void>;
}

export const EquippedStateContext = createContext<EquippedStateValue | null>(null);

export function GeneralEquippedStateProvider({ relics, children }: { relics: Relic[]; children: ReactNode }) {
    const value: EquippedStateValue = {
        allRelics: relics,
        getEquipped: (dollName) => relics.filter(r => r.equipped === dollName),
        getEquippedDoll: (relicId) => relics.find(r => r.id === relicId)?.equipped,
        equip: (relicId, dollName) => db.relics.update(relicId, { equipped: dollName }).then(() => {}),
        unequip: (relicId) => db.relics.update(relicId, { equipped: undefined }).then(() => {}),
        setEquipped: (relicId, value) => db.relics.update(relicId, { equipped: value ?? undefined }).then(() => {}),
    };

    return <EquippedStateContext.Provider value={value}>{children}</EquippedStateContext.Provider>;
}

export function FormationEquippedStateProvider({
    formation,
    relics,
    children,
}: {
    formation: Formation;
    relics: Relic[];
    children: ReactNode;
}) {
    // Optimistic ref so sequential equip/unequip calls in a single async handler
    // (e.g. handleEquipBuild) see each other's effects without waiting for the DB round-trip.
    const assignmentsRef = useRef<Record<string, string>>({ ...formation.relicAssignments });

    useEffect(() => {
        assignmentsRef.current = { ...formation.relicAssignments };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formation.id]);

    const persist = async (next: Record<string, string>) => {
        assignmentsRef.current = next;
        await db.formations.update(formation.id, { relicAssignments: next });
    };

    const value: EquippedStateValue = {
        allRelics: relics,
        getEquipped: (dollName) => relics.filter(r => r.id != null && assignmentsRef.current[r.id!] === dollName),
        getEquippedDoll: (relicId) => assignmentsRef.current[relicId] ?? undefined,
        equip: async (relicId, dollName) => {
            await persist({ ...assignmentsRef.current, [relicId]: dollName });
        },
        unequip: async (relicId) => {
            const next = { ...assignmentsRef.current };
            delete next[relicId];
            await persist(next);
        },
        setEquipped: async (relicId, value) => {
            if (value == null) {
                const next = { ...assignmentsRef.current };
                delete next[relicId];
                await persist(next);
            } else {
                await persist({ ...assignmentsRef.current, [relicId]: value });
            }
        },
    };

    return <EquippedStateContext.Provider value={value}>{children}</EquippedStateContext.Provider>;
}

export function useEquippedState(): EquippedStateValue {
    const ctx = useContext(EquippedStateContext);
    if (!ctx) throw new Error('useEquippedState must be used within an EquippedStateProvider');
    return ctx;
}
