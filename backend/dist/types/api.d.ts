export interface ApiSuccessResponse<T> {
    message: string;
    data?: T;
}
export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: Record<string, any>;
    requestId?: string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    offset?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface AuthContext {
    userId: string;
    companyId: string;
    email: string;
}
