import { evaluateDpsForBuilds, DamageType, AttackMode } from '../utils/buildUtils';
import { Relic } from '../optimizer/types';

self.onmessage = (e: MessageEvent) => {
    const {
        rawResults,
        filteredIndices,
        optimizedRelics,
        stats,
        ignoredSkills,
        ignoredPassives,
        damageType,
        attackMode,
        selectedDoll
    } = e.data as {
        rawResults: Uint32Array;
        filteredIndices: Uint32Array;
        optimizedRelics: Relic[];
        stats: any;
        ignoredSkills: string[];
        ignoredPassives: string[];
        damageType: DamageType;
        attackMode: AttackMode;
        selectedDoll?: string;
    };

    try {
        const dpsArray = evaluateDpsForBuilds(
            rawResults,
            filteredIndices,
            optimizedRelics,
            stats,
            ignoredSkills,
            damageType,
            attackMode,
            selectedDoll,
            ignoredPassives
        );

        (self as unknown as Worker).postMessage({ type: 'DONE', dpsArray }, [dpsArray.buffer]);
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', message: error.message });
    }
};
