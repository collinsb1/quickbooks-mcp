import QuickBooks from "node-quickbooks";
export declare function handleDeleteEntity(client: QuickBooks, args: {
    entity_type: string;
    id: string;
    confirm?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=delete.d.ts.map