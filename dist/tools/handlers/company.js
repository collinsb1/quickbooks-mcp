// Handler for get_company_info tool
import { promisify, getCompanyIdValue } from "../../client/index.js";
export async function handleGetCompanyInfo(client) {
    const companyId = getCompanyIdValue();
    const result = await promisify((cb) => client.getCompanyInfo(companyId, cb));
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
}
//# sourceMappingURL=company.js.map