type AdditionalCharge = {
  description: string;
  amount: number;
};

type RentBillEmailTemplateParams = {
  tenantName: string;
  ownerName: string;
  email: string;
  monthName: string;
  baseRent: number;
  additionalCharges: AdditionalCharge[];
  totalAmount: number;
  paymentId: string;
};

export const buildRentBillEmail = ({
  tenantName,
  ownerName,
  email,
  monthName,
  baseRent,
  additionalCharges,
  totalAmount,
  paymentId
}: RentBillEmailTemplateParams) => {
  const chargesListHtml = additionalCharges.map(charge => `
    <div style="display:flex;justify-content:between;margin-top:10px;padding:8px 0;border-bottom:1px dashed #e2e8f0;font-size:14px;color:#475569">
      <div style="flex:1">${charge.description}</div>
      <div style="font-weight:700;color:#0f172a;text-align:right">₹${charge.amount.toLocaleString('en-IN')}</div>
    </div>
  `).join('');

  const html = `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px">
        <div style="background:linear-gradient(135deg,#2563eb 0%,#0ea5e9 55%,#10b981 100%);border-radius:24px;padding:28px;color:#fff;box-shadow:0 20px 40px rgba(37,99,235,.18)">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9">Rent Invoice</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.1;font-weight:800">Monthly Bill - ${monthName}</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.7;max-width:540px;opacity:.95">
            Hello ${tenantName}, your landlord ${ownerName} has generated your rent bill for the month of ${monthName}. Please review the details below.
          </p>
        </div>

        <div style="margin-top:20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 12px 24px rgba(15,23,42,.06)">
          <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#64748b;margin-bottom:12px">Bill Breakdown</div>
          
          <!-- Base Rent -->
          <div style="display:flex;justify-content:between;padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:15px;color:#0f172a;font-weight:600">
            <div style="flex:1">Base Rent</div>
            <div style="font-weight:800;text-align:right">₹${baseRent.toLocaleString('en-IN')}</div>
          </div>

          <!-- Additional Charges -->
          ${additionalCharges.length > 0 ? `
            <div style="margin-top:16px">
              <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8">Additional Charges / Fines</div>
              ${chargesListHtml}
            </div>
          ` : ''}

          <!-- Total Due -->
          <div style="margin-top:20px;padding:18px;border-radius:18px;background:#f0fdf4;border:1px solid #bbf7d0;display:flex;justify-content:between;align-items:center">
            <div>
              <div style="font-size:12px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:.08em">Total Amount Due</div>
              <div style="font-size:10px;color:#166534;margin-top:2px">Please pay by the 5th of the month</div>
            </div>
            <div style="font-size:24px;font-weight:900;color:#166534;text-align:right">₹${totalAmount.toLocaleString('en-IN')}</div>
          </div>

          <div style="margin-top:24px;text-align:center">
            <span style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:14px;font-size:13px;font-weight:800;box-shadow:0 8px 16px rgba(37,99,235,.2)">Invoice Ref: ${paymentId.substring(18)}</span>
          </div>
        </div>

        <div style="padding:18px 8px 4px;text-align:center;color:#94a3b8;font-size:12px">
          Sent on behalf of ${ownerName} by Property Manager portal.
        </div>
      </div>
    </div>`;

  const chargesListText = additionalCharges.map(c => `- ${c.description}: ₹${c.amount}`).join('\n');
  const text = [
    `Monthly Rent Bill - ${monthName}`,
    `Hello ${tenantName},`,
    `Here is your rent bill details:`,
    `Base Rent: ₹${baseRent}`,
    additionalCharges.length > 0 ? `Additional Charges:\n${chargesListText}` : '',
    `Total Amount Due: ₹${totalAmount}`,
    `Please clear your dues by the 5th of the month.`,
    `Invoice Ref: ${paymentId}`
  ].filter(Boolean).join('\n\n');

  return { html, text };
};
