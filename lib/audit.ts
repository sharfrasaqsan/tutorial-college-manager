import { adminDb } from "./firebase-admin.ts";

export interface AuditLogEntry {
  who: string;
  role: "owner" | "teacher" | "system";
  action: string;
  entity: "session" | "correctionRequest" | "timetableSlot" | "fee" | "admissionFee" | "salary" | "invoice";
  entityId: string;
  before: any;
  after: any;
  when: string;
  yearId: string;
  metadata?: Record<string, any>;
}

/**
 * Writes an auditLog entry to `years/{yearId}/auditLog`.
 * If a Firestore transaction is provided, the write is executed inside that transaction.
 */
export async function recordAuditLog(
  entry: Omit<AuditLogEntry, "when">,
  transaction?: FirebaseFirestore.Transaction
): Promise<void> {
  const when = new Date().toISOString();
  const logDoc: AuditLogEntry = {
    ...entry,
    when,
  };

  const auditCol = adminDb
    .collection("years")
    .doc(entry.yearId)
    .collection("auditLog");

  if (transaction) {
    const newRef = auditCol.doc();
    transaction.set(newRef, logDoc);
  } else {
    await auditCol.add(logDoc);
  }

  console.log(
    `[AuditLog] ${logDoc.role} (${logDoc.who}) performed ${logDoc.action} on ${logDoc.entity} ${logDoc.entityId}`
  );
}
