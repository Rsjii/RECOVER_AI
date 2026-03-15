export declare const config: {
    nodeEnv: string;
    port: number;
    databaseUrl: string | undefined;
    redisUrl: string | undefined;
    jwtSecret: string | undefined;
    refreshTokenSecret: string | undefined;
    encryptionKey: string | undefined;
    adminSecret: string | undefined;
    frontendUrl: string | undefined;
    stripe: {
        apiKey: string | undefined;
        clientId: string | undefined;
        clientSecret: string | undefined;
        webhookSecret: string | undefined;
    };
    quickbooks: {
        clientId: string | undefined;
        clientSecret: string | undefined;
        environment: "sandbox" | "production";
    };
    resend: {
        apiKey: string | undefined;
        fromEmail: string;
    };
    lemonSqueezy: {
        apiKey: string | undefined;
        storeId: string | undefined;
        webhookSecret: string | undefined;
    };
    sendgrid: {
        apiKey: string | undefined;
        fromEmail: string;
        fromName: string;
    };
    anthropic: {
        apiKey: string | undefined;
        model: string;
    };
    openai: {
        apiKey: string | undefined;
        model: string;
    };
    google: {
        clientId: string | undefined;
        clientSecret: string | undefined;
    };
    slack: {
        webhookUrl: string | undefined;
    };
    baseUrl: string;
};
