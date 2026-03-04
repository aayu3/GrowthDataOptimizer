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
        self.postMessage({ type: 'DONE', results });
    } catch (error: any) {
        self.postMessage({ type: 'ERROR', message: error.message });
    }
};
