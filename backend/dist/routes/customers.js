"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const tenantScope_1 = require("../middleware/tenantScope");
const customerController_1 = require("../controllers/customerController");
const router = (0, express_1.Router)();
// Public route — no auth (customer clicking unsubscribe from email)
router.post('/unsubscribe', customerController_1.unsubscribeCustomer);
router.use(auth_1.authMiddleware);
router.use(tenantScope_1.tenantScopeGuard);
router.get('/', customerController_1.listCustomers);
router.get('/:id', customerController_1.getCustomer);
exports.default = router;
