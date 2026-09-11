/**
 * [BLOCKED: ADQ-004] Dev-only mock verifier standing in for real platform in-app-
 * purchase receipt verification (Apple/Google, research.md §10). Every caller depends
 * only on this shape — swapping in the approved server-side receipt verification is a
 * single binding change (constitution §5); production purchase/subscription endpoints
 * MUST NOT accept a purchase through this mock.
 */
export interface PaymentVerifier {
  verifyReceipt(receiptToken: string): Promise<{ valid: boolean }>;
}

export class MockPaymentVerifier implements PaymentVerifier {
  async verifyReceipt(receiptToken: string): Promise<{ valid: boolean }> {
    // Dev-only: any non-empty token is "valid". Never used in production.
    return { valid: receiptToken.length > 0 };
  }
}
