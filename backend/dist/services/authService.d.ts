import { SignupInput, LoginInput, AuthResponse } from '../types/auth';
declare class AuthService {
    signup(input: SignupInput): Promise<AuthResponse>;
    login(input: LoginInput): Promise<AuthResponse>;
    refreshToken(refreshToken: string, metadata?: {
        userAgent?: string;
        ipAddress?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    getCurrentUser(userId: string): Promise<AuthResponse['user'] & {
        company: AuthResponse['company'];
    }>;
    private generateTokens;
    requestPasswordReset(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
    googleLogin(code: string): Promise<AuthResponse>;
}
export declare const authService: AuthService;
export {};
