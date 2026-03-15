import { Queue, Worker } from 'bullmq';
import { DunningEmailJob } from '../types/email';
export declare function getRedisConnection(): {
    host: string;
    port: number;
    password: string | undefined;
    tls: {} | undefined;
    maxRetriesPerRequest: null;
};
export declare function getDunningQueue(): Queue<DunningEmailJob>;
export declare function scheduleDunningEmails(invoiceId: string, companyId: string): Promise<number>;
export declare function queueEmailNow(job: DunningEmailJob): Promise<string>;
export declare function startDunningWorker(): Worker<DunningEmailJob>;
export declare function stopDunningWorker(): Promise<void>;
