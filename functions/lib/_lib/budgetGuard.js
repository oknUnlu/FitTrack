"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBudget = checkBudget;
const usageLogger_1 = require("./usageLogger");
const DEFAULT_MONTHLY_LIMIT = 10000;
async function checkBudget() {
    try {
        const limit = parseInt(process.env.MONTHLY_BUDGET_LIMIT || '', 10) || DEFAULT_MONTHLY_LIMIT;
        const current = await (0, usageLogger_1.getMonthlyUsage)();
        return current < limit;
    }
    catch (_a) {
        return true; // fail-open for budget check
    }
}
//# sourceMappingURL=budgetGuard.js.map