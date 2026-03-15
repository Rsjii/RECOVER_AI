export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export declare function ensureOwnerMembership(companyId: string, userId: string): Promise<void>;
export declare function listMembers(companyId: string): Promise<any[]>;
export declare function updateMemberRole(companyId: string, userId: string, role: TeamRole): Promise<void>;
export declare function revokeMember(companyId: string, userId: string): Promise<void>;
export declare function createInvitation(input: {
    companyId: string;
    email: string;
    role: TeamRole;
    invitedByUserId: string;
    expiresAt: Date;
}): Promise<{
    token: string;
}>;
export declare function listInvitations(companyId: string): Promise<any[]>;
