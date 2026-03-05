import { RelicSolver } from '../optimizer/solver';
import { Relic, OptimizerConstraints, SkillDefinition } from '../optimizer/types';

self.onmessage = (e: MessageEvent) => {
    const { relics, constraints, skillsData, relicInfo, partition } = e.data as {
        relics: Relic[];
        constraints: OptimizerConstraints;
        skillsData: Record<string, SkillDefinition>;
        relicInfo: any;
        partition?: { id: number, total: number };
    };

    try {
        const solver = new RelicSolver(relics, constraints, skillsData, relicInfo);
        const results = solver.solve(partition);
        // Transfer the underlying ArrayBuffer ownership directly to the main thread
        // This is instant and takes 0 memory allocation time
        (self as unknown as Worker).postMessage({ type: 'DONE', results }, [results.buffer.buffer]);
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', message: error.message });
    }
};
