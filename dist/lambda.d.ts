interface APIGatewayEvent {
    httpMethod?: string;
    path?: string;
    queryStringParameters?: Record<string, string | undefined> | null;
    requestContext?: {
        http?: {
            method: string;
            path: string;
        };
        stage?: string;
    };
    headers: Record<string, string | undefined>;
    body?: string;
    isBase64Encoded?: boolean;
}
interface APIGatewayResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    isBase64Encoded: boolean;
}
export declare function handler(event: APIGatewayEvent): Promise<APIGatewayResult>;
export {};
//# sourceMappingURL=lambda.d.ts.map