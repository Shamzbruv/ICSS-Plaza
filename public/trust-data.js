export const policyVersion = '2026-11-13';
export const reportReasons = {
  delivery: 'Order not received or delayed',
  refunds: 'Return, refund or warranty issue',
  listing: 'Misleading listing or counterfeit goods',
  fraud: 'Suspected fraud or unauthorised payment',
  safety: 'Unsafe or prohibited goods or services',
  abuse: 'Harassment, impersonation or abusive conduct',
  privacy: 'Misuse of personal information',
  rights: 'Intellectual property concern',
  other: 'Other vendor concern'
};
export const reportStatuses = {
  received: 'Received', reviewing: 'Under review', awaiting_customer: 'Waiting for your response',
  awaiting_vendor: 'Waiting for vendor', resolved: 'Resolved', closed: 'Closed'
};
export const reportOutcomes = {
  guidance: 'Guidance or referral provided',
  seller_remedy: 'Vendor remedy confirmed',
  policy_action: 'Platform action taken',
  no_violation: 'No platform breach established',
  insufficient: 'Insufficient information',
  duplicate: 'Duplicate report',
  withdrawn: 'Withdrawn'
};
