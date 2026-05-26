type InviteEmailTemplateParams = {
  ownerName: string;
  tenantEmail: string;
  inviteUrl: string;
  propertyName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
};

export const buildTenantInviteEmail = ({
  ownerName,
  tenantEmail,
  inviteUrl,
  propertyName,
  roomNumber,
  bedNumber
}: InviteEmailTemplateParams) => {
  const propertyLine = [propertyName, roomNumber ? `Room ${roomNumber}` : null, bedNumber ? `Bed ${bedNumber}` : null]
    .filter(Boolean)
    .join(' · ');

  const html = `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;padding:32px 16px">
        <div style="background:linear-gradient(135deg,#2563eb 0%,#0ea5e9 55%,#10b981 100%);border-radius:24px;padding:28px;color:#fff;box-shadow:0 20px 40px rgba(37,99,235,.18)">
          <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9">Property Manager</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.1;font-weight:800">Complete your tenant profile</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.7;max-width:540px;opacity:.95">
            ${ownerName} has invited you to review your profile and securely link it to your property allocation.
          </p>
        </div>

        <div style="margin-top:20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 12px 24px rgba(15,23,42,.06)">
          <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#64748b">Invitation details</div>
          <div style="margin-top:14px;padding:16px;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0">
            <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em">Send to</div>
            <div style="margin-top:4px;font-size:15px;font-weight:700;color:#0f172a">${tenantEmail}</div>
          </div>

          <div style="margin-top:14px;padding:16px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe">
            <div style="font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.08em">Property allocation</div>
            <div style="margin-top:4px;font-size:14px;font-weight:600;color:#0f172a">${propertyLine || 'No allocation selected yet'}</div>
          </div>

          <div style="margin-top:20px;text-align:center">
            <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:800;box-shadow:0 10px 20px rgba(37,99,235,.22)">Open Secure Invitation</a>
          </div>

          <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#475569;text-align:center">
            This secure link is tied to your tenant record and expires in 72 hours.
          </p>
        </div>

        <div style="padding:18px 8px 4px;text-align:center;color:#94a3b8;font-size:12px">
          Sent by ${ownerName}. If you were not expecting this invitation, you can ignore this email.
        </div>
      </div>
    </div>`;

  const text = [
    'Complete your tenant profile',
    `Sent to: ${tenantEmail}`,
    `Allocation: ${propertyLine || 'No allocation selected yet'}`,
    `Open invitation: ${inviteUrl}`,
    'This link expires in 72 hours.'
  ].join('\n\n');

  return { html, text };
};