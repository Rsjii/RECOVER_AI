import { CompanyRow } from '../types/database';
export interface CreateCompanyInput {
    name: string;
    email: string;
    timezone?: string;
    preferredCurrency?: string;
}
export declare function createCompany(input: CreateCompanyInput): Promise<CompanyRow>;
export declare function findCompanyByEmail(email: string): Promise<CompanyRow | null>;
export declare function findCompanyById(companyId: string): Promise<CompanyRow | null>;
export declare function setCompanyOwner(companyId: string, userId: string): Promise<void>;
export declare function updateCompany(companyId: string, updates: Record<string, any>): Promise<CompanyRow>;
