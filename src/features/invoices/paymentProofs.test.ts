import { describe, expect, it } from "vitest";
import { validatePaymentProof } from "./paymentProofValidation";

describe("validatePaymentProof", () => {
  it("accepts supported files within the size limit", () => {
    const file = new File(["invoice"], "proof.pdf", { type: "application/pdf" });
    expect(() => validatePaymentProof(file)).not.toThrow();
  });

  it("rejects unsupported file types", () => {
    const file = new File(["script"], "proof.svg", { type: "image/svg+xml" });
    expect(() => validatePaymentProof(file)).toThrow(/JPG, PNG, WEBP/);
  });

  it("rejects files larger than 10 MB", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proof.pdf", { type: "application/pdf" });
    expect(() => validatePaymentProof(file)).toThrow(/10 MB/);
  });
});
