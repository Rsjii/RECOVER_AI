import { UserRow } from '../types/database';
export interface CreateUserInput {
    companyId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    role?: string;
}
export declare function createUser(input: CreateUserInput): Promise<UserRow>;
export declare function findUserByEmail(email: string): Promise<UserRow | null>;
export declare function findUserById(id: string): Promise<UserRow | null>;
export declare function findUserWithCompany(userId: string): Promise<any>;
export declare function findUserWithCompanyByEmail(email: string): Promise<any>;
export declare function updateLastLogin(userId: string): Promise<void>;
export declare function updateUser(userId: string, updates: Record<string, any>): Promise<UserRow>;
export declare function deactivateUser(userId: string): Promise<void>;
export declare function setResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
export declare function findUserByResetToken(token: string): Promise<UserRow | null>;
export declare function updatePassword(userId: string, passwordHash: string): Promise<void>;
export declare function clearResetToken(userId: string): Promise<void>;
