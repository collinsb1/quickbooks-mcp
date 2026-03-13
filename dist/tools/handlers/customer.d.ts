import QuickBooks from "node-quickbooks";
interface AddressInput {
    line1?: string;
    line2?: string;
    line3?: string;
    line4?: string;
    line5?: string;
    city?: string;
    country_sub_division_code?: string;
    postal_code?: string;
    country?: string;
    lat?: string;
    long?: string;
}
export declare function handleCreateCustomer(client: QuickBooks, args: {
    display_name: string;
    given_name?: string;
    middle_name?: string;
    family_name?: string;
    suffix?: string;
    company_name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    bill_address?: AddressInput;
    ship_address?: AddressInput;
    notes?: string;
    taxable?: boolean;
    parent_ref?: string;
    job?: boolean;
    bill_with_parent?: boolean;
    preferred_delivery_method?: string;
    sales_term_ref?: string;
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleGetCustomer(client: QuickBooks, args: {
    id: string;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export declare function handleEditCustomer(client: QuickBooks, args: {
    id: string;
    display_name?: string;
    given_name?: string;
    middle_name?: string;
    family_name?: string;
    suffix?: string;
    company_name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    bill_address?: AddressInput;
    ship_address?: AddressInput;
    notes?: string;
    taxable?: boolean;
    active?: boolean;
    parent_ref?: string;
    job?: boolean;
    bill_with_parent?: boolean;
    preferred_delivery_method?: string;
    sales_term_ref?: string;
    draft?: boolean;
}): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
export {};
//# sourceMappingURL=customer.d.ts.map