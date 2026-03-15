import { Request, Response } from 'express';
export declare const listTeamMembers: (req: Request, res: Response) => Promise<void>;
export declare const inviteMember: (req: Request, res: Response) => Promise<void>;
export declare const updateMemberRole: (req: Request, res: Response) => Promise<void>;
export declare const revokeMember: (req: Request, res: Response) => Promise<void>;
export declare const validateInvitation: (req: Request, res: Response) => Promise<void>;
export declare const acceptInvitation: (req: Request, res: Response) => Promise<void>;
