function buildPayloads(td) {
  const goodCustomer = td.customers?.[0];
  const lateCustomer = td.customers?.[1];
  const invoice0 = td.invoices?.[0];
  const invoice4 = td.invoices?.[4];

  return {
    loginBody: { email: td.email, password: td.password },
    badLoginBody: { email: td.email, password: 'WrongPass123!' },
    signupConflictBody: {
      companyName: td.companyName,
      email: td.email,
      password: td.password,
    },

    riskAlice: { customerId: goodCustomer?.id },

    emailNegative: {
      customerId: lateCustomer?.id,
      invoiceId: invoice4?.id,
      customerName: 'Bob Smith',
      invoiceAmount: -10,
      dueDate: new Date().toISOString().slice(0, 10),
      daysOverdue: 10,
    },
    emailValid: {
      customerId: lateCustomer?.id,
      invoiceId: invoice4?.id,
      customerName: 'Bob Smith',
      invoiceAmount: 2500,
      dueDate: '2026-01-19',
      daysOverdue: 45,
      riskScore: 82,
      previousReminders: 2,
      companyName: td.companyName,
      paymentLink: 'https://pay.recoverai.test/inv-005',
    },
    planZero: {
      customerId: lateCustomer?.id,
      invoiceId: invoice4?.id,
      invoiceAmount: 0,
      daysOverdue: 45,
    },
    planValid: {
      customerId: lateCustomer?.id,
      invoiceId: invoice4?.id,
      invoiceAmount: 2500,
      daysOverdue: 45,
      riskScore: 82,
      maxDurationDays: 90,
    },

    emailSchedule: { invoiceId: invoice4?.id },
    emailSendNow: { invoiceId: invoice4?.id, emailType: 'dunning_1' },
    sendgridDelivered: [
      {
        email: lateCustomer?.email || 'customer@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        event: 'delivered',
        sg_message_id: 'fake-msg-id-123',
      },
    ],

    refs: {
      lateCustomerId: lateCustomer?.id,
      invoice0Id: invoice0?.id,
      invoice4Id: invoice4?.id,
    },
  };
}

module.exports = { buildPayloads };

